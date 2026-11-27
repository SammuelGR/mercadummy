import { existsSync } from 'node:fs';
import process, { env, loadEnvFile } from 'node:process';

/**
 * Imports the DummyJSON catalog through the admin routes of the API, never writing to the databases directly.
 * Existing categories (`slug`) and products (`externalId`) are left unchanged and counted as skipped,
 * so running it again only creates what is missing. See docs/backend/02-dummyjson-extraction.md.
 */

interface SourceCategory {
  slug: string;
  name: string;
}

interface SourceProduct {
  id: number;
  title: string;
  category: string;
  price: number;
  discountPercentage: number;
  stock: number;
  thumbnail: string;
  [key: string]: unknown;
}

interface ApiResponse {
  status: number;
  body: Record<string, unknown>;
}

interface Tally {
  created: number;
  skipped: number;
  rejected: string[];
}

/** Keys of `details` accepted by the API; everything else from DummyJSON is discarded. */
const detailKeys = [
  'description',
  'rating',
  'brand',
  'sku',
  'weight',
  'dimensions',
  'warrantyInformation',
  'tags',
  'images',
] as const;

class ImportAbortedError extends Error {}

if (existsSync('.env')) {
  loadEnvFile();
}

const apiUrl = (env.CATALOG_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const dummyJsonUrl = (env.DUMMYJSON_URL ?? 'https://dummyjson.com').replace(/\/+$/, '');

try {
  await run();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

async function run(): Promise<void> {
  const email = env.ADMIN_EMAIL;
  const password = env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new ImportAbortedError('Set ADMIN_EMAIL and ADMIN_PASSWORD with the credentials of an admin account.');
  }

  // 1. Fetch and validate everything before sending anything.
  console.log(`Fetching the catalog from ${dummyJsonUrl}...`);
  const categories = parseCategories(await fetchJson(`${dummyJsonUrl}/products/categories`));
  const rawProducts = parseProducts(await fetchJson(`${dummyJsonUrl}/products?limit=0`));

  const problems = validateSource(categories, rawProducts);
  if (problems.length > 0) {
    throw new ImportAbortedError(
      `The source data is invalid; nothing was sent:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`,
    );
  }
  // Every product passed the checks above, so it has the fields of SourceProduct.
  const products = rawProducts as SourceProduct[];
  console.log(`Fetched ${String(categories.length)} categories and ${String(products.length)} products.`);

  // 2. Log in as admin and send the categories, keeping the id of each slug.
  const cookie = await logIn(email, password);
  const categoryIds = new Map<string, string>();
  const categoryTally: Tally = { created: 0, skipped: 0, rejected: [] };

  for (const category of categories) {
    const response = await post('/admin/categories', category, cookie);
    const id = readCreatedOrExistingId(response, 'CATEGORY_ALREADY_EXISTS', categoryTally, `category ${category.slug}`);
    if (id !== undefined) {
      categoryIds.set(category.slug, id);
    }
  }

  // 3. Send each product with the id of its category, one at a time.
  const productTally: Tally = { created: 0, skipped: 0, rejected: [] };

  for (const product of products) {
    const label = `product ${String(product.id)} (${product.title})`;
    const categoryId = categoryIds.get(product.category);
    if (categoryId === undefined) {
      productTally.rejected.push(`${label}: its category ${product.category} was not imported`);
      continue;
    }

    const response = await post('/admin/products', toProductPayload(product, categoryId), cookie);
    readCreatedOrExistingId(response, 'PRODUCT_ALREADY_EXISTS', productTally, label);
  }

  // 4. Report.
  report('Categories', categoryTally);
  report('Products', productTally);
  if (categoryTally.rejected.length > 0 || productTally.rejected.length > 0) {
    process.exitCode = 1;
  }
}

async function fetchJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new ImportAbortedError(`Could not reach ${url}: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!response.ok) {
    throw new ImportAbortedError(`${url} responded ${String(response.status)}.`);
  }
  return response.json();
}

function parseCategories(data: unknown): SourceCategory[] {
  if (!Array.isArray(data)) {
    throw new ImportAbortedError('The category list is not an array.');
  }

  return data.map((item: unknown, index) => {
    if (!isRecord(item) || typeof item.slug !== 'string' || typeof item.name !== 'string') {
      throw new ImportAbortedError(`Category at position ${String(index)} has no slug or name.`);
    }
    // `url` points to the DummyJSON API and is not stored.
    return { slug: item.slug, name: item.name };
  });
}

function parseProducts(data: unknown): Record<string, unknown>[] {
  if (!isRecord(data) || !Array.isArray(data.products) || typeof data.total !== 'number') {
    throw new ImportAbortedError('The product response has no `products` list or `total`.');
  }

  // Without `limit=0`, DummyJSON returns only the first page.
  if (data.products.length !== data.total) {
    throw new ImportAbortedError(
      `Received ${String(data.products.length)} products, but DummyJSON reports ${String(data.total)}.`,
    );
  }

  return data.products.map((item: unknown, index) => {
    if (!isRecord(item)) {
      throw new ImportAbortedError(`Product at position ${String(index)} is not an object.`);
    }
    return item;
  });
}

/** The validations of the migration flow: required fields, ranges, known categories and unique ids and SKUs. */
function validateSource(categories: SourceCategory[], products: Record<string, unknown>[]): string[] {
  const problems: string[] = [];
  const slugs = new Set(categories.map((category) => category.slug));
  const ids = new Set<number>();
  const skus = new Set<string>();

  for (const [index, product] of products.entries()) {
    const label = `product ${typeof product.id === 'number' ? String(product.id) : `at position ${String(index)}`}`;

    if (!Number.isInteger(product.id)) problems.push(`${label}: missing id`);
    if (typeof product.title !== 'string' || product.title === '') problems.push(`${label}: missing title`);
    if (typeof product.thumbnail !== 'string' || product.thumbnail === '') {
      problems.push(`${label}: missing thumbnail`);
    }
    if (typeof product.category !== 'string' || !slugs.has(product.category)) {
      problems.push(`${label}: category ${JSON.stringify(product.category)} is not in the category list`);
    }
    if (typeof product.price !== 'number' || product.price < 0) problems.push(`${label}: invalid price`);
    if (typeof product.stock !== 'number' || !Number.isInteger(product.stock) || product.stock < 0) {
      problems.push(`${label}: invalid stock`);
    }

    // A missing discount stops the migration instead of being assumed as 0.
    if (
      typeof product.discountPercentage !== 'number' ||
      product.discountPercentage < 0 ||
      product.discountPercentage > 100
    ) {
      problems.push(`${label}: missing or invalid discountPercentage`);
    }

    if (typeof product.id === 'number') {
      if (ids.has(product.id)) problems.push(`${label}: repeated id`);
      ids.add(product.id);
    }

    if (typeof product.sku === 'string') {
      if (skus.has(product.sku)) problems.push(`${label}: repeated sku ${product.sku}`);
      skus.add(product.sku);
    }
  }

  return problems;
}

function toProductPayload(product: SourceProduct, categoryId: string): Record<string, unknown> {
  const details: Record<string, unknown> = {};
  for (const key of detailKeys) {
    const value = product[key];
    // Missing values are left out instead of being sent as null; the API rejects null and empty text.
    if (value !== undefined && value !== null && value !== '') {
      details[key] = value;
    }
  }

  return {
    externalId: product.id,
    categoryId,
    title: product.title,
    price: product.price,
    discountPercentage: product.discountPercentage,
    stock: product.stock,
    thumbnail: product.thumbnail,
    details,
  };
}

async function logIn(email: string, password: string): Promise<string> {
  const response = await request('/auth/login', { email, password });
  if (response.status !== 200) {
    throw new ImportAbortedError(`Login failed (${String(response.status)} ${readCode(response)}).`);
  }

  const sessionCookie = response.cookies.find((cookie) => cookie.startsWith('sid='));
  if (sessionCookie === undefined) {
    throw new ImportAbortedError('Login succeeded but returned no session cookie.');
  }

  if (response.body.role !== 'admin') {
    throw new ImportAbortedError(`${email} is not an admin account.`);
  }

  return sessionCookie.split(';')[0] ?? sessionCookie;
}

async function post(path: string, body: unknown, cookie: string): Promise<ApiResponse> {
  const response = await request(path, body, cookie);

  // The session or the databases are unavailable: stop, since every following call would fail the same way.
  // What was already created stays, and a new run creates the rest.
  if (response.status === 401 || response.status === 403 || response.status >= 500) {
    throw new ImportAbortedError(
      `${path} responded ${String(response.status)} ${readCode(response)}; the import stopped. Run it again to continue.`,
    );
  }
  return response;
}

async function request(path: string, body: unknown, cookie?: string): Promise<ApiResponse & { cookies: string[] }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie !== undefined) {
    headers.Cookie = cookie;
  }

  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch (error) {
    throw new ImportAbortedError(
      `Could not reach the API at ${apiUrl}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text === '' ? {} : JSON.parse(text);
  } catch {
    parsed = {};
  }

  return {
    status: response.status,
    body: isRecord(parsed) ? parsed : {},
    cookies: response.headers.getSetCookie(),
  };
}

/** Counts the result of one creation and returns the id to use: the new one, or the existing one. */
function readCreatedOrExistingId(
  response: ApiResponse,
  alreadyExistsCode: string,
  tally: Tally,
  label: string,
): string | undefined {
  if (response.status === 201 && typeof response.body.id === 'string') {
    tally.created++;
    return response.body.id;
  }

  if (
    response.status === 409 &&
    response.body.code === alreadyExistsCode &&
    typeof response.body.existingId === 'string'
  ) {
    tally.skipped++;
    return response.body.existingId;
  }

  tally.rejected.push(`${label}: ${String(response.status)} ${readCode(response)}${describeFields(response)}`);
  return undefined;
}

function readCode(response: ApiResponse): string {
  return typeof response.body.code === 'string' ? response.body.code : 'unexpected response';
}

function describeFields(response: ApiResponse): string {
  const fields = response.body.fields;
  if (!Array.isArray(fields)) {
    return '';
  }
  const messages = fields.filter(isRecord).map((field) => `${String(field.field)}: ${String(field.message)}`);
  return messages.length > 0 ? ` (${messages.join('; ')})` : '';
}

function report(label: string, tally: Tally): void {
  console.log(
    `${label}: ${String(tally.created)} created, ${String(tally.skipped)} skipped, ${String(tally.rejected.length)} rejected.`,
  );
  for (const rejection of tally.rejected) {
    console.log(`  rejected ${rejection}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

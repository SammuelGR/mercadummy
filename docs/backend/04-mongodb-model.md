# MongoDB Model

MongoDB stores the **read views**, shaped like the screens. It is not the source of truth: all content comes from PostgreSQL or is computed from it. Only the projection process writes to the views.

Instructions for rebuilding or fixing the views are in `05-mongodb-reprocessing.md`.

## Overview

Database: `mercadummy`.

| Collection | One document per | Screens and use | Source in PostgreSQL |
|---|---|---|---|
| `products` | product | catalog, detail, cart | `products`, `categories` |
| `categories` | category | catalog filter | `categories` |
| `orders` | order, with its items | history | `orders`, `order_items` |

Users and the outbox are **not** projected. Sessions and carts live in Redis.

## Conventions

| Topic | Rule |
|---|---|
| Identifiers | UUID v4 as lowercase **text**; `_id` is the PostgreSQL `id` |
| Field names | camelCase, following DummyJSON when there is an equivalent field |
| Money | `Decimal128`, created from the `numeric` text; the API returns a number |
| Dates | `Date`, in UTC, with millisecond precision; the front end displays them in the local time zone |
| Relationships | data needed by the screen is copied into the document; there is no `$lookup` |
| `version` | copy of the PostgreSQL `version` |

Text was chosen for UUIDs because it is easier to read in the prototype. The binary UUID type takes less space.

## `products` collection

```json
{
  "_id": "b2a6e0d4-1f57-4a93-8c0e-3d9b7a5f2e61",
  "title": "Essence Mascara Lash Princess",
  "titleSearch": "essence mascara lash princess",
  "thumbnail": "https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/thumbnail.webp",
  "category": { "id": "4c1f8b2e-9a07-4d5c-b3e6-0f2a7c9d1b48", "slug": "beauty", "name": "Beauty" },
  "price": { "$numberDecimal": "9.99" },
  "discountPercentage": 10,
  "stock": 99,
  "availabilityStatus": "In Stock",
  "rating": 2.56,
  "description": "The Essence Mascara Lash Princess is a popular mascara...",
  "images": ["https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/1.webp"],
  "specifications": [
    { "label": "Brand", "value": "Essence" },
    { "label": "SKU", "value": "BEA-ESS-ESS-001" },
    { "label": "Weight", "value": "4" },
    { "label": "Dimensions (W × H × D)", "value": "15.14 × 13.08 × 22.99" },
    { "label": "Warranty", "value": "1 week warranty" }
  ],
  "isActive": true,
  "createdAt": { "$date": "2026-11-25T18:00:00.000Z" },
  "version": 1
}
```

| Field | Type | Source in PostgreSQL | Transformation |
|---|---|---|---|
| `_id` | string | `products.id` | direct |
| `title` | string | `products.title` | direct |
| `titleSearch` | string | `products.title` | normalized for search |
| `thumbnail` | string | `products.thumbnail` | direct |
| `category.id` | string | `categories.id` | embedded |
| `category.slug` | string | `categories.slug` | embedded |
| `category.name` | string | `categories.name` | embedded |
| `price` | Decimal128 | `products.price` | full price |
| `discountPercentage` | int | `products.discount_percentage` | rounded: 10.48 → 10; 10.50 → 11 |
| `stock` | int | `products.stock` | direct |
| `availabilityStatus` | string | `products.stock` | computed |
| `rating` | double | `details.rating` | omitted if missing |
| `description` | string | `details.description` | `""` if missing |
| `images` | array of string | `details.images` | `[]` if missing; keeps the order |
| `specifications` | array | `details` | see below |
| `isActive` | bool | `products.is_active` | direct |
| `createdAt` | date | `products.created_at` | used to sort the catalog |
| `version` | int | `products.version` | direct |

Not projected: `external_id`, `updated_at` and, from `details`, `tags`.

### Computed fields

**`titleSearch`**: without accents and in lowercase. The search term goes through the same function.

```js
const normalize = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
```

**`discountPercentage`**: `Math.round` over the database value. Rounding is for display only; calculations use the exact PostgreSQL value. When the result is 0, the front end hides the badge.

**`availabilityStatus`** (proposed rule; the boundary between 7 and 8 is not consistent in the DummyJSON data):

| `stock` | Value |
|---|---|
| 0 | `Out of Stock` |
| 1 to 7 | `Low Stock` |
| 8 or more | `In Stock` |

**`specifications`**: `label` and `value` pairs, both text, in this order. Missing items are omitted.

| Key in `details` | `label` | `value` |
|---|---|---|
| `brand` | `Brand` | the text |
| `sku` | `SKU` | the text |
| `weight` | `Weight` | the number, without unit |
| `dimensions` | `Dimensions (W × H × D)` | `width × height × depth`; only if all three exist |
| `warrantyInformation` | `Warranty` | the text |

Inactive products **remain in the collection**, with `isActive: false`. The catalog and the detail page hide them, and the cart uses them to warn that the item is unavailable.

## `categories` collection

```json
{ "_id": "4c1f8b2e-9a07-4d5c-b3e6-0f2a7c9d1b48", "slug": "beauty", "name": "Beauty", "version": 1 }
```

| Field | Type | Source in PostgreSQL |
|---|---|---|
| `_id` | string | `categories.id` |
| `slug` | string | `categories.slug` |
| `name` | string | `categories.name` |
| `version` | int | `categories.version` |

`updated_at` is not projected.

## `orders` collection

```json
{
  "_id": "9d3e7a15-2c84-4b6f-a0d9-5e1f8c4b7a23",
  "orderNumber": 1001,
  "userId": "7f1c2a9e-4b3d-4c8a-9f21-6d5e8b0a1c34",
  "status": "CONFIRMED",
  "createdAt": { "$date": "2026-11-25T18:32:00.000Z" },
  "totalQuantity": 2,
  "total": { "$numberDecimal": "19.98" },
  "items": [
    {
      "productId": "b2a6e0d4-1f57-4a93-8c0e-3d9b7a5f2e61",
      "title": "Essence Mascara Lash Princess",
      "thumbnail": "https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/thumbnail.webp",
      "price": { "$numberDecimal": "9.99" },
      "quantity": 2
    }
  ],
  "version": 1
}
```

| Field | Type | Source in PostgreSQL |
|---|---|---|
| `_id` | string | `orders.id` |
| `orderNumber` | int | `orders.order_number`, displayed as "Order #1001" |
| `userId` | string | `orders.user_id` |
| `status` | string | `orders.status`; always `CONFIRMED` |
| `createdAt` | date | `orders.created_at` |
| `totalQuantity` | int | `orders.total_quantity` |
| `total` | Decimal128 | `orders.total`, at full price |
| `items[].productId` | string | `order_items.product_id` |
| `items[].title` | string | `order_items.title` |
| `items[].thumbnail` | string | `order_items.thumbnail` |
| `items[].price` | Decimal128 | `order_items.price` |
| `items[].quantity` | int | `order_items.quantity` |
| `version` | int | `orders.version` |

- Items use the values **from the purchase**. Changing a product does not alter past orders.
- Items are sorted by `title` and `productId`. With UUID v4, the id does not indicate insertion order, and `order_items` has no position column.
- Not projected: `discounted_total`, `total_products`, `idempotency_key`, `updated_at`, nor the per-item discount and totals.

## Indexes

In addition to the automatic index on `_id`:

| Collection | Name | Keys | Use |
|---|---|---|---|
| `products` | `catalog` | `{ isActive: 1, createdAt: 1, _id: 1 }` | paginated catalog |
| `products` | `catalog_by_category` | `{ isActive: 1, "category.slug": 1, createdAt: 1, _id: 1 }` | filter by category |
| `categories` | `slug_unique` | `{ slug: 1 }`, unique | no repeated slug |
| `orders` | `by_user` | `{ userId: 1, createdAt: -1, _id: -1 }` | user history |

Index definitions live in **a single place in the code**. The application creates them at startup, and the rebuild uses the same definition.

## Queries per screen

| Screen or operation | Query |
|---|---|
| Category filter | `db.categories.find().sort({ name: 1 })` |
| Catalog | see below |
| Product detail | `db.products.findOne({ _id: id, isActive: true })`; no result, `404` |
| Cart | `db.products.find({ _id: { $in: ids } })`, including inactive ones |
| History | `db.orders.find({ userId }).sort({ createdAt: -1, _id: -1 })` |

In the history, `userId` **always comes from the session**.

The cart uses `title`, `thumbnail`, `price`, `stock` and `isActive`.

### Catalog and Load More

The order is `createdAt` and, on ties, `_id`. With UUID v4, sorting only by `_id` would mix products without any criterion. This way, products created later tend to go to the end of the list.

```js
const filter = { isActive: true };
if (category) filter['category.slug'] = category;
if (inStock) filter.stock = { $gt: 0 };            // includes Low Stock
if (search) filter.titleSearch = { $regex: escapeRegex(normalize(search)) };
if (cursor) {
  filter.$or = [
    { createdAt: { $gt: cursor.createdAt } },
    { createdAt: cursor.createdAt, _id: { $gt: cursor.id } },
  ];
}

const docs = await db.collection('products')
  .find(filter)
  .sort({ createdAt: 1, _id: 1 })
  .limit(limit + 1)
  .toArray();
```

- If `limit + 1` documents come back, return the first `limit` and build `nextCursor` from the `createdAt` and `_id` of the last one returned. Otherwise, `nextCursor` is `null`.
- To the API, the cursor is an opaque string, for example the JSON in `base64url`. The API validates its content before building the filter and converts `createdAt` back to `Date`.
- Changing the search or a filter discards the cursor.
- `escapeRegex` is mandatory, and `limit` must have a maximum. The values are in `06-api-contract.md`.
- Substring search does not make good use of an index. For the prototype's volume, it is enough.

## Projection: how the views are updated

The worker consumes `outbox_events`. To decide what to do, it uses only `aggregate_type` and `aggregate_id`. The `event_type` is for logging and diagnostics.

| `aggregate_type` | Events | Collection updated |
|---|---|---|
| `CATEGORY` | `CategoryUpserted` | `categories` |
| `PRODUCT` | `ProductUpserted`, `ProductStockChanged` | `products` |
| `ORDER` | `OrderPlaced` | `orders` |

`ReprocessRequested` can be used with any of the three types.

An order does not change after checkout, so `OrderPlaced` is the only business event for `ORDER`. A correction made directly in the database uses `ReprocessRequested`.

The worker **does not apply the event content**. It rereads the current state in PostgreSQL and replaces the whole document. If the record no longer exists, it deletes the document. Because of this, processing the same event again is safe. Events must not trigger other effects, such as notifications, inside this worker.

A change to a category's name or `slug` also increments the version of its products and generates an event for each one.

### Reading from PostgreSQL

Each document is loaded with **a single SQL statement**, so the version and the content come from the same moment. The same queries serve the worker and the rebuild.

```sql
-- load-category
SELECT id, slug, name, version
FROM categories
WHERE id = ANY($1::uuid[]);
```

```sql
-- load-product
SELECT p.id, p.title, p.thumbnail, p.price, p.discount_percentage, p.stock,
       p.details, p.is_active, p.created_at, p.version,
       c.id AS category_id, c.slug AS category_slug, c.name AS category_name
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE p.id = ANY($1::uuid[]);
```

```sql
-- load-order
SELECT o.id, o.order_number, o.user_id, o.status, o.created_at,
       o.total_quantity, o.total, o.version,
       json_agg(json_build_object(
           'productId', i.product_id,
           'title',     i.title,
           'thumbnail', i.thumbnail,
           'price',     i.price::text,
           'quantity',  i.quantity
       ) ORDER BY i.title, i.product_id) AS items
FROM orders o
JOIN order_items i ON i.order_id = o.id
WHERE o.id = ANY($1::uuid[])
GROUP BY o.id;
```

Item prices are returned as text so they do not pass through a floating-point number before becoming `Decimal128`.

### Writing to MongoDB

```js
const isDuplicateId = (error) => error.code === 11000 && error.keyPattern?._id === 1;

async function saveView(collection, doc) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await collection.replaceOne(
        { _id: doc._id, version: { $lte: doc.version } },
        doc,
        { upsert: true },
      );
      return;
    } catch (error) {
      if (!isDuplicateId(error)) throw error;
    }
  }
  // Duplicate twice: MongoDB already has a newer version.
}
```

| Situation | Result |
|---|---|
| Document does not exist | it is created |
| Stored version lower or **equal** | the document is replaced |
| Stored version higher | the upsert tries to insert, gets a duplicate key on `_id` and nothing changes |

- **`$lte`** allows rewriting the same version, which is needed when the document format or a view calculation changes. This assumes all projection processes run the same code.
- **The second attempt** covers two simultaneous writes of a new document: the error can occur even when the incoming version is the newest. Since the filter uses a version comparison, do not rely on the server's automatic retry.
- **Only a duplicate key on `_id` is expected.** A duplicate in another index, such as `slug_unique`, is a real error.

Deletion uses `deleteOne({ _id })`. The design assumes **a single worker**. With several, a delayed write could recreate a recently deleted document; this would need to be handled first.

### Worker cycle

1. Open a transaction (`READ COMMITTED`).
2. Try the lock shared with the rebuild. If it cannot be acquired, end the transaction and wait. See `05-mongodb-reprocessing.md`.
3. Select a pending batch.
4. For each event, load the record, write or delete the view and mark the result.
5. Commit the transaction and repeat.

```sql
-- worker-lock
SELECT pg_try_advisory_xact_lock_shared(727001) AS locked;
```

```sql
-- worker-batch
SELECT id, aggregate_type, aggregate_id
FROM outbox_events
WHERE processed_at IS NULL AND attempts < 10
ORDER BY id
LIMIT 50
FOR UPDATE SKIP LOCKED;
```

```sql
-- worker-success
UPDATE outbox_events SET processed_at = now(), last_error = NULL WHERE id = $1;
```

```sql
-- worker-failure
UPDATE outbox_events SET attempts = attempts + 1, last_error = $2 WHERE id = $1;
```

- The limit of 10 attempts and the batch of 50 are proposed values. Wait for an interval after a failed cycle, so a short MongoDB outage does not exhaust the attempts in a row.
- A PostgreSQL error aborts the batch transaction. In that case, `ROLLBACK` and try again in a later cycle. Events already applied to MongoDB will be processed again, which is safe.
- An event that reached the limit stays pending and must be handled as described in the reprocessing document.
- Ordering by `id` does not guarantee transaction commit order. Rereading the current state and the version make this acceptable.
- The views are **eventually consistent**: a change may take a while to appear. Checkout always validates in PostgreSQL.

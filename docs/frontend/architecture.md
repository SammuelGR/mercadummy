# Frontend Architecture

Mercadummy is a responsive, English-language single-page application in `frontend/`. It uses the Mercadummy REST API for the catalog, authentication, cart, checkout, and order history.

The [screen specifications](screens.md) define routes, navigation, and user interactions. The [API contract](../backend/06-api-contract.md) defines endpoints, payloads, responses, and errors.

## Stack

| Area | Technology |
| --- | --- |
| Application | React, TypeScript, Vite |
| Routing | TanStack Router with file-based routing |
| Server state and HTTP | TanStack Query, Fetch API |
| Styling and icons | Tailwind CSS, Lucide React |
| Internationalization | i18next, react-i18next |
| Testing | Vitest, React Testing Library |
| Linting and formatting | Oxlint, Prettier |
| Package management and deployment | npm, Vercel |

`frontend/package.json` defines the installed dependencies and available scripts. Dependencies are added when required by the work in scope.

## Source Organization

| Path under `frontend/src/` | Responsibility |
| --- | --- |
| `main.tsx` | Application entry point and providers |
| `routes/` | Route definitions, layouts, and access rules |
| `pages/` | Screen composition and page-specific components. Each page uses an `index.tsx` entry point, such as `pages/home/index.tsx`. |
| `components/` | Components shared across pages |
| `hooks/` | Reusable React hooks |
| `services/` | API requests and response handling |
| `types/` | Shared TypeScript types |
| `utils/` | Shared utilities |
| `styles/` | Global styles |
| `locales/` | Translation resources |
| `test/` | Shared test setup and render helpers |

The `@/` alias resolves to `frontend/src/`.

## Routing and Session Access

Route modules connect URLs to page components. Access rules are defined in the `route.tsx` file of each pathless group.

| Group | Access |
| --- | --- |
| `_shared/` | Visitors and authenticated users |
| `_public/` | Visitors. Authenticated users are redirected to `/`. |
| `_private/` | Authenticated users. Visitors are redirected to `/login`. |

Session state comes from `GET /auth/me`. A `401 UNAUTHENTICATED` identifies a visitor. Network and service failures are handled as errors. The shared catalog remains accessible when the session service is unavailable.

## State and API Integration

TanStack Query manages catalog, product details, categories, session, cart, and order history. React manages form input and local interface state. Cached cart and order data is scoped to the authenticated user.

API requests use `credentials: 'include'` with the backend-managed `sid` cookie. The API base URL is configured per environment. The frontend uses API error codes to determine how to handle failures.

- **Catalog.** Load More appends results using `nextCursor`. Changes to search or filters reset pagination.
- **Cart.** The header, cart page, and checkout share the same cart data. Cart mutations return the complete updated cart. After a network failure or `503` during an add, the frontend checks the cart before retrying.
- **Checkout.** Items with a reported issue block confirmation. Retries reuse the same idempotency key for the purchase. The confirmation page uses the checkout response because order history can lag behind.

## Styling and Internationalization

Global styles live in `src/styles/globals.css`. Screen-specific layouts and responsive behavior follow the [screen specifications](screens.md).

English interface copy lives in bundled JSON resources under `src/locales/`. Translation namespaces follow feature boundaries, with `common` for shared text.

## Testing and Validation

Tests live near the code they cover. Shared setup and render helpers live in `src/test/`. Tests cover observable behavior and business rules such as access redirects, catalog pagination, and recovery from API errors.

Run `npm run lint`, `npm run format:check`, and `npm run build` from `frontend/`, along with the relevant automated tests. The build generates the route tree before checking TypeScript. The generated tree is excluded from linting and formatting.

## Deployment

The Vercel project uses `frontend` as its Root Directory. `frontend/vercel.json` defines the SPA rewrite for direct navigation and page refreshes.

The backend's `FRONTEND_ORIGIN` must match the deployed frontend origin. The frontend and API must be on the same site under the current [`SameSite=Lax` cookie policy](../backend/03-redis.md#cookie).

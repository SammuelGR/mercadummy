# API Contract

REST routes of the API (NestJS, CQRS). The API is **not implemented** yet; this is the contract to follow.

The paths below belong to the API and should not be confused with the front-end screen routes.

## Available routes

**Access:** `public` requires no session; `session` requires an authenticated user, of any role; `admin` requires the `admin` role.

| Method | Route | Access | Type | Data used |
|---|---|---|---|---|
| `POST` | `/auth/register` | public | command | PostgreSQL, Redis |
| `POST` | `/auth/login` | public | command | PostgreSQL, Redis |
| `POST` | `/auth/logout` | session | command | Redis |
| `GET` | `/auth/me` | session | query | Redis |
| `GET` | `/categories` | public | query | MongoDB |
| `GET` | `/products` | public | query | MongoDB |
| `GET` | `/products/:id` | public | query | MongoDB |
| `GET` | `/cart` | session | query | Redis, MongoDB |
| `POST` | `/cart/items` | session | command | Redis, MongoDB |
| `PUT` | `/cart/items/:productId` | session | command | Redis, MongoDB |
| `DELETE` | `/cart/items/:productId` | session | command | Redis, MongoDB |
| `POST` | `/orders` | session | command | Redis, PostgreSQL |
| `GET` | `/orders` | session | query | MongoDB |
| `POST` | `/admin/categories` | admin | command | PostgreSQL |
| `POST` | `/admin/products` | admin | command | PostgreSQL |

On routes with `session` or `admin` access, the session is always validated in Redis.

## Conventions

| Topic | Rule |
|---|---|
| Format | JSON in UTF-8, `Content-Type: application/json`, camelCase fields |
| Identifiers | UUID as text |
| Money | number with up to 2 decimal places |
| Dates | ISO 8601 text in UTC, for example `2026-11-25T18:32:00.000Z` |
| Authentication | `sid` cookie; the front end uses `credentials: 'include'` |
| Unexpected fields | rejected with `400 VALIDATION_ERROR` |
| Invalid id in the path | treated as a missing record (`404`); in the cart `DELETE`, `400` |
| User | identified **only by the session**; no route accepts a `userId` from the client |

Cookie, CORS and `Origin` check details are in `03-redis.md`.

**Eventual consistency:** MongoDB queries may take a while to reflect a command. For this reason, commands return what the front end needs to confirm the result without depending on the view.

## Errors

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid request data",
  "fields": [{ "field": "email", "message": "Invalid email" }]
}
```

`code` and `message` are always present. `message` is an English text; the front end decides what to do based on `code`.

| Extra field | When it appears |
|---|---|
| `fields[]` (`field`, `message`) | `VALIDATION_ERROR` caused by the body; one entry per invalid field |
| `items[]` (`productId`, `requested`, `available`) | `INSUFFICIENT_STOCK` and `PRODUCT_UNAVAILABLE` |
| `existingId` | `CATEGORY_ALREADY_EXISTS` and `PRODUCT_ALREADY_EXISTS` |

| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | invalid data or JSON |
| 401 | `UNAUTHENTICATED` | no valid session |
| 401 | `INVALID_CREDENTIALS` | wrong e-mail or password |
| 403 | `FORBIDDEN` | the role does not allow the operation |
| 403 | `INVALID_ORIGIN` | origin not allowed on a write |
| 404 | `NOT_FOUND` | the route does not exist |
| 404 | `PRODUCT_NOT_FOUND` | product missing or inactive |
| 404 | `CART_ITEM_NOT_FOUND` | item is not in the cart |
| 409 | `EMAIL_ALREADY_IN_USE` | e-mail already registered |
| 409 | `INSUFFICIENT_STOCK` | quantity greater than stock |
| 409 | `PRODUCT_UNAVAILABLE` | cart product unavailable at checkout |
| 409 | `CART_EMPTY` | checkout with an empty cart |
| 409 | `CATEGORY_ALREADY_EXISTS` | `slug` already registered |
| 409 | `PRODUCT_ALREADY_EXISTS` | `externalId` already registered |
| 409 | `SKU_ALREADY_IN_USE` | SKU used by another product |
| 422 | `CATEGORY_NOT_FOUND` | `categoryId` does not exist |
| 500 | `INTERNAL_ERROR` | unexpected error, without internal details |
| 503 | `SERVICE_UNAVAILABLE` | a required PostgreSQL, MongoDB or Redis is unavailable |

General errors (`400`, `401 UNAUTHENTICATED`, `403`, `500` and `503`) apply to the routes where they are relevant and are not repeated below.

## Authentication

### `POST /auth/register`

```json
{ "fullName": "Maria Souza", "email": "maria@example.com", "password": "a-secure-password" }
```

| Field | Rule |
|---|---|
| `fullName` | required, 1 to 150 characters, no leading or trailing spaces |
| `email` | required, valid format, up to 254 characters; stored in lowercase |
| `password` | required, 8 to 128 characters |

Password confirmation is validated on the front end and **is not sent**. The role is always `user`.

**`201`**, with the `sid` cookie:

```json
{ "id": "7f1c2a9e-4b3d-4c8a-9f21-6d5e8b0a1c34", "fullName": "Maria Souza", "role": "user" }
```

**Errors:** `409 EMAIL_ALREADY_IN_USE`. If Redis fails after the account is created, the response is `503`; the user must log in.

### `POST /auth/login`

```json
{ "email": "maria@example.com", "password": "a-secure-password" }
```

**`200`**, with a new `sid` cookie and the same body as registration. The e-mail comparison is case-insensitive.

**Errors:** `401 INVALID_CREDENTIALS`, with the same response for a missing e-mail and a wrong password.

### `POST /auth/logout`

No body. **`204`**: ends the session and expires the cookie. The cart is kept.

### `GET /auth/me`

**`200`**, with the same body as registration. A visitor gets `401 UNAUTHENTICATED`.

## Catalog

### `GET /categories`

**`200`**, sorted by name:

```json
{ "items": [{ "id": "4c1f8b2e-9a07-4d5c-b3e6-0f2a7c9d1b48", "slug": "beauty", "name": "Beauty" }] }
```

### `GET /products`

| Parameter | Type | Default | Rule |
|---|---|---|---|
| `search` | text | | searches the name, ignoring accents and case; up to 100 characters |
| `category` | slug | | one category; an unknown slug yields an empty list |
| `inStock` | `true` or `false` | `false` | `true` shows only stock greater than zero |
| `cursor` | text | | `nextCursor` from the previous response |
| `limit` | integer | 12 | 1 to 100 |

**`200`**:

```json
{
  "items": [
    {
      "id": "b2a6e0d4-1f57-4a93-8c0e-3d9b7a5f2e61",
      "title": "Essence Mascara Lash Princess",
      "thumbnail": "https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/thumbnail.webp",
      "category": { "id": "4c1f8b2e-9a07-4d5c-b3e6-0f2a7c9d1b48", "slug": "beauty", "name": "Beauty" },
      "price": 9.99,
      "discountPercentage": 10,
      "rating": 2.56,
      "stock": 99,
      "availabilityStatus": "In Stock"
    }
  ],
  "nextCursor": null
}
```

- `price` is the full price. `discountPercentage` is the integer shown on the badge; with `0`, the front end hides the badge.
- `rating` may be missing.
- `availabilityStatus`: `In Stock`, `Low Stock` or `Out of Stock`.
- When the search or filters change, the front end discards the cursor.

**Errors:** an invalid cursor or parameter yields `400 VALIDATION_ERROR`.

### `GET /products/:id`

**`200`**: the fields of a list item plus:

```json
{
  "description": "The Essence Mascara Lash Princess is a popular mascara...",
  "images": ["https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/1.webp"],
  "specifications": [{ "label": "Brand", "value": "Essence" }]
}
```

`description` may be empty, as may the lists. Without images, the front end can use `thumbnail`.

**Errors:** `404 PRODUCT_NOT_FOUND`.

## Cart

All four routes respond with the **full cart**:

```json
{
  "items": [
    {
      "productId": "b2a6e0d4-1f57-4a93-8c0e-3d9b7a5f2e61",
      "title": "Essence Mascara Lash Princess",
      "thumbnail": "https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/thumbnail.webp",
      "price": 9.99,
      "quantity": 2,
      "stock": 99
    },
    {
      "productId": "e8d3c7b1-6a24-4f0d-b95a-1c7e4f2a8d90",
      "quantity": 1,
      "issue": "PRODUCT_UNAVAILABLE"
    }
  ],
  "totalQuantity": 3,
  "total": 19.98
}
```

- `issue` only appears when there is a problem: `PRODUCT_UNAVAILABLE` or `INSUFFICIENT_STOCK`. Unavailability takes precedence.
- An item whose product was not found has only `productId`, `quantity` and `issue`. An inactive product has the other fields.
- `total` is at full price and does not include unavailable items.
- With any `issue`, the front end blocks checkout.
- The header counter uses `totalQuantity`.
- An empty cart is `{ "items": [], "totalQuantity": 0, "total": 0 }`.

### `GET /cart`

No parameters. **`200`** with the cart.

### `POST /cart/items`

Adds the quantity to the existing one.

```json
{ "productId": "b2a6e0d4-1f57-4a93-8c0e-3d9b7a5f2e61", "quantity": 2 }
```

`quantity` is an integer starting at 1. **`200`** with the cart.

**Errors:** `404 PRODUCT_NOT_FOUND` and `409 INSUFFICIENT_STOCK`. In that error, `requested` is the total that would be in the cart.

This route **is not idempotent**. After a network failure or a `503`, check the cart before retrying, since the addition may already have been made.

### `PUT /cart/items/:productId`

Replaces the quantity of an existing item.

```json
{ "quantity": 3 }
```

`quantity` is an integer starting at 1. **`200`** with the cart.

**Errors:** `404 PRODUCT_NOT_FOUND`, `404 CART_ITEM_NOT_FOUND` and `409 INSUFFICIENT_STOCK`.

### `DELETE /cart/items/:productId`

No body. **`200`** with the cart. Removing a missing item is not an error. Removal works even if the product is unavailable.

## Orders

### `POST /orders`

Completes the purchase of the cart. The API **does not receive items or prices** from the front end.

```json
{ "idempotencyKey": "3a9c5e71-8b24-4d0f-a6c3-1e7f9b2d5c48" }
```

- The front end generates the UUID when it opens checkout and **reuses the same value** when retrying.
- Once an order is created, a new purchase needs another key.
- Stock and prices are validated in PostgreSQL.

The order is created with status `CONFIRMED`, which does not change afterwards.

**`201`** when the order is created, or **`200`** when the key already had an order. The body is the same:

```json
{ "orderId": "9d3e7a15-2c84-4b6f-a0d9-5e1f8c4b7a23", "orderNumber": 1001 }
```

The confirmation screen uses this response, since the order may take a while to appear in the history.

**Errors:** `409 CART_EMPTY`, `409 INSUFFICIENT_STOCK` and `409 PRODUCT_UNAVAILABLE`.

- `items` lists all items with problems.
- If both kinds of problem occur, the `code` is `PRODUCT_UNAVAILABLE`.
- For an unavailable product, `available` is `0`.
- On error, no order is created and stock does not change.

The full flow and the cart cleanup are in `03-redis.md`. There is a note about duplicate purchases in two tabs.

### `GET /orders`

Orders of the session user, from most recent to oldest. There is no pagination.

**`200`**:

```json
{
  "items": [
    {
      "id": "9d3e7a15-2c84-4b6f-a0d9-5e1f8c4b7a23",
      "orderNumber": 1001,
      "status": "CONFIRMED",
      "createdAt": "2026-11-25T18:32:00.000Z",
      "totalQuantity": 2,
      "total": 19.98,
      "items": [
        {
          "productId": "b2a6e0d4-1f57-4a93-8c0e-3d9b7a5f2e61",
          "title": "Essence Mascara Lash Princess",
          "thumbnail": "https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/thumbnail.webp",
          "price": 9.99,
          "quantity": 2
        }
      ]
    }
  ]
}
```

`status` is always `CONFIRMED`. Title, thumbnail and price are those at the purchase date.

## Catalog registration (migration)

Used by the migration script. They do not form a full product management: there are no routes to edit or delete.

The script calls `POST /auth/login` with an `admin` account and sends the cookie on each call. There is no route to create an `admin`.

### `POST /admin/categories`

```json
{ "slug": "beauty", "name": "Beauty" }
```

| Field | Rule |
|---|---|
| `slug` | required, 1 to 60 characters; lowercase letters, digits and hyphens between them |
| `name` | required, 1 to 80 characters |

**`201`**:

```json
{ "id": "4c1f8b2e-9a07-4d5c-b3e6-0f2a7c9d1b48", "slug": "beauty", "name": "Beauty" }
```

**Errors:** `409 CATEGORY_ALREADY_EXISTS`, with `existingId`. Nothing is changed, and the script uses that id.

### `POST /admin/products`

```json
{
  "externalId": 1,
  "categoryId": "4c1f8b2e-9a07-4d5c-b3e6-0f2a7c9d1b48",
  "title": "Essence Mascara Lash Princess",
  "price": 9.99,
  "discountPercentage": 10.48,
  "stock": 99,
  "thumbnail": "https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/thumbnail.webp",
  "details": { "brand": "Essence", "rating": 2.56 }
}
```

| Field | Required | Rule |
|---|---|---|
| `externalId` | no | positive integer; the script always sends it |
| `categoryId` | yes | UUID of an existing category |
| `title` | yes | 1 to 150 characters |
| `price` | yes | from 0 to 99999999.99, up to 2 decimal places |
| `discountPercentage` | yes | 0 to 100, up to 2 decimal places |
| `stock` | yes | integer starting at 0 |
| `thumbnail` | yes | `http` or `https` URL |
| `details` | yes | object; may be empty |

Accepted keys in `details`, all optional:

| Key | Rule |
|---|---|
| `description`, `brand`, `sku`, `warrantyInformation` | non-empty text |
| `rating` | number from 0 to 5 |
| `weight` | number starting at 0 |
| `dimensions` | `width`, `height` and `depth`, numbers starting at 0 |
| `tags` | list of texts |
| `images` | list of `http` or `https` URLs |

Other keys in `details`, such as `shippingInformation`, `returnPolicy`, `minimumOrderQuantity`, `reviews` and `meta`, yield `400 VALIDATION_ERROR`.

The API does not accept `id`, `createdAt`, `updatedAt`, `isActive` or `version`. The product is created active.

**`201`**:

```json
{ "id": "b2a6e0d4-1f57-4a93-8c0e-3d9b7a5f2e61", "externalId": 1 }
```

`externalId` is `null` when it is not sent.

**Errors, in this order of checking:**

1. `409 PRODUCT_ALREADY_EXISTS`, with `existingId`: the `externalId` already exists. Nothing is changed.
2. `422 CATEGORY_NOT_FOUND`.
3. `409 SKU_ALREADY_IN_USE`.

The order matters: in a new migration run, an already imported product must be reported as existing, not as a repeated SKU. A concurrent violation of `external_id` returns the same `PRODUCT_ALREADY_EXISTS`.

SKU uniqueness is checked by the application, without a database constraint. Two simultaneous creations may both pass this check; the script sends one product at a time.

Both routes write the record and the outbox event in the **same transaction**. The item appears in the catalog after the projection.

## Screens and routes

| Screen or component | API routes |
|---|---|
| Header | `GET /auth/me`, `GET /cart` (counter), `POST /auth/logout` |
| `/` | `GET /categories`, `GET /products` |
| `/products/$id` | `GET /products/:id`, `POST /cart/items` |
| `/login` | `POST /auth/login` |
| `/register` | `POST /auth/register` |
| `/cart` | `GET /cart`, `PUT` and `DELETE /cart/items/:productId` |
| `/checkout` | `GET /cart`, `POST /orders` |
| `/orders` | `GET /orders` |

For a visitor, `GET /auth/me` responds `401`, and the front end does not query the cart.

## Out of scope

Price filtering, profile editing, product editing and removal, order management by the administrator, order changes by the shopper and password recovery.

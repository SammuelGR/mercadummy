# Redis: Session and Cart

## Role in the system

Redis stores **only sessions and carts**.

- It is the only place where these two kinds of data exist. It is not a copy of PostgreSQL.
- It is not a catalog cache. Product data is read from MongoDB.
- It takes no part in the outbox or in rebuilding the views.
- Only the API accesses Redis.

## Keys

| Key | Type | Content | Expiration |
|---|---|---|---|
| `session:{sessionId}` | hash | `userId`, `fullName`, `role` | 24 hours from login, no renewal |
| `cart:{userId}` | hash | field `productId`, value `quantity` | 7 days from the last write operation |

`userId` and `productId` are the PostgreSQL UUIDs. In Redis, all hash values are stored as text.

## Session

### Identifier

The `sessionId` works as a credential. Generate **32 random bytes** with a cryptographic generator and encode them in `base64url`. In Node.js: `crypto.randomBytes(32).toString('base64url')`.

Do not log the `sessionId`.

### Fields

| Field | Example | Use |
|---|---|---|
| `userId` | `7f1c2a9e-4b3d-4c8a-9f21-6d5e8b0a1c34` | identify the user in every operation |
| `fullName` | `Maria Souza` | `GET /auth/me` response |
| `role` | `user` or `admin` | authorization |

E-mail, password and password hash are not stored.

`fullName` and `role` are copies taken at login. If it ever becomes possible to change a user's role or remove a user, their sessions will have to be terminated. That will require an index of sessions per user, which does not exist in this version.

### Cookie

| Attribute | Value |
|---|---|
| Name | `sid` |
| Content | only the `sessionId` |
| `HttpOnly` | yes |
| `Secure` | yes; may be turned off only in the local environment without HTTPS |
| `SameSite` | `Lax` |
| `Path` | `/` |
| `Max-Age` | `86400` |

- The front end sends requests with `credentials: 'include'`. For CORS, the API returns the exact front-end origin (do not use `*`) and `Access-Control-Allow-Credentials: true`.
- On write operations, the API rejects an `Origin` header different from the expected one. Requests without `Origin`, such as those from the migration script, are accepted and still require each route's authentication.
- `SameSite=Lax` assumes the front end and the API are on the same *site*. If they are deployed on different sites, the cookie must be revisited.

### Operations

**Create** (login and registration). Both commands go in the same transaction so the key is never left without an expiration.

```redis
MULTI
HSET session:{sessionId} userId {userId} fullName {fullName} role {role}
EXPIRE session:{sessionId} 86400
EXEC
```

- Always generate a new `sessionId`. Never reuse a value received from the browser.
- If the request already carries a session cookie, delete the previous session.
- On registration, first store the user in PostgreSQL and then create the session. If Redis fails, the account remains created and the user must log in.
- The same user may have several sessions, one per browser.

**Validate** (routes that require a session):

```redis
HGETALL session:{sessionId}
```

With no cookie or an empty result, respond `401 UNAUTHENTICATED`. Do not change the hash after it is created: an `HSET` after expiration would recreate the key **without an expiration**.

**End** (logout):

```redis
DEL session:{sessionId}
```

The API also expires the cookie. The cart is kept.

## Cart

Only authenticated users have a cart. The `userId` **always comes from the session**, never from the body or the URL.

### Structure

```redis
HGETALL cart:7f1c2a9e-4b3d-4c8a-9f21-6d5e8b0a1c34
1) "b2a6e0d4-1f57-4a93-8c0e-3d9b7a5f2e61"
2) "2"
3) "e8d3c7b1-6a24-4f0d-b95a-1c7e4f2a8d90"
4) "1"
```

- The quantity is an integer greater than zero.
- Name, price, image, discount and totals are **not** stored.
- An empty cart is a missing key: Redis removes the hash when its last field is deleted.
- Reading the cart does not renew its expiration.

### Add: `POST /cart/items`

The quantity sent is **added** to the quantity already in the cart.

1. Validate that the quantity is an integer greater than zero.
2. Look up the product in MongoDB. If it does not exist or is inactive, respond `404 PRODUCT_NOT_FOUND`.
3. Run the script, passing the stock that was read. The check and the write happen in a single operation.

```lua
-- cart-add
-- KEYS[1] = cart:{userId}
-- ARGV = productId, quantity, stock, expiration in seconds
local current = tonumber(redis.call('HGET', KEYS[1], ARGV[1]) or '0')
local updated = current + tonumber(ARGV[2])
if updated > tonumber(ARGV[3]) then
  return -1
end
redis.call('HSET', KEYS[1], ARGV[1], updated)
redis.call('EXPIRE', KEYS[1], ARGV[4])
return updated
```

Return `-1`: respond `409 INSUFFICIENT_STOCK`. The expiration is `604800`.

### Change quantity: `PUT /cart/items/:productId`

The quantity sent **replaces** the current one. Before the script, validate that it is an integer greater than zero, that the product is active and that it does not exceed the stock. To remove an item, use `DELETE`.

```lua
-- cart-set
-- KEYS[1] = cart:{userId}
-- ARGV = productId, quantity, expiration in seconds
if redis.call('HEXISTS', KEYS[1], ARGV[1]) == 0 then
  return 0
end
redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[3])
return 1
```

Return `0`: the item is not in the cart; respond `404 CART_ITEM_NOT_FOUND`. This way, a delayed change does not recreate an item that was already removed.

### Remove: `DELETE /cart/items/:productId`

```redis
MULTI
HDEL cart:{userId} {productId}
EXPIRE cart:{userId} 604800
EXEC
```

Removing a missing item is not an error. If the cart becomes empty, `EXPIRE` has no effect.

### Read: `GET /cart`

1. `HGETALL cart:{userId}`.
2. Fetch all products from MongoDB in a single query by `_id`.
3. Build each item with `productId`, `title`, `thumbnail`, `price`, `quantity` and `stock`.
4. Compute `totalQuantity` (sum of quantities) and `total` (sum of `price × quantity`, at full price) using decimal arithmetic.

Redis does not guarantee the order of hash fields. The API sorts items by `title` and `productId`; items whose product was not found go last.

The header counter is the `totalQuantity` of this response. There is no separate route for it.

The cart may contain an item that is no longer available. In that case, the item is returned with the `issue` field:

| Situation | `issue` | Counted in `total` |
|---|---|---|
| Product inactive or not found in MongoDB | `PRODUCT_UNAVAILABLE` | no |
| Quantity greater than stock | `INSUFFICIENT_STOCK` | yes |

- With any `issue`, the front end blocks checkout until the user adjusts the cart.
- An item whose product was not found comes with only `productId`, `quantity` and `issue`. It still counts in `totalQuantity` and can be removed.
- **Reading never deletes items.** During a MongoDB rebuild, a product may be temporarily missing.
- If MongoDB is down, respond with an error, without changing the cart.

MongoDB stock may lag behind. Cart validation serves to guide the user; the **definitive validation happens at checkout, in PostgreSQL**.

## Checkout: `POST /orders`

The front end generates an `idempotencyKey` UUID when it opens checkout and resends the same value on retries. The key is stored in PostgreSQL, not in Redis.

1. Validate the session.
2. Look in PostgreSQL for an order with the same user and `idempotencyKey`. If it exists, clean up the cart with its items (step 5) and return that order.
3. Read the cart. If it is empty, respond `409 CART_EMPTY`.
4. In a PostgreSQL transaction, validate and decrease stock, use the PostgreSQL prices and store the order with status `CONFIRMED`, its items and the `OrderPlaced` event in the outbox. If the transaction fails **for any reason**, repeat the lookup from step 2 before responding with an error.
5. After the commit, remove the purchased items from the cart.

Step 2 comes before reading the cart because, on a retry, the cart may already be empty. The new lookup in step 4 covers two simultaneous requests with the same key: the second may fail due to a duplicate key or insufficient stock, even though the order already exists.

### Cart cleanup

The script removes an item **only if its quantity is still equal to the purchased quantity**. Items added or changed during processing are kept.

```lua
-- cart-checkout-cleanup
-- KEYS[1] = cart:{userId}
-- ARGV = pairs of productId, purchased quantity
local removed = 0
for i = 1, #ARGV, 2 do
  if redis.call('HGET', KEYS[1], ARGV[i]) == ARGV[i + 1] then
    removed = removed + redis.call('HDEL', KEYS[1], ARGV[i])
  end
end
return removed
```

- If an item's quantity changed during the purchase, it remains with the full new quantity.
- Cleanup does not renew the expiration.
- If cleanup fails, the order **remains valid**: log the error and respond with success. The items may remain in the cart.
- Running the script again right away removes nothing more. The exception is when the user added the same product again, in the same quantity, between the two runs.

## Failures

| Situation | Expected effect |
|---|---|
| Redis down | login, registration, cart and session routes respond `503`; the public catalog keeps working, without checking the session |
| Redis data lost | users log in again and carts are lost; orders are not affected |
| Memory exhausted with `noeviction` | writes that need memory return an error; keys are not evicted to free space |

A connection failure must not be treated as a missing session (`401`) or as an empty cart.

## Configuration

| Option | Value | Reason |
|---|---|---|
| `appendonly` | `yes` | recover sessions and carts after a restart |
| `appendfsync` | `everysec` | writes to disk every second; a crash may lose the most recent writes |
| `maxmemory-policy` | `noeviction` | do not evict sessions or carts without warning; set it explicitly, since the default may vary in managed services |

```bash
redis-server --appendonly yes --appendfsync everysec --maxmemory-policy noeviction
```

- In a container, the data directory must be on a persistent volume.
- Do not expose the Redis port publicly. Outside the local environment, require authentication.
- The address and password come from environment variables.

Expiration still applies with `noeviction`: expired keys are removed normally.

## Known limitations

| Situation | Consequence | Possible solution, not included |
|---|---|---|
| Two tabs confirm checkout at the same time, with different keys | two orders may be created, if there is stock | per-user lock, for example `checkout:lock:{userId}` |
| The cart changes after the user reviewed the checkout | the order uses the cart at confirmation time | send the expected items and total and reject if they differ |
| The price changes after the review | the order uses the current PostgreSQL price | send the expected total and reject if it differs |

## Note: duplicate purchase

If two tabs confirm the purchase at the same time, with different idempotency keys, **two orders may be created**, as long as there is stock. The `idempotencyKey` only prevents repeated requests with the same key.

A per-user lock in Redis would prevent this. It is **not part of the current design** and is recorded for evaluation, in case the prototype needs protection against duplicate purchases.

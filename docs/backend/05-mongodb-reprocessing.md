# MongoDB Reprocessing

Instructions for rebuilding or fixing the views. Documents, indexes, load queries and the write function are in `04-mongodb-model.md`.

> The application commands and tools mentioned here still **need to be implemented** together with the API.

## Principle

The views are rebuilt from the **current state of PostgreSQL**, not from the event history. This is not Event Sourcing.

This relies on three guarantees:

1. Every creation, change or deletion of a category, product or order writes an event **in the same transaction**, including corrections made directly in the database.
2. Every change increments the `version`.
3. Every piece of data in a view exists in PostgreSQL or is computed from it.

Reprocessing does not change business data or access Redis. Processed events are not needed. **Never delete pending events.**

## Which path to use

| Situation | Path |
|---|---|
| MongoDB dropped or lost | **B** is the simplest; **A** avoids a catalog that fills in gradually |
| A document format or a calculation changed | **A**; B works, but mixes formats during the process |
| There are documents that should not exist | **A** |
| PostgreSQL was restored from a backup, or reloaded with new ids | **A**, mandatory |
| One or a few divergent records, with known ids | **B** for those records |
| Only an index changed | create or recreate the index; no reprocessing needed |

After restoring PostgreSQL, MongoDB may have **higher** versions, which the write rule does not replace, or documents with other ids. For categories with new ids, the unique `slug` index would also cause an error.

Before either path, **fix the cause** of the problem. Reprocessing with the same bug in the code repeats the result.

## The lock between the worker and the rebuild

Both use a PostgreSQL advisory lock with key `727001`, a fixed number chosen for this purpose. It does not require a new table.

| Process | Lock | Effect |
|---|---|---|
| Worker | shared, per transaction, without waiting | skips the cycle if a rebuild is running |
| Rebuild | exclusive, per session, with waiting | waits for the current batch and blocks new ones |

The worker must acquire the lock in **every** cycle, before selecting events (`worker-lock`). It is released at the end of the transaction. Two rebuilds also cannot run at the same time.

The API keeps writing to PostgreSQL during the rebuild. Events accumulate and are processed afterwards.

## Path A: rebuild with temporary collections

Proposed application command: `projections:rebuild`, for one collection or for all of them. It uses the **same transformation function** as the worker.

Use **a single connection** to PostgreSQL from step 1 to step 8. Do not use a different pool connection for each command.

### 1. Acquire the lock

Outside any transaction:

```sql
-- rebuild-lock
SELECT pg_advisory_lock(727001);
```

### 2. Prepare the temporary collections

- Drop leftovers from previous runs: `categories_rebuild`, `products_rebuild` and `orders_rebuild`.
- Create the temporary collections **with their indexes**, even if the source table is empty.

### 3. Open a consistent read

```sql
-- rebuild-begin
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
```

The order of steps 1 and 3 matters. PostgreSQL fixes the snapshot of the data at the first query of the transaction. If the lock were requested inside it, that snapshot could predate the end of the worker's last batch.

### 4. Copy in batches

For each collection, fetch the ids in batches, starting with `00000000-0000-0000-0000-000000000000`:

```sql
-- rebuild-ids-categories
SELECT id FROM categories WHERE id > $1 ORDER BY id LIMIT 500;
```

```sql
-- rebuild-ids-products
SELECT id FROM products WHERE id > $1 ORDER BY id LIMIT 500;
```

```sql
-- rebuild-ids-orders
SELECT id FROM orders WHERE id > $1 ORDER BY id LIMIT 500;
```

Load each batch with the corresponding `load-*` query, transform it and insert it into the temporary collection. The last id of the batch is the parameter for the next one. Stop when no id comes back.

Any error **aborts** the rebuild; no document is skipped.

### 5. Check and close the read

Still in the same transaction, the count in each rebuilt temporary collection must be **equal** to the table's:

```sql
-- rebuild-counts
SELECT (SELECT count(*) FROM categories) AS categories,
       (SELECT count(*) FROM products)   AS products,
       (SELECT count(*) FROM orders)     AS orders;
```

An order without items is not returned by `load-order` and will make this check fail. It violates an application rule and must be investigated.

```sql
-- rebuild-commit
COMMIT;
```

If the `COMMIT` or the connection fails, **do not swap**: the lock may have been lost.

### 6. Swap the collections

Rename only the rebuilt collections:

```js
for (const name of ['categories', 'products', 'orders']) {
  await db.collection(`${name}_rebuild`).rename(name, { dropTarget: true });
}
```

Each swap replaces the old collection and takes the indexes from the temporary one. **The three swaps are not a single operation**, and in-flight queries may be interrupted.

### 7. Reactivate events that exhausted their attempts

```sql
-- retry-failed
UPDATE outbox_events
SET attempts = 0, last_error = NULL
WHERE processed_at IS NULL AND attempts >= 10;
```

### 8. Release the lock

```sql
-- rebuild-unlock
SELECT pg_advisory_unlock(727001);
```

The worker resumes processing pending events. Some may already be reflected in the copy; processing them again is safe. Whatever changed after the read started is applied now. This includes new records, even if their UUID sorts "before" the batch already copied.

### If something fails

| Moment | State | What to do |
|---|---|---|
| Before the swaps | current collections intact | end the transaction, release the lock, fix and run again |
| Between the swaps | some collections are new | run the command again, from the start |
| The process crashed | PostgreSQL releases the lock when it notices the connection ended | run again; step 2 cleans up the leftovers |

If the command keeps running after an error, it must `ROLLBACK` and release the lock, or close the connection.

## Path B: requeue records

The worker itself reprocesses. It uses no temporary collections and no pause.

1. Confirm the worker is running the correct code.
2. **Create the indexes** first, especially if MongoDB was dropped.
3. Insert the events.

**All records:**

```sql
-- requeue-all
INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type)
SELECT 'CATEGORY', id, 'ReprocessRequested' FROM categories
UNION ALL
SELECT 'PRODUCT', id, 'ReprocessRequested' FROM products
UNION ALL
SELECT 'ORDER', id, 'ReprocessRequested' FROM orders;
```

To redo just one collection, use only the corresponding `SELECT`.

**One record** (parameters: type and id):

```sql
-- requeue-one
INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type)
VALUES ($1, $2, 'ReprocessRequested');
```

If the id no longer exists in PostgreSQL, the worker deletes the corresponding document.

4. If there are events that exhausted their attempts, run `retry-failed`.
5. Monitor until nothing is pending.

Limitations:

- New events go to the end of the queue and may delay updates made afterwards.
- With an empty MongoDB, the screens fill in gradually.
- Documents whose id is no longer in PostgreSQL are not found by `requeue-all`.
- It does not replace documents with a version higher than PostgreSQL's.

## Monitoring

```sql
-- monitor
SELECT count(*) FILTER (WHERE attempts < 10)   AS pending,
       count(*) FILTER (WHERE attempts >= 10)  AS failed,
       min(occurred_at)                        AS oldest
FROM outbox_events
WHERE processed_at IS NULL;
```

`failed` greater than zero requires analyzing `last_error`. Fix the cause before running `retry-failed`.

## Final check

Do it with an empty queue and, preferably, without new writes. Compare the id and version pairs of the three collections.

```sql
-- verify-categories
SELECT id, version FROM categories ORDER BY id;
```

```sql
-- verify-products
SELECT id, version FROM products ORDER BY id;
```

```sql
-- verify-orders
SELECT id, version FROM orders ORDER BY id;
```

In MongoDB, for each collection:

```js
await db.collection(name).find({}, { projection: { version: 1 } }).sort({ _id: 1 }).toArray();
```

Both lists must have the same ids and versions. Also check the indexes and open a few documents. The comparison **does not detect** a wrong calculation when id and version are correct.

## During reprocessing

| Part of the system | Effect |
|---|---|
| Catalog, categories and history | in path A, old data until the swaps; in B, gradual updates; with MongoDB dropped, empty or incomplete |
| Cart | may show items as unavailable; **reading never deletes them** |
| Checkout | the API keeps validating in PostgreSQL, but the front end may block the purchase if the cart shows unavailable items |
| Sessions | not affected |

## Recommended test for the prototype

When the API is ready:

1. Run the migration and create test orders.
2. Save a copy of the documents.
3. Drop the MongoDB database.
4. Rebuild through path A and compare with the copy.
5. Repeat through path B.
6. Repeat path A while new purchases are made, and check after the queue is empty.

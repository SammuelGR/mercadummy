# Mercadummy 🛒💸

## Development

### Backend

Requirements: Node.js 22 (22.22.3+) or 24 (24.15.0+), and Docker to run the databases locally.

The backend runs as two processes: the **API** and the **outbox worker**, which copies every change in PostgreSQL to the MongoDB views read by the catalog. Run all commands below in `backend/`.

#### Step by step

1. **Configure the environment.** Copy `.env.example` to `.env`. The defaults work with the local containers. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` for the admin account created in step 6.

   ```bash
   cp .env.example .env
   ```

2. **Start the databases** (PostgreSQL, MongoDB and Redis). Skip this step if you set the URLs of your own databases in `.env`.

   ```bash
   docker compose up -d --wait
   ```

3. **Install the dependencies and create the PostgreSQL tables.**

   ```bash
   npm install
   npx prisma migrate deploy
   ```

4. **Start the API** on `http://localhost:3000`, in its own terminal.

   ```bash
   npm run start:dev
   ```

5. **Start the worker** in a second terminal. It creates the MongoDB indexes and keeps the views up to date. Without it, the catalog stays empty.

   ```bash
   npm run start:worker:dev
   ```

6. **Create the admin account**, once. It uses `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `ADMIN_FULL_NAME` from `.env`, or from the command line.

   ```bash
   npm run admin:create
   ```

7. **Import the catalog** from DummyJSON (24 categories, 194 products) through the API. It logs in with the same admin account. Running it again only creates what is missing.

   ```bash
   npm run catalog:import
   ```

8. **Check the catalog.** Products appear after the worker processes the events, usually within a second.

   ```bash
   curl http://localhost:3000/categories
   curl "http://localhost:3000/products?limit=3"
   ```

To run from a build instead of watch mode, use `npm run build`, then `npm start` and `npm run start:worker`.

#### Scripts

| Script                     | What it does                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| `npm run start:dev`        | Starts the API in watch mode, compiled to `dist/`                                                  |
| `npm run start:worker:dev` | Starts the outbox worker in watch mode, compiled to `dist-worker/` so it does not clash with the API |
| `npm run build`            | Compiles the API and the worker to `dist/`                                                         |
| `npm start`                | Starts the API from the build                                                                      |
| `npm run start:worker`     | Starts the worker from the build                                                                   |
| `npm run admin:create`     | Creates an `admin` account in PostgreSQL from `ADMIN_*`; fails without changes if the e-mail exists |
| `npm run catalog:import`   | Imports the DummyJSON catalog through the API (`CATALOG_API_URL`); existing records are skipped    |
| `npm run typecheck`        | Checks the TypeScript types                                                                        |
| `npm run lint`             | Runs ESLint; `npm run lint:fix` applies automatic fixes                                            |
| `npm run format:check`     | Checks the formatting with Prettier; `npm run format` rewrites the files                           |

The scripts that compile code run `prisma generate` first, so the Prisma client always matches `prisma/schema.prisma`. `admin:create` and `catalog:import` compile to `dist-scripts/`.

The environment variables are described in `backend/.env.example` and in [Backend Architecture](docs/backend/architecture.md#configuration). The import is detailed in [DummyJSON Extraction](docs/backend/02-dummyjson-extraction.md#running-the-migration).

#### Validation

Before reporting a change as ready:

```bash
npm run typecheck
npm run lint
npm run format:check
npm run build
```

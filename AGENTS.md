# Canonical Agent Instructions

`AGENTS.md` is the canonical instruction file for AI coding agents working in this repository. Keep other agent-specific instruction files as short pointers to this file.

## Project Summary

Mercadummy is an e-commerce application built around polyglot persistence and CQRS, using PostgreSQL, MongoDB, and Redis.

The project includes product browsing, authentication, shopping cart management, checkout, and order history. The product catalog is initially populated from DummyJSON.

## Documentation Map

### Frontend

- [Architecture](docs/frontend/architecture.md): frontend stack, source organization, routing, state, and API integration.
- [Conventions](docs/frontend/conventions.md): testing, TypeScript, React, imports, linting, formatting, and styling rules.
- [Design](docs/frontend/design.md): visual direction and reference values for color, typography, spacing, and component styling.
- [Screens](docs/frontend/screens.md): screen specifications, navigation, and expected user interactions.

### Backend

- [Architecture](docs/backend/architecture.md): module organization, component responsibilities, CQRS conventions, database integration, and background processing.
- [Overview](docs/backend/README.md): data architecture and database responsibilities.
- [PostgreSQL Model](docs/backend/01-postgres-model.md): write model, entities, relationships, constraints, and business rules.
- [DummyJSON Extraction](docs/backend/02-dummyjson-extraction.md): product and category import specifications.
- [Redis](docs/backend/03-redis.md): session management, shopping cart, and checkout flow.
- [MongoDB Model](docs/backend/04-mongodb-model.md): read models, indexes, queries, and projections.
- [MongoDB Reprocessing](docs/backend/05-mongodb-reprocessing.md): projection rebuilding and recovery procedures.
- [API Contract](docs/backend/06-api-contract.md): endpoints, access rules, requests, responses, and errors.

Read the relevant documentation before implementing or modifying a feature.

## Language

- Write all source code and documentation in English.
- Use English for all user-facing interface text.

## Repository Organization

- `frontend/`: frontend application.
- `backend/`: backend application.
- `docs/`: project documentation, organized by domain.

Keep frontend and backend source code, dependencies, scripts, and configuration within their respective directories.

## Code Quality

- Preserve the strictness of the active TypeScript configuration.
- Prefer explicit types and descriptive names.
- Keep runtime imports and type-only imports distinct.
- Prefer direct, readable implementations with clear responsibilities.
- Introduce shared abstractions when they address concrete requirements.
- Remove unused code, dead exports, and obsolete implementations.
- Use Oxlint in `frontend/` and ESLint with typescript-eslint in `backend/`. Format each application with its own Prettier configuration. Run `npm run lint` and `npm run format:check` from each affected application directory.

## Workflow Rules

- Read the task specification and inspect the affected files before editing.
- Keep changes scoped to the requested task.
- Preserve existing user changes and unrelated code.
- Follow the accepted architecture and established repository conventions.
- Ask before introducing changes to project scope, architecture, data models, or API contracts.

## Decision and Dependency Policy

Treat undocumented product behavior and technical decisions as undecided.

Before adding a dependency, verify that:

- It addresses a concrete project requirement.
- The existing stack cannot address that requirement cleanly.
- The package is maintained and appropriate for the project.

Ask before introducing dependencies that establish or modify the project's technical direction.

## Configuration

- Keep environment-specific configuration in environment variables.
- Document required environment variables in `.env.example` files.
- Keep database connections configurable across development environments.
- Keep credentials, tokens, and other secrets out of version control.

## Testing and Validation

- Read the relevant `package.json` for available scripts and dependency versions.
- Write tests that protect meaningful behavior and business rules.
- Run the relevant build, lint, type-checking, and testing commands before reporting a change as ready.
- Report validation results, failures, and unresolved blockers.
- Preserve existing validation standards when resolving failures.

## Documentation Rules

- Keep documentation factual, concise, and operational.
- Record accepted decisions, constraints, contracts, and relevant tradeoffs.
- Keep standing agent instructions in this file and detailed specifications under `docs/`.
- Update affected documentation when an accepted change modifies a documented decision or contract.
- Keep documentation aligned with the implemented state.

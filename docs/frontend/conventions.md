# Frontend Conventions

## Testing Rules

- Write tests only when they protect meaningful behavior, published content, links, or project-specific business rules.
- Do not add tests only to increase coverage numbers or assert implementation details.
- Keep tests scoped to the component responsibility:
  - Orchestrator components may mock child components and assert composition decisions.
  - Component tests should assert only the content and behavior owned by that component.
  - Content regression tests may render real component trees and use real data when the goal is to protect published content.
- When tests need router context, create a shared render helper that provides a fresh in-memory router for each test. Keep router mocks local to tests that isolate routing dependencies.
- Translation text assertions should usually target the i18n key rendered by the test mock, not the final translated copy. The goal is to verify that the correct translation key is wired into the UI.
- Use explicit fixtures for fake data. Do not mix real production content into fake fixtures unless the test is intentionally validating real content.
- Prefer clear inline assertions. Create local helpers only when they remove meaningful duplication and make the test easier to read.
- Helper names must describe exactly what is being asserted. Avoid vague names such as `expectContent` or helpers that hide the main behavior under test.
- Do not turn secondary implementation details, decorative styling, aria labels, or non-essential copy into unnecessary test contracts.

## TypeScript and React Rules

- Preserve the strictness of the active TypeScript configuration. Do not introduce `any` without a concrete untyped boundary and a locally documented reason.
- Keep runtime imports and type-only imports distinct.
- Declare default-exported React components with `export default function ComponentName()` instead of a separate trailing export.
- Prefer small React components with explicit props types.
- Extract child components or helpers when branching obscures the JSX structure.
- Do not leave unused code, dead exports, or commented-out implementations.

## Import Rules

- The `@/*` alias maps to `src/*`.
- Use local relative imports for files in the same directory or tightly coupled nearby files.
- Use the `@/` alias when it makes cross-directory imports clearer.
- Do not rewrite imports solely for style churn.

## Linting and Formatting Rules

- Follow `.oxlintrc.json` for lint rules and `.prettierrc.json` for formatting.
- Keep code-quality rules in oxlint and formatting concerns in Prettier.
- In multiline JSX, separate adjacent sibling elements and expression blocks at the same indentation level with a blank line.
- Use `npm run lint:fix` for lint fixes and `npm run format:check` for read-only formatting validation. Run both from `frontend/`.

## Styling Rules

- Use Tailwind CSS v4 for styling.
- Import every Lucide icon with an `Icon` suffix alias, for example `import { Menu as MenuIcon } from 'lucide-react'`.
- Global CSS lives in `src/styles/globals.css`.
- Use `src/utils/cn.ts` to compose conditional Tailwind classes and resolve conflicting utilities.
- Keep global CSS limited to Tailwind imports, base element defaults, and truly global browser normalization. Do not duplicate resets already provided by Tailwind's Preflight.
- Place global element styles in `@layer base` and custom design tokens in `@theme`.
- Keep CSS declarations alphabetized inside each rule unless cascade, browser compatibility, or readability requires a different order.
- Keep Tailwind utility classes roughly alphabetized when practical, without sacrificing responsive/state grouping or readability.
- Break long `className` values across lines when they exceed the configured Prettier print width.
- Use Tailwind's `motion-safe:` variant for non-essential CSS movement such as transforms and animations; keep non-motion transitions, such as color changes, outside it.
- Do not add theme tokens, fonts, color palettes, or design-specific values until those decisions are explicitly accepted.
- Do not create component CSS files unless Tailwind utilities are insufficient for a concrete implementation.


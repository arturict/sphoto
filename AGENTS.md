# SPhoto agent notes

Self-hosted paid photo storage on Immich. Read `README.md` and `docs/ARCHITECTURE.md` first.

## Layout

- `apps/api`: Hono API, `node:sqlite`, jobs. Workflows in `src/services`, scheduled tasks in `src/jobs`.
- `apps/web`: Vite + React + TanStack Router. German UI.
- `packages/shared`: zod schemas that define the API contract. Change them first, then API and web.
- `e2e`: Playwright journeys against the Docker stack (`compose.yaml` + `compose.test.yaml`).

## Commands

pnpm only. Run heavy jobs through `capped` on the Linux nodes.

```bash
pnpm install
pnpm check                                   # lint, typecheck, test, build
pnpm --filter @sphoto/api test               # one package
pnpm --filter @sphoto/e2e stack:up && pnpm --filter @sphoto/e2e test
```

## Rules

- Every external system (Immich, Stripe, mail) sits behind an interface with a test double in
  `apps/api/src/testing`. Test behaviour through those doubles; do not mock internals.
- Webhook handlers and scheduled tasks must stay idempotent. A migration or deletion must never remove
  data before its replacement exists.
- No secrets in the repository. `.env.example` holds placeholders only; e2e secrets are generated per run.
- Immich API calls follow the v3 OpenAPI spec (`immich-app/immich`, `open-api/immich-openapi-specs.json`).
  Check the spec when changing `apps/api/src/immich`.
- UI text and mails are German; code, comments and docs are English.

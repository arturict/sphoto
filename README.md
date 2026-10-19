# SPhoto

Self-hosted, paid photo storage built on [Immich](https://immich.app). Customers sign up for a free
account (5 GB, no machine learning) or subscribe to Basic (200 GB, CHF 5/month) or Pro (1 TB,
CHF 15/month) with face and object search. SPhoto adds what Immich does not have: sign-up and
billing, plan changes with automatic photo migration, exports, account deletion with a grace
period, and an admin view.

Customers use Immich (web and mobile apps) for their photos and the SPhoto portal for their account.

## Architecture

```
          Caddy / reverse proxy (optional)
                       |
   +-------------------+-------------------+
   | app (this repo)   | immich-free       | immich-paid  --> ml (optional)
   | API + web + jobs  | no ML, 5 GB quota | ML, 200 GB / 1 TB quota
   +---------+---------+---------+---------+------+
             |                   |                |
          SQLite            Postgres (2 databases) + Valkey (2 indexes)
```

- `apps/api`: Hono API on Node 24 with `node:sqlite`. Provisions users on the two Immich instances,
  verifies Stripe webhooks, runs migrations and exports in the background, and runs the maintenance
  jobs (deletions, grace periods, reminders, usage snapshots, health checks).
- `apps/web`: Vite, React and TanStack Router. Landing page, checkout status, customer portal and
  admin pages. German UI.
- `packages/shared`: zod schemas for the API contract, used by both sides.
- `e2e`: Playwright journeys against the real stack (real Immich, `stripe-mock`, Mailpit).

The design and its trade-offs are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Running it in
production is in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Develop

Requires Node 24 and pnpm 12 (`corepack enable` picks the pinned version).

```bash
pnpm install
pnpm check        # lint, typecheck, unit tests, build
```

Unit tests (`pnpm test`) cover the API against in-memory doubles of Immich, Stripe and mail. They check
behaviour such as the upgrade migration, grace periods, idempotent webhooks and export rules.

### End-to-end tests

The journeys run against the full Docker stack with tiny quotas and grace periods and synthetic images.

```bash
pnpm --filter @sphoto/e2e exec playwright install chromium
pnpm --filter @sphoto/e2e stack:up      # builds the app, starts Immich, stripe-mock and Mailpit
pnpm --filter @sphoto/e2e e2e
pnpm --filter @sphoto/e2e stack:down    # deletes containers, volumes and built images
```

`SPHOTO_E2E_PROJECT` and `SPHOTO_E2E_PORT_BASE` let several stacks share one machine.

### Run the API against a local stack

`pnpm dev:api` and `pnpm dev:web` (Vite proxies `/api` to port 3000) need the same environment
variables as the container; see [.env.example](.env.example).

## Operate

Copy `.env.example` to `.env`, fill it in and run `docker compose up -d --build`. Details, backups
and the Stripe webhook setup are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## License

SPhoto talks to Immich over its public API and does not include Immich code. Immich is AGPL-3.0.

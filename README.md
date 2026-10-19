# SPhoto

A small, self-hosted photo service around Immich. Create an account, upload photos,
browse a private library, download originals, and manage a storage plan. The
operator gets account usage, plan controls, health checks, and a reconciliation job.

| Plan | Storage quota | Monthly product price |
| --- | --- | --- |
| Free | 5 GB | CHF 0 |
| Basic | 200 GB | CHF 5 |
| Pro | 1 TB (1,000 GB) | CHF 15 |

Quotas use 1,024³ bytes per displayed GB, matching the original product. Prices do
not imply that payment collection is configured. Manual billing collects no money.

## Run the complete stack

Requirements: Docker Engine with Compose v2 (or Docker Desktop in Linux-container
mode), about 4 GB of available memory, and enough disk space for originals and the
Immich images. No Bun, API key, public DNS, Docker socket mount, or manual Immich
setup is required.

```sh
cp .env.example .env
# Set ADMIN_EMAIL, ADMIN_PASSWORD, SESSION_SECRET and DB_PASSWORD.
# Generate separate random values, for example: openssl rand -hex 32
# PUBLIC_URL must be the browser origin, without a trailing slash.
docker compose up -d --build --wait --wait-timeout 300
```

Open `http://localhost:19000`. Sign up to create a Free library. The operator signs
in through the same page using `ADMIN_EMAIL` and `ADMIN_PASSWORD`; these credentials
also initialize the bundled Immich administrator on the first startup. An existing
Immich volume must already have an administrator with those credentials. Changing
the environment later does not reset an existing password.

The app and native Immich UI (port 19283) bind to loopback by default. To use the
Immich apps or native UI remotely, expose Immich through a separately configured
HTTPS reverse proxy. Use the same customer credentials. SPhoto's upload form
accepts one JPEG, PNG, or WebP up to 25 MB; larger files, videos, albums, removal,
and bulk exports use the native Immich UI. ML features are disabled in this subset.

The full stack is four services: SPhoto, Immich v3.3.3, PostgreSQL with Immich's
vector extensions, and Valkey. Images/configuration follow that Immich release's
upstream Compose. Project-scoped named volumes persist SQLite, PostgreSQL, and
photos. No external network or pre-existing instance is needed.

For an isolated test installation, `node scripts/test-env.mjs` creates a fresh
`.env` with random synthetic credentials and refuses to overwrite an existing file.
Set unique Compose project names and ports when running multiple copies.

## Development and checks

Use Node.js 24 and the pnpm version pinned in `package.json`:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm check                       # typecheck, lint, HTTP/unit tests, production build
# Start the Compose stack first, then exercise it in Chromium:
pnpm exec playwright install chromium
pnpm test:e2e
```

On Artur's Linux fleet, prefix installs, builds, tests, browser installs, and dev
servers with `capped` (for example `capped -m 2G -c 2 pnpm check`). The E2E suite uses
the `.env` operator credentials and creates synthetic accounts and photos. Run it
only on an isolated test stack; remove that stack's volumes afterward.

To run SPhoto outside Docker while using the bundled dependencies, start
`docker compose up -d immich`, set `IMMICH_URL=http://localhost:19283` and `PORT=19000`
in `.env`, then run `pnpm dev`. Do not run the containerized app on the same port.
`pnpm build` emits `dist/`; `node --env-file=.env dist/server.js` runs that build.

## Billing

`BILLING_MODE=manual` is the default. Operators grant Basic/Pro in `/admin`.
Downgrades below current usage are rejected. The dashboard displays monthly plan
value, **not collected revenue**.

For Stripe, set `BILLING_MODE=stripe`, the API and webhook secrets, and two distinct
monthly CHF Price IDs: Basic CHF 5, Pro CHF 15, quantity one. Configure the Stripe
Customer Portal for plan changes and cancellation. Register `/webhooks/stripe`
for `checkout.session.completed`, `customer.subscription.created`,
`customer.subscription.updated`, and `customer.subscription.deleted`.

Customers sign up for Free before checkout. Checkout redirects never grant storage:
signed events retrieve the current Stripe subscription, apply the quota in Immich,
then persist the plan and event ID. Checkout attempts reuse a persisted open
session and Stripe idempotency key, avoiding duplicate subscriptions on retries.
A 15-minute job repairs missed subscription updates. Retry failed events in Stripe;
failed processing returns an error and never marks the event complete.

`active`, `trialing`, and `past_due` retain paid storage while Stripe handles
payment retries. Other states revert to Free. Cancellation never deletes photos:
existing files remain downloadable, and Immich blocks uploads when over quota.
Do not enable public sales until you have verified your actual Stripe test-mode
checkout/portal, HTTPS routing, email/password recovery, backups, retention policy,
and storage capacity. No real Stripe account or payment was used in the tests.

## Operations

- `/health/live`: process liveness; `/health/ready`: Immich connectivity.
- `/admin`: accounts, usage, manual plan changes, and the last 20 job results.
- Reconciliation runs on startup and every 15 minutes. It checks Immich, refreshes
  subscription state/quotas, and purges expired app sessions. Operators can run it
  from the dashboard; runs serialize with billing changes.
- Keep `SESSION_SECRET` stable. Immich session tokens are AES-256-GCM encrypted in
  SQLite; browser cookies are random, hashed at rest, HttpOnly, SameSite=Strict,
  and Secure when `PUBLIC_URL` uses HTTPS. Passwords are handled by Immich and are
  not stored in SPhoto. Rotating the secret invalidates stored sessions; clear the
  sessions table during a planned rotation.
- Back up the **three volumes together**, plus the private `.env`. Stop the stack
  for a consistent offline backup; restore into an isolated project and test it.
  PostgreSQL holds Immich's index; the photos volume alone is insufficient. There
  is no automated backup or restore service in this rebuild.
- Local stop: `docker compose down`. Only for disposable test data:
  `docker compose down --volumes --rmi local`.
- Never expose the initial Immich setup endpoint to the public before the app has
  initialized it. Keep its default loopback binding or remove the host port.
- Public access needs an HTTPS reverse proxy and an exact `PUBLIC_URL`. The app
  does not trust proxy-supplied client IPs: authentication limits are per direct
  peer (a proxy shares one limit). Multi-replica operation is not supported.

## Scope and migration

This is a rebuild with a deliberate subset, not an in-place migration of old
customer JSON or separate free/paid Immich databases. Existing installations need
an explicit data and billing migration before switching traffic. Nothing is
currently deployed by this branch.

See [the original feature inventory and scope decisions](docs/feature-inventory.md)
and [verification evidence and gaps](docs/verification.md). The previous code is
preserved in Git at `ed6790667999d04e1dc09206cde0bb7ba51195fc`.
Immich remains a separate AGPL-3.0 licensed service; this app does not vendor or
patch its source. No application license is assigned by this rebuild.

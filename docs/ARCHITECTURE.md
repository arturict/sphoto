# Architecture and decisions

## Product scope

| Area | Behaviour |
| --- | --- |
| Free signup | Email only. SPhoto creates the Immich user on the free instance (5 GB quota) and mails the generated password. |
| Paid signup | Stripe Checkout (Basic or Pro). The `checkout.session.completed` webhook creates the user on the paid instance. |
| Upgrade free to paid | Same checkout. SPhoto copies every asset (originals, favourites, archive state, live-photo pairing) and album to the paid instance, then removes the free account. The free account stays untouched until all files arrived. |
| Plan change Basic/Pro | Done in the Stripe billing portal. The `customer.subscription.updated` webhook changes the Immich quota. |
| Cancellation | `customer.subscription.deleted` starts a grace period (14 days, with reminders). Afterwards the account moves to the free instance if it fits the free quota. If it does not fit nothing is deleted; the customer and the admin are notified once. |
| Export | One per 30 days. SPhoto asks Immich for ZIP archives (4 GB parts), stores them for 7 days and shows download links with SHA-256 sums in the portal. |
| Account deletion | Requested in the portal, executed after a grace period (14 days) that the customer can cancel. Cancels the subscription, deletes the Immich user and anonymises the record. |
| Portal login | Magic link by mail (15 minutes, single use), then an HttpOnly session cookie (7 days). |
| Admin | Bearer key. Overview (users, MRR, instance health), users and actions, jobs, analytics. |
| Monitoring | Health check of both instances every cycle, admin mail after two failures and on recovery, quota warnings to customers at 80 and 95 percent, daily usage snapshots. |

## Components

- **Two Immich instances** keep the cost model simple: only the paid instance runs machine learning.
  They share one Postgres (two databases) and one Valkey (two indexes) to save memory.
- **API** (`apps/api`) is a modular monolith: `services/*` hold the workflows, `http/app.ts` is the
  thin HTTP layer, `jobs/maintenance.ts` the scheduled tasks. Every external system sits behind an
  interface (`ImmichGateway`, `Billing`, `Mailer`) with a real implementation and a test double.
- **Storage** is SQLite in a named volume. One writer, tiny data (users, tokens, jobs), backups are a
  file copy. Rows are validated with zod when read.
- **Web** (`apps/web`) is a static SPA served by the API container. The browser only talks to `/api`.

## Immich access model

Immich keeps administrators out of other users' libraries. SPhoto therefore holds two kinds of keys:

- one **admin automation key** per instance with only the permissions it needs (create, read, update
  and delete users, server statistics). The API creates the admin account and this key itself on first
  start, so nothing has to be pasted into `.env` by hand;
- one **per-user key** with read, download, upload and album permissions, created right after the
  user is created, while SPhoto still knows the generated password. Exports and migrations use it.
  It is stored in the SPhoto database; whoever can read that database can read the photos of every
  customer, which is the same trust level the operator already has through the Immich admin account.

## Reliability rules

- Stripe webhooks are idempotent: processed event ids are stored, and handlers tolerate a replay of the
  same checkout. A failing handler answers 500 so Stripe retries.
- A migration copies first and switches second. Any failed file aborts it, the target account is removed
  again and the source account stays as it was. Re-running is safe because the target is rebuilt.
- Background work (migrations, exports) is recorded in the `jobs` table. A restart marks interrupted jobs
  as failed so the customer can retry; nothing resumes half-way.
- Scheduled tasks are plain functions of `(database, clock, gateways)` and run one after another; one
  failing task does not stop the others.

## Deliberately dropped from the previous version

| Dropped | Why |
| --- | --- |
| Siloed mode (one Immich stack per customer, Docker socket access, per-customer subdomains) | Two shared instances are the documented default. Per-customer provisioning needed `docker.sock` access and a lot of code that was dead in shared mode. |
| Nextcloud platform option | Half implemented, not part of the SPhoto product. |
| Per-instance branding and custom CSS | Only existed for siloed instances. |
| Maintenance windows, alert settings per instance | Replaced by fixed health checks, quota warnings and admin mails. |
| Separate stats service | It read siloed metadata and was empty in shared mode. Usage and MRR are part of the admin pages. |
| Traefik with a body-rewrite plugin | An optional Caddy file replaces it. Customers are linked to the portal from mails and the SPhoto site. |
| Upgrade proration preview | Plan changes between Basic and Pro happen in the Stripe billing portal, which shows proration itself. |
| Google Photos migration page | A static guide to third-party tools; the landing FAQ covers it in two sentences. |
| Immich forks and workflows (`.github/workflows/*`, mobile, docs, SDK) | Leftovers from an upstream copy; the cause of the permanently red CI. |

## Known limits

- Migrations and exports run sequentially in one process (files are streamed, not buffered). Very large
  libraries take a long time; there is no resume.
- Locked-folder assets and trashed assets are not migrated or exported (they need a PIN session or are
  intentionally excluded).
- Face data and machine-learning results are not carried over; the paid instance recomputes them.
- Moving between instances changes the server address and password in the customer's Immich app.
- Admin authentication is a single shared key without rate limiting; put the API behind a reverse proxy
  that limits requests if it is exposed publicly.

# Original product and rebuild scope

Inventory written from `clean-tanstack` at
`ed6790667999d04e1dc09206cde0bb7ba51195fc`, before replacing the tree. The branch
name and repository instructions were stale: `web/package.json` actually ran
Next.js 15 / React 19, not TanStack. This document describes implemented surfaces,
not evidence that the old features worked in production.

| Original area and source | Implemented surface | Rebuild decision |
| --- | --- | --- |
| `README.md`, `automation/src/config.ts`, web landing | Free 5 GB, Basic 200 GB / CHF 5, Pro 1,000 GB / CHF 15; privacy/hosting/ML claims; Immich and Nextcloud selectors | Keep prices and quotas. Remove claims about encryption, EU hosting, support and ML that this stack cannot establish. |
| `web/src/app/page.tsx`, success and checkout-error pages | Landing, free registration, checkout, provisioning status | Replace with server-rendered HTML; customer signs up before checkout. No SPA framework needed for these forms. |
| `automation/src/shared-users.ts` | Shared free/paid Immich accounts, quota updates, tier migration, JSON user files | Keep account and quota behavior in one shared Immich instance. SQLite owns product records; no photo movement on plan changes. |
| `automation/src/instances.ts`, `instance-template.yml`, `subdomain.ts` | Siloed Immich and Nextcloud Compose generation, per-customer domains, starts/stops/deletes, storage migration | Drop. A Docker socket and arbitrary stack lifecycle are unnecessary for one bounded photo service. Nextcloud is a separate product. |
| `automation/src/stripe.ts`, portal upgrade flow | Checkout, webhooks, subscription changes/payment failures, billing portal, plan changes | Keep authenticated Stripe checkout/portal, signature validation, durable deduplication, current-state reconciliation and cancellation quotas. Add explicit manual billing mode. No email-based account provisioning. |
| `web/src/app/portal/page.tsx`, `index.ts` portal routes | Email login tokens, usage, cancellation, account-deletion grace periods, export requests | Password login via Immich replaces email links. Keep usage and billing. Deletion/grace periods and self-service password recovery are excluded pending a retention/email design. |
| `automation/src/export.ts` | ZIP exports, expiring download tokens, notification emails | Keep individual original download in SPhoto; bulk exports remain in native Immich. Remove duplicate export workers and token lifecycle. |
| `web/src/app/migrate/google-photos/page.tsx` | Google Takeout / immich-go instructions | Drop product-specific page. There was no Takeout importer to preserve; native Immich tooling remains available. |
| `automation/src/plan-migration.ts` | Upgrade/downgrade checks and migrations | Keep quota changes and reject unsafe manual downgrades. Stripe cancellation preserves data while blocking over-quota uploads. No cross-instance copying. |
| Admin pages for shared users, plans, health, analytics, alerts, branding and maintenance | Customer CRUD, sync/import/orphan cleanup, revenue, per-instance stats; operational controls | Keep a single operator dashboard for managed accounts, actual Immich usage, plan grants and visible job results. No shell-based upgrades, deletion or repair endpoints. |
| `stats/server.js` | Basic-auth dashboard, scans silo metadata and `du`, up to 100 Stripe subscriptions for MRR | Remove service. It did not read the shared-user records used by the default mode; plan value is shown honestly rather than presented as collected MRR. |
| `automation/src/analytics.ts`, `alerts.ts`, `health.ts` | Daily snapshots, storage/inactivity/down/churn alerts, health histories | Keep current health, usage and recorded reconciliation outcomes. Drop historical charts, inferred churn and email alerts. |
| `automation/src/maintenance.ts`, `branding.ts`, `email.ts` | Planned maintenance/status, notifications, injected CSS, Resend welcome/login/export/cancellation mail | Drop; each adds state and operational promises beyond the working storage/billing path. No email provider is required locally. |
| `automation/src/index.ts` timers | Startup/4h stats, 6h alerts, hourly maintenance notifications, 15m health, expired exports | Replace with one serialized startup/15-minute job: health, Stripe state, quota repair and session expiry; manual retry and durable outcomes. |
| `instances/free`, `instances/paid`, root/Coolify/local Compose variants, Traefik, patched Immich web image | Multiple networks and prestarted instances, separate ML service, proxy routing, source patching | Replace with one complete Compose file and upstream pinned Immich images. ML is disabled for **all** plans; no per-tier AI entitlement is advertised. |
| `automation/src/__tests__` | Bun utility/config/message/subdomain tests | Replace with Node HTTP integration tests, SQLite persistence/security tests, actual Stripe SDK fixtures and full-stack Playwright journeys. No Bun-specific runtime APIs are needed. |
| `.github/workflows/` | Mostly inherited Immich mobile/server/SDK/translations/release automation | Remove. Those referenced absent Immich source directories, upstream GitHub App secrets, or unrelated release machinery. One CI workflow checks this app and boots the real Compose stack. |
| `.shared/ui-ux-pro-max`, `.claude`, legacy scripts, Makefile and scaling docs | Agent assets, old setup/deploy utilities and architecture variants | Remove from the product tree; replace with current instructions and reproducible test setup. |

## Design

One Node.js 24 / TypeScript process serves HTML/forms and runs billing/automation.
Express handles HTTP, Zod validates external inputs and upstream JSON, SQLite
records accounts/sessions/events/checkouts/jobs, and the official Stripe SDK handles
billing. Immich owns authentication, originals, image processing and upload quota
enforcement; PostgreSQL and Valkey support it. Customer photo requests always use
that customer's Immich token. The app never mounts Docker's socket.

This keeps the paid photo-storage purpose while removing instance orchestration
and unrelated product branches. Native Immich provides its richer photo journeys.
The SPhoto gallery intentionally supports small image uploads and paginated
browsing; it does not claim complete feature parity with the previous UI.

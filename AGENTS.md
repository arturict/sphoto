# Project Overview

## Astra working defaults

These instructions are tuned for GPT-6 Astra. They guide execution; they do not
change the selected runtime model or expand access and external-action authority.

- Infer the intended outcome from the full conversation. Treat actionable
  requests such as “can you fix” as authorization to do the scoped work. Continue
  through implementation and verification; answer pure advice questions as advice.
- Resolve routine choices from evidence and state material assumptions. Ask only
  when an unresolved answer changes scope, correctness, cost, or authority.
  Continue independent work while waiting; incorporate steering without restarting.
- Complete authorized preparation before seeking final approval. Reuse earlier
  authorization; preserve the explicit deployment, communication, purchase,
  privacy, and destructive-action limits below. Do not invent permission gates.
- User instructions outrank skill guidelines, subject to system/developer rules.
  If a skill blocks progress, link its exact `SKILL.md`, quote the relevant rule,
  and explain the concrete conflict; do not present an interpretation as a rule.
- Delegate independent investigations, disjoint edits, or reviews when parallel
  work saves time or improves quality. Give each worker a bounded outcome and
  file ownership; integrate centrally. Respect harness limits and explicit user
  model choices. Skip delegation overhead for a short, coupled task.
- Use the smallest meaningful verification for the change and complete applicable
  repository gates. For instruction-only edits, inspect conflicts, paths, diffs
  and secrets; skip application builds unless runtime behavior is affected.
  Repeat passing checks only after a relevant change or new evidence. Do not add
  tests that merely restate implementation or remove useful behavioral coverage.
- Lead with the result in concise, plain prose. Use lists when they help scanning;
  avoid canned summaries, jargon and performative narration. Report what changed,
  what was verified, and material limits; never turn a local check into a live claim.

SPhoto is a self-hosted, multi-tenant photo cloud platform built on [Immich](https://immich.app).
It automates customer provisioning via Stripe webhooks, spinning up isolated Immich instances with
dedicated PostgreSQL and Redis containers. Traefik handles SSL termination and wildcard subdomain
routing. The platform offers two plans: Basic (200 GB, CHF 5/month) and Pro (1 TB, CHF 15/month).

## Repository Structure

- `automation/` — Bun/TypeScript API server handling Stripe webhooks, instance lifecycle, and
  admin endpoints.
- `web/` — Next.js 15 frontend with landing page, checkout flow, success page, and admin dashboard.
- `stats/` — Express dashboard for viewing instance stats and Stripe revenue.
- `instances/` — Runtime directory where per-customer docker-compose stacks are generated.
- `docker-compose.yml` — Orchestrates Traefik, ML service, automation, stats, and web containers.
- `.env.example` — Template for required environment variables (Stripe, Resend, admin auth).
- `instance-template.yml` — Docker Compose template used when provisioning new customer instances.

## Build & Development Commands

```bash
# Clone and enter project
git clone https://github.com/arturict/sphoto.git /opt/sphoto
cd /opt/sphoto/sphoto

# Copy and configure environment
cp .env.example .env
nano .env   # fill in Stripe, Resend, admin credentials

# Start all services (production)
docker compose up -d --build

# View logs
docker compose logs -f automation
docker compose logs -f web

# Rebuild a single service after code changes
docker compose up -d --build automation

# Stop all services
docker compose down

# =============================================================================
# DEPLOYMENT ON VM (after git push)
# =============================================================================
# SSH into VM, then run:
cd /opt/sphoto/sphoto
git pull

# Full rebuild (recommended after major changes):
docker compose down
docker compose up -d --build

# Quick update (specific services only):
docker compose up -d --build automation web

# If old containers are still running, force remove:
docker ps -a | grep sphoto
docker compose down --remove-orphans
docker compose up -d --build

# =============================================================================
# LOCAL DEVELOPMENT (requires Bun)
# =============================================================================
# First-time setup:
./scripts/dev-setup.sh

# Or manually:
make dev-setup       # Creates .env.local, installs deps
make dev             # Start Immich containers
make web             # Start web on :3000 (Terminal 1)
make automation      # Start automation on :3001 (Terminal 2)

# Individual commands:
cd web && bun install && bun run dev         # Web dev server
cd automation && bun install && bun run dev  # Automation dev server

# Code quality:
make typecheck       # TypeScript check (automation)
make lint            # ESLint (web)

# See docs/LOCAL-DEVELOPMENT.md for detailed instructions

# Health check
curl https://api.sphoto.arturf.ch/health
```

## Code Style & Conventions

| Area              | Convention                                                             |
|-------------------|------------------------------------------------------------------------|
| Language          | TypeScript everywhere (strict mode enabled)                            |
| Formatting        | Prettier defaults; 2-space indent; single quotes                       |
| Naming            | camelCase for variables/functions; PascalCase for components/types     |
| Commits           | Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)              |
| Imports           | Absolute imports via `@/` alias in web and admin apps                  |
| React             | Functional components with hooks; prefer `use client` only when needed |
| CSS               | Tailwind CSS; shadcn/ui components; no custom CSS unless necessary     |
| API keys          | Never commit secrets; use `.env` and `x-api-key` header                |

## Architecture Notes

```
                      *.sphoto.arturf.ch
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                         TRAEFIK                              │
│           (TLS termination, routing, Let's Encrypt)          │
└─────────────────────────────┬────────────────────────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
       ▼                      ▼                      ▼
┌────────────┐        ┌─────────────┐        ┌─────────────┐
│    web     │        │ automation  │        │   stats     │
│ (Next.js)  │        │ (Bun/TS)    │        │ (Express)   │
│ :3000      │        │ :3000       │        │ :3000       │
└────────────┘        └──────┬──────┘        └─────────────┘
                             │
     ┌───────────────────────┼───────────────────────┐
     │                       │                       │
     ▼                       ▼                       ▼
┌──────────┐          ┌──────────┐          ┌──────────┐
│ instance │          │ instance │          │ instance │
│  alice   │          │   bob    │          │  carol   │
│ (immich) │          │ (immich) │          │ (immich) │
└────┬─────┘          └────┬─────┘          └────┬─────┘
     │                     │                     │
     └─────────────────────┼─────────────────────┘
                           ▼
                  ┌────────────────┐
                  │   sphoto-ml    │
                  │ (shared, 16GB) │
                  └────────────────┘
```

**Data Flow:**
1. Customer visits `sphoto.arturf.ch`, picks a plan, enters desired subdomain.
2. `web` redirects to Stripe Checkout with subdomain stored in metadata.
3. On successful payment, Stripe sends `checkout.session.completed` webhook to `automation`.
4. `automation` generates a docker-compose file under `instances/<subdomain>/`, starts containers,
   creates admin user with `shouldChangePassword: true`, and sends welcome email via Resend.
5. Customer accesses their instance at `<subdomain>.sphoto.arturf.ch`.

## Testing Strategy

The automation server has comprehensive unit tests using Bun's built-in test runner.

### Running Tests

```bash
# Run all tests
cd automation && bun test

# Run tests in watch mode (re-runs on file changes)
cd automation && bun test --watch

# Run a specific test file
cd automation && bun test src/__tests__/utils.test.ts

# Run tests with coverage (if needed)
cd automation && bun test --coverage
```

### Test Structure

Tests are located in `automation/src/__tests__/`:

| File                  | Tests                                          |
|-----------------------|------------------------------------------------|
| `utils.test.ts`       | Utility functions (formatBytes, generatePassword, etc.) |
| `subdomain.test.ts`   | Subdomain validation and reserved names        |
| `config.test.ts`      | Configuration and environment parsing          |
| `messages.test.ts`    | Centralized German messages                    |

### Writing New Tests

For new behavior or a defect, add a meaningful regression test when it can
verify the contract. Do not add tests for prose edits or trivial wrappers:

```typescript
// automation/src/__tests__/myfeature.test.ts
import { describe, expect, test } from 'bun:test';
import { myFunction } from '../mymodule';

describe('myFunction', () => {
  test('does something', () => {
    expect(myFunction()).toBe(expectedValue);
  });
});
```

### Code Quality Commands

```bash
# Automation quality check (when automation behavior changes)
cd automation && bun test && bun run typecheck

# Web app checks
cd web && bun run lint && bun run build
```

| Layer       | Tool          | Command            | Notes                                   |
|-------------|---------------|--------------------|-----------------------------------------|
| Unit        | Bun Test      | `bun test`         | Automation server logic                 |
| Lint        | ESLint        | `bun run lint`     | Web app (via Next.js config)            |
| Type-check  | TypeScript    | `bun run typecheck`| Automation; `bun run typecheck` for web |
| E2E         | —             | —                  | > TODO: Playwright for checkout flow    |
| CI          | —             | —                  | > TODO: GitHub Actions workflow         |

## Security & Compliance

- **Secrets:** All credentials live in `.env` (never committed). Use `openssl rand -hex 32` for
  `ADMIN_API_KEY`.
- **Authentication:** Admin endpoints require `x-api-key` header. Traefik dashboard protected by
  HTTP Basic Auth (`TRAEFIK_AUTH` hash).
- **Docker Socket:** Automation container mounts `/var/run/docker.sock` (privileged). Limit host
  access accordingly.
- **License:** Project uses Immich (AGPL-3.0). Source code must remain public if distributed.
- **Backups:** No automated backups; customers are responsible for their own data exports.
- **Dependency Scanning:** > TODO: Enable `npm audit` / `bun audit` in CI.

## Agent Guardrails

1. **Do not modify:**
   - `.env` or any file containing secrets.
   - `instances/` directory (runtime-generated).
   - Live deployment state without explicit approval. A requested local
     `docker-compose.yml` patch may be prepared and validated before approval to apply it.

2. **Required human review before merge/deployment (prepare and verify the patch first):**
   - Changes to `automation/src/stripe.ts` (payment logic).
   - Changes to Dockerfile or base images.
   - Any new environment variable.

3. **Rate limits:**
   - Stripe API: respect Stripe rate limits (100 req/s).
   - Resend: free tier allows 100 emails/day.

4. **Testing before merge (runtime changes; document-only edits use document checks):**
   - Run `bun run typecheck` in `automation/`.
   - Run `bun run lint && bun run build` in `web/`.

## Extensibility Hooks

| Hook                     | Location                          | Description                            |
|--------------------------|-----------------------------------|----------------------------------------|
| Plan pricing             | `automation/src/config.ts`        | PLANS object with storage/price        |
| Email templates          | `automation/src/email.ts`         | HTML email content                     |
| Reserved subdomains      | `automation/src/config.ts`        | RESERVED_SUBDOMAINS array              |
| Instance template        | `instance-template.yml`           | Docker Compose for new instances       |
| Feature flags            | Environment variables             | e.g., `IMMICH_VERSION`                 |
| UI components            | `web/src/components/ui/`          | shadcn/ui primitives                   |

## Further Reading

- [Immich Documentation](https://immich.app/docs)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Traefik v2 Docs](https://doc.traefik.io/traefik/)
- [Bun Runtime](https://bun.sh/docs)
- `README.md` — Quick-start guide and architecture overview
- `.env.example` — Full list of environment variables with comments

## btca

Use btca (Bun TypeScript Codebase Assistant) for codebase/docs questions when the user says "use btca".

### Quick Reference

```bash
# Ask a single question
btca ask -r <resource> -q "<question>"

# Interactive TUI session
btca chat -r <resource>

# List configured resources
btca config resources list

# Add a new resource
btca config resources add -n <name> -t git -u <repo-url> -b <branch>

# Set AI model
btca config model -p <provider> -m <model>
```

### Available Resources

- `svelte` - Svelte framework docs
- `tailwindcss` - Tailwind CSS docs
- `immich` - Immich photo server docs

### Adding New Resources

To add a git repository as a resource:

```bash
btca config resources add -n <name> -t git -u https://github.com/org/repo -b main
```

### Installation

If btca is not installed:

```bash
bun add -g btca opencode-ai && btca
```

# SPhoto agent guide

Read README.md and docs/feature-inventory.md. This branch is a full rebuild, not the
old Next.js/Bun/siloed-instance product. Use Node 24, TypeScript, pnpm, and one
Compose stack. The code is in src/, behavioral HTTP tests in test/, and real-stack
browser journeys in test/e2e/.

- Preserve unrelated work. Never read or modify another rebuild agent's branch or folder.
- Do not commit secrets or authentication state. .env.example contains placeholders.
- Keep per-customer photo requests on the customer's Immich token. Administrator
  credentials are only for provisioning, quota changes and operator views.
- No Docker socket mounts, shell-based tenant provisioning, or destructive repair APIs.
- Validate inputs and upstream responses with schemas; no any or type assertions.
- pnpm check runs the required typecheck, lint, behavioral tests and build.
- On Linux fleet nodes run installs, builds, tests and browsers through capped.
- Runtime/Compose changes require an isolated full-stack test with synthetic data.
  Set a unique Compose project and ports, then clean up only your own resources.
- Never run E2E against production or preserve test credentials in artifacts.
- Billing logic, Docker/base-image changes and new configuration need human review
  before merge or deployment. Preparation and local tests are authorized by a rebuild task.
- Do not merge, deploy, change repository settings or alter unrelated PRs without
  explicit authorization. Keep commit messages plain with the model co-author line.

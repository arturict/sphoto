# Local Development Guide

This guide covers setting up SPhoto for local development on your machine.

## Prerequisites

| Tool | Version | Installation |
|------|---------|--------------|
| **Bun** | 1.0+ | `curl -fsSL https://bun.sh/install \| bash` |
| **Docker** | 20.0+ | [docs.docker.com/get-docker](https://docs.docker.com/get-docker/) |
| **Docker Compose** | 2.0+ | Included with Docker Desktop |

### WSL2 Users (Windows)

If you're developing on Windows with WSL2:

1. **Use Bun instead of npm** - This project uses Bun for all JavaScript/TypeScript operations. Bun handles WSL2 paths correctly, unlike npm which can have issues with UNC paths.

2. **Store the repo inside WSL** - Clone the repo to a Linux path (e.g., `~/repos/sphoto`), not a Windows mount (e.g., `/mnt/c/...`). This significantly improves performance.

3. **Docker Desktop** - Enable "Use the WSL 2 based engine" in Docker Desktop settings.

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/arturict/sphoto.git
cd sphoto/sphoto

# 2. Run setup script (creates .env.local, installs deps)
./scripts/dev-setup.sh

# 3. Edit your environment variables
nano .env.local  # or your preferred editor

# 4. Start Immich containers
make dev

# 5. In separate terminals:
make web          # Terminal 1: http://localhost:3000
make automation   # Terminal 2: http://localhost:3001
```

## Detailed Setup

### 1. Environment Setup

Run the setup script:

```bash
./scripts/dev-setup.sh
```

This script:
- Checks prerequisites (Bun, Docker)
- Creates `.env.local` from template
- Creates local data directories
- Cleans any corrupted node_modules (WSL fix)
- Installs all dependencies

### 2. Configure Environment Variables

Edit `.env.local` with your settings:

```bash
# Required for basic functionality
ADMIN_API_KEY=your-secret-key     # Generate: openssl rand -hex 32

# Required for Immich instances (get after step 3)
SHARED_FREE_API_KEY=              # From http://localhost:2283
SHARED_PAID_API_KEY=              # From http://localhost:2284

# Optional: For Stripe testing
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Optional: For email testing
RESEND_API_KEY=re_xxx
```

### 3. Start Immich Containers

```bash
make dev
```

This starts two Immich instances:
- **Free instance**: http://localhost:2283
- **Paid instance**: http://localhost:2284

For each instance:
1. Open the URL in your browser
2. Create an admin account
3. Go to **Account Settings → API Keys → Create**
4. Copy the API key to `.env.local`

### 4. Start Development Servers

In **Terminal 1** (web frontend):
```bash
make web
```
→ http://localhost:3000

In **Terminal 2** (automation API):
```bash
make automation
```
→ http://localhost:3001

## Available Commands

### Development

| Command | Description |
|---------|-------------|
| `make dev-setup` | First-time setup |
| `make dev` | Start Immich containers + show next steps |
| `make web` | Start web dev server (port 3000) |
| `make automation` | Start automation server (port 3001) |
| `make dev-all` | Start everything in background |

### Immich Containers

| Command | Description |
|---------|-------------|
| `make immich` | Start Immich containers only |
| `make immich-down` | Stop Immich containers |
| `make immich-logs` | Follow Immich logs |

### Dependencies

| Command | Description |
|---------|-------------|
| `make install` | Install all dependencies |
| `make install-web` | Install web dependencies only |
| `make install-auto` | Install automation dependencies only |

### Testing

| Command | Description |
|---------|-------------|
| `make users` | List all shared users |
| `make nuke` | Delete all shared users |
| `make stripe-listen` | Forward Stripe webhooks |

### Code Quality

| Command | Description |
|---------|-------------|
| `make typecheck` | TypeScript check (automation) |
| `make lint` | ESLint (web) |

### Cleanup

| Command | Description |
|---------|-------------|
| `make clean` | Remove all local data + containers |
| `make clean-web` | Remove web node_modules |
| `make clean-auto` | Remove automation node_modules |

## Testing Stripe Webhooks

To test Stripe webhooks locally:

1. Install Stripe CLI: [stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli)

2. Login to Stripe:
   ```bash
   stripe login
   ```

3. Forward webhooks (in a new terminal):
   ```bash
   make stripe-listen
   ```

4. Copy the webhook signing secret and add to `.env.local`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxx
   ```

5. Use test card: `4242 4242 4242 4242`

## Local URLs

| Service | URL | Description |
|---------|-----|-------------|
| Web | http://localhost:3000 | Landing page, checkout |
| Automation | http://localhost:3001 | API server |
| Free Immich | http://localhost:2283 | Free tier instance |
| Paid Immich | http://localhost:2284 | Paid tier instance |

## Troubleshooting

### "Command not found: bun"

Install Bun:
```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc  # or restart terminal
```

### Docker containers won't start

1. Make sure Docker is running:
   ```bash
   docker info
   ```

2. Check for port conflicts:
   ```bash
   lsof -i :2283
   lsof -i :2284
   ```

3. Try a clean restart:
   ```bash
   make clean
   make dev
   ```

### node_modules corrupted (WSL)

This can happen on WSL when npm creates Windows-style temp files. Fix:

```bash
make clean-web clean-auto
make install
```

Or run the setup script which handles this automatically:
```bash
./scripts/dev-setup.sh
```

### Next.js can't find pages/app directory

This is usually a WSL path issue. Make sure:

1. You're using Bun (not npm)
2. The repo is in a Linux path, not `/mnt/c/...`
3. Run `make clean-web && make web`

### "EPERM: operation not permitted" on Windows paths

You're hitting a WSL2 + npm issue. This project uses Bun which doesn't have this problem:

```bash
make clean-web
make web  # Uses Bun, not npm
```

### API requests fail with 401

Make sure your `.env.local` has the correct API keys:

1. `ADMIN_API_KEY` - Your secret admin key
2. `SHARED_FREE_API_KEY` - From Immich at :2283
3. `SHARED_PAID_API_KEY` - From Immich at :2284

## Architecture (Local)

```
┌─────────────────────────────────────────────────────────┐
│                    Your Machine                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐         ┌────────────────┐            │
│  │   Web        │         │   Automation   │            │
│  │   (Bun)      │ ──────> │   (Bun)        │            │
│  │   :3000      │         │   :3001        │            │
│  └──────────────┘         └───────┬────────┘            │
│                                   │                      │
│                     ┌─────────────┴─────────────┐       │
│                     │                           │        │
│              ┌──────▼──────┐           ┌───────▼──────┐ │
│              │  Free       │           │  Paid        │ │
│              │  Immich     │           │  Immich      │ │
│              │  :2283      │           │  :2284       │ │
│              └──────┬──────┘           └───────┬──────┘ │
│                     │                          │        │
│              ┌──────▼──────┐           ┌───────▼──────┐ │
│              │  PostgreSQL │           │  PostgreSQL  │ │
│              │  + Redis    │           │  + Redis     │ │
│              └─────────────┘           └──────────────┘ │
│                                                          │
│  Data stored in: .local/                                 │
│  ├── free/     (uploads, db)                            │
│  └── paid/     (uploads, db)                            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Tips

### Hot Reload

Both `make web` and `make automation` support hot reload:
- Web: Automatic with Next.js
- Automation: Uses `bun --watch`

### Running in Background

To run everything in the background (no hot reload):
```bash
make dev-all
```

### Viewing Logs

```bash
make dev-logs      # Immich container logs
make immich-logs   # Same as above
```

### Reset Everything

To start fresh:
```bash
make clean         # Removes .local/ and containers
make dev-setup     # Re-run setup
```

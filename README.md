# SPhoto - Self-Hosted Photo Cloud

Self-hosted photo storage based on [Immich](https://github.com/immich-app/immich).

## Plans

| Plan | Storage | Price | ML Features |
|------|---------|-------|-------------|
| Free | 5 GB | CHF 0 | - |
| Basic | 200 GB | CHF 5/mo | Yes |
| Pro | 1 TB | CHF 15/mo | Yes |

## Quick Start

### Local Development

```bash
# Prerequisites: Bun 1.0+, Docker

# 1. Setup
./scripts/dev-setup.sh   # or: make dev-setup

# 2. Start Immich containers
make dev

# 3. Start services (separate terminals)
make web          # http://localhost:3000
make automation   # http://localhost:3001
```

**Local URLs:**
- Web: http://localhost:3000
- API: http://localhost:3001
- Free Immich: http://localhost:2283
- Paid Immich: http://localhost:2284

### Production Deployment

```bash
# 1. Clone
git clone https://github.com/arturict/sphoto.git /opt/sphoto
cd /opt/sphoto/sphoto

# 2. Configure
cp .env.example .env
nano .env  # Fill in all values

# 3. Start shared Immich instances
cd instances/free && cp .env.example .env && nano .env && docker compose up -d
cd ../paid && cp .env.example .env && nano .env && docker compose up -d

# 4. Create admin users
# Visit https://free.YOUR_DOMAIN and https://photos.YOUR_DOMAIN
# Create admin accounts, generate API keys

# 5. Add API keys to .env
nano /opt/sphoto/sphoto/.env
# SHARED_FREE_API_KEY=...
# SHARED_PAID_API_KEY=...

# 6. Start main stack
cd /opt/sphoto/sphoto
docker compose up -d --build

# 7. Configure Stripe webhook
# URL: https://api.YOUR_DOMAIN/webhook
# Events: checkout.session.completed, customer.subscription.*
```

### Updating

```bash
cd /opt/sphoto/sphoto
git pull
docker compose up -d --build
```

## Commands

| Command | Description |
|---------|-------------|
| `make dev-setup` | First-time local setup |
| `make dev` | Start Immich containers |
| `make web` | Start web (port 3000) |
| `make automation` | Start API (port 3001) |
| `make typecheck` | TypeScript check |
| `make lint` | ESLint |
| `make clean` | Remove local data |

## Architecture

```
                    *.your-domain.com
                           │
                           ▼
                       TRAEFIK (SSL)
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
   Landing Page      Automation API      Stats Dashboard
   (Next.js)         (Bun/Express)       (Express)
                           │
           ┌───────────────┴───────────────┐
           ▼                               ▼
    FREE INSTANCE                   PAID INSTANCE
    (5GB, no ML)                    (200GB-1TB, ML)
                                           │
                                           ▼
                                    Shared ML Service
```

## Environment Variables

See [.env.example](.env.example) for all options.

**Required:**
- `DOMAIN` - Your domain (e.g., `sphoto.example.com`)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_PRO`
- `RESEND_API_KEY`
- `ADMIN_API_KEY` - Generate with `openssl rand -hex 32`
- `SHARED_FREE_API_KEY`, `SHARED_PAID_API_KEY` - From Immich instances

## Documentation

- [Local Development](docs/LOCAL-DEVELOPMENT.md)
- [Infrastructure & Storage](docs/INFRASTRUCTURE.md)

## License

Based on [Immich](https://github.com/immich-app/immich) (AGPL-3.0)

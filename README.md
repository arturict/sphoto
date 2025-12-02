<p align="center">
  <h1 align="center">📸 SPhoto</h1>
  <h3 align="center">Managed Photo Cloud Platform</h3>
  <p align="center">
    <a href="https://opensource.org/license/agpl-v3"><img src="https://img.shields.io/badge/License-AGPL_v3-blue.svg?style=for-the-badge" alt="License: AGPLv3"></a>
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
    <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker"/>
  </p>
</p>

---

SPhoto is a **managed multi-tenant photo cloud platform** built on top of [Immich](https://immich.app). It provides automated instance provisioning, Stripe billing integration, and a modern admin dashboard.

## ✨ Features

- **🚀 Automated Instance Provisioning** - New customers get their own isolated Immich instance within seconds
- **💳 Stripe Integration** - Subscription billing with automatic plan detection (Basic/Pro)
- **🔐 Auto User Setup** - Admin accounts created automatically with secure passwords
- **📧 Email Notifications** - Welcome emails via Resend with login credentials
- **🎛️ Admin Dashboard** - Manage all instances, start/stop/delete with one click
- **🌐 Custom Subdomains** - Each customer gets `username.yourdomain.com`
- **📊 Storage Quotas** - Automatic quota enforcement per plan (200GB Basic / 2TB Pro)
- **🔒 SSL/TLS** - Automatic Let's Encrypt certificates via Traefik
- **🤖 Shared ML** - Single machine learning container for all instances

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Traefik (Reverse Proxy)                  │
│                    SSL Termination + Routing                     │
└─────────────────────────────────────────────────────────────────┘
           │              │              │              │
           ▼              ▼              ▼              ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
    │   Web    │   │Automation│   │  Stats   │   │ Instance │
    │ (Next.js)│   │  Server  │   │Dashboard │   │   1..n   │
    └──────────┘   └──────────┘   └──────────┘   └──────────┘
                         │                             │
                         ▼                             ▼
                   ┌──────────┐                 ┌──────────┐
                   │  Stripe  │                 │Shared ML │
                   │ Webhooks │                 │Container │
                   └──────────┘                 └──────────┘
```

## 🚀 Quick Start

### Prerequisites

- Ubuntu 22.04+ Server
- Docker & Docker Compose
- Domain with wildcard DNS (`*.yourdomain.com`)
- Stripe Account (Test or Live)
- Resend Account (for emails)

### Installation

```bash
# Clone the repository
git clone https://github.com/arturict/sphoto.git
cd sphoto/sphoto

# Copy and configure environment
cp .env.example .env
nano .env

# Start the platform
docker compose up -d

# Check logs
docker compose logs -f automation
```

### Environment Variables

```env
# Domain
DOMAIN=sphoto.yourdomain.com

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_BASIC=price_...
STRIPE_PRICE_PRO=price_...

# Resend (Email)
RESEND_API_KEY=re_...
EMAIL_FROM=SPhoto <noreply@yourdomain.com>

# Admin
ADMIN_USER=admin
ADMIN_PASS=your-secure-password
ADMIN_API_KEY=your-api-key
```

### Stripe Setup

1. Create two Products in Stripe Dashboard:
   - **Basic** - Monthly subscription (e.g., CHF 5/month)
   - **Pro** - Monthly subscription (e.g., CHF 15/month)
2. Copy the Price IDs to `.env`
3. Create a Webhook endpoint: `https://api.yourdomain.com/webhook`
4. Subscribe to events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`

## 📁 Project Structure

```
sphoto/
├── automation/          # Automation server (TypeScript/Bun)
│   ├── src/
│   │   ├── index.ts    # Main server
│   │   ├── stripe.ts   # Stripe webhook handlers
│   │   ├── instance.ts # Instance management
│   │   └── email.ts    # Email templates
│   └── Dockerfile
├── web/                 # Web frontend (Next.js + shadcn/ui)
│   ├── src/app/
│   │   ├── page.tsx    # Landing page
│   │   ├── admin/      # Admin dashboard
│   │   └── success/    # Post-checkout page
│   └── Dockerfile
├── stats/              # Stats dashboard
├── templates/          # Instance docker-compose template
├── docker-compose.yml  # Main orchestration
└── .env.example
```

## 🎯 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/checkout/:plan` | GET | Create Stripe checkout session |
| `/webhook` | POST | Stripe webhook handler |
| `/status/:sessionId` | GET | Check provisioning status |
| `/health` | GET | Health check |
| `/api/instances` | GET | List all instances (Admin) |
| `/api/instances/:id` | DELETE | Delete instance (Admin) |
| `/api/instances/:id/stop` | POST | Stop instance (Admin) |
| `/api/instances/:id/start` | POST | Start instance (Admin) |

## 🔧 Admin Dashboard

Access the admin dashboard at `https://yourdomain.com/admin`

Features:
- View all instances with status
- Start/Stop/Delete instances
- See storage usage per instance
- Quick links to each instance

## 📱 Mobile App

Users can use the official **Immich** mobile app:
1. Download from [App Store](https://apps.apple.com/app/immich/id1613945652) or [Play Store](https://play.google.com/store/apps/details?id=app.alextran.immich)
2. Enter server URL: `https://username.yourdomain.com`
3. Login with credentials from welcome email

## 🤝 Credits

- [Immich](https://immich.app) - The amazing open-source photo platform this is built on
- [Traefik](https://traefik.io) - Cloud-native reverse proxy
- [shadcn/ui](https://ui.shadcn.com) - Beautiful UI components

## 📄 License

This project is licensed under the AGPL-3.0 License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/arturict">arturict</a>
</p>

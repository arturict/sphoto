# <span style="color:red">S</span>Photo - Günstige Foto-Cloud

> **Domain:** sphoto.arturf.ch

Selbst-gehostete Foto-Speicherung basierend auf [Immich](https://github.com/immich-app/immich).

## 📋 Pläne

| Plan | Speicher | Preis | ML Features |
|------|----------|-------|-------------|
| **Free** | 5 GB | Kostenlos | ❌ |
| **Basic** | 200 GB | CHF 5.-/Monat | ✅ |
| **Pro** | 1 TB | CHF 15.-/Monat | ✅ |

---

## 🚀 Deployment Modes

SPhoto supports two deployment architectures:

### Shared Mode (Recommended for most users)

Two shared Immich instances serve all users:
- `free.sphoto.arturf.ch` - Free tier (5GB, no ML)
- `photos.sphoto.arturf.ch` - Paid tiers (200GB-1TB, with ML)

**Benefits:**
- Much lower resource usage (~2GB RAM total vs ~1GB per user)
- Easier to manage
- Supports free tier

**Set in `.env`:**
```bash
DEPLOYMENT_MODE=shared
```

### Siloed Mode (Original)

Each paying customer gets their own isolated Immich instance with dedicated database and Redis.

**Benefits:**
- Complete data isolation
- Per-customer customization
- No noisy neighbor issues

**Set in `.env`:**
```bash
DEPLOYMENT_MODE=siloed
```

---

## 🚀 Schnellstart (Shared Mode)

### Voraussetzungen

- Server mit Docker & Docker Compose
- Domain `*.sphoto.arturf.ch` zeigt auf Server-IP
- Stripe Account
- Resend Account (für E-Mails)

### 1. Repository klonen

```bash
git clone https://github.com/DEIN-USER/sphoto.git /opt/sphoto
cd /opt/sphoto/sphoto
```

### 2. Environment konfigurieren

```bash
cp .env.example .env
nano .env
```

**Pflichtfelder in `.env`:**

```bash
# Deployment mode
DEPLOYMENT_MODE=shared

# Admin credentials
ADMIN_USER=admin
ADMIN_PASS=dein_sicheres_passwort
ADMIN_API_KEY=$(openssl rand -hex 32)

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_BASIC=price_xxx
STRIPE_PRICE_PRO=price_xxx

# Resend
RESEND_API_KEY=re_xxx
```

### 3. Shared Instances starten

```bash
# Start free tier instance
cd instances/free
cp .env.example .env
# Edit .env with a secure DB_PASSWORD
docker compose up -d

# Start paid tier instance
cd ../paid
cp .env.example .env
# Edit .env with a secure DB_PASSWORD
docker compose up -d
```

### 4. Create admin users on both instances

1. Visit `https://free.sphoto.arturf.ch` - Create admin account
2. Visit `https://photos.sphoto.arturf.ch` - Create admin account
3. On each instance: Account Settings → API Keys → Create key
4. Add keys to `.env`:
   ```bash
   SHARED_FREE_API_KEY=your_free_instance_key
   SHARED_PAID_API_KEY=your_paid_instance_key
   ```

### 5. Start main services

```bash
cd /opt/sphoto/sphoto
docker compose up -d
```

### 6. Testen

```bash
# Health Check
curl https://api.sphoto.arturf.ch/health

# Check shared instances status
curl https://api.sphoto.arturf.ch/api/shared/instances \
  -H "x-api-key: DEIN_ADMIN_API_KEY"

# Create a free user
curl -X POST https://api.sphoto.arturf.ch/signup/free \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

---

## 🧑‍💻 Local Development

For detailed local development instructions, see **[docs/LOCAL-DEVELOPMENT.md](docs/LOCAL-DEVELOPMENT.md)**.

### Quick Start

```bash
# 1. First-time setup (creates .env.local, installs deps)
./scripts/dev-setup.sh

# 2. Start Immich containers
make dev

# 3. In separate terminals:
make web          # http://localhost:3000
make automation   # http://localhost:3001
```

### Prerequisites

- **Bun** 1.0+ (`curl -fsSL https://bun.sh/install | bash`)
- **Docker** with Docker Compose

### Available Commands

| Command | Description |
|---------|-------------|
| `make dev-setup` | First-time setup |
| `make dev` | Start Immich containers |
| `make web` | Start web (port 3000) |
| `make automation` | Start API (port 3001) |
| `make install` | Install all dependencies |
| `make clean` | Remove all local data |

### Local URLs

- **Web**: http://localhost:3000
- **Automation API**: http://localhost:3001
- **Free Immich**: http://localhost:2283
- **Paid Immich**: http://localhost:2284

> **Note**: This project uses **Bun** for all JavaScript/TypeScript operations. If you previously used npm and encounter issues, run `make clean-web && make install`.

---

## 🔄 Automatischer Ablauf (Shared Mode)

### Free Tier
```
Kunde besucht sphoto.arturf.ch
         ↓
Klickt "Free - 5GB"
         ↓
POST /signup/free
         ↓
Automation Server:
  • Erstellt User auf free.sphoto.arturf.ch
  • Sendet E-Mail via Resend
         ↓
Kunde erhält:
  "Deine Cloud: https://free.sphoto.arturf.ch"
         ↓
Fertig! 🎉
```

### Paid Tier
```
Kunde besucht sphoto.arturf.ch
         ↓
Klickt "Basic - CHF 5.-"
         ↓
Stripe Checkout
         ↓
Webhook → api.sphoto.arturf.ch/webhook
         ↓
Automation Server:
  • Erstellt User auf photos.sphoto.arturf.ch
  • Setzt Quota (200GB/1TB)
  • Sendet E-Mail via Resend
         ↓
Kunde erhält:
  "Deine Cloud: https://photos.sphoto.arturf.ch"
         ↓
Fertig! 🎉
```

---

## 📊 Admin Dashboard

**URL:** `https://stats.sphoto.arturf.ch`

Zeigt:
- Anzahl aktive Kunden
- Gesamter Speicherverbrauch
- Monatliche Einnahmen
- Status aller Instanzen

---

## 🛠️ Verwaltung (Shared Mode)

### Alle Users anzeigen
```bash
curl https://api.sphoto.arturf.ch/api/shared/users \
  -H "x-api-key: DEIN_API_KEY"
```

### User Stats abrufen
```bash
curl https://api.sphoto.arturf.ch/api/shared/users/USER_ID/stats \
  -H "x-api-key: DEIN_API_KEY"
```

### User Quota ändern
```bash
curl -X PUT https://api.sphoto.arturf.ch/api/shared/users/USER_ID/quota \
  -H "x-api-key: DEIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"quotaGB": 500}'
```

### User migrieren (Free → Paid)
```bash
curl -X POST https://api.sphoto.arturf.ch/api/shared/users/USER_ID/migrate \
  -H "x-api-key: DEIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tier": "basic", "quotaGB": 200}'
```

### User löschen
```bash
curl -X DELETE https://api.sphoto.arturf.ch/api/shared/users/USER_ID?force=true \
  -H "x-api-key: DEIN_API_KEY"
```

### Shared Instances Status
```bash
curl https://api.sphoto.arturf.ch/api/shared/instances \
  -H "x-api-key: DEIN_API_KEY"
```

---

## 🏗️ Architektur (Shared Mode)

```
                    *.sphoto.arturf.ch
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                      TRAEFIK                            │
│              (Auto-SSL, Routing)                        │
└────────────────────────┬────────────────────────────────┘
                         │
     ┌───────────────────┼───────────────────┐
     │                   │                   │
     ▼                   ▼                   ▼
┌─────────┐      ┌──────────────┐     ┌──────────────┐
│ Landing │      │  Automation  │     │    Stats     │
│  Page   │      │   Server     │     │  Dashboard   │
└─────────┘      └──────────────┘     └──────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌─────────────────────┐     ┌─────────────────────┐
│   FREE INSTANCE     │     │   PAID INSTANCE     │
│ free.sphoto.arturf  │     │ photos.sphoto.arturf│
│                     │     │                     │
│ • 5GB quota         │     │ • 200GB-1TB quota   │
│ • No ML             │     │ • Full ML features  │
│ • Unlimited users   │     │ • Paying customers  │
└─────────────────────┘     └──────────┬──────────┘
                                       │
                                       ▼
                            ┌────────────────┐
                            │  Shared ML     │
                            │  (CPU, 16GB)   │
                            └────────────────┘
```

---

## ⚠️ Wichtig

- **Kein Backup inkludiert** - Kunden müssen eigene Backups machen
- **Homelab-Hosting** - Nicht für Enterprise geeignet
- **AGPL-Lizenz** - Quellcode muss öffentlich bleiben
- **Migration löscht Fotos** - Bei Free→Paid Migration müssen Nutzer Fotos erneut hochladen

---

## 📄 Lizenz

Basiert auf [Immich](https://github.com/immich-app/immich) (AGPL-3.0)

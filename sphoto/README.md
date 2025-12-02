# <span style="color:red">S</span>Photo - Günstige Foto-Cloud

> **Domain:** sphoto.arturf.ch

Selbst-gehostete Foto-Speicherung basierend auf [Immich](https://github.com/immich-app/immich).

## 📋 Pläne

| Plan | Speicher | Preis |
|------|----------|-------|
| **Basic** | 200 GB | CHF 5.-/Monat |
| **Pro** | 1 TB | CHF 15.-/Monat |

---

## 🚀 Schnellstart

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
# =============================================================================
# 🔐 ADMIN LOGIN (für admin.* und stats.* URLs)
# =============================================================================
ADMIN_USER=admin
ADMIN_PASS=dein_sicheres_passwort

# Traefik Auth Hash generieren:
docker run --rm httpd:alpine htpasswd -nb admin dein_sicheres_passwort
# Output kopieren (z.B. admin:$apr1$xyz...)
TRAEFIK_AUTH=admin:$apr1$HIER_DEN_HASH

# API Key für curl/Scripts:
ADMIN_API_KEY=$(openssl rand -hex 32)

# =============================================================================
# 💳 Stripe (von stripe.com/dashboard)
# =============================================================================
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_BASIC=price_xxx      # 200GB, CHF 5
STRIPE_PRICE_PRO=price_xxx        # 1TB, CHF 15

# =============================================================================
# 📧 Resend (von resend.com)
# =============================================================================
RESEND_API_KEY=re_xxx
```

### 3. Stripe einrichten

1. **Gehe zu** [stripe.com/dashboard](https://dashboard.stripe.com)

2. **Erstelle 2 Produkte:**
   - `SPhoto Basic` → CHF 5.00/Monat, recurring
   - `SPhoto Pro` → CHF 15.00/Monat, recurring

3. **Kopiere die Price IDs** (beginnen mit `price_`)

4. **Webhook erstellen:**
   - URL: `https://api.sphoto.arturf.ch/webhook`
   - Events auswählen:
     - `checkout.session.completed`
     - `invoice.paid`
     - `invoice.payment_failed`
     - `customer.subscription.deleted`

5. **Webhook Secret kopieren** (beginnt mit `whsec_`)

### 4. Resend einrichten

1. **Gehe zu** [resend.com](https://resend.com)
2. **API Key erstellen**
3. **Domain verifizieren:** `arturf.ch`
4. **API Key in `.env` eintragen**

### 5. Starten

```bash
docker compose up -d
```

### 6. Testen

```bash
# Health Check
curl https://api.sphoto.arturf.ch/health

# Manuell Instanz erstellen (zum Testen)
curl -X POST https://api.sphoto.arturf.ch/api/instances \
  -H "x-api-key: DEIN_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "plan": "basic"}'
```

---

## 🔄 Automatischer Ablauf

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
  • Generiert ID: "hans-x7k2"
  • Erstellt Docker Container
  • Sendet E-Mail via Resend
         ↓
Kunde erhält:
  "Deine Cloud: https://hans-x7k2.sphoto.arturf.ch"
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

## 🛠️ Verwaltung

### Alle Instanzen anzeigen
```bash
curl https://api.sphoto.arturf.ch/api/instances \
  -H "x-api-key: DEIN_API_KEY"
```

### Instanz stoppen
```bash
curl -X POST https://api.sphoto.arturf.ch/api/instances/KUNDE_ID/stop \
  -H "x-api-key: DEIN_API_KEY"
```

### Instanz löschen
```bash
curl -X DELETE https://api.sphoto.arturf.ch/api/instances/KUNDE_ID \
  -H "x-api-key: DEIN_API_KEY"
```

### Docker Stats
```bash
docker stats --format "table {{.Name}}\t{{.MemUsage}}" | grep sphoto
```

---

## 🏗️ Architektur

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
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │ Instanz  │   │ Instanz  │   │ Instanz  │
   │  hans    │   │  maria   │   │  peter   │
   └────┬─────┘   └────┬─────┘   └────┬─────┘
        │              │              │
        └──────────────┼──────────────┘
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

---

## 📄 Lizenz

Basiert auf [Immich](https://github.com/immich-app/immich) (AGPL-3.0)

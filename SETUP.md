# 🚀 SwissPhoto Setup Guide

## Domain: arturferreira.tech

---

## 1️⃣ DNS konfigurieren

Bei deinem Domain-Provider (z.B. Cloudflare, Infomaniak):

```
arturferreira.tech       A     → DEINE_SERVER_IP
*.arturferreira.tech     A     → DEINE_SERVER_IP
```

**Wichtig:** Der Wildcard-Eintrag `*` ermöglicht automatische Subdomains für jeden Kunden!

---

## 2️⃣ Server vorbereiten

```bash
# Docker installieren (falls nicht vorhanden)
curl -fsSL https://get.docker.com | sh

# Verzeichnisse erstellen
sudo mkdir -p /opt/swissphoto/instances
sudo chown -R $USER:$USER /opt/swissphoto

# Repository klonen
cd /opt/swissphoto
git clone https://github.com/DEIN-USER/swissphoto.git repo
cd repo
```

---

## 3️⃣ Environment konfigurieren

```bash
# .env erstellen
cp orchestration/.env.example orchestration/.env

# Bearbeiten
nano orchestration/.env
```

**Wichtige Einstellungen:**
- `ACME_EMAIL`: Deine E-Mail für SSL-Zertifikate
- `TRAEFIK_AUTH`: Generiere mit `htpasswd -nb admin DEIN_PASSWORT`
- `STRIPE_SECRET_KEY`: Von Stripe Dashboard
- `STRIPE_WEBHOOK_SECRET`: Von Stripe Webhooks
- `ADMIN_API_KEY`: Generiere mit `openssl rand -hex 32`

---

## 4️⃣ Stripe einrichten

### Im Stripe Dashboard:

1. **Produkte erstellen:**
   - Basic (CHF 3.00/Monat)
   - Standard (CHF 5.00/Monat)
   - Pro (CHF 7.00/Monat)
   - Power (CHF 12.00/Monat)

2. **Webhook erstellen:**
   - URL: `https://api.arturferreira.tech/webhook`
   - Events:
     - `checkout.session.completed`
     - `invoice.paid`
     - `invoice.payment_failed`
     - `customer.subscription.deleted`

3. **Payment Links erstellen** (optional, für Landingpage)

4. **Price IDs** in `automation/webhook-server.ts` eintragen

---

## 5️⃣ Starten!

```bash
cd /opt/swissphoto/repo/orchestration

# Full Stack starten
docker compose -f docker-compose.full-stack.yml up -d

# Logs prüfen
docker compose -f docker-compose.full-stack.yml logs -f
```

---

## 6️⃣ Testen

### URLs:
- **Landingpage:** https://arturferreira.tech
- **Admin Dashboard:** https://admin.arturferreira.tech
- **API Health:** https://api.arturferreira.tech/health

### Manuelle Instanz erstellen (zum Testen):
```bash
curl -X POST https://api.arturferreira.tech/api/instances \
  -H "Content-Type: application/json" \
  -H "x-api-key: DEIN_ADMIN_API_KEY" \
  -d '{"email": "test@example.com", "storage_gb": 100}'
```

---

## 📊 Verwaltung

### Alle Instanzen anzeigen:
```bash
curl https://api.arturferreira.tech/api/instances \
  -H "x-api-key: DEIN_ADMIN_API_KEY"
```

### Instanz stoppen:
```bash
curl -X POST https://api.arturferreira.tech/api/instances/KUNDE_ID/stop \
  -H "x-api-key: DEIN_ADMIN_API_KEY"
```

### Ressourcen-Verbrauch:
```bash
docker stats --format "table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}" | grep swissphoto
```

---

## 🔄 Updates

```bash
cd /opt/swissphoto/repo

# Upstream Updates holen
git fetch upstream
git merge upstream/main

# Neue Images pullen
docker compose -f orchestration/docker-compose.full-stack.yml pull

# Neustart
docker compose -f orchestration/docker-compose.full-stack.yml up -d
```

---

## 🆘 Troubleshooting

### SSL-Zertifikate funktionieren nicht:
- Prüfe DNS: `dig arturferreira.tech`
- Prüfe Traefik Logs: `docker logs swissphoto-traefik`

### Instanz startet nicht:
- Prüfe Logs: `docker logs sp_KUNDE_server`
- Prüfe Netzwerk: `docker network ls | grep swissphoto`

### Stripe Webhooks kommen nicht an:
- Prüfe URL in Stripe Dashboard
- Teste mit Stripe CLI: `stripe listen --forward-to https://api.arturferreira.tech/webhook`

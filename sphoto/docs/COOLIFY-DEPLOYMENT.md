# SPhoto - Coolify Deployment Guide

Diese Anleitung erklärt, wie du SPhoto auf einer Coolify-VM deployen kannst, wobei Coolify's integrierter Traefik Reverse-Proxy für SSL-Zertifikate und Routing genutzt wird.

## ⚡ Quick Update Command

```bash
cd /opt/sphoto/sphoto
git pull
docker compose up -d --build
```

**Diesen Befehl für alle Updates verwenden!**

---

## Übersicht

### Unterschiede zum Standalone-Deployment

| Feature | Standalone | Coolify |
|---------|------------|---------|
| Traefik | Eigene Instanz | Coolify's Traefik |
| SSL Zertifikate | `le` certresolver | `letsencrypt` certresolver |
| Netzwerk | `sphoto-net` | `coolify` |
| Labels Format | `entrypoints=websecure` | `entryPoints=https` |
| Wildcard SSL | TLS Challenge | DNS Challenge (empfohlen) |

## Voraussetzungen

- Coolify v4.x installiert und konfiguriert
- Domain mit DNS auf Coolify-Server zeigend
- Wildcard DNS Record für Subdomains (`*.sphoto.deinedomain.ch`)
- Mindestens 250GB Speicherplatz (abhängig von Plänen)
- 8GB+ RAM empfohlen (wegen ML Container)

## Setup Schritte

### 1. Wildcard SSL Zertifikate einrichten

Für dynamische Subdomains (jede Instanz bekommt `<id>.sphoto.deinedomain.ch`) brauchst du Wildcard-Zertifikate via DNS Challenge.

#### Option A: Hetzner DNS

1. Erstelle einen API Key in der Hetzner DNS Console
2. Bearbeite Coolify's Traefik Config (`/data/coolify/proxy/dynamic/`)

Erstelle `/data/coolify/proxy/dynamic/wildcard.yml`:

```yaml
http:
  middlewares:
    redirect-to-https:
      redirectscheme:
        scheme: https
    gzip:
      compress: true
```

Aktualisiere Coolify's Traefik mit DNS Challenge:

```bash
# In Coolify's Proxy-Einstellungen oder docker-compose
environment:
  - HETZNER_API_KEY=dein-api-key

command:
  # ... bestehende commands ...
  - '--certificatesresolvers.letsencrypt.acme.dnschallenge.provider=hetzner'
  - '--certificatesresolvers.letsencrypt.acme.dnschallenge.delaybeforecheck=0'
```

#### Option B: Cloudflare DNS

```bash
environment:
  - CF_API_EMAIL=deine@email.com
  - CF_API_KEY=dein-api-key

command:
  - '--certificatesresolvers.letsencrypt.acme.dnschallenge.provider=cloudflare'
```

### 2. Projekt in Coolify erstellen

1. Gehe zu Coolify Dashboard → Projects → New Project
2. Wähle "Docker Compose" als Deployment Type
3. Verbinde dein Git Repository oder nutze "Raw Docker Compose"

### 3. Environment Variables setzen

In Coolify's Environment Variables Panel:

```env
# Domain
DOMAIN=sphoto.deinedomain.ch

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_BASIC=price_xxx
STRIPE_PRICE_PRO=price_xxx

# Email (Resend)
RESEND_API_KEY=re_xxx
EMAIL_FROM=SPhoto <noreply@deinedomain.ch>

# Admin
ADMIN_API_KEY=ein-sicherer-api-key
ADMIN_USER=admin
ADMIN_PASS=sicheres-passwort
TRAEFIK_AUTH=admin:$apr1$xxx  # htpasswd generiert

# Immich
IMMICH_VERSION=release

# Coolify Mode aktivieren
COOLIFY_MODE=true

# Optional: Externer Speicher
EXTERNAL_STORAGE_PATH=/mnt/storage
```

### 4. Docker Compose für Coolify

Nutze `docker-compose.coolify.yml` statt `docker-compose.yml`:

```bash
# Auf dem Server
cd /opt/sphoto
cp docker-compose.coolify.yml docker-compose.yml
```

Oder in Coolify direkt den Inhalt von `docker-compose.coolify.yml` verwenden.

### 5. Verzeichnisse erstellen

```bash
# Auf dem Coolify Server via SSH
sudo mkdir -p /data/instances
sudo mkdir -p /data/exports
sudo chown -R 1000:1000 /data/instances /data/exports
```

### 6. Coolify Network prüfen

Stelle sicher, dass das `coolify` Network existiert:

```bash
docker network ls | grep coolify
# Falls nicht vorhanden:
docker network create --attachable coolify
```

### 7. Deployment starten

In Coolify: "Deploy" klicken oder via CLI:

```bash
docker compose -f docker-compose.coolify.yml up -d --build
```

## Architektur mit Coolify

```
┌─────────────────────────────────────────────────────────────────┐
│                        Coolify Server                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐    ┌─────────────────────────────────┐   │
│  │  Coolify Traefik │    │         coolify network         │   │
│  │   (Port 80/443)  │────│                                 │   │
│  └────────┬─────────┘    │  ┌─────────┐  ┌──────────────┐  │   │
│           │              │  │  Web    │  │  Automation  │  │   │
│           │              │  │ :3000   │  │    :3000     │  │   │
│           │              │  └─────────┘  └──────────────┘  │   │
│           │              │                                 │   │
│           │              │  ┌─────────┐  ┌──────────────┐  │   │
│  SSL via  │              │  │  Stats  │  │     ML       │  │   │
│  DNS      │              │  │ :3000   │  │    :3003     │  │   │
│  Challenge│              │  └─────────┘  └──────────────┘  │   │
│           │              │                                 │   │
│           ▼              │  ┌──────────────────────────┐   │   │
│    *.sphoto.domain.ch    │  │   Instance Containers    │   │   │
│           │              │  │  - kunde1-server         │   │   │
│           │              │  │  - kunde2-app (NC)       │   │   │
│           └──────────────│  │  - ...                   │   │   │
│                          │  └──────────────────────────┘   │   │
│                          └─────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    /data/instances/                      │   │
│  │   kunde1/  kunde2/  kunde3/  ...                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Wichtige Unterschiede

### Traefik Labels

**Standalone:**
```yaml
labels:
  - "traefik.http.routers.myapp.entrypoints=websecure"
  - "traefik.http.routers.myapp.tls.certresolver=le"
```

**Coolify:**
```yaml
labels:
  - "traefik.http.routers.myapp-https.entryPoints=https"
  - "traefik.http.routers.myapp-https.tls=true"
  - "traefik.http.routers.myapp-https.tls.certresolver=letsencrypt"
  - "traefik.http.routers.myapp-http.entryPoints=http"
  - "traefik.http.routers.myapp-http.middlewares=redirect-to-https"
```

### Netzwerk

**Standalone:**
```yaml
networks:
  sphoto-net:
    name: sphoto-net
```

**Coolify:**
```yaml
networks:
  coolify:
    external: true
```

## Troubleshooting

### Container nicht erreichbar

1. Prüfe ob Container im `coolify` Network ist:
```bash
docker inspect <container> | grep -A 20 Networks
```

2. Prüfe Traefik Labels:
```bash
docker inspect <container> | grep -A 50 Labels
```

### SSL Zertifikat Fehler

1. Prüfe DNS Challenge Logs:
```bash
docker logs coolify-proxy 2>&1 | grep -i acme
```

2. Stelle sicher, dass Wildcard DNS korrekt ist:
```bash
dig +short *.sphoto.deinedomain.ch
```

### Instance startet nicht

1. Prüfe ob Coolify Network existiert:
```bash
docker network ls | grep coolify
```

2. Prüfe Instance Logs:
```bash
docker compose -f /data/instances/<id>/docker-compose.yml logs
```

### 502 Bad Gateway

1. Container läuft nicht oder falscher Port
2. Falscher Service-Name in Labels
3. Container nicht im Coolify Network

## Monitoring

### Logs ansehen

```bash
# Alle SPhoto Logs
docker compose logs -f

# Spezifische Instance
docker logs sphoto-<id>-server -f

# Coolify Traefik
docker logs coolify-proxy -f
```

### Ressourcen prüfen

```bash
# Container Stats
docker stats --no-stream | grep sphoto

# Disk Usage
df -h /data/instances
```

## Backup

### Instances sichern

```bash
# Alle Instances
tar -czvf sphoto-backup-$(date +%Y%m%d).tar.gz /data/instances

# Einzelne Instance
tar -czvf kunde1-backup.tar.gz /data/instances/kunde1
```

### Restore

```bash
# Instance wiederherstellen
tar -xzvf kunde1-backup.tar.gz -C /
cd /data/instances/kunde1
docker compose up -d
```

## Migration von Standalone zu Coolify

1. **Backup erstellen:**
```bash
tar -czvf sphoto-full-backup.tar.gz /data/instances
```

2. **Alte Container stoppen:**
```bash
docker compose down
```

3. **Coolify Compose aktivieren:**
```bash
cp docker-compose.coolify.yml docker-compose.yml
```

4. **Environment anpassen:**
```bash
echo "COOLIFY_MODE=true" >> .env
```

5. **Neu starten:**
```bash
docker compose up -d --build
```

6. **Instances neu verbinden:**
Die bestehenden Instance-Container müssen neu gestartet werden, damit sie die neuen Coolify-Labels bekommen:
```bash
for dir in /data/instances/*/; do
  cd "$dir"
  docker compose down
  docker compose up -d
done
```

## Updates

### ⚡ Standard Update (wichtig!)

```bash
cd /opt/sphoto/sphoto
git pull
docker compose up -d --build
```

**Diesen Befehl für alle Updates verwenden!** Er:
1. Wechselt ins richtige Verzeichnis
2. Holt die neuesten Änderungen von GitHub
3. Baut nur geänderte Container neu und startet sie

### Nach grösseren Updates

Falls neue Environment Variablen hinzugefügt wurden:
```bash
cd /opt/sphoto/sphoto
git pull
# .env prüfen/anpassen
nano .env
docker compose down
docker compose up -d --build
```

### Nur bestimmte Services neu bauen

```bash
cd /opt/sphoto/sphoto
docker compose up -d --build automation web
```

## Support

Bei Fragen: [GitHub Issues](https://github.com/arturict/sphoto/issues)

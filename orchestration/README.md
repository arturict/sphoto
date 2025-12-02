# 🏗️ SwissPhoto Silo-Architektur

## Übersicht

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Server (128GB RAM)                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    SHARED SERVICES (einmalig)                   │    │
│  │                                                                 │    │
│  │  ┌───────────────────┐      ┌───────────────────────────────┐   │    │
│  │  │     Traefik       │      │    Machine Learning (CPU)     │   │    │
│  │  │   Reverse Proxy   │      │        24GB RAM limit         │   │    │
│  │  │   Auto-SSL        │      │     Shared by ALL users       │   │    │
│  │  └───────────────────┘      └───────────────────────────────┘   │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│              ┌───────────────┼───────────────┐                          │
│              │               │               │                          │
│              ▼               ▼               ▼                          │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐                  │
│  │   Instanz 1   │ │   Instanz 2   │ │   Instanz N   │                  │
│  │  hans.swiss   │ │  maria.swiss  │ │  peter.swiss  │                  │
│  │   photo.ch    │ │   photo.ch    │ │   photo.ch    │                  │
│  ├───────────────┤ ├───────────────┤ ├───────────────┤                  │
│  │ Server  1GB   │ │ Server  1GB   │ │ Server  1GB   │                  │
│  │ Postgres 1GB  │ │ Postgres 1GB  │ │ Postgres 1GB  │                  │
│  │ Redis  0.5GB  │ │ Redis  0.5GB  │ │ Redis  0.5GB  │                  │
│  │ ───────────── │ │ ───────────── │ │ ───────────── │                  │
│  │ ~2.5GB/Instanz│ │ ~2.5GB/Instanz│ │ ~2.5GB/Instanz│                  │
│  └───────┬───────┘ └───────┬───────┘ └───────┬───────┘                  │
│          │                 │                 │                          │
│          ▼                 ▼                 ▼                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                        NAS STORAGE                              │    │
│  │   /instances/hans/uploads     (100GB Quota)                     │    │
│  │   /instances/maria/uploads    (500GB Quota)                     │    │
│  │   /instances/peter/uploads    (1TB Quota)                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## RAM-Kalkulation für 15 Instanzen

| Komponente | RAM |
|------------|-----|
| Shared ML Service | 24 GB |
| Traefik | 0.5 GB |
| 15 × Instanz (2.5GB) | 37.5 GB |
| OS + Buffer | 10 GB |
| **Total** | **~72 GB** |
| **Verfügbar** | **~56 GB für Cache/Burst** ✅ |

## Quick Start

### 1. Shared Services starten
```bash
cd /opt/swissphoto
docker compose -f orchestration/shared-services.yml up -d
```

### 2. Neue Kundeninstanz erstellen
```bash
./orchestration/multi-instance-manager.sh create hans 100 hans@email.ch
```

### 3. Kunde kann sich einloggen
```
https://hans.swissphoto.ch
```

## Befehle

```bash
# Neue Instanz erstellen
./multi-instance-manager.sh create <kunde> <gb> <email>

# Instanz stoppen (bei Nichtzahlung)
./multi-instance-manager.sh stop <kunde>

# Instanz wieder starten
./multi-instance-manager.sh start <kunde>

# Instanz komplett löschen
./multi-instance-manager.sh delete <kunde>

# Alle Instanzen anzeigen
./multi-instance-manager.sh list

# Ressourcen-Verbrauch
./multi-instance-manager.sh stats
```

## Automatisierung mit Stripe

Wenn ein Kunde zahlt:
1. Stripe Webhook triggered
2. Script erstellt automatisch Instanz
3. Kunde erhält E-Mail mit Login-Link

Wenn Kunde nicht zahlt:
1. Stripe Webhook (invoice.payment_failed)
2. Script stoppt Instanz (Daten bleiben)
3. Nach 30 Tagen: Automatische Löschung

## Was du manuell machen musst (am Anfang)

1. **Kunde meldet sich** → Du erstellst Instanz mit Script
2. **Kunde zahlt via Stripe** → Du prüfst Dashboard
3. **Kunde kündigt** → Du stoppst/löschst Instanz

Später kannst du Webhooks automatisieren.

## DNS Setup

Bei deinem Domain-Provider:
```
*.swissphoto.ch  →  A Record  →  DEINE_SERVER_IP
```

Traefik erstellt automatisch SSL-Zertifikate für jede Subdomain!

# 🏗️ SwissPhoto Architektur

## Empfohlenes Setup für 15 User

### Single-Instance Modell (Empfohlen für Start)

```
┌─────────────────────────────────────────────────────────────┐
│                    Dein Server (128GB RAM)                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Docker Compose Stack                     │   │
│  │                                                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │   │
│  │  │ SwissPhoto  │  │   Redis     │  │ PostgreSQL  │   │   │
│  │  │   Server    │  │   Cache     │  │    DB       │   │   │
│  │  │   (2GB)     │  │   (1GB)     │  │   (4GB)     │   │   │
│  │  └──────┬──────┘  └─────────────┘  └─────────────┘   │   │
│  │         │                                             │   │
│  │         ▼                                             │   │
│  │  ┌─────────────────────────────────────────────────┐  │   │
│  │  │          Machine Learning Service                │  │   │
│  │  │          (CPU-basiert, 8-16GB RAM)               │  │   │
│  │  │                                                  │  │   │
│  │  │  • CLIP (Bildsuche)                              │  │   │
│  │  │  • Face Recognition (Gesichtserkennung)          │  │   │
│  │  └─────────────────────────────────────────────────┘  │   │
│  │                                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   NAS Storage                         │   │
│  │              10+ TB HDDs (Fotos/Videos)               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   SSD Storage                         │   │
│  │            PostgreSQL + Model Cache                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### RAM-Nutzung (geschätzt)

| Komponente | RAM |
|------------|-----|
| SwissPhoto Server | 2 GB |
| PostgreSQL | 4-8 GB |
| Redis | 0.5-1 GB |
| ML Service | 8-16 GB |
| OS + Buffer | 8 GB |
| **Total** | ~25-35 GB |

**Verbleibend**: ~90-100 GB für Caching und Burst-Load ✅

---

## Instanz vs. Silo Modell

### Single Instance (Empfohlen)
```
Eine Immich-Instanz für alle 15 User
├── User A (100GB Quota)
├── User B (200GB Quota)
├── User C (500GB Quota)
└── ...

Vorteile:
✅ Einfach zu verwalten
✅ Weniger RAM-Verbrauch
✅ Ein Backup reicht
✅ Shared ML-Service

Nachteile:
❌ Alle User teilen Performance
❌ Kein echtes "eigene Instanz" Gefühl
```

### Silo Modell (Multi-Instance)
```
Separate Instanz pro zahlenden Kunde
├── kunde-a.swissphoto.ch → Instanz A
├── kunde-b.swissphoto.ch → Instanz B
└── kunde-c.swissphoto.ch → Instanz C

Pro Instanz: ~4-6 GB RAM
Für 15 Instanzen: ~60-90 GB RAM

Vorteile:
✅ Echte Isolation
✅ Individuelle Konfiguration
✅ Einfacheres Billing

Nachteile:
❌ Mehr RAM-Verbrauch
❌ Komplexere Verwaltung
❌ Mehr Wartung
```

---

## Kubernetes - Brauchst du es?

**Kurze Antwort: NEIN** 🚫

Für 15 User ist Kubernetes Overkill:
- Zu komplex
- Zu viel Overhead
- Docker Compose reicht völlig

**Wann Kubernetes Sinn macht:**
- 100+ User
- Multi-Server Setup
- Auto-Scaling nötig
- SLA-Garantien

---

## "Serverless-ähnlich" ohne Kubernetes

Du kannst Instanzen dynamisch starten/stoppen mit einem einfachen Script:

```bash
#!/bin/bash
# manage-instance.sh

INSTANCE=$1
ACTION=$2

case $ACTION in
  start)
    docker compose -f instances/$INSTANCE/docker-compose.yml up -d
    ;;
  stop)
    docker compose -f instances/$INSTANCE/docker-compose.yml down
    ;;
  status)
    docker compose -f instances/$INSTANCE/docker-compose.yml ps
    ;;
esac
```

### Traefik für Routing

```yaml
# traefik/docker-compose.yml
services:
  traefik:
    image: traefik:v3.0
    command:
      - "--providers.docker=true"
      - "--entrypoints.websecure.address=:443"
    ports:
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
```

Jede Instanz bekommt Traefik-Labels:
```yaml
labels:
  - "traefik.http.routers.kunde-a.rule=Host(`kunde-a.swissphoto.ch`)"
```

---

## Empfohlener Start

1. **Phase 1**: Single Instance mit 15 User-Accounts
2. **Phase 2**: Bei Bedarf auf Multi-Instance wechseln
3. **Phase 3**: Nur bei 50+ Kunden über Kubernetes nachdenken

---

## GPU vs CPU für ML

### Deine Quadro P600:
- 2 GB VRAM ❌ (zu wenig)
- 384 CUDA Cores

### Empfehlung:
**Nutze CPU-basiertes ML!**

Bei 128 GB RAM ist CPU-Inferenz schnell genug:
- CLIP: ~0.5-1 Sekunde pro Bild
- Face Detection: ~0.3 Sekunden pro Bild

Für 15 User völlig ausreichend.

### Upgrade-Option für später:
- RTX 3060 (12GB VRAM): ~CHF 300
- RTX 4060 Ti (16GB VRAM): ~CHF 450

# SPhoto Scaling & Infrastructure Roadmap

> Strategieplan für die Skalierung von SPhoto von Single-VPS zu Kubernetes-Cluster

**Stand:** Dezember 2024

---

## Übersicht

```
┌─────────────────────────────────────────────────────────────────┐
│                    SPhoto Infrastruktur                         │
├─────────────────────────────────────────────────────────────────┤
│  Phase 1 (Jetzt)    │  Phase 2 (50-200)   │  Phase 3 (200+)    │
│  Single VPS         │  Multi-VPS          │  Kubernetes        │
│  ~50 User           │  ~200 User          │  500+ User         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Kostenrechnung pro User

| Ressource | Kosten/User/Monat | Bemerkung |
|-----------|-------------------|-----------|
| Storage (HDD) | ~0.003 €/GB | Hetzner Storage Box |
| Compute (anteilig) | ~1-2 € | Bei ~50 User/Server |
| ML (shared) | ~0.50 € | Gesichtserkennung etc. |
| Netzwerk/Backup | ~0.50 € | Traffic + Snapshots |
| **Basis-Overhead** | **~3-4 €** | Pro User |

### Beispiel: 1 TB User
| Position | Kosten |
|----------|--------|
| Storage | ~3 € |
| Compute | ~2 € |
| ML + Overhead | ~1 € |
| **Total** | **~6 €** |
| **Verkaufspreis** | **12 CHF** |
| **Gewinn** | **~5-6 CHF** |

---

## Hetzner Storage Preise

| Produkt | Kapazität | Preis/Monat | €/TB |
|---------|-----------|-------------|------|
| Storage Box BX11 | 1 TB | 3.81 € | 3.81 € |
| Storage Box BX21 | 5 TB | 8.46 € | 1.69 € |
| Storage Box BX31 | 10 TB | 16.07 € | 1.61 € |
| Storage Box BX41 | 20 TB | 30.51 € | 1.53 € |

> ⚠️ **Nicht verwenden:** Hetzner Volumes (SSD) = 52 €/TB – zu teuer für Medien!

---

## Phase 1: Single VPS (Jetzt)

**Zielgruppe:** 0-50 User

### Architektur
```
┌─────────────────────────────────────┐
│  Hetzner CPX41                      │
│  8 vCPU, 16GB RAM, 240GB SSD        │
│  ~30 €/Monat                        │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Traefik (Reverse Proxy)     │   │
│  │ Automation Server           │   │
│  │ ML Server (shared)          │   │
│  │ PostgreSQL (pro Instanz)    │   │
│  │ Immich Server (pro Instanz) │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
              │
              │ NFS Mount
              ▼
┌─────────────────────────────────────┐
│  Hetzner Storage Box (5 TB)         │
│  ~8 €/Monat                         │
│  /mnt/storage/{instance-id}/uploads │
└─────────────────────────────────────┘
```

### Kosten Phase 1
| Position | Kosten/Monat |
|----------|--------------|
| CPX41 VPS | 30 € |
| Storage Box 5TB | 8 € |
| **Total Fixkosten** | **38 €** |

### Break-Even
- Bei Ø 8 CHF/User: **~5 zahlende User**

---

## Phase 2: Multi-VPS (50-200 User)

**Trigger:** RAM-Auslastung > 80% oder > 50 aktive Instanzen

### Architektur
```
┌─────────────────────────────────────┐
│  VPS 1 (Primary)                    │
│  - Traefik                          │
│  - Automation Server                │
│  - ML Server                        │
│  - 25 Instanzen                     │
└─────────────────────────────────────┘
              │
┌─────────────────────────────────────┐
│  VPS 2 (Worker)                     │
│  - 25 Instanzen                     │
│  - Eigene PostgreSQL DBs            │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  Hetzner Storage Box (10 TB)        │
│  Shared via NFS                     │
└─────────────────────────────────────┘
```

### Kosten Phase 2
| Position | Kosten/Monat |
|----------|--------------|
| 2x CPX41 VPS | 60 € |
| Storage Box 10TB | 16 € |
| **Total Fixkosten** | **76 €** |

---

## Phase 3: Kubernetes Cluster (200+ User)

**Trigger:** Manuelle Skalierung zu aufwendig, > 200 User

### Architektur
```
┌──────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                         │
│                                                               │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│  │  Node 1    │  │  Node 2    │  │  Node 3    │   ...       │
│  │  Hetzner   │  │  Hetzner   │  │  Homelab   │             │
│  │  CPX31     │  │  CPX31     │  │  Custom    │             │
│  │  20€/Mo    │  │  20€/Mo    │  │  0€/Mo     │             │
│  └────────────┘  └────────────┘  └────────────┘             │
│        │              │               │                      │
│        └──────────────┴───────────────┘                      │
│                       │                                      │
│              ┌────────┴────────┐                             │
│              │  Shared Services │                            │
│              │  - Traefik       │                            │
│              │  - ML Server     │                            │
│              │  - Monitoring    │                            │
│              └─────────────────┘                             │
└──────────────────────────────────────────────────────────────┘
                        │
                        │ NFS/S3
                        ▼
┌──────────────────────────────────────────────────────────────┐
│  Storage Layer                                                │
│  - Hetzner Storage Box 20TB                                  │
│  - Optional: MinIO für S3-kompatiblen Zugriff               │
└──────────────────────────────────────────────────────────────┘
```

### Kubernetes-Optionen

| Option | Kosten | Komplexität | Empfehlung |
|--------|--------|-------------|------------|
| **Hetzner Cloud K8s** | 20€/Mo + Nodes | ⭐ Einfach | Für Start |
| **k3s selbst hosten** | Nur Node-Kosten | ⭐⭐ Mittel | Beste Balance |
| **Talos Linux** | Nur Node-Kosten | ⭐⭐⭐ Komplex | Maximum Control |

### Kosten Phase 3
| Position | Kosten/Monat |
|----------|--------------|
| K8s Control Plane | 20 € |
| 3x Worker Nodes (CPX31) | 60 € |
| Load Balancer | 6 € |
| Storage Box 20TB | 30 € |
| **Total Fixkosten** | **~116 €** |

---

## Homelab als Kubernetes Node

### Voraussetzungen
- [ ] Statische IP oder VPN (Tailscale/WireGuard)
- [ ] Ports: 6443 (K8s API), 10250 (Kubelet)
- [ ] Stabile Internetverbindung (min. 100 Mbit/s Upload)
- [ ] USV für Stromausfälle

### Konfiguration
```yaml
# k3s agent join (Homelab)
apiVersion: v1
kind: Node
metadata:
  name: homelab-node
  labels:
    node-type: homelab
    location: home
    priority: low
spec:
  taints:
    - key: "location"
      value: "homelab"
      effect: "PreferNoSchedule"
```

### Scheduling-Strategie
```yaml
# Instanzen bevorzugt auf Cloud-Nodes
affinity:
  nodeAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        preference:
          matchExpressions:
            - key: node-type
              operator: In
              values:
                - cloud
      - weight: 50
        preference:
          matchExpressions:
            - key: node-type
              operator: In
              values:
                - homelab
```

---

## Preispläne

### Empfohlene Staffelung

| Plan | Speicher | Kosten | Preis | Marge |
|------|----------|--------|-------|-------|
| **Free** | 5 GB | ~0.50 € | 0 CHF | Lead Generation |
| **Lite** | 100 GB | ~1.30 € | 4 CHF | ~210% |
| **Standard** | 500 GB | ~2.50 € | 8 CHF | ~220% |
| **Family** | 1 TB | ~4.00 € | 12 CHF | ~200% |
| **Pro** | 3 TB | ~8.00 € | 25 CHF | ~210% |

### Premium-Variante (Swiss Hosting)

| Plan | Speicher | Preis | Zielgruppe |
|------|----------|-------|------------|
| **Privat** | 100 GB | 5 CHF | Einzelpersonen |
| **Familie** | 500 GB | 12 CHF | Familien |
| **Pro** | 1 TB | 20 CHF | Power User |
| **Studio** | 3 TB | 45 CHF | Fotografen |
| **Business** | 10 TB | 120 CHF | Agenturen |

---

## Gewinnprognose

| User | Fixkosten | Variable Kosten | Einnahmen (Ø 8 CHF) | Gewinn |
|------|-----------|-----------------|---------------------|--------|
| 10 | 38 € | ~10 € | ~80 CHF | ~30 CHF |
| 50 | 38 € | ~50 € | ~400 CHF | ~300 CHF |
| 100 | 76 € | ~100 € | ~800 CHF | ~600 CHF |
| 200 | 116 € | ~200 € | ~1'600 CHF | ~1'250 CHF |
| 500 | 150 € | ~500 € | ~4'000 CHF | ~3'200 CHF |
| 1000 | 250 € | ~1'000 € | ~8'000 CHF | ~6'500 CHF |

---

## Migrations-Checkliste

### Phase 1 → Phase 2
- [ ] Storage Box von 5TB auf 10TB upgraden
- [ ] Zweiten VPS provisionieren
- [ ] NFS Mount auf beiden VPS einrichten
- [ ] Load Balancing für Traefik
- [ ] Automation Server: Multi-Node Support

### Phase 2 → Phase 3
- [ ] k3s Cluster aufsetzen
- [ ] Helm Charts für Immich erstellen
- [ ] Persistent Volume Claims für Storage Box
- [ ] Ingress Controller (Traefik) migrieren
- [ ] Automation Server: Kubernetes API Integration
- [ ] Auto-Scaling Operator entwickeln
- [ ] Monitoring (Prometheus/Grafana)
- [ ] Homelab Node einbinden (optional)

---

## Hosting-Anbieter Vergleich

### Empfohlen: Hetzner (Deutschland)

| Produkt | Specs | Preis |
|---------|-------|-------|
| CPX11 | 2 vCPU, 4GB | 4.85 €/Mo |
| CPX21 | 3 vCPU, 8GB | 9.29 €/Mo |
| CPX31 | 4 vCPU, 16GB | 17.49 €/Mo |
| CPX41 | 8 vCPU, 32GB | 30.49 €/Mo |
| CPX51 | 16 vCPU, 64GB | 65.49 €/Mo |

### Alternativen

| Anbieter | Land | Preis-Level | Besonderheit |
|----------|------|-------------|--------------|
| **Contabo** | 🇩🇪 | €€ | Sehr günstig, grosse HDDs |
| **OVH** | 🇫🇷 | €€€ | Gute EU-Abdeckung |
| **Netcup** | 🇩🇪 | €€ | Gutes P/L-Verhältnis |
| **Infomaniak** | 🇨🇭 | €€€€ | Swiss Made Premium |
| **Exoscale** | 🇨🇭 | €€€€ | Enterprise, Swiss |

---

## ENV-Variablen für External Storage

```bash
# .env
EXTERNAL_STORAGE_PATH=/mnt/storage

# Wenn nicht gesetzt: Lokaler Speicher (./uploads)
# Wenn gesetzt: {EXTERNAL_STORAGE_PATH}/{instance-id}/uploads
```

### NFS Mount einrichten (Hetzner Storage Box)

```bash
# Storage Box credentials
STORAGE_BOX_USER=u123456
STORAGE_BOX_HOST=u123456.your-storagebox.de

# Mount
sudo apt install nfs-common
sudo mkdir -p /mnt/storage
echo "${STORAGE_BOX_USER}@${STORAGE_BOX_HOST}:/ /mnt/storage nfs defaults 0 0" | sudo tee -a /etc/fstab
sudo mount -a
```

---

## Nächste Schritte

1. **Kurzfristig (Phase 1)**
   - [ ] Storage Box einrichten
   - [ ] `EXTERNAL_STORAGE_PATH` konfigurieren
   - [ ] Monitoring aufsetzen (Uptime, Disk Usage)

2. **Mittelfristig (Phase 2)**
   - [ ] Bei > 40 Usern zweiten VPS planen
   - [ ] Multi-Node Automation vorbereiten

3. **Langfristig (Phase 3)**
   - [ ] Kubernetes-Migration bei > 150 Usern
   - [ ] Helm Charts entwickeln
   - [ ] Auto-Scaling implementieren

---

*Letzte Aktualisierung: Dezember 2024*

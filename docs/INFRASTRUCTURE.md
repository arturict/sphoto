# Infrastructure & Storage Options

## Current Setup (Development/Testing)

- **VPS**: DigitalOcean Droplet, $24/mo (2 vCPU, 4GB RAM, 80GB SSD)
- **Storage**: Local SSD only

## Production Architecture

For production with many users, consider:

1. **Separate compute and storage**
2. **Use object storage for photos** (S3-compatible)
3. **CDN for serving images**
4. **Kubernetes (k3s/k8s) for scaling**

## Storage Pricing Comparison (Europe, 2026)

### Object Storage (S3-compatible)

| Provider | Price/TB/mo | Traffic | Notes |
|----------|-------------|---------|-------|
| **Intercolo** | €2.49 | 1TB free/TB | Cheapest, German DC, GDPR |
| **Hetzner** | €4.99 | €1/TB | German, very reliable |
| **OVHcloud** | €7.00 | Paid | Large infra, EU |

**Recommendation**: Intercolo for best price, Hetzner for reliability.

### Block Storage (for VPS)

| Provider | Price | Notes |
|----------|-------|-------|
| Hetzner Storage Box 1TB | €3.20/mo | BX11, SFTP/SMB/WebDAV |
| Hetzner Storage Box 5TB | €10.90/mo | BX21 |
| Hetzner Storage Box 10TB | €20.80/mo | BX31 |
| Hetzner Storage Box 20TB | €40.60/mo | BX41 |

Source: [Hetzner Storage Box](https://www.hetzner.com/storage/storage-box/)

## VPS Options (Hetzner)

| Specs | Price | Good for |
|-------|-------|----------|
| 2 vCPU, 4GB RAM | €3.50/mo | 1-5 users |
| 4 vCPU, 8GB RAM | €5.50/mo | 5-20 users |
| 8 vCPU, 16GB RAM | €9.50/mo | 20-50 users |

## Margin Calculation

**Example with 10 users on Basic plan (€5/mo each):**

| Item | Cost |
|------|------|
| Revenue | €50/mo |
| VPS (4 vCPU, 8GB) | -€5.50/mo |
| Storage 2TB (Intercolo) | -€5/mo |
| **Profit** | **€39.50/mo** |

**Example with 50 users mixed:**
- 30 Free users (0 revenue, ~150GB)
- 15 Basic users (€75/mo, ~3TB)  
- 5 Pro users (€75/mo, ~5TB)

| Item | Cost |
|------|------|
| Revenue | €150/mo |
| VPS (8 vCPU, 16GB) | -€9.50/mo |
| Storage 10TB (Intercolo) | -€25/mo |
| **Profit** | **€115.50/mo** |

## Recommended Production Stack

```
┌─────────────────────────────────────────────────┐
│                  Cloudflare CDN                 │
│              (free, caches images)              │
└───────────────────────┬─────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────┐
│              Hetzner VPS (k3s)                  │
│         Traefik + Immich + Automation           │
└───────────────────────┬─────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────┐
│           Intercolo Object Storage              │
│              (S3-compatible, €2.49/TB)          │
└─────────────────────────────────────────────────┘
```

## Immich with S3 Storage

Immich supports S3-compatible storage. Configure in `.env`:

```bash
# S3 Storage Configuration
UPLOAD_LOCATION=/upload  # Keep originals locally or use S3
S3_ENABLED=true
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_ENDPOINT=https://s3.intercolo.com
S3_BUCKET=sphoto-photos
S3_REGION=eu-central-1
```

## External Storage (Block Storage)

For using Hetzner Storage Box or external SSD:

1. Mount storage on host:
   ```bash
   # Hetzner Storage Box via SFTP/SSHFS
   sshfs uXXXXXX@uXXXXXX.your-storagebox.de:/ /mnt/storage
   
   # Or via NFS/SMB if available
   mount -t cifs //uXXXXXX.your-storagebox.de/backup /mnt/storage
   ```

2. Set in `.env`:
   ```bash
   EXTERNAL_STORAGE_PATH=/mnt/storage/sphoto
   ```

3. Instances will store photos on external storage instead of local SSD.

## Scaling with Kubernetes

When you outgrow a single VPS:

1. **k3s** (lightweight): Good for 2-5 nodes
2. **k8s** (full): For larger deployments

Key considerations:
- Shared ML service can be memory-intensive (16GB recommended)
- Database should be on fast storage (SSD)
- Photos can be on slow storage (HDD/Object Storage)

## Migration Path

1. **Phase 1** (now): Single VPS + local storage
2. **Phase 2**: VPS + external block storage (Hetzner Storage Box)
3. **Phase 3**: VPS + S3 object storage (Intercolo)
4. **Phase 4**: k3s cluster + S3 + CDN

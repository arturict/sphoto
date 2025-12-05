# Building Custom Immich for SPhoto

This guide explains how to build a custom Immich image with the SPhoto billing button.

## Overview

The SPhoto fork adds a "Billing & Account" button to the Immich user menu that links to the SPhoto portal (`portal.sphoto.arturf.ch`).

## Changes Made

The following file was modified:

```
web/src/lib/components/shared-components/navigation-bar/account-info-panel.svelte
```

Changes:
- Added `mdiCreditCardOutline` icon import
- Added environment variables for portal URL configuration
- Added conditional "Billing & Account" button below admin settings

## Building the Custom Image

### Option 1: Build from this repository

```bash
# From the repository root
cd /path/to/swissphoto

# Build the full Immich server (includes web)
docker build -t sphoto-immich-server:latest \
  --build-arg VITE_SPHOTO_ENABLED=true \
  --build-arg VITE_SPHOTO_PORTAL_URL=https://portal.sphoto.arturf.ch \
  -f server/Dockerfile .
```

### Option 2: Use the official image (no billing button)

If you don't need the billing button, use the official image:

```yaml
services:
  server:
    image: ghcr.io/immich-app/immich-server:release
```

### Option 3: CI/CD Build

Add a GitHub Actions workflow:

```yaml
# .github/workflows/build-immich.yml
name: Build Custom Immich

on:
  push:
    paths:
      - 'web/**'
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: server/Dockerfile
          push: true
          tags: ghcr.io/${{ github.repository_owner }}/sphoto-immich:latest
          build-args: |
            VITE_SPHOTO_ENABLED=true
            VITE_SPHOTO_PORTAL_URL=https://portal.sphoto.arturf.ch
```

## Deployment

Update your `docker-compose.yml` to use the custom image:

```yaml
services:
  server:
    image: ghcr.io/YOUR_ORG/sphoto-immich:latest
    # ... rest of config
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_SPHOTO_ENABLED` | `false` | Enable the billing button |
| `VITE_SPHOTO_PORTAL_URL` | `https://portal.sphoto.arturf.ch` | Portal URL |

## Keeping Up-to-Date

When Immich releases a new version:

1. Sync your fork with upstream:
   ```bash
   git fetch upstream
   git merge upstream/main
   ```

2. Resolve any merge conflicts in the modified files

3. Rebuild and push the image

4. Update your docker-compose to pull the new image:
   ```bash
   docker compose pull && docker compose up -d
   ```

## Notes

- The billing button only appears when `VITE_SPHOTO_ENABLED=true`
- Non-admin users see the button below "Account Settings"
- Admin users see it below "Administration"
- The button opens the portal in the same tab (use `target="_blank"` for new tab)

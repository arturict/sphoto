# Deployment

## Requirements

- A Linux host with Docker (Compose v2.24 or newer) and enough disk for the photo volumes.
  Memory: about 2 GB for both Immich servers, Postgres and Valkey, plus 3 GB if you enable machine learning.
- DNS for `DOMAIN`, `free.DOMAIN` and `photos.DOMAIN` (or any three hostnames, see `.env`).
- A Stripe account with two recurring prices (Basic, Pro) and a webhook endpoint.
- A mail sender: Resend or any SMTP server.

## First start

```bash
cp .env.example .env     # fill in every value, generate secrets with: openssl rand -hex 32
docker compose up -d --build
docker compose logs -f app
```

The app waits for both Immich servers (the first start migrates their databases and takes a minute or
two), creates the Immich admin account from `IMMICH_ADMIN_EMAIL` and the matching password, and stores a
scoped API key. Sign-up answers with an error until this has finished.

Add the TLS front door when the host has no reverse proxy yet:

```bash
echo "DOMAIN=sphoto.example.com" >> .env
docker compose -f compose.yaml -f compose.proxy.yaml up -d
```

## Stripe

Webhook endpoint: `PUBLIC_URL/api/stripe/webhook`. Events: `checkout.session.completed`,
`customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
Enable plan switching between Basic and Pro in the Stripe customer portal configuration.

## Operating notes

- **Backups.** Back up the `app-data` volume (SQLite, exports), the `database` volume (both Immich
  databases) and the `free-uploads` and `paid-uploads` volumes together. Stop the stack or use Postgres
  and SQLite snapshots to get a consistent copy.
- **Updates.** Pin `IMMICH_VERSION` and read the Immich release notes before changing it. Rebuild the app
  with `docker compose up -d --build`.
- **Admin.** `PUBLIC_URL/admin` takes `ADMIN_API_KEY`. "Wartung jetzt ausführen" runs all scheduled tasks at once.
- **Logs.** The app writes JSON lines to stdout.
- **Reverse proxy.** The API trusts `X-Forwarded-For` for per-client rate limits. Only expose it behind a
  proxy that sets this header.

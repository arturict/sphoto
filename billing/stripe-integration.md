# 💳 Stripe Integration für SwissPhoto

## Übersicht

Für die Abrechnung deiner SwissPhoto-Kunden empfehlen wir Stripe.

## Setup

### 1. Stripe Account erstellen
1. Gehe zu [stripe.com](https://stripe.com)
2. Erstelle einen Account
3. Verifiziere dein Unternehmen

### 2. Produkte erstellen

Erstelle in Stripe folgende Produkte:

```javascript
// Stripe Dashboard → Products → Add Product

// Basic Plan
{
  name: "SwissPhoto Basic",
  price: 300, // CHF 3.00 in Rappen
  currency: "chf",
  recurring: { interval: "month" }
}

// Standard Plan
{
  name: "SwissPhoto Standard",
  price: 500,
  currency: "chf",
  recurring: { interval: "month" }
}

// Pro Plan
{
  name: "SwissPhoto Pro",
  price: 700,
  currency: "chf",
  recurring: { interval: "month" }
}

// Power Plan
{
  name: "SwissPhoto Power",
  price: 1200,
  currency: "chf",
  recurring: { interval: "month" }
}
```

### 3. Webhook einrichten

Erstelle einen Webhook Endpoint für:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

### 4. Environment Variables

```bash
# In .env hinzufügen
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_BASIC=price_xxx
STRIPE_PRICE_STANDARD=price_xxx
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_POWER=price_xxx
```

## Einfache Implementation

Da du nur ~15 Kunden hast, kannst du auch einen **manuellen Ansatz** wählen:

### Option A: Stripe Payment Links

1. Erstelle Payment Links in Stripe für jeden Plan
2. Teile die Links mit Kunden
3. Überprüfe Zahlungen manuell im Stripe Dashboard
4. Erstelle Accounts manuell in Immich Admin

### Option B: Stripe Invoicing

1. Erstelle Rechnungen manuell in Stripe
2. Kunden bezahlen per Link
3. Du erhältst Benachrichtigungen
4. Verwalte Accounts manuell

## Automatisierung (später)

Für mehr Kunden kannst du später einen Billing-Service bauen:

```
┌─────────────────┐      ┌─────────────────┐
│   Stripe        │ ───► │  Webhook Server │
│   (Zahlungen)   │      │  (Node.js)      │
└─────────────────┘      └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │  SwissPhoto DB  │
                         │  (User Quotas)  │
                         └─────────────────┘
```

## Storage Quotas

Immich unterstützt **User Quotas** nativ:
1. Gehe zu Admin → Users
2. Wähle einen User
3. Setze "Storage Quota" auf z.B. 100GB

## Kosten

Stripe Gebühren in der Schweiz:
- 2.9% + CHF 0.30 pro Transaktion
- Keine monatlichen Gebühren

Beispiel bei CHF 5.- Plan:
- Gebühr: ~CHF 0.45
- Du erhältst: ~CHF 4.55

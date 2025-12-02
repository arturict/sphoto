# SwissPhoto - Änderungsprotokoll

SwissPhoto ist ein Fork von [Immich](https://github.com/immich-app/immich), angepasst für den Schweizer Markt.

## 🇨🇭 Über SwissPhoto

**SwissPhoto** ist ein günstiger, selbst gehosteter Foto-Speicherdienst aus der Schweiz.

### Besonderheiten:
- 🏠 **Homelab-Hosting** - Läuft auf dedizierter Hardware in der Schweiz
- 💰 **Günstige Preise** - Ab CHF 3.-/Monat für 100GB
- 🔒 **Datenschutz** - Deine Daten bleiben in der Schweiz
- ⚠️ **Kein Backup** - Dafür extrem günstig (Eigenverantwortung!)

### Preismodell:
| Plan | Speicher | Preis/Monat |
|------|----------|-------------|
| Basic | 100 GB | CHF 3.- |
| Standard | 200 GB | CHF 5.- |
| Pro | 500 GB | CHF 7.- |
| Power | 1 TB | CHF 12.- |
| Extra | +1 TB | +CHF 12.- |

## Änderungen gegenüber Immich

- [x] Branding zu SwissPhoto geändert
- [x] Eigene Startseite mit Preisen
- [x] Billing-Integration vorbereitet
- [ ] Stripe-Integration
- [ ] Custom Domain Support

## Upstream Updates

So holst du Updates vom Original-Immich:

```bash
git fetch upstream
git merge upstream/main
# Konflikte lösen
git tag v1.x.x-swiss1
```

## Lizenz

Dieses Projekt steht unter der AGPL-3.0 Lizenz (wie Immich).
Der Quellcode muss öffentlich verfügbar bleiben.

---
Basiert auf Immich v2.x - https://github.com/immich-app/immich

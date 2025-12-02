# 🇨🇭 SwissPhoto

**Günstige, selbst gehostete Foto-Speicherung aus der Schweiz**

[![Based on Immich](https://img.shields.io/badge/Based%20on-Immich-blue)](https://github.com/immich-app/immich)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-green.svg)](LICENSE)

---

## ⚠️ WICHTIGER HINWEIS

> **SwissPhoto ist ein Budget-Dienst OHNE Backup!**
> 
> Deine Daten werden auf einem privaten Homelab-Server in der Schweiz gespeichert.
> Wir empfehlen dringend, eigene Backups deiner wichtigen Fotos zu erstellen.
> **Bei Datenverlust übernehmen wir keine Haftung.**

---

## 💰 Preise

| Plan | Speicher | Preis/Monat |
|------|----------|-------------|
| **Basic** | 100 GB | CHF 3.- |
| **Standard** ⭐ | 200 GB | CHF 5.- |
| **Pro** | 500 GB | CHF 7.- |
| **Power** | 1 TB | CHF 12.- |
| **Extra** | +1 TB | +CHF 12.- |

---

## ✨ Features

- 📱 **Mobile App** - Nutze die offizielle Immich App (iOS & Android)
- 🔍 **Smart Search** - KI-basierte Bildsuche
- 👤 **Gesichtserkennung** - Automatische Personenerkennung
- 🗺️ **Karten-Ansicht** - Sieh wo deine Fotos aufgenommen wurden
- 🔗 **Teilen** - Teile Alben mit Familie und Freunden
- 🔒 **Privatsphäre** - Deine Daten bleiben in der Schweiz

---

## 🚀 Technische Details

### Hardware
- **Server**: Dedizierter Server in der Schweiz
- **RAM**: 128 GB
- **CPU**: Multi-Core Server CPU
- **Storage**: HDD-Array für Medien, SSD für Datenbank
- **Internet**: 130 Mbit/s Upload / 600 Mbit/s Download

### Software
- Basiert auf [Immich](https://github.com/immich-app/immich)
- Docker-basierte Architektur
- PostgreSQL Datenbank
- CPU-basiertes Machine Learning

---

## 🔧 Self-Hosting (für Entwickler)

```bash
# Repository klonen
git clone https://github.com/dein-username/swissphoto.git
cd swissphoto

# Environment konfigurieren
cp docker/swissphoto.env docker/.env
# Bearbeite docker/.env mit deinen Einstellungen

# Starten
cd docker
docker compose -f docker-compose.swissphoto.yml up -d

# Logs anschauen
docker compose -f docker-compose.swissphoto.yml logs -f
```

---

## 📄 Lizenz

SwissPhoto ist ein Fork von Immich und steht unter der **AGPL-3.0 Lizenz**.

Der Quellcode muss öffentlich verfügbar bleiben.

---

## 🙏 Credits

- [Immich](https://github.com/immich-app/immich) - Das fantastische Open-Source Projekt auf dem SwissPhoto basiert
- [PixelUnion](https://pixelunion.eu) - Inspiration für das Hosting-Modell

---

## 📞 Support

- E-Mail: support@swissphoto.ch
- GitHub Issues: [Hier melden](../../issues)

---

*SwissPhoto ist nicht mit Immich assoziiert. Wir respektieren die Arbeit der Immich-Community und tragen zurück wo möglich.*

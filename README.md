# 🎉 Hochzeitsplaner Web-Anwendung

Eine vollständige Hochzeitsplanungs-Software mit Web-Interface, SSL-Unterstützung und Windows .exe Build.

## ✨ Features

- 📊 **Budget-Verwaltung** - Automatische Kostenberechnung basierend auf Gästezahlen
- 👥 **Gäste-Management** - Einladungen, RSVP, Gruppenverwaltung
- 📅 **Zeitplan** - Hochzeitstag-Planung mit öffentlichem Gäste-Zugang
- 💰 **Kosten-Konfiguration** - Flexible Preisgestaltung pro Person/Kategorie
- �️ **Google Maps Integration** - Kartenvorschauen mit API Key Unterstützung
- �🔐 **Multi-User Support** - Admin/User/Gast-Rollen mit sicherer Authentifizierung
- 🔒 **SSL-Unterstützung** - HTTPS mit echten Zertifikaten
- 🖥️ **Windows .exe** - Standalone-Anwendung ohne Installation

## 🚀 Automatischer Windows Build

[![Build Windows .exe](https://github.com/DEIN_USERNAME/DEIN_REPO/actions/workflows/build-exe.yml/badge.svg)](https://github.com/DEIN_USERNAME/DEIN_REPO/actions/workflows/build-exe.yml)

### Download der fertigen .exe:
1. Gehe zu [Actions](../../actions)
2. Wähle den neuesten erfolgreichen Build
3. Lade `hochzeitsplaner-windows` herunter
4. Entpacke und starte `Hochzeitsplaner.exe`

## 🔧 Technische Details

### Systemanforderungen
- **Windows:** 10/11 (64-bit)
- **Speicher:** ~50MB für .exe + Daten
- **Netzwerk:** Optional für Gäste-Zugang

### Architektur
- **Backend:** Flask 3.0 (Python)
- **Frontend:** HTML5 + JavaScript (Vanilla)
- **Datenbank:** CSV/JSON (portable)
- **Build:** PyInstaller für Windows .exe

### Unterstützte Browser
- Chrome/Edge (empfohlen)
- Firefox
- Safari

## 📱 Verwendung

### 1. Erste Schritte
```
1. Hochzeitsplaner.exe starten
2. Datenverzeichnis auswählen (beim ersten Start)
3. Browser öffnet sich automatisch
4. Standard-Login: admin / hochzeit2025
```

### 2. Gäste-Zugang
- **URL:** `https://DEINE-IP:8443` oder `http://DEINE-IP:8080`
- **Login:** Gäste-Code oder Email
- **Features:** RSVP, Zeitplan-Ansicht

### 3. Google Maps Integration
Für verbesserte Kartenanzeigen:
```bash
# Konfiguriere deinen Google Maps API Key
# Siehe GOOGLE_MAPS_ANLEITUNG.md für Details
google_maps_config.json
```

### 4. SSL-Zertifikate (Optional)
```
ssl_certificate.crt  ← SSL-Zertifikat
ssl_private_key.key  ← Privater Schlüssel
```
Platziere beide Dateien neben der .exe für automatische HTTPS-Aktivierung.

## 🛠️ Entwicklung

### Lokaler Build
```bash
pip install -r requirements.txt
python working_launcher_ssl.py
```

### GitHub Actions Build
Automatisch bei Push auf `main` Branch.

## 📋 Standardkonfiguration

### Login-Daten
- **Admin:** `admin` / `hochzeit2025`
- **Gäste:** Email oder generierter Code

### Ports
- **HTTPS:** 8443 (bevorzugt)
- **HTTP:** 8080 (Fallback)

### Datenstruktur
```
data/
├── gaesteliste.json    ← Gäste und RSVP
├── budget.json         ← Budget-Einträge  
├── zeitplan.json       ← Hochzeitstag-Ablauf
├── kosten_config.json  ← Preiskonfiguration
└── settings.json       ← App-Einstellungen
```

## 🎯 Lokale Netzwerk-Integration

### Domain-Setup (hochzeitsplaner.de)
```bash
# Windows: C:\Windows\System32\drivers\etc\hosts
# macOS/Linux: /etc/hosts
192.168.1.100  hochzeitsplaner.de
```

### Router-Konfiguration
1. **Port-Weiterleitung:** 80 → 8080, 443 → 8443
2. **DNS:** hochzeitsplaner.de → lokale IP
3. **Firewall:** Ports 8080/8443 freigeben

## 🔐 Sicherheit

- ✅ Session-basierte Authentifizierung
- ✅ CSRF-Schutz
- ✅ Rollen-basierte Zugriffskontrolle
- ✅ SSL/TLS-Verschlüsselung
- ✅ Sichere Passwort-Speicherung

## 📞 Support

Bei Problemen:
1. Programm neu starten
2. Port-Konflikte prüfen (automatische Auswahl)
3. SSL-Zertifikate validieren
4. Firewall-Einstellungen überprüfen

---

**Entwickelt für die perfekte Hochzeitsplanung! 💒✨**

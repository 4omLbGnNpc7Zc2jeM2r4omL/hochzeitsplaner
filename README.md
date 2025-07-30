# Hochzeitsplaner Web-Anwendung

Eine moderne, webbasierte Anwendung zur Planung und Verwaltung von Hochzeiten.

## 🎉 Features

- **Dashboard**: Übersicht über Gäste und Budget
- **Gästeverwaltung**: Vollständige Verwaltung der Gästeliste
- **Budgetplanung**: Automatische Budgeterstellung und -verfolgung
- **Excel Export**: Export aller Daten nach Excel
- **Responsive Design**: Funktioniert auf Desktop und Mobile
- **Moderne UI**: Bootstrap 5 mit ansprechendem Design

## 🚀 Schnellstart

### 1. Einfacher Start (Empfohlen)

```bash
python3 start_web.py
```

Das Script:
- Prüft Python-Version
- Installiert automatisch alle Abhängigkeiten
- Erstellt notwendige Verzeichnisse
- Startet die Web-Anwendung
- Öffnet automatisch den Browser

### 2. Manueller Start

```bash
# Abhängigkeiten installieren
pip install -r requirements.txt

# Anwendung starten
python3 app.py
```

Dann Browser öffnen: http://localhost:5000

## 📋 Voraussetzungen

- Python 3.8 oder höher
- Internetverbindung (für Bootstrap/Chart.js CDN)

## 📂 Projektstruktur

```
Hochzeitsbot WebVersion/
├── app.py                 # Flask Hauptanwendung
├── datenmanager.py        # Datenmanagement
├── hochzeitsplaner.py     # Original Desktop-Version
├── start_web.py           # Automatisches Setup & Start
├── requirements.txt       # Python-Abhängigkeiten
├── README.md              # Diese Datei
├── data/                  # Datenverzeichnis
├── templates/             # HTML-Templates
│   ├── base.html
│   ├── index.html
│   ├── gaesteliste.html
│   ├── budget.html
│   └── einstellungen.html
└── static/                # CSS & JavaScript
    ├── css/
    │   └── style.css
    └── js/
        ├── main.js
        ├── dashboard.js
        └── gaesteliste.js
```

## 🔧 Verwendung

### Dashboard
- Zeigt Übersicht über Gäste und Budget
- Interaktive Charts
- Schnellzugriff auf alle Funktionen

### Gästeverwaltung
- Gäste hinzufügen, bearbeiten, löschen
- Filter nach Status
- Suchfunktion
- Teilnahme-Tracking für verschiedene Events

### Budget
- Automatische Budgeterstellung basierend auf Gästeanzahl
- Kategorien-basierte Verwaltung
- Ausgaben-Tracking
- Übersicht über verbleibendes Budget

### Einstellungen
- Namen von Braut/Bräutigam konfigurierbar
- Budget-Parameter anpassbar
- Excel-Export
- System-Informationen

## 📊 Excel Export

Der Excel-Export erstellt eine umfassende Übersicht mit:
- Gästeliste mit allen Details
- Budget-Übersicht
- Zusammenfassungen und Statistiken

## 🛠 Technische Details

### Backend
- **Flask**: Web-Framework
- **Pandas**: Datenmanagement
- **OpenPyXL**: Excel-Export

### Frontend
- **Bootstrap 5**: UI-Framework
- **Chart.js**: Diagramme
- **Vanilla JavaScript**: Interaktivität

### Datenbank
- CSV-basierte Datenspeicherung
- Keine externe Datenbank erforderlich

## 🔒 Sicherheit

- Läuft lokal (localhost:5000)
- Keine Daten werden ins Internet übertragen
- CORS aktiviert für lokale Entwicklung

## 🆘 Problembehandlung

### Port bereits in Verwendung
```bash
# Prozess finden und beenden
lsof -ti:5000 | xargs kill -9
```

### Abhängigkeiten-Probleme
```bash
# Pip upgraden
python3 -m pip install --upgrade pip

# Requirements neu installieren
pip install -r requirements.txt --force-reinstall
```

### Browser öffnet nicht automatisch
Manuell öffnen: http://localhost:5000

## 📝 Changelog

### Version 2.0.0
- Komplette Web-Version
- Responsive Design
- Automatisches Setup
- Moderne UI mit Bootstrap 5

### Version 1.x
- Desktop-Version mit tkinter
- Grundlegende Funktionalität

## 👥 Support

Bei Problemen oder Fragen:
1. README.md durchlesen
2. Problembehandlung versuchen
3. Log-Ausgaben prüfen

## 📄 Lizenz

Dieses Projekt ist für den privaten Gebrauch bestimmt.

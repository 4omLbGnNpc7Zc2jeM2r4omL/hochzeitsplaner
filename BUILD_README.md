# Hochzeitsplaner - .exe Distribution

## 🎯 Überblick
Dieses Projekt erstellt eine eigenständige .exe-Datei Ihrer Hochzeitsplaner-Webanwendung, die auf jedem Windows-Computer ohne Python-Installation läuft.

## 🚀 Schnellstart (.exe erstellen)

### Windows:
```batch
# Doppelklick auf:
BUILD.bat
```

### macOS/Linux (für Windows-Distribution):
```bash
# Im Terminal:
./build.sh
```

### Manuell:
```bash
python build_exe.py
```

## 📦 Was wird erstellt?
Nach dem Build-Prozess erhalten Sie:
- `Distribution/Hochzeitsplaner.exe` - Die fertige Anwendung
- `Distribution/README.txt` - Anleitung für Endbenutzer

## 🎯 Features der .exe
- ✅ **Ein-Klick-Start**: Doppelklick startet alles
- ✅ **Automatischer Browser-Start**: Öffnet die Web-App automatisch
- ✅ **Alle Abhängigkeiten enthalten**: Keine separate Installation nötig
- ✅ **Portable**: Kann in jeden Ordner kopiert werden
- ✅ **Daten-Export**: Alle Daten bleiben lokal gespeichert

## 🔧 Technische Details

### Build-Prozess:
1. **PyInstaller-Installation**: Automatisch falls nicht vorhanden
2. **Launcher-Erstellung**: Spezielle Start-Logik für Web-App
3. **Dependency-Sammlung**: Alle Python-Module werden eingepackt
4. **Asset-Integration**: Templates, CSS, JS, Daten-Ordner
5. **One-File-Build**: Alles in einer .exe-Datei

### Enthaltene Module:
- Flask + Flask-CORS (Web-Framework)
- Pandas + OpenPyXL (Datenverarbeitung)
- Pillow (Bildverarbeitung)
- Alle Standard-Python-Libraries

### Build-Konfiguration:
- **Typ**: One-File (alle Abhängigkeiten in einer .exe)
- **Konsole**: Ja (für Status-Ausgaben)
- **Kompression**: UPX aktiviert
- **Icon**: Standard (kann erweitert werden)

## 📁 Verzeichnis-Struktur nach Build:
```
Distribution/
├── Hochzeitsplaner.exe    # Die fertige Anwendung
└── README.txt             # Benutzer-Anleitung

# Temporäre Build-Dateien (können gelöscht werden):
build/                     # PyInstaller Cache
dist/                      # Build-Output
launcher.py               # Generierter Launcher
hochzeitsplaner.spec      # PyInstaller Konfiguration
version_info.txt          # Windows Version-Info
```

## 🚀 Anwendung starten (Endbenutzer)
1. **Doppelklick** auf `Hochzeitsplaner.exe`
2. **Warten** auf "Server läuft auf..."
3. **Browser öffnet automatisch** mit der Anwendung
4. **Anmelden** mit: admin / hochzeit2025

## 🔐 Konfiguration
Die Anmelde-Daten können in der generierten `auth_config.json` geändert werden:
```json
{
  "auth": {
    "username": "admin",
    "password": "hochzeit2025",
    "session_timeout_hours": 1
  }
}
```

## 🆘 Fehlerbehebung

### Build-Probleme:
- **Python fehlt**: Python 3.8+ installieren
- **PyInstaller-Fehler**: `pip install --upgrade pyinstaller`
- **Memory-Fehler**: Mehr RAM oder Swap-Space

### Runtime-Probleme:
- **Port belegt**: Andere Ports werden automatisch probiert
- **Antivirus-Warnung**: .exe zur Ausnahme-Liste hinzufügen
- **Browser öffnet nicht**: Manuell http://localhost:8080 aufrufen

### Performance:
- **Langsamer Start**: Normal bei One-File-Build (3-10 Sekunden)
- **Große Datei**: ~50-100MB (alle Abhängigkeiten enthalten)

## 🔄 Aktualisierung
Um eine neue Version zu erstellen:
1. Änderungen am Code vornehmen
2. `BUILD.bat` erneut ausführen
3. Neue .exe aus `Distribution/` verwenden

## 📋 Systemanforderungen
- **Windows**: 7/8/10/11 (64-bit empfohlen)
- **RAM**: Mindestens 512MB verfügbar
- **Festplatte**: ~200MB freier Speicher
- **Browser**: Chrome, Firefox, Edge, Safari

## 🎉 Fertig!
Ihre Hochzeitsplaner-Anwendung ist jetzt als portable .exe verfügbar und kann auf jedem Windows-Computer ohne Installation verwendet werden!

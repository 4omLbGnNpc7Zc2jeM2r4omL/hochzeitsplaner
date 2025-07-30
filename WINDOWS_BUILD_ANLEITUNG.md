# 🚀 Windows .exe mit GitHub Actions erstellen

## Schritt-für-Schritt Anleitung

### 1. GitHub Repository erstellen
1. Gehen Sie zu [github.com](https://github.com)
2. Klicken Sie auf "New repository"
3. Name: `hochzeitsplaner`
4. ✅ "Public" (oder Private mit GitHub Pro)
5. Klicken Sie "Create repository"

### 2. Code hochladen
```bash
# Im Terminal (in Ihrem Projekt-Ordner):
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/IHR_USERNAME/hochzeitsplaner.git
git branch -M main
git push -u origin main
```

**Oder über GitHub Desktop:**
1. GitHub Desktop installieren
2. "Add an Existing Repository"
3. Ordner auswählen
4. "Publish repository"

### 3. Automatischer Build
Nach dem Upload startet automatisch der Build:

1. Gehen Sie zu Ihrem Repository auf GitHub
2. Klicken Sie auf **"Actions"**
3. Sie sehen: "Build Windows .exe" läuft
4. Warten Sie ~5-10 Minuten

### 4. .exe herunterladen
Nach erfolgreichem Build:

1. Gehen Sie zu **"Actions"** → **"Build Windows .exe"**
2. Klicken Sie auf den grünen Build
3. Scrollen Sie nach unten zu **"Artifacts"**
4. Klicken Sie auf **"Hochzeitsplaner-Windows"**
5. ZIP-Datei wird heruntergeladen

### 5. .exe verwenden
1. ZIP-Datei entpacken
2. `Hochzeitsplaner.exe` ist bereit!
3. Doppelklick zum Starten

## 🔄 Automatische Updates
Bei jeder Code-Änderung:
1. Code zu GitHub pushen
2. Neue .exe wird automatisch erstellt
3. Download aus Actions/Artifacts

## 🆘 Alternative: Manual Trigger
Falls der Build nicht automatisch startet:
1. Gehen Sie zu **"Actions"**
2. Klicken Sie auf **"Build Windows .exe"**
3. Klicken Sie **"Run workflow"**
4. Klicken Sie **"Run workflow"** (grüner Button)

## 📋 Was passiert beim Build?
1. ✅ Windows-VM startet
2. ✅ Python 3.11 wird installiert
3. ✅ Ihre Abhängigkeiten werden installiert
4. ✅ PyInstaller erstellt die .exe
5. ✅ .exe wird als Artifact gespeichert

## 🎯 Resultat
- **Datei:** `Hochzeitsplaner.exe`
- **Größe:** ~50-100 MB (alle Abhängigkeiten enthalten)
- **Kompatibilität:** Windows 7/8/10/11
- **Portable:** Kann überall hin kopiert werden
- **Keine Installation nötig:** Einfach doppelklicken!

---

## 🔧 Lokaler Windows-Build
Falls Sie Zugang zu einem Windows-Computer haben:

1. Kopieren Sie alle Dateien auf Windows
2. Doppelklick auf `BUILD_WINDOWS.bat`
3. Fertig!

## 💡 Tipps
- **GitHub Actions:** 2000 Minuten/Monat kostenlos
- **Builds dauern:** ~5-10 Minuten
- **Artifacts bleiben:** 30 Tage verfügbar
- **Updates:** Einfach neuen Code pushen

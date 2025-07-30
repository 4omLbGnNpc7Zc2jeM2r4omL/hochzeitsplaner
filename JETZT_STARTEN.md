# 🚀 WINDOWS .EXE - FINALE ANLEITUNG

## ✅ BEREITS ERLEDIGT:
- ✅ Git Repository erstellt
- ✅ GitHub Actions Workflow konfiguriert  
- ✅ Alle Build-Dateien vorbereitet
- ✅ .gitignore erstellt

## 🎯 NÄCHSTE SCHRITTE:

### 1. GitHub Repository erstellen (2 Minuten)
1. Gehen Sie zu: **https://github.com**
2. Klicken Sie: **"New repository"** (grüner Button)
3. Repository Name: **`hochzeitsplaner`**
4. Beschreibung: **`Hochzeitsplaner Web-App mit automatischem Windows .exe Build`**
5. ✅ **Public** (oder Private mit GitHub Pro)
6. ❌ **NICHT** "Initialize with README" ankreuzen
7. Klicken Sie: **"Create repository"**

### 2. Code zu GitHub hochladen (1 Minute)
Kopieren Sie diese Befehle in Ihr Terminal und ersetzen Sie `IHR_USERNAME`:

```bash
git remote add origin https://github.com/IHR_USERNAME/hochzeitsplaner.git
git branch -M main
git push -u origin main
```

**Beispiel:**
```bash
git remote add origin https://github.com/pascal123/hochzeitsplaner.git
git branch -M main  
git push -u origin main
```

### 3. Automatischer Windows .exe Build (5-10 Minuten)
Nach dem Push:

1. **GitHub öffnen:** Gehen Sie zu Ihrem Repository
2. **Actions klicken:** Tab "Actions" oben
3. **Build läuft:** "Build Windows .exe" wird automatisch gestartet
4. **Warten:** ~5-10 Minuten (grüner Haken = fertig)
5. **Download:** Klick auf Build → "Artifacts" → "Hochzeitsplaner-Windows"

## 🎉 ERGEBNIS:
- **Datei:** `Hochzeitsplaner.exe` 
- **Größe:** ~50-100 MB
- **Funktionen:** Komplette Web-App mit Ein-Klick-Start
- **Kompatibilität:** Windows 7/8/10/11
- **Installation:** Keine nötig - einfach ausführen!

## 🔄 BEI ÄNDERUNGEN:
Für Updates einfach:
```bash
git add .
git commit -m "Update"
git push
```
→ Neue .exe wird automatisch erstellt!

## 🆘 FALLS PROBLEME:
1. **Build fehlgeschlagen:** Prüfen Sie "Actions" → Build-Log
2. **Repository privat:** GitHub Pro nötig für private Repos
3. **Keine Artifacts:** Build noch nicht fertig oder fehlgeschlagen

## 📱 KONTAKT:
Bei Fragen können Sie die Build-Logs in GitHub Actions prüfen oder das Repository teilen.

---

**🚀 JETZT STARTEN:** Gehen Sie zu github.com und erstellen Sie das Repository!

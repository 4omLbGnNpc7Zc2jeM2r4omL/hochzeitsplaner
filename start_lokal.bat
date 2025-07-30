@echo off
chcp 65001 >nul
title Hochzeitsplaner - Lokaler HTTP-Modus

echo.
echo ===============================================
echo    HOCHZEITSPLANER - LOKALER START
echo    Ohne SSL-Probleme im lokalen Netzwerk
echo ===============================================
echo.

REM Prüfe ob Python verfügbar ist
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python ist nicht installiert oder nicht im PATH verfügbar!
    echo.
    echo 💡 Bitte Python von python.org herunterladen und installieren
    echo    https://python.org/downloads/
    echo.
    pause
    exit /b 1
)

REM Prüfe ob app.py existiert
if not exist "app.py" (
    echo ❌ app.py nicht gefunden!
    echo    Bitte starten Sie diese Datei im Hochzeitsplaner-Verzeichnis
    echo.
    pause
    exit /b 1
)

echo ✅ Python gefunden
echo ✅ Hochzeitsplaner-Dateien gefunden
echo.
echo 🚀 Starte lokalen HTTP-Server...
echo    Keine SSL-Zertifikate benötigt
echo    Schnell und sicher im lokalen Netzwerk
echo.

REM Starte lokalen HTTP-Launcher
python local_launcher_http.py

echo.
echo 🛑 Hochzeitsplaner beendet
pause

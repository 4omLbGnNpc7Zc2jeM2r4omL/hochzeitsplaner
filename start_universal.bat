@echo off
chcp 65001 >nul
title Hochzeitsplaner - Universeller Launcher

echo.
echo ===============================================
echo    HOCHZEITSPLANER - UNIVERSELLER MODUS
echo    Automatisch: HTTP lokal + HTTPS extern
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
echo 🎯 UNIVERSELLER MODUS:
echo    • Automatische Netzwerk-Erkennung
echo    • HTTP für lokale Zugriffe (Port 8080)
echo    • HTTPS für externe Zugriffe (Port 8443, falls SSL verfügbar)
echo    • Unterstützt: DS-Lite, Fritz!Box, lokale Domains
echo    • Zugriff: localhost, IP-Adresse, hochzeitsplaner.de
echo.
echo 🚀 Starte universellen Server...
echo.

REM Starte universellen Launcher
python universal_launcher.py

echo.
echo 🛑 Hochzeitsplaner beendet
pause

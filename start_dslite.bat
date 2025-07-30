@echo off
chcp 65001 >nul
title Hochzeitsplaner - DS-Lite IPv6-Modus

echo.
echo ===============================================
echo    HOCHZEITSPLANER - DS-LITE IPv6-MODUS
echo    Optimiert für Vodafone DS-Lite
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
echo 🌐 DS-LITE INFORMATION:
echo    • Vodafone DS-Lite = Keine öffentliche IPv4
echo    • IPv4 Portweiterleitung funktioniert NICHT
echo    • IPv6 funktioniert direkt ohne NAT
echo    • Externe Zugriffe nur über IPv6 möglich
echo.
echo 🚀 Starte IPv6-optimierten Server...
echo    HTTP: Port 8080 (lokal über IPv4)
echo    HTTPS: Port 8443 (extern über IPv6 direkt)
echo.

REM Starte IPv6-optimierten Launcher
python launcher_ipv6_dslite.py

echo.
echo 🛑 Hochzeitsplaner beendet
pause

@echo off
chcp 65001 >nul
title Hochzeitsplaner - Dual-Mode (HTTP + HTTPS)

echo.
echo ===============================================
echo    HOCHZEITSPLANER - DUAL-MODE
echo    HTTP für lokal + HTTPS für Fritz!Box
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

REM Prüfe SSL-Zertifikate
if exist "ssl_certificate.crt" (
    if exist "ssl_private_key.key" (
        echo ✅ SSL-Zertifikate gefunden - Dual-Mode verfügbar
    ) else (
        echo ⚠️ SSL-Schlüssel nicht gefunden - nur HTTP-Modus
    )
) else (
    echo ⚠️ SSL-Zertifikat nicht gefunden - nur HTTP-Modus
)

echo.
echo 🚀 Starte Dual-Mode Server...
echo    HTTP: Port 8080 (lokal)
echo    HTTPS: Port 8443 (extern über Fritz!Box)
echo.

REM Starte Dual-Mode-Launcher
python smart_launcher_dual.py

echo.
echo 🛑 Hochzeitsplaner beendet
pause

@echo off
echo ================================================
echo    HOCHZEITSPLANER .EXE BUILDER
echo ================================================
echo.

REM Wechsle ins richtige Verzeichnis
cd /d "%~dp0"

REM Prüfe ob Python verfügbar ist
python --version >nul 2>&1
if errorlevel 1 (
    echo FEHLER: Python ist nicht installiert oder nicht im PATH!
    echo Bitte installieren Sie Python 3.8+ von https://python.org
    pause
    exit /b 1
)

echo ✅ Python gefunden
echo.

REM Führe Build-Script aus
echo 🔨 Starte Build-Prozess...
python build_exe.py

echo.
echo ✅ Build abgeschlossen!
echo.
echo 📁 Ihre .exe finden Sie im Distribution-Ordner
echo 🚀 Zum Testen: Doppelklick auf Distribution\Hochzeitsplaner.exe
echo.
pause

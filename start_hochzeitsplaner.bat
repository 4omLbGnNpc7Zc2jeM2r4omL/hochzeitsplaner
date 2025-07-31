@echo off
chcp 65001 >nul 2>&1
cls

echo.
echo ========================================================
echo  🎉 HOCHZEITSPLANER PRODUKTIVSERVER
echo ========================================================
echo.

REM Prüfe Python-Installation
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python ist nicht installiert oder nicht im PATH!
    echo.
    echo 📥 Bitte installieren Sie Python von https://python.org
    pause
    exit /b 1
)

REM Zeige Python-Version
echo ✅ Python-Installation gefunden:
python --version

REM Prüfe ob Virtual Environment existiert
if exist ".venv\Scripts\activate.bat" (
    echo ✅ Virtual Environment gefunden
    call .venv\Scripts\activate.bat
) else (
    echo ⚠️  Kein Virtual Environment gefunden
    echo 💡 Tipp: Erstellen Sie ein venv mit: python -m venv .venv
)

echo.
echo 📦 Prüfe Dependencies...

REM Prüfe ob requirements.txt existiert
if exist "requirements.txt" (
    echo ✅ requirements.txt gefunden
    pip install -r requirements.txt --quiet
) else (
    echo ⚠️  requirements.txt nicht gefunden
    echo 📥 Installiere Basis-Dependencies...
    pip install flask flask-cors pandas openpyxl gunicorn gevent --quiet
)

echo.
echo 🚀 Starte Hochzeitsplaner Produktivserver...
echo 🌐 Nach dem Start: http://localhost:8080
echo 🛑 Zum Beenden: Strg+C
echo ========================================================
echo.

REM Starte den optimierten Launcher
python launcher.py

echo.
echo 👋 Hochzeitsplaner beendet
pause

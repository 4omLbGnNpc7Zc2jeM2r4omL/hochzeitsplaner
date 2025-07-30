@echo off
chcp 65001 >nul
echo ================================================
echo    HOCHZEITSPLANER WINDOWS .EXE BUILDER
echo ================================================
echo.

REM Prüfe Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python nicht gefunden!
    echo Installieren Sie Python von python.org
    pause
    exit /b 1
)

echo ✅ Python gefunden
echo.

REM Installiere PyInstaller
echo 📦 Installiere PyInstaller...
python -m pip install pyinstaller >nul 2>&1

REM Erstelle Launcher
echo 🔧 Erstelle Windows-Launcher...
python -c "exec(open('cross_platform_build.py').read().split('def create_windows_launcher')[1].split('def ')[0]); create_windows_launcher()"

REM Build .exe
echo 🔨 Erstelle .exe...
python -m PyInstaller --clean windows_build.spec

REM Erstelle Distribution
echo 📦 Erstelle Paket...
if exist "HochzeitsplanerWindows" rmdir /s /q "HochzeitsplanerWindows"
mkdir "HochzeitsplanerWindows"
copy "dist\Hochzeitsplaner.exe" "HochzeitsplanerWindows\"

echo # Hochzeitsplaner Windows > "HochzeitsplanerWindows\README.txt"
echo. >> "HochzeitsplanerWindows\README.txt"
echo Doppelklick auf Hochzeitsplaner.exe zum Starten >> "HochzeitsplanerWindows\README.txt"
echo Anmeldung: admin / hochzeit2025 >> "HochzeitsplanerWindows\README.txt"

echo.
echo ✅ FERTIG!
echo 📁 Windows .exe: HochzeitsplanerWindows\Hochzeitsplaner.exe
echo.
pause

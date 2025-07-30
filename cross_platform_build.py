#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cross-Platform .exe Builder
Erstellt Windows-kompatible Builds auch von macOS/Linux
"""

import sys
import os
import subprocess
import shutil
from pathlib import Path

def print_header():
    print("🎉" + "="*50 + "🎉")
    print("    CROSS-PLATFORM WINDOWS .EXE BUILDER")
    print("🎉" + "="*50 + "🎉")
    print()

def create_windows_launcher():
    """Erstellt Windows-optimierten Launcher"""
    launcher_content = '''#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Windows Hochzeitsplaner Launcher
"""

import sys
import os
import webbrowser
import time
import threading
import socket

# Windows-spezifische Imports
try:
    import winreg
    import ctypes
    from ctypes import wintypes
    WINDOWS = True
except ImportError:
    WINDOWS = False

def get_app_data_dir():
    """Holt Windows AppData Verzeichnis"""
    if WINDOWS:
        try:
            # Windows AppData Pfad
            appdata = os.environ.get('APPDATA')
            if appdata:
                app_dir = os.path.join(appdata, 'Hochzeitsplaner')
                os.makedirs(app_dir, exist_ok=True)
                return app_dir
        except:
            pass
    
    # Fallback: Aktuelles Verzeichnis
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    else:
        return os.path.dirname(os.path.abspath(__file__))

def setup_windows_console():
    """Konfiguriert Windows Konsole"""
    if WINDOWS:
        try:
            # UTF-8 Support aktivieren
            ctypes.windll.kernel32.SetConsoleOutputCP(65001)
            # Konsolen-Titel setzen
            ctypes.windll.kernel32.SetConsoleTitleW("Hochzeitsplaner 🎉")
        except:
            pass

def find_available_port():
    """Findet verfügbaren Port"""
    for port in [8080, 8081, 8082, 5001, 5002]:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('localhost', port))
                return port
        except OSError:
            continue
    return 8080

def open_browser_delayed(url):
    """Öffnet Browser nach Verzögerung"""
    def open_browser():
        time.sleep(3)
        try:
            webbrowser.open(url)
            print(f"🌐 Browser geöffnet: {url}")
        except Exception as e:
            print(f"⚠️  Browser-Fehler: {e}")
            print(f"   Manuell öffnen: {url}")
    
    threading.Thread(target=open_browser, daemon=True).start()

def main():
    # Windows-Setup
    setup_windows_console()
    
    # Ins richtige Verzeichnis wechseln
    app_dir = get_app_data_dir()
    os.chdir(app_dir)
    
    print("🎉" + "="*50 + "🎉")
    print("        HOCHZEITSPLANER WINDOWS")
    print("🎉" + "="*50 + "🎉")
    print()
    print("🚀 Starte Anwendung...")
    print("📁 Daten-Ordner:", app_dir)
    
    # Port finden und Browser starten
    port = find_available_port()
    url = f"http://localhost:{port}"
    open_browser_delayed(url)
    
    try:
        # Flask App starten
        os.environ['FLASK_ENV'] = 'production'
        
        from app import app
        
        print(f"🌐 Server: {url}")
        print("📝 Anmeldung: admin / hochzeit2025")
        print("🛑 Beenden: Strg+C oder Fenster schließen")
        print()
        
        app.run(
            host='127.0.0.1',
            port=port,
            debug=False,
            use_reloader=False,
            threaded=True
        )
        
    except KeyboardInterrupt:
        print("\\n🛑 Beendet durch Benutzer")
    except Exception as e:
        print(f"❌ Fehler: {e}")
        if WINDOWS:
            input("\\nEnter zum Beenden...")
    
if __name__ == '__main__':
    main()
'''
    
    with open('windows_launcher.py', 'w', encoding='utf-8') as f:
        f.write(launcher_content)
    
    print("✅ Windows-Launcher erstellt")

def create_windows_spec():
    """Erstellt Windows-optimierte .spec Datei"""
    spec_content = '''# -*- mode: python ; coding: utf-8 -*-
# Windows .exe Konfiguration

import sys
from pathlib import Path

block_cipher = None

# Sammle alle benötigten Dateien
data_files = [
    ('data', 'data'),
    ('static', 'static'),
    ('templates', 'templates'),
]

# Prüfe ob auth_config.json existiert
if Path('auth_config.json').exists():
    data_files.append(('auth_config.json', '.'))

# Hidden imports für Windows
hidden_imports = [
    'flask',
    'flask_cors', 
    'pandas',
    'openpyxl',
    'PIL',
    'PIL.Image',
    'werkzeug',
    'jinja2',
    'markupsafe',
    'itsdangerous',
    'click',
    'blinker',
    'numpy',
    'pytz',
    'dateutil',
    'threading',
    'socket',
    'webbrowser',
    'json',
    'time',
    'os',
    'sys',
    'shutil',
    'tempfile',
    'zipfile',
    'datetime',
    'functools',
]

# Windows-spezifische Imports
if sys.platform == 'win32':
    hidden_imports.extend([
        'winreg',
        'ctypes',
        'ctypes.wintypes',
        'msvcrt'
    ])

a = Analysis(
    ['windows_launcher.py', 'app.py', 'datenmanager.py'],
    pathex=[],
    binaries=[],
    datas=data_files,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['matplotlib', 'scipy', 'tkinter'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='Hochzeitsplaner',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
'''
    
    with open('windows_build.spec', 'w', encoding='utf-8') as f:
        f.write(spec_content)
    
    print("✅ Windows .spec erstellt")

def create_batch_file():
    """Erstellt Windows Batch-Datei für einfachen Build"""
    batch_content = '''@echo off
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
copy "dist\\Hochzeitsplaner.exe" "HochzeitsplanerWindows\\"

echo # Hochzeitsplaner Windows > "HochzeitsplanerWindows\\README.txt"
echo. >> "HochzeitsplanerWindows\\README.txt"
echo Doppelklick auf Hochzeitsplaner.exe zum Starten >> "HochzeitsplanerWindows\\README.txt"
echo Anmeldung: admin / hochzeit2025 >> "HochzeitsplanerWindows\\README.txt"

echo.
echo ✅ FERTIG!
echo 📁 Windows .exe: HochzeitsplanerWindows\\Hochzeitsplaner.exe
echo.
pause
'''
    
    with open('BUILD_WINDOWS.bat', 'w', encoding='utf-8') as f:
        f.write(batch_content)
    
    print("✅ Windows Batch-Datei erstellt")

def build_with_wine():
    """Versucht Build mit Wine (Windows-Emulation)"""
    try:
        # Prüfe ob Wine installiert ist
        subprocess.check_call(['wine', '--version'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        print("🍷 Wine gefunden - versuche Windows-Build...")
        
        # Installiere Python in Wine
        print("📦 Installiere Python in Wine...")
        # Dies wäre ein komplexerer Prozess...
        
        return False  # Vorerst deaktiviert
    except:
        return False

def main():
    print_header()
    
    if not Path("app.py").exists():
        print("❌ app.py nicht gefunden!")
        return
    
    print("🔧 Erstelle Windows-kompatible Dateien...")
    
    create_windows_launcher()
    create_windows_spec()
    create_batch_file()
    
    print()
    print("✅ Windows Build-Dateien erstellt!")
    print()
    print("📋 **Für Windows .exe haben Sie folgende Optionen:**")
    print()
    print("1️⃣  **GitHub Actions (Empfohlen):**")
    print("   - Code zu GitHub pushen")
    print("   - Automatischer Windows-Build")
    print("   - Download aus Actions/Artifacts")
    print()
    print("2️⃣  **Windows-Computer:**")
    print("   - BUILD_WINDOWS.bat auf Windows ausführen")
    print("   - Oder: python cross_platform_build.py")
    print()
    print("3️⃣  **Cloud-Service:**")
    print("   - GitHub Codespaces")
    print("   - Repl.it Windows-Container")
    print()
    print("📁 Alle Dateien sind bereit für Windows-Build!")

if __name__ == '__main__':
    main()

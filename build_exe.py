#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Build Script für Hochzeitsplaner .exe
Erstellt eine ausführbare Datei mit allen Abhängigkeiten
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

def print_step(step, message):
    print(f"\n{'='*60}")
    print(f"SCHRITT {step}: {message}")
    print('='*60)

def install_pyinstaller():
    """Installiert PyInstaller falls nicht vorhanden"""
    try:
        import PyInstaller
        print("✅ PyInstaller bereits installiert")
        return True
    except ImportError:
        print("📦 Installiere PyInstaller...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
            print("✅ PyInstaller erfolgreich installiert")
            return True
        except subprocess.CalledProcessError as e:
            print(f"❌ Fehler beim Installieren von PyInstaller: {e}")
            return False

def create_launcher():
    """Erstellt ein Launcher-Script"""
    launcher_content = '''#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Hochzeitsplaner Launcher
Startet die Webanwendung automatisch und öffnet Browser
"""

import sys
import os
import webbrowser
import time
import threading
import socket
from pathlib import Path

# Stelle sicher, dass wir im richtigen Verzeichnis sind
if getattr(sys, 'frozen', False):
    # Wenn als .exe ausgeführt
    application_path = os.path.dirname(sys.executable)
else:
    # Wenn als Script ausgeführt
    application_path = os.path.dirname(os.path.abspath(__file__))

os.chdir(application_path)

def print_banner():
    print("🎉" + "="*60 + "🎉")
    print("           HOCHZEITSPLANER WEB-ANWENDUNG")
    print("                  Standalone Version")
    print("🎉" + "="*60 + "🎉")
    print()
    print("🚀 Starte Anwendung...")
    print("📱 Browser öffnet automatisch...")
    print("🛑 Zum Beenden: Strg+C oder Fenster schließen")
    print()

def find_available_port():
    """Findet einen verfügbaren Port"""
    ports_to_try = [8080, 8081, 8082, 5001, 5002, 3000, 3001]
    
    for port in ports_to_try:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('localhost', port))
                return port
        except OSError:
            continue
    
    return 8080  # Fallback

def open_browser_delayed(url, delay=3):
    """Öffnet Browser nach Verzögerung"""
    def open_browser():
        time.sleep(delay)
        try:
            webbrowser.open(url)
            print(f"🌐 Browser geöffnet: {url}")
        except Exception as e:
            print(f"⚠️  Browser konnte nicht automatisch geöffnet werden: {e}")
            print(f"    Bitte öffnen Sie manuell: {url}")
    
    thread = threading.Thread(target=open_browser)
    thread.daemon = True
    thread.start()

def main():
    print_banner()
    
    # Port finden
    port = find_available_port()
    url = f"http://localhost:{port}"
    
    # Browser-Thread starten
    open_browser_delayed(url)
    
    # Flask App importieren und starten
    try:
        # Umgebungsvariablen setzen
        os.environ['FLASK_ENV'] = 'production'
        os.environ['FLASK_PORT'] = str(port)
        
        # App importieren
        from app import app
        
        print(f"🌐 Server läuft auf: {url}")
        print("📝 Logs werden hier angezeigt...")
        print()
        
        # App starten
        app.run(
            host='0.0.0.0',
            port=port,
            debug=False,
            use_reloader=False,
            threaded=True
        )
        
    except KeyboardInterrupt:
        print("\\n🛑 Anwendung beendet durch Benutzer")
    except Exception as e:
        print(f"❌ Fehler beim Starten der Anwendung: {e}")
        print("\\n📋 Drücken Sie Enter zum Beenden...")
        input()
    
if __name__ == '__main__':
    main()
'''
    
    with open('launcher.py', 'w', encoding='utf-8') as f:
        f.write(launcher_content)
    
    print("✅ Launcher-Script erstellt")

def create_spec_file():
    """Erstellt PyInstaller .spec Datei"""
    spec_content = '''# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

# Alle Python-Dateien sammeln
python_files = [
    'launcher.py',
    'app.py',
    'datenmanager.py'
]

# Daten-Ordner und -Dateien
data_files = [
    ('data', 'data'),
    ('static', 'static'),
    ('templates', 'templates'),
    ('auth_config.json', '.'),
    ('requirements.txt', '.'),
]

# Versteckte Imports
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
    'six',
    'dateutil',
    'babel',
]

a = Analysis(
    python_files,
    pathex=[],
    binaries=[],
    datas=data_files,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
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
    version='version_info.txt'
)
'''
    
    with open('hochzeitsplaner.spec', 'w', encoding='utf-8') as f:
        f.write(spec_content)
    
    print("✅ PyInstaller .spec Datei erstellt")

def create_version_info():
    """Erstellt Version-Info für die .exe"""
    version_content = '''# UTF-8
#
VSVersionInfo(
  ffi=FixedFileInfo(
    filevers=(1, 0, 0, 0),
    prodvers=(1, 0, 0, 0),
    mask=0x3f,
    flags=0x0,
    OS=0x40004,
    fileType=0x1,
    subtype=0x0,
    date=(0, 0)
  ),
  kids=[
    StringFileInfo(
      [
      StringTable(
        u'040904B0',
        [StringStruct(u'CompanyName', u'Pascal\'s Hochzeitsplaner'),
         StringStruct(u'FileDescription', u'Hochzeitsplaner Web-Anwendung'),
         StringStruct(u'FileVersion', u'1.0.0.0'),
         StringStruct(u'InternalName', u'hochzeitsplaner'),
         StringStruct(u'LegalCopyright', u'© 2025 Pascal'),
         StringStruct(u'OriginalFilename', u'Hochzeitsplaner.exe'),
         StringStruct(u'ProductName', u'Hochzeitsplaner'),
         StringStruct(u'ProductVersion', u'1.0.0.0')])
      ]), 
    VarFileInfo([VarStruct(u'Translation', [1033, 1200])])
  ]
)
'''
    
    with open('version_info.txt', 'w', encoding='utf-8') as f:
        f.write(version_content)
    
    print("✅ Version-Info erstellt")

def build_exe():
    """Erstellt die .exe mit PyInstaller"""
    print("🔨 Starte PyInstaller Build...")
    
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--clean",
        "hochzeitsplaner.spec"
    ]
    
    try:
        subprocess.check_call(cmd)
        print("✅ Build erfolgreich!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Build-Fehler: {e}")
        return False

def create_github_workflow():
    """Erstellt GitHub Actions Workflow für Windows .exe Build"""
    workflow_dir = Path(".github/workflows")
    workflow_dir.mkdir(parents=True, exist_ok=True)
    
    workflow_content = '''name: Build Windows .exe

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  build:
    runs-on: windows-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt
        pip install pyinstaller
    
    - name: Build .exe
      run: |
        python build_exe.py
    
    - name: Upload .exe artifact
      uses: actions/upload-artifact@v4
      with:
        name: Hochzeitsplaner-Windows
        path: Distribution/
        retention-days: 30
    
    - name: Create Release (if tag)
      if: startsWith(github.ref, 'refs/tags/')
      uses: softprops/action-gh-release@v1
      with:
        files: Distribution/Hochzeitsplaner.exe
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
'''
    
    with open(workflow_dir / "build-exe.yml", 'w', encoding='utf-8') as f:
        f.write(workflow_content)
    
    print("✅ GitHub Actions Workflow erstellt (.github/workflows/build-exe.yml)")
    print("   Push zu GitHub und der Build läuft automatisch auf Windows!")

def create_distribution():
    """Erstellt Distribution-Ordner"""
    dist_dir = Path("Distribution")
    if dist_dir.exists():
        shutil.rmtree(dist_dir)
    
    dist_dir.mkdir()
    
    # Binary kopieren (Windows .exe oder macOS Binary)
    if sys.platform == 'win32':
        binary_source = Path("dist/Hochzeitsplaner.exe")
        binary_dest = dist_dir / "Hochzeitsplaner.exe"
    else:
        binary_source = Path("dist/Hochzeitsplaner")
        binary_dest = dist_dir / "Hochzeitsplaner"
    
    if binary_source.exists():
        shutil.copy2(binary_source, binary_dest)
        if sys.platform == 'win32':
            print("✅ .exe in Distribution-Ordner kopiert")
        else:
            print("✅ macOS-Binary in Distribution-Ordner kopiert")
    else:
        print(f"❌ Binary nicht gefunden: {binary_source}")
        return False
    
    # README erstellen
    readme_content = '''# Hochzeitsplaner - Standalone Version

## 🚀 Start
'''
    
    if sys.platform == 'win32':
        readme_content += 'Doppelklick auf `Hochzeitsplaner.exe` zum Starten.'
    else:
        readme_content += '''Auf macOS: Doppelklick auf `Hochzeitsplaner` zum Starten.
Auf Windows: Übertragen Sie die .exe-Version von GitHub Actions.'''
    
    readme_content += '''

## 📱 Nutzung
- Die Anwendung startet automatisch einen lokalen Webserver
- Ihr Browser öffnet sich automatisch mit der Anwendung
- Falls nicht, öffnen Sie manuell: http://localhost:8080

## 🔐 Anmeldung
- Benutzername: admin
- Passwort: hochzeit2025
(Kann in auth_config.json geändert werden)

## 🛑 Beenden
- Strg+C im Konsolen-Fenster
- Oder einfach das Fenster schließen

## 📁 Daten
Alle Ihre Daten werden im selben Ordner wie die Binary gespeichert:
- `data/` - Alle Hochzeitsdaten
- `auth_config.json` - Anmelde-Einstellungen

## 🆘 Support
Bei Problemen prüfen Sie:
- Antivirus-Einstellungen
- Firewall-Einstellungen
- Port-Verfügbarkeit (8080-8082, 5001-5002)

Version: 1.0.0
Erstellt: 2025
'''
    
    with open(dist_dir / "README.txt", 'w', encoding='utf-8') as f:
        f.write(readme_content)
    
    print("✅ Distribution-Ordner erstellt")
    return True

def main():
    print("🎉 Hochzeitsplaner .exe Builder")
    print("="*40)
    
    # Prüfe Betriebssystem
    if sys.platform != 'win32':
        print("⚠️  HINWEIS: Sie sind auf macOS/Linux!")
        print("   PyInstaller erstellt nur für das aktuelle OS.")
        print("   Für Windows .exe benötigen Sie:")
        print("   1. Windows-Computer oder")
        print("   2. Windows-VM oder") 
        print("   3. GitHub Actions (siehe unten)")
        print()
        
        create_github_workflow()
        
        response = input("Möchten Sie trotzdem fortfahren? (erstellt macOS-Binary) [j/N]: ")
        if response.lower() not in ['j', 'ja', 'y', 'yes']:
            print("Build abgebrochen.")
            return
    
    # Überprüfungen
    if not Path("app.py").exists():
        print("❌ app.py nicht gefunden! Bitte im richtigen Verzeichnis ausführen.")
        return
    
    try:
        print_step(1, "PyInstaller installieren")
        if not install_pyinstaller():
            return
        
        print_step(2, "Launcher-Script erstellen")
        create_launcher()
        
        print_step(3, "Build-Konfiguration erstellen")
        create_spec_file()
        create_version_info()
        
        print_step(4, ".exe erstellen")
        if not build_exe():
            return
        
        print_step(5, "Distribution vorbereiten")
        if not create_distribution():
            return
        
        print("\n" + "🎉"*20)
        print("✅ BUILD ERFOLGREICH!")
        print("🎉"*20)
        print()
        if sys.platform == 'win32':
            print("📁 Ihre .exe finden Sie in: ./Distribution/Hochzeitsplaner.exe")
        else:
            print("📁 Ihr macOS-Binary finden Sie in: ./Distribution/Hochzeitsplaner")
            print("⚠️  Für Windows .exe nutzen Sie GitHub Actions (siehe workflow-Datei)")
        print("📋 Komplett mit README und allen Abhängigkeiten!")
        print()
        print("🚀 Zum Testen: Doppelklick auf die Datei")
        print()
        
    except Exception as e:
        print(f"\n❌ Unerwarteter Fehler: {e}")
        print("📝 Bitte prüfen Sie die Fehlermeldungen oben.")

if __name__ == '__main__':
    main()

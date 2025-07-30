#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GitHub Actions Troubleshooting Script
Analysiert und behebt häufige Build-Probleme
"""

import os
import sys
import json
from pathlib import Path

def check_requirements():
    """Prüft requirements.txt auf Probleme"""
    req_file = Path("requirements.txt")
    if not req_file.exists():
        print("❌ requirements.txt fehlt!")
        return False
    
    try:
        with open(req_file, 'r', encoding='utf-8') as f:
            requirements = f.read().strip()
        
        print("✅ requirements.txt gefunden:")
        print(requirements)
        
        # Prüfe auf problematische Pakete
        problematic = []
        lines = requirements.split('\n')
        for line in lines:
            line = line.strip()
            if line and not line.startswith('#'):
                if 'ttkbootstrap' in line:
                    problematic.append(f"  - {line} (GUI-Paket, nicht für Server nötig)")
                elif 'matplotlib' in line:
                    problematic.append(f"  - {line} (Große Abhängigkeiten)")
        
        if problematic:
            print("\n⚠️  Möglicherweise problematische Pakete:")
            for p in problematic:
                print(p)
        
        return True
    except Exception as e:
        print(f"❌ Fehler beim Lesen von requirements.txt: {e}")
        return False

def create_minimal_requirements():
    """Erstellt minimale requirements.txt für Web-App"""
    minimal_reqs = """Flask==3.0.0
Flask-CORS==4.0.0
pandas==2.1.4
openpyxl==3.1.2"""
    
    with open("requirements_minimal.txt", 'w', encoding='utf-8') as f:
        f.write(minimal_reqs)
    
    print("✅ requirements_minimal.txt erstellt")
    return True

def fix_build_script():
    """Behebt häufige Probleme im build_exe.py"""
    
    # Prüfe auf Windows-spezifische Probleme
    build_fixes = """
def main():
    print("🎉 Hochzeitsplaner .exe Builder")
    print("="*40)
    
    # WICHTIG: Für GitHub Actions Windows Build
    if sys.platform == 'win32':
        print("✅ Windows Build-Umgebung erkannt")
    else:
        print("⚠️  Nicht-Windows Umgebung - erstelle GitHub Actions Workflow")
        create_github_workflow()
        print("Build wird übersprungen - nur für Windows-Umgebung")
        return
    
    # Rest des Build-Prozesses...
    """
    
    print("💡 Build-Script Verbesserungen identifiziert")
    return True

def check_file_paths():
    """Prüft auf fehlende Dateien"""
    required_files = [
        "app.py",
        "datenmanager.py", 
        "requirements.txt",
        "data/",
        "static/",
        "templates/"
    ]
    
    missing = []
    for file_path in required_files:
        path = Path(file_path)
        if not path.exists():
            missing.append(file_path)
    
    if missing:
        print("❌ Fehlende Dateien/Ordner:")
        for m in missing:
            print(f"  - {m}")
        return False
    else:
        print("✅ Alle erforderlichen Dateien vorhanden")
        return True

def create_fixed_workflow():
    """Erstellt verbesserten GitHub Actions Workflow"""
    
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
    timeout-minutes: 30
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Upgrade pip
      run: |
        python -m pip install --upgrade pip
    
    - name: Install minimal dependencies
      run: |
        echo "Installing minimal dependencies..."
        pip install Flask==3.0.0
        pip install Flask-CORS==4.0.0
        pip install pandas==2.1.4
        pip install openpyxl==3.1.2
        pip install pyinstaller
    
    - name: Verify installation
      run: |
        python -c "import flask; print('Flask OK')"
        python -c "import pandas; print('Pandas OK')"
        python -c "import PyInstaller; print('PyInstaller OK')"
    
    - name: Create launcher
      run: |
        python -c "
from pathlib import Path
launcher_content = '''#!/usr/bin/env python3
import sys, os, webbrowser, time, threading, socket
if getattr(sys, 'frozen', False):
    os.chdir(os.path.dirname(sys.executable))
def find_port():
    for port in [8080, 8081, 8082]:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('localhost', port))
                return port
        except OSError:
            continue
    return 8080
def main():
    print('🎉 Hochzeitsplaner wird gestartet...')
    port = find_port()
    threading.Thread(target=lambda: (time.sleep(3), webbrowser.open(f'http://localhost:{port}')), daemon=True).start()
    try:
        from app import app
        app.run(host='0.0.0.0', port=port, debug=False, use_reloader=False)
    except Exception as e:
        print(f'Fehler: {e}')
        input('Enter zum Beenden...')
if __name__ == '__main__':
    main()
'''
with open('launcher.py', 'w', encoding='utf-8') as f:
    f.write(launcher_content)
print('Launcher erstellt')
        "
    
    - name: Build exe with PyInstaller
      run: |
        pyinstaller --onefile --name Hochzeitsplaner --add-data "data;data" --add-data "static;static" --add-data "templates;templates" --add-data "auth_config.json;." --hidden-import flask --hidden-import flask_cors --hidden-import pandas --hidden-import openpyxl launcher.py
    
    - name: Prepare distribution
      run: |
        mkdir Distribution
        copy "dist\\Hochzeitsplaner.exe" "Distribution\\"
        echo "# Hochzeitsplaner Windows" > "Distribution\\README.txt"
        echo "" >> "Distribution\\README.txt"
        echo "Doppelklick auf Hochzeitsplaner.exe zum Starten" >> "Distribution\\README.txt"
        echo "Login: admin / hochzeit2025" >> "Distribution\\README.txt"
    
    - name: Upload exe artifact
      uses: actions/upload-artifact@v4
      with:
        name: Hochzeitsplaner-Windows
        path: Distribution/
        retention-days: 30
'''
    
    workflow_dir = Path(".github/workflows")
    workflow_dir.mkdir(parents=True, exist_ok=True)
    
    with open(workflow_dir / "build-exe-fixed.yml", 'w', encoding='utf-8') as f:
        f.write(workflow_content)
    
    print("✅ Verbesserter Workflow erstellt: .github/workflows/build-exe-fixed.yml")

def main():
    print("🔧 GitHub Actions Build Troubleshooting")
    print("="*50)
    
    print("\n1️⃣  Prüfe requirements.txt...")
    check_requirements()
    
    print("\n2️⃣  Prüfe Dateien...")
    check_file_paths()
    
    print("\n3️⃣  Erstelle minimale requirements...")
    create_minimal_requirements()
    
    print("\n4️⃣  Erstelle verbesserten Workflow...")
    create_fixed_workflow()
    
    print("\n" + "="*50)
    print("🎯 LÖSUNGSVORSCHLÄGE:")
    print("="*50)
    
    print("\n💡 OPTION 1 - Schnelle Reparatur:")
    print("1. Committen Sie die neuen Dateien:")
    print("   git add .")
    print("   git commit -m 'Fix Windows build'")
    print("   git push")
    print("\n2. Der neue Workflow 'build-exe-fixed.yml' sollte funktionieren")
    
    print("\n💡 OPTION 2 - Manuelle Korrektur:")
    print("1. Ersetzen Sie requirements.txt mit requirements_minimal.txt")
    print("2. Vereinfachen Sie den Build-Prozess")
    print("3. Testen Sie lokal zuerst")
    
    print("\n📋 HÄUFIGE PROBLEME:")
    print("- ttkbootstrap: GUI-Paket, nicht für Server nötig")
    print("- Pillow: Manchmal Probleme auf Windows")
    print("- Komplexe Dependencies: Können Build verlangsamen")
    
    print("\n🚀 NÄCHSTE SCHRITTE:")
    print("1. Führen Sie 'git add . && git commit -m \"Fix build\" && git push' aus")
    print("2. Prüfen Sie GitHub Actions auf neuen Build")
    print("3. Der 'build-exe-fixed.yml' Workflow sollte stabiler sein")

if __name__ == '__main__':
    main()

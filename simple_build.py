#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Vereinfachter .exe Builder für Windows
Keine Abhängigkeiten - funktioniert out of the box
"""

import sys
import os
import subprocess
import shutil
from pathlib import Path

def print_header():
    print("🎉" + "="*50 + "🎉")
    print("      HOCHZEITSPLANER - SIMPLE EXE BUILDER")
    print("🎉" + "="*50 + "🎉")
    print()

def install_requirements():
    """Installiert PyInstaller"""
    print("📦 Installiere PyInstaller...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"], 
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except:
        return False

def create_simple_launcher():
    """Erstellt vereinfachten Launcher"""
    content = '''#!/usr/bin/env python3
import os
import sys
import webbrowser
import time
import threading

# Ins richtige Verzeichnis wechseln
if getattr(sys, 'frozen', False):
    os.chdir(os.path.dirname(sys.executable))
else:
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

def open_browser():
    time.sleep(3)
    try:
        webbrowser.open('http://localhost:8080')
    except:
        pass

# Browser-Thread starten
threading.Thread(target=open_browser, daemon=True).start()

# App importieren und starten
print("🎉 Hochzeitsplaner startet...")
print("🌐 Browser öffnet automatisch...")
print("🛑 Zum Beenden: Strg+C")
print()

try:
    from app import app
    app.run(host='0.0.0.0', port=8080, debug=False, use_reloader=False)
except KeyboardInterrupt:
    print("\\n🛑 Beendet")
except Exception as e:
    print(f"❌ Fehler: {e}")
    input("Enter zum Beenden...")
'''
    
    with open('simple_launcher.py', 'w', encoding='utf-8') as f:
        f.write(content)

def build_simple():
    """Erstellt .exe mit einfachen Parametern"""
    print("🔨 Erstelle .exe...")
    
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--name=Hochzeitsplaner",
        "--add-data=data;data",
        "--add-data=static;static", 
        "--add-data=templates;templates",
        "--add-data=auth_config.json;.",
        "--hidden-import=flask",
        "--hidden-import=flask_cors",
        "--hidden-import=pandas",
        "--hidden-import=openpyxl",
        "simple_launcher.py"
    ]
    
    try:
        subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except:
        return False

def create_simple_distribution():
    """Erstellt einfache Distribution"""
    dist_dir = Path("HochzeitsplanerApp")
    if dist_dir.exists():
        shutil.rmtree(dist_dir)
    dist_dir.mkdir()
    
    # .exe kopieren
    exe_path = Path("dist/Hochzeitsplaner.exe")
    if exe_path.exists():
        shutil.copy2(exe_path, dist_dir / "Hochzeitsplaner.exe")
        
        # Start-Anleitung erstellen
        readme = '''HOCHZEITSPLANER - ANLEITUNG

1. STARTEN:
   Doppelklick auf "Hochzeitsplaner.exe"

2. ANMELDEN:
   Benutzername: admin
   Passwort: hochzeit2025

3. BEENDEN:
   Strg+C oder Fenster schließen

4. DATEN:
   Werden automatisch gespeichert

Bei Problemen: Antivirus-Software prüfen
'''
        with open(dist_dir / "ANLEITUNG.txt", 'w', encoding='utf-8') as f:
            f.write(readme)
        
        return True
    return False

def main():
    print_header()
    
    if not Path("app.py").exists():
        print("❌ app.py nicht gefunden!")
        input("Enter zum Beenden...")
        return
    
    print("1️⃣  Installiere PyInstaller...")
    if not install_requirements():
        print("❌ Installation fehlgeschlagen!")
        input("Enter zum Beenden...")
        return
    
    print("2️⃣  Erstelle Launcher...")
    create_simple_launcher()
    
    print("3️⃣  Baue .exe...")
    if not build_simple():
        print("❌ Build fehlgeschlagen!")
        input("Enter zum Beenden...")
        return
    
    print("4️⃣  Erstelle Paket...")
    if not create_simple_distribution():
        print("❌ Paket-Erstellung fehlgeschlagen!")
        input("Enter zum Beenden...")
        return
    
    print()
    print("🎉" * 20)
    print("✅ FERTIG!")
    print("🎉" * 20)
    print()
    print("📁 Ordner: HochzeitsplanerApp")
    print("🚀 Datei: Hochzeitsplaner.exe")
    print()
    input("Enter zum Beenden...")

if __name__ == '__main__':
    main()

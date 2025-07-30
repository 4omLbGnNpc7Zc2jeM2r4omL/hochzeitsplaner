#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Hochzeitsplaner Web-Anwendung Starter
Automatisches Setup und Start der Webanwendung
"""

import sys
import os
import subprocess
import webbrowser
import time
from pathlib import Path

def print_banner():
    print("🎉" + "="*60 + "🎉")
    print("           HOCHZEITSPLANER WEB-ANWENDUNG")
    print("                  Version 2.0.0")
    print("🎉" + "="*60 + "🎉")
    print()

def check_python():
    """Prüft Python-Version"""
    if sys.version_info < (3, 8):
        print("❌ Python 3.8 oder höher erforderlich!")
        print(f"   Aktuelle Version: {sys.version}")
        return False
    
    print(f"✅ Python {sys.version.split()[0]} gefunden")
    return True

def check_port(port):
    """Prüft ob Port verfügbar ist"""
    import socket
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('localhost', port))
            return True
    except OSError:
        return False

def find_available_port():
    """Findet einen verfügbaren Port"""
    ports_to_try = [8080, 8081, 8082, 5001, 5002, 3000, 3001]
    
    for port in ports_to_try:
        if check_port(port):
            return port
    
    # Fallback: Zufälliger Port
    import socket
    with socket.socket() as s:
        s.bind(('', 0))
        return s.getsockname()[1]

def install_requirements():
    """Installiert die erforderlichen Pakete"""
    requirements_file = Path(__file__).parent / "requirements.txt"
    
    if not requirements_file.exists():
        print("❌ requirements.txt nicht gefunden!")
        return False
    
    print("📦 Installiere Abhängigkeiten...")
    
    try:
        subprocess.run([
            sys.executable, "-m", "pip", "install", "-r", str(requirements_file)
        ], check=True, capture_output=True, text=True)
        print("✅ Abhängigkeiten erfolgreich installiert")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Fehler bei der Installation: {e}")
        print(f"   Ausgabe: {e.stderr}")
        return False

def check_data_directory():
    """Erstellt Datenverzeichnis falls nicht vorhanden"""
    data_dir = Path(__file__).parent / "data"
    
    if not data_dir.exists():
        data_dir.mkdir(exist_ok=True)
        print("📁 Datenverzeichnis erstellt")
    else:
        print("✅ Datenverzeichnis vorhanden")
    
    return True

def start_web_app():
    """Startet die Web-Anwendung"""
    app_file = Path(__file__).parent / "app.py"
    
    if not app_file.exists():
        print("❌ app.py nicht gefunden!")
        return False
    
    # Verfügbaren Port finden
    port = find_available_port()
    url = f"http://localhost:{port}"
    
    print("🚀 Starte Web-Anwendung...")
    print(f"   URL: {url}")
    print("   Zum Beenden: Strg+C")
    print()
    
    # App-Datei für den gewählten Port anpassen
    with open(app_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Port in der App-Datei aktualisieren
    content = content.replace('port=8080', f'port={port}')
    content = content.replace('localhost:8080', f'localhost:{port}')
    
    with open(app_file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    # Browser öffnen nach kurzer Verzögerung
    def open_browser():
        time.sleep(2)
        try:
            webbrowser.open(url)
        except:
            pass
    
    import threading
    browser_thread = threading.Thread(target=open_browser)
    browser_thread.daemon = True
    browser_thread.start()
    
    try:
        # Flask App starten
        subprocess.run([sys.executable, str(app_file)], check=True)
    except KeyboardInterrupt:
        print("\n👋 Anwendung beendet")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Fehler beim Starten: {e}")
        return False

def main():
    """Hauptfunktion"""
    print_banner()
    
    # Checks
    if not check_python():
        sys.exit(1)
    
    if not install_requirements():
        print("\n❌ Setup fehlgeschlagen!")
        input("Drücke Enter zum Beenden...")
        sys.exit(1)
    
    if not check_data_directory():
        sys.exit(1)
    
    print("\n✅ Setup abgeschlossen!")
    print("🌐 Öffne Web-Anwendung...")
    print()
    
    # Web-App starten
    if not start_web_app():
        print("\n❌ Start fehlgeschlagen!")
        input("Drücke Enter zum Beenden...")
        sys.exit(1)

if __name__ == "__main__":
    main()

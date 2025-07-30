#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Hochzeitsplaner Working Launcher
SSL-fähig mit GUI-Konfiguration
"""

import sys
import os
import webbrowser
import time
import threading
import socket
import json
from pathlib import Path
import shutil

# Stelle sicher, dass wir im richtigen Verzeichnis sind
if getattr(sys, 'frozen', False):
    # Wenn als .exe ausgeführt
    application_path = os.path.dirname(sys.executable)
else:
    # Wenn als Script ausgeführt
    application_path = os.path.dirname(os.path.abspath(__file__))

os.chdir(application_path)

class SimpleConfig:
    """Einfache Konfigurationsverwaltung ohne GUI-Dependencies"""
    
    def __init__(self):
        self.config_file = Path("hochzeitsplaner_config.json")
        self.default_config = {
            "data_directory": str(Path(application_path) / "data"),
            "ssl_enabled": False,
            "host": "127.0.0.1",
            "port": 8080,
            "auto_open_browser": True,
            "domain": "pascalundkäthe-heiraten.de"
        }
        self.config = self.load_config()
    
    def load_config(self):
        """Lädt Konfiguration aus Datei"""
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                # Merge mit default config
                merged = self.default_config.copy()
                merged.update(config)
                return merged
            except Exception as e:
                print(f"⚠️  Fehler beim Laden der Konfiguration: {e}")
        
        return self.default_config.copy()
    
    def save_config(self):
        """Speichert Konfiguration"""
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"❌ Fehler beim Speichern: {e}")
            return False
    
    def setup_data_directory(self):
        """Richtet Datenverzeichnis ein"""
        data_path = Path(self.config["data_directory"])
        
        # Bei erstem Start nach Datenverzeichnis fragen
        if not self.config_file.exists():
            print("\n🔧 ERSTER START - KONFIGURATION")
            print("="*50)
            
            # Einfache Konsolen-Eingabe ohne GUI
            use_custom = input("Möchten Sie ein benutzerdefiniertes Datenverzeichnis verwenden? [j/N]: ").lower()
            
            if use_custom in ['j', 'ja', 'y', 'yes']:
                while True:
                    custom_path = input("Bitte geben Sie den vollständigen Pfad ein: ").strip()
                    if custom_path:
                        custom_path = Path(custom_path)
                        try:
                            custom_path.mkdir(parents=True, exist_ok=True)
                            if custom_path.exists() and custom_path.is_dir():
                                data_path = custom_path
                                self.config["data_directory"] = str(data_path)
                                print(f"✅ Datenverzeichnis gesetzt: {data_path}")
                                break
                            else:
                                print("❌ Verzeichnis konnte nicht erstellt werden.")
                        except Exception as e:
                            print(f"❌ Fehler: {e}")
                    
                    print("Verwende Standard-Verzeichnis...")
                    break
            
            # Konfiguration speichern
            self.save_config()
        
        # Erstelle Verzeichnis falls nicht vorhanden
        data_path.mkdir(parents=True, exist_ok=True)
        
        # Kopiere Standard-Daten falls Verzeichnis leer ist
        default_data_path = Path(application_path) / "data"
        if default_data_path.exists() and not any(data_path.iterdir()):
            try:
                for item in default_data_path.iterdir():
                    if item.is_file():
                        shutil.copy2(item, data_path / item.name)
                    elif item.is_dir():
                        shutil.copytree(item, data_path / item.name, dirs_exist_ok=True)
                print(f"✅ Standard-Daten nach {data_path} kopiert")
            except Exception as e:
                print(f"⚠️  Fehler beim Kopieren der Standard-Daten: {e}")
        
        return data_path

def print_banner():
    """Zeigt Banner"""
    print("🎉" + "="*60 + "🎉")
    print("           HOCHZEITSPLANER WEB-ANWENDUNG")
    print("                SSL-Version 2.0.0")
    print("🎉" + "="*60 + "🎉")
    print()

def find_available_port(start_port=8080):
    """Findet einen verfügbaren Port"""
    ports_to_try = [start_port, 8081, 8082, 5001, 5002, 3000, 3001]
    
    for port in ports_to_try:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('localhost', port))
                return port
        except OSError:
            continue
    
    return start_port

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
    
    # Konfiguration laden
    config_manager = SimpleConfig()
    config = config_manager.config
    
    # Datenverzeichnis einrichten
    print("📁 Richte Datenverzeichnis ein...")
    data_path = config_manager.setup_data_directory()
    
    # Umgebung vorbereiten
    os.environ['DATA_PATH'] = str(data_path)
    os.environ['FLASK_ENV'] = 'production'
    
    # Port finden
    port = find_available_port(config.get('port', 8080))
    if port != config.get('port', 8080):
        print(f"⚠️  Port {config['port']} belegt, verwende Port {port}")
    
    # URL bestimmen
    host = config.get('host', '127.0.0.1')
    protocol = "https" if config.get('ssl_enabled', False) else "http"
    url = f"{protocol}://{host}:{port}"
    
    print(f"🚀 Starte Server...")
    print(f"📂 Datenverzeichnis: {data_path}")
    print(f"🌐 Server-URL: {url}")
    
    if config.get('ssl_enabled', False):
        print("🔒 SSL aktiviert (experimentell)")
    
    # Browser-Thread starten
    if config.get('auto_open_browser', True):
        open_browser_delayed(url)
    
    # Flask App importieren und starten
    try:
        # App importieren
        from app import app
        
        print("📝 Logs werden hier angezeigt...")
        print("🛑 Zum Beenden: Strg+C oder Fenster schließen")
        print()
        
        # App starten (vorerst ohne SSL bis Zertifikat verfügbar)
        app.run(
            host=host,
            port=port,
            debug=False,
            use_reloader=False,
            threaded=True
            # ssl_context='adhoc'  # Aktivieren wenn SSL gewünscht
        )
        
    except KeyboardInterrupt:
        print("\n🛑 Anwendung beendet durch Benutzer")
    except Exception as e:
        print(f"❌ Fehler beim Starten der Anwendung: {e}")
        print("\n📋 Drücken Sie Enter zum Beenden...")
        input()

if __name__ == '__main__':
    main()

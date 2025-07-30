#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Lokaler HTTP-Launcher für Hochzeitsplaner
Nur HTTP - Schnell, sicher und ohne SSL-Probleme im lokalen Netzwerk
"""
import json
import os
import sys
import socket
import webbrowser
import threading
import time
from pathlib import Path

class LocalConfig:
    """Einfache lokale Konfigurationsverwaltung"""
    
    def __init__(self):
        self.config_file = "launcher_config.json"
        self.config = self.load_config()
        
    def load_config(self):
        """Lädt Konfiguration"""
        default_config = {
            "data_directory": "",
            "port": 8080,               # HTTP Port
            "host": "0.0.0.0",
            "ssl_enabled": False,       # SSL komplett deaktiviert
            "auto_open_browser": True,
            "first_run": True
        }
        
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    for key, value in default_config.items():
                        if key not in config:
                            config[key] = value
                    return config
            except Exception:
                pass
        
        return default_config
    
    def save_config(self):
        """Speichert Konfiguration"""
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=2, ensure_ascii=False)
        except Exception:
            pass

    def setup_data_directory(self):
        """Richtet Datenverzeichnis ein"""
        if getattr(sys, 'frozen', False):
            application_path = os.path.dirname(sys.executable)
        else:
            application_path = os.path.dirname(os.path.abspath(__file__))
        
        if self.config.get('first_run', True) or not self.config.get('data_directory'):
            print("🏠 ERSTKONFIGURATION - Datenverzeichnis festlegen")
            print("="*60)
            print("Der Hochzeitsplaner benötigt ein Verzeichnis für Ihre Daten.")
            print()
            
            while True:
                data_input = input("📁 Pfad zum Datenverzeichnis (oder Enter für Standard): ").strip()
                
                if not data_input:
                    data_path = Path(application_path) / "data"
                    print(f"✅ Verwende Standard-Verzeichnis: {data_path}")
                    break
                else:
                    data_path = Path(data_input)
                    try:
                        data_path = data_path.expanduser().resolve()
                        data_path.mkdir(parents=True, exist_ok=True)
                        print(f"✅ Datenverzeichnis eingerichtet: {data_path}")
                        break
                    except Exception as e:
                        print(f"❌ Ungültiger Pfad: {e}")
                        print("Bitte versuchen Sie es erneut.\n")
            
            self.config['data_directory'] = str(data_path)
            self.config['first_run'] = False
            self.save_config()
        else:
            data_path = Path(self.config['data_directory'])
        
        data_path.mkdir(parents=True, exist_ok=True)
        return data_path

def get_local_ip():
    """Ermittelt die lokale IP-Adresse"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception:
        return "192.168.178.96"

def find_available_port(start_port=8080):
    """Findet einen verfügbaren Port"""
    ports_to_try = [8080, 8081, 8082, 5000, 5001, 3000, 3001, 9000]
    
    for port in ports_to_try:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('localhost', port))
                return port
        except OSError:
            continue
    
    return 8080  # Fallback

def open_browser_delayed(url, delay=3):
    """Öffnet Browser nach kurzer Verzögerung"""
    def open_browser():
        time.sleep(delay)
        try:
            webbrowser.open(url)
            print(f"🌐 Browser geöffnet: {url}")
        except Exception as e:
            print(f"⚠️  Browser konnte nicht geöffnet werden: {e}")
    
    thread = threading.Thread(target=open_browser)
    thread.daemon = True
    thread.start()

def print_banner():
    """Zeigt Banner"""
    print("🎉" + "="*60 + "🎉")
    print("           HOCHZEITSPLANER - LOKALER HTTP-MODUS")
    print("         🏠 Schnell & Sicher im lokalen Netzwerk")
    print("           ⚡ Keine SSL-Probleme oder Zertifikate")
    print("🎉" + "="*60 + "🎉")
    print()

def main():
    print_banner()
    
    # Konfiguration laden
    config_manager = LocalConfig()
    config = config_manager.config
    
    # Datenverzeichnis einrichten
    print("📁 Richte Datenverzeichnis ein...")
    data_path = config_manager.setup_data_directory()
    
    # Umgebung vorbereiten
    os.environ['DATA_PATH'] = str(data_path)
    os.environ['FLASK_ENV'] = 'production'
    
    # Port ermitteln
    preferred_port = config.get('port', 8080)
    
    # Prüfe ob bevorzugter Port verfügbar ist
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('localhost', preferred_port))
        port = preferred_port
        print(f"✅ Port {port} ist verfügbar")
    except OSError:
        port = find_available_port(preferred_port)
        print(f"⚠️  Port {preferred_port} belegt, verwende Port {port}")
    
    # Server-Details
    host = config.get('host', '0.0.0.0')
    local_ip = get_local_ip()
    url = f"http://localhost:{port}"
    
    print(f"\n🚀 Starte HTTP-Server...")
    print(f"📂 Datenverzeichnis: {data_path}")
    print(f"🖥️  Server läuft auf: {local_ip}:{port}")
    print()
    
    print("📍 ZUGRIFF-URLS:")
    print(f"   🏠 Lokal: http://localhost:{port}")
    print(f"   📱 Netzwerk: http://{local_ip}:{port}")
    print(f"   🌐 Domain (falls konfiguriert): http://hochzeitsplaner.de:{port}")
    print()
    
    print("✅ VORTEILE HTTP-MODUS:")
    print("   • Keine SSL-Zertifikat-Probleme")
    print("   • Schnellere Verbindung im lokalen Netzwerk")
    print("   • Einfache Konfiguration")
    print("   • Weniger Speicherverbrauch")
    print()
    
    print("💡 FÜR EXTERNEN ZUGRIFF:")
    print("   → Verwenden Sie smart_launcher_dual.py für Fritz!Box-Setup")
    print("   → Oder working_launcher_ssl.py für reinen HTTPS-Modus")
    print()
    
    # Browser öffnen
    if config.get('auto_open_browser', True):
        open_browser_delayed(url)
    
    # Flask App starten
    try:
        from app import app
        
        print("📝 Logs werden hier angezeigt...")
        print("🛑 Zum Beenden: Strg+C oder Fenster schließen")
        print("="*60)
        print()
        
        # HTTP-Server starten (OHNE SSL)
        app.run(
            host=host,
            port=port,
            debug=False,
            use_reloader=False,
            threaded=True
            # Kein ssl_context = HTTP-Modus
        )
        
    except KeyboardInterrupt:
        print("\n🛑 Anwendung beendet durch Benutzer")
    except Exception as e:
        print(f"❌ Fehler beim Starten der Anwendung: {e}")
        print("🔧 Mögliche Lösungen:")
        print("   • Prüfen Sie ob der Port verfügbar ist")
        print("   • Starten Sie die Anwendung neu")
        print("   • Prüfen Sie die app.py Datei")
        print("\n📋 Drücken Sie Enter zum Beenden...")
        input()

if __name__ == '__main__':
    main()

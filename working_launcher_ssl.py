#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SSL-Launcher für Hochzeitsplaner Web-Anwendung
Mit echten SSL-Zertifikaten von Ionos
Dual-Domain Support: hochzeitsplaner.de (lokal) + pascalundkäthe-heiraten.de (Internet)
"""
import json
import os
import sys
import socket
import subprocess
import webbrowser
import threading
import time
import shutil
from pathlib import Path

class SimpleConfig:
    """Einfache Konfigurationsverwaltung"""
    
    def __init__(self):
        self.config_file = "launcher_config.json"
        self.config = self.load_config()
        
    def load_config(self):
        """Lädt Konfiguration aus JSON-Datei"""
        default_config = {
            "data_directory": "",
            "port": 8080,
            "host": "0.0.0.0",  # Erlaube Zugriff von allen Netzwerk-Interfaces
            "ssl_enabled": True,  # SSL standardmäßig aktiviert
            "auto_open_browser": True,
            "first_run": True
        }
        
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    # Merge mit Default-Werten
                    for key, value in default_config.items():
                        if key not in config:
                            config[key] = value
                    return config
            except Exception as e:
                print(f"⚠️  Fehler beim Laden der Konfiguration: {e}")
        
        return default_config
    
    def save_config(self):
        """Speichert Konfiguration in JSON-Datei"""
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"⚠️  Fehler beim Speichern der Konfiguration: {e}")
    
    def setup_data_directory(self):
        """Richtet Datenverzeichnis ein"""
        # Aktueller Pfad - korrekte Erkennung für PyInstaller auf Windows
        if getattr(sys, 'frozen', False):
            # Wenn als .exe ausgeführt (PyInstaller)
            application_path = os.path.dirname(sys.executable)
        else:
            # Normal als Python-Script
            application_path = os.path.dirname(os.path.abspath(__file__))
        
        # Bei ersten Start: Datenverzeichnis konfigurieren
        if self.config.get('first_run', True) or not self.config.get('data_directory'):
            print("🏠 ERSTKONFIGURATION - Datenverzeichnis festlegen")
            print("="*60)
            print("Der Hochzeitsplaner benötigt ein Verzeichnis für Ihre Daten.")
            print("Empfehlung: Wählen Sie einen Ordner in Ihren Dokumenten.")
            print()
            
            while True:
                data_input = input("📁 Pfad zum Datenverzeichnis (oder Enter für Standard): ").strip()
                
                if not data_input:
                    # Standard: data-Verzeichnis neben der Anwendung
                    data_path = Path(application_path) / "data"
                    print(f"✅ Verwende Standard-Verzeichnis: {data_path}")
                    break
                else:
                    data_path = Path(data_input)
                    
                    # Prüfe ob Pfad gültig ist
                    try:
                        data_path = data_path.expanduser().resolve()
                        
                        # Prüfe ob Verzeichnis erstellt werden kann
                        data_path.mkdir(parents=True, exist_ok=True)
                        
                        print(f"✅ Datenverzeichnis eingerichtet: {data_path}")
                        break
                    except Exception as e:
                        print(f"❌ Ungültiger Pfad: {e}")
                        print("Bitte versuchen Sie es erneut.\n")
            
            # Konfiguration aktualisieren
            self.config['data_directory'] = str(data_path)
            self.config['first_run'] = False
            
            # Konfiguration speichern
            self.save_config()
        else:
            # Gespeichertes Verzeichnis verwenden
            data_path = Path(self.config['data_directory'])
        
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

def check_ssl_certificates():
    """Prüft SSL-Zertifikate und gibt Status zurück"""
    # Bestimme Verzeichnis korrekt für PyInstaller und normale Ausführung
    if getattr(sys, 'frozen', False):
        # Wenn als .exe ausgeführt (PyInstaller)
        script_dir = os.path.dirname(sys.executable)
    else:
        # Normal als Python-Script
        script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # SSL-Dateipfade - os.path.join funktioniert auf allen Plattformen
    ssl_cert_path = os.path.join(script_dir, 'ssl_certificate.crt')
    ssl_key_path = os.path.join(script_dir, 'ssl_private_key.key')
    
    cert_exists = os.path.exists(ssl_cert_path)
    key_exists = os.path.exists(ssl_key_path)
    
    if cert_exists and key_exists:
        print("🔒 SSL-Zertifikat und Privatschlüssel gefunden")
        print(f"   Zertifikat: {ssl_cert_path}")
        print(f"   Schlüssel: {ssl_key_path}")
        return True, ssl_cert_path, ssl_key_path
    else:
        print("⚠️  SSL-Zertifikatsdateien nicht vollständig vorhanden:")
        if not cert_exists:
            print(f"   ❌ Fehlend: {ssl_cert_path}")
        if not key_exists:
            print(f"   ❌ Fehlend: {ssl_key_path}")
        print("   👉 Stelle sicher, dass beide Dateien im Programmverzeichnis sind")
        return False, None, None

def print_banner():
    """Zeigt Banner"""
    print("🎉" + "="*60 + "🎉")
    print("           HOCHZEITSPLANER WEB-ANWENDUNG")
    print("          SSL-Version mit Dual-Domain-Support")
    print("     🌐 Lokal: hochzeitsplaner.de")
    print("     🌍 Internet: pascalundkäthe-heiraten.de")
    print("🎉" + "="*60 + "🎉")
    print()

def find_available_port(start_port=8080):
    """Findet einen verfügbaren Port"""
    ports_to_try = [start_port, 8443, 8081, 8082, 5001, 5002, 3000, 3001]
    
    for port in ports_to_try:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('localhost', port))
                return port
        except OSError:
            continue
    
    return start_port

def get_local_ip():
    """Ermittelt die lokale IP-Adresse"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception:
        return "192.168.1.xxx"

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
    
    # SSL-Zertifikate prüfen
    print("\n🔒 Prüfe SSL-Zertifikate...")
    ssl_available, cert_path, key_path = check_ssl_certificates()
    
    # Umgebung vorbereiten
    os.environ['DATA_PATH'] = str(data_path)
    os.environ['FLASK_ENV'] = 'production'
    
    # Port finden
    if ssl_available:
        # Für HTTPS bevorzugt Port 8443 oder 8080
        preferred_port = 8443 if config.get('port', 8080) == 8080 else config.get('port', 8080)
    else:
        preferred_port = config.get('port', 8080)
    
    port = find_available_port(preferred_port)
    if port != preferred_port:
        print(f"⚠️  Port {preferred_port} belegt, verwende Port {port}")
    
    # Protocol und URL bestimmen
    host = config.get('host', '0.0.0.0')
    use_ssl = ssl_available and config.get('ssl_enabled', True)
    protocol = "https" if use_ssl else "http"
    url = f"{protocol}://localhost:{port}"  # Für Browser-Öffnung localhost verwenden
    
    # Lokale IP für Ausgabe
    local_ip = get_local_ip()
    
    print(f"\n🚀 Starte Server...")
    print(f"📂 Datenverzeichnis: {data_path}")
    print(f"🖥️  Server läuft auf allen Netzwerk-Interfaces")
    print()
    
    if use_ssl:
        print("🔒 SSL aktiviert - Sicherer HTTPS-Modus")
        print("📍 ZUGRIFF-URLS:")
        print(f"   🏠 Intern erreichbar: https://localhost:{port}")
        print(f"   🌐 Lokal im Netzwerk: https://hochzeitsplaner.de:{port}")
        print(f"   🌍 Internet-Domain: https://pascalundkäthe-heiraten.de:{port}")
        print(f"   📱 Direkte IP: https://{local_ip}:{port}")
    else:
        print("⚠️  HTTP-Modus (unverschlüsselt)")
        print("📍 ZUGRIFF-URLS:")
        print(f"   🏠 Intern erreichbar: http://localhost:{port}")
        print(f"   🌐 Lokal im Netzwerk: http://hochzeitsplaner.de:{port}")
        print(f"   🌍 Internet-Domain: http://pascalundkäthe-heiraten.de:{port}")
        print(f"   📱 Direkte IP: http://{local_ip}:{port}")
    
    print()
    print("💡 DOMAIN-KONFIGURATION:")
    print("   🏠 Für lokale Domain: python configure_network.py ausführen")
    print("   🌍 Für Internet-Domain: Router + DNS konfigurieren")
    
    # Browser-Thread starten
    if config.get('auto_open_browser', True):
        open_browser_delayed(url)
    
    # Flask App importieren und starten
    try:
        # App importieren
        from app import app
        
        print("\n📝 Logs werden hier angezeigt...")
        print("🛑 Zum Beenden: Strg+C oder Fenster schließen")
        print("="*60)
        print()
        
        # SSL-Context vorbereiten
        ssl_context = None
        if use_ssl and cert_path and key_path:
            ssl_context = (cert_path, key_path)
        
        # App starten
        app.run(
            host=host,
            port=port,
            debug=False,
            use_reloader=False,
            threaded=True,
            ssl_context=ssl_context
        )
        
    except KeyboardInterrupt:
        print("\n🛑 Anwendung beendet durch Benutzer")
    except Exception as e:
        print(f"❌ Fehler beim Starten der Anwendung: {e}")
        print("🔧 Mögliche Lösungen:")
        print("   • Prüfen Sie die SSL-Zertifikatsdateien")
        print("   • Versuchen Sie einen anderen Port")
        print("   • Deaktivieren Sie SSL in der Konfiguration")
        print("\n📋 Drücken Sie Enter zum Beenden...")
        input()

if __name__ == '__main__':
    main()

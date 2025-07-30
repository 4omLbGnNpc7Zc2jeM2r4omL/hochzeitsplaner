#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SAFE SSL-Launcher für Hochzeitsplaner - Bluescreen-Fix Version
Reduzierte Komplexität, keine kritischen Threading-Operationen
"""
import json
import os
import sys
import socket
import time
import platform
from pathlib import Path

class SafeConfig:
    """Sichere Konfigurationsverwaltung ohne Threading"""
    
    def __init__(self):
        self.config_file = "launcher_config.json"
        self.config = self.load_config()
        
    def load_config(self):
        """Lädt Konfiguration"""
        default_config = {
            "data_directory": "",
            "port": 8443,
            "host": "0.0.0.0",
            "ssl_enabled": True,
            "auto_open_browser": False,  # DEAKTIVIERT - Kann Bluescreens verursachen
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
        """Sichere Datenverzeichnis-Einrichtung"""
        if getattr(sys, 'frozen', False):
            application_path = os.path.dirname(sys.executable)
        else:
            application_path = os.path.dirname(os.path.abspath(__file__))
        
        # Einfache Verzeichnis-Einrichtung ohne User-Input
        data_path = Path(application_path) / "data"
        data_path.mkdir(parents=True, exist_ok=True)
        
        self.config['data_directory'] = str(data_path)
        self.config['first_run'] = False
        self.save_config()
        
        return data_path

def safe_check_ssl_certificates():
    """Sichere SSL-Zertifikat-Prüfung ohne Threading"""
    print("🔍 Prüfe SSL-Zertifikate...")
    
    search_dirs = []
    
    if getattr(sys, 'frozen', False):
        exe_dir = os.path.dirname(sys.executable)
        search_dirs.extend([
            exe_dir,
            os.path.join(exe_dir, '_internal'),
        ])
        if hasattr(sys, '_MEIPASS'):
            search_dirs.append(sys._MEIPASS)
    else:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        search_dirs.append(script_dir)
    
    search_dirs.append(os.getcwd())
    
    for search_dir in search_dirs:
        if not os.path.exists(search_dir):
            continue
            
        cert_path = os.path.join(search_dir, 'ssl_certificate.crt')
        key_path = os.path.join(search_dir, 'ssl_private_key.key')
        
        if os.path.exists(cert_path) and os.path.exists(key_path):
            print(f"✅ SSL-Zertifikate gefunden: {search_dir}")
            return True, cert_path, key_path
    
    print("⚠️  SSL-Zertifikate nicht gefunden")
    return False, None, None

def safe_get_local_ip():
    """Sichere IP-Ermittlung ohne Netzwerk-Threading"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(2)  # Timeout nach 2 Sekunden
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception:
        return "192.168.1.100"

def safe_check_port(port):
    """Sichere Port-Prüfung"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            s.bind(('localhost', port))
            return True
    except OSError:
        return False

def print_safe_banner():
    """Sicherer Banner"""
    print("🎉" + "="*50 + "🎉")
    print("     HOCHZEITSPLANER WEB-ANWENDUNG")
    print("     SAFE MODE - Bluescreen-Fix Version")
    print("🎉" + "="*50 + "🎉")
    print()

def safe_main():
    """Sichere Haupt-Funktion ohne kritische Threading-Operationen"""
    print_safe_banner()
    
    # Konfiguration
    config_manager = SafeConfig()
    config = config_manager.config
    
    # Datenverzeichnis
    print("📁 Richte Datenverzeichnis ein...")
    data_path = config_manager.setup_data_directory()
    
    # SSL-Zertifikate
    print("🔒 Prüfe SSL-Zertifikate...")
    ssl_available, cert_path, key_path = safe_check_ssl_certificates()
    
    # Umgebung
    os.environ['DATA_PATH'] = str(data_path)
    os.environ['FLASK_ENV'] = 'production'
    
    # Port
    port = 8443
    port_available = safe_check_port(port)
    
    if not port_available:
        print(f"⚠️  Port {port} belegt - Server startet trotzdem")
    
    # Netzwerk-Info
    local_ip = safe_get_local_ip()
    use_ssl = ssl_available and config.get('ssl_enabled', True)
    protocol = "https" if use_ssl else "http"
    
    print(f"\n🚀 Starte Server auf Port {port}...")
    print(f"📂 Datenverzeichnis: {data_path}")
    print()
    
    if use_ssl:
        print("🔒 SSL aktiviert")
        print("📍 URLs:")
        print(f"   🏠 Lokal: https://localhost:{port}")
        print(f"   📱 IP: https://{local_ip}:{port}")
        print(f"   🌐 Domain: https://xn--pascalundkthe-heiraten-94b.de:{port}")
    else:
        print("⚠️  HTTP-Modus (keine SSL-Zertifikate)")
        print("📍 URLs:")
        print(f"   🏠 Lokal: http://localhost:{port}")
        print(f"   📱 IP: http://{local_ip}:{port}")
    
    print()
    print("🌐 WICHTIG: Browser manuell öffnen!")
    print("🛑 Zum Beenden: Strg+C")
    print("="*50)
    print()
    
    # Flask App importieren und starten
    try:
        from app import app
        
        # SSL-Context
        ssl_context = None
        if use_ssl and cert_path and key_path:
            try:
                ssl_context = (cert_path, key_path)
            except Exception as e:
                print(f"⚠️  SSL-Context Fehler: {e}")
                ssl_context = None
                use_ssl = False
        
        # Server starten - OHNE Threading-Probleme
        app.run(
            host="0.0.0.0",
            port=port,
            debug=False,
            use_reloader=False,
            threaded=False,  # THREADING DEAKTIVIERT
            processes=1,     # SINGLE PROCESS
            ssl_context=ssl_context
        )
        
    except KeyboardInterrupt:
        print("\n🛑 Server beendet")
    except Exception as e:
        print(f"\n❌ Fehler: {e}")
        print("🔧 Versuchen Sie:")
        print("   • Als Administrator ausführen")
        print("   • Antivirus temporär deaktivieren")
        print("   • Port 8443 freigeben")
        input("\nEnter zum Beenden...")

if __name__ == '__main__':
    try:
        safe_main()
    except Exception as e:
        print(f"KRITISCHER FEHLER: {e}")
        print("Bitte Entwickler kontaktieren!")
        input("Enter zum Beenden...")

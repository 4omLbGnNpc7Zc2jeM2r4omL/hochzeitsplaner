#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Smart Dual-Mode Launcher für Hochzeitsplaner
HTTP für lokales Netzwerk + HTTPS für externen Zugriff via Fritz!Box
"""
import json
import os
import sys
import socket
import platform
import time
from pathlib import Path

class SmartConfig:
    """Intelligente Konfigurationsverwaltung"""
    
    def __init__(self):
        self.config_file = "launcher_config.json"
        self.config = self.load_config()
        
    def load_config(self):
        """Lädt Konfiguration"""
        default_config = {
            "data_directory": "",
            "http_port": 8080,      # HTTP für lokalen Zugriff
            "https_port": 8443,     # HTTPS für externen Zugriff
            "host": "0.0.0.0",
            "local_ssl_disabled": True,    # SSL im lokalen Netzwerk deaktiviert
            "external_ssl_enabled": True,  # SSL für externen Zugriff aktiviert
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

def check_ssl_certificates():
    """Prüft SSL-Zertifikate für externen Zugriff"""
    ssl_cert_path = None
    ssl_key_path = None
    
    search_dirs = []
    
    if getattr(sys, 'frozen', False):
        exe_dir = os.path.dirname(sys.executable)
        search_dirs.extend([exe_dir, os.path.join(exe_dir, '_internal')])
        if hasattr(sys, '_MEIPASS'):
            search_dirs.append(sys._MEIPASS)
    else:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        search_dirs.append(script_dir)
    
    search_dirs.append(os.getcwd())
    
    print("🔍 Prüfe SSL-Zertifikate für externen Zugriff...")
    
    for search_dir in search_dirs:
        if not os.path.exists(search_dir):
            continue
            
        cert_candidate = os.path.join(search_dir, 'ssl_certificate.crt')
        key_candidate = os.path.join(search_dir, 'ssl_private_key.key')
        
        if os.path.exists(cert_candidate) and os.path.exists(key_candidate):
            ssl_cert_path = cert_candidate
            ssl_key_path = key_candidate
            print(f"✅ SSL-Zertifikate gefunden in: {search_dir}")
            break
    
    if ssl_cert_path and ssl_key_path:
        return True, ssl_cert_path, ssl_key_path
    else:
        print("⚠️  SSL-Zertifikate nicht gefunden - nur HTTP-Modus verfügbar")
        return False, None, None

def setup_data_directory(config_manager):
    """Richtet Datenverzeichnis ein"""
    if getattr(sys, 'frozen', False):
        application_path = os.path.dirname(sys.executable)
    else:
        application_path = os.path.dirname(os.path.abspath(__file__))
    
    if config_manager.config.get('first_run', True) or not config_manager.config.get('data_directory'):
        print("🏠 ERSTKONFIGURATION - Datenverzeichnis festlegen")
        print("="*60)
        
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
        
        config_manager.config['data_directory'] = str(data_path)
        config_manager.config['first_run'] = False
        config_manager.save_config()
    else:
        data_path = Path(config_manager.config['data_directory'])
    
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

def check_port_available(port):
    """Prüft ob Port verfügbar ist"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('localhost', port))
        return True
    except OSError:
        return False

def print_banner():
    """Zeigt Banner"""
    print("🎉" + "="*70 + "🎉")
    print("           HOCHZEITSPLANER - SMART DUAL-MODE")
    print("        🏠 HTTP für lokales Netzwerk (sicher & schnell)")
    print("        🌍 HTTPS für externen Zugriff (über Fritz!Box)")
    print("🎉" + "="*70 + "🎉")
    print()

def main():
    print_banner()
    
    # Konfiguration laden
    config_manager = SmartConfig()
    config = config_manager.config
    
    # Datenverzeichnis einrichten
    print("📁 Richte Datenverzeichnis ein...")
    data_path = setup_data_directory(config_manager)
    
    # SSL-Zertifikate prüfen (nur für externen Zugriff benötigt)
    ssl_available, cert_path, key_path = check_ssl_certificates()
    
    # Umgebung vorbereiten
    os.environ['DATA_PATH'] = str(data_path)
    os.environ['FLASK_ENV'] = 'production'
    
    # Ports konfigurieren
    http_port = config.get('http_port', 8080)
    https_port = config.get('https_port', 8443)
    host = config.get('host', '0.0.0.0')
    local_ip = get_local_ip()
    
    # Port-Verfügbarkeit prüfen
    http_available = check_port_available(http_port)
    https_available = check_port_available(https_port)
    
    print(f"\n🔍 Port-Status:")
    print(f"   HTTP Port {http_port}: {'✅ verfügbar' if http_available else '❌ belegt'}")
    print(f"   HTTPS Port {https_port}: {'✅ verfügbar' if https_available else '❌ belegt'}")
    
    # Bestimme welcher Modus verwendet wird
    use_dual_mode = http_available and ssl_available
    use_http_only = http_available and not ssl_available
    use_https_only = not http_available and https_available and ssl_available
    
    print(f"\n🚀 Server-Konfiguration:")
    print(f"📂 Datenverzeichnis: {data_path}")
    print(f"🖥️  Server läuft auf: {local_ip}")
    
    if use_dual_mode:
        print("\n✅ DUAL-MODE AKTIVIERT - Optimal für Fritz!Box Setup")
        print("📍 ZUGRIFF-URLS:")
        print(f"   🏠 LOKAL (HTTP - schnell & sicher im Netzwerk):")
        print(f"      → http://localhost:{http_port}")
        print(f"      → http://{local_ip}:{http_port}")
        print(f"      → http://hochzeitsplaner.de:{http_port}")
        print(f"   🌍 EXTERN (HTTPS - über Fritz!Box):")
        print(f"      → https://xn--pascalundkthe-heiraten-94b.de")
        print(f"      → https://pascalundkäthe-heiraten.de")
        print("\n🔧 FRITZ!BOX PORTWEITERLEITUNG:")
        print("   • HTTP: Port 80 (extern) → Port 8080 (intern)")
        print("   • HTTPS: Port 443 (extern) → Port 8443 (intern)")
        print("   • Beide auf IP: 192.168.178.96")
        
        # Starte beide Server
        start_dual_servers(data_path, http_port, https_port, host, cert_path, key_path)
        
    elif use_http_only:
        print("\n📡 HTTP-MODUS (SSL-Zertifikate nicht verfügbar)")
        print("📍 ZUGRIFF-URLS:")
        print(f"   🏠 LOKAL: http://localhost:{http_port}")
        print(f"   📱 NETZWERK: http://{local_ip}:{http_port}")
        print("   💡 Für externen Zugriff: SSL-Zertifikate hinzufügen")
        
        start_http_server(data_path, http_port, host)
        
    elif use_https_only:
        print("\n🔒 HTTPS-MODUS (HTTP-Port belegt)")
        print("📍 ZUGRIFF-URLS:")
        print(f"   🌍 HTTPS: https://localhost:{https_port}")
        print(f"   📱 NETZWERK: https://{local_ip}:{https_port}")
        
        start_https_server(data_path, https_port, host, cert_path, key_path)
        
    else:
        print("\n❌ FEHLER: Keine verfügbaren Ports oder SSL-Probleme")
        print("🔧 Lösungen:")
        print("   • Beenden Sie andere Anwendungen")
        print("   • Prüfen Sie SSL-Zertifikate")
        print("   • Verwenden Sie andere Ports")
        input("\nDrücken Sie Enter zum Beenden...")

def start_dual_servers(data_path, http_port, https_port, host, cert_path, key_path):
    """Startet HTTP und HTTPS Server parallel"""
    import threading
    from app import app
    
    print(f"\n📝 Starte Dual-Mode Server...")
    print("🛑 Zum Beenden: Strg+C")
    print("="*70)
    
    # HTTP Server Thread
    def run_http():
        try:
            app.run(host=host, port=http_port, debug=False, use_reloader=False, threaded=True)
        except Exception as e:
            print(f"❌ HTTP Server Fehler: {e}")
    
    # HTTPS Server Thread  
    def run_https():
        try:
            ssl_context = (cert_path, key_path)
            app.run(host=host, port=https_port, debug=False, use_reloader=False, 
                   threaded=True, ssl_context=ssl_context)
        except Exception as e:
            print(f"❌ HTTPS Server Fehler: {e}")
    
    # Threads starten
    http_thread = threading.Thread(target=run_http, daemon=True)
    https_thread = threading.Thread(target=run_https, daemon=True)
    
    http_thread.start()
    time.sleep(1)  # Kurze Verzögerung zwischen Starts
    https_thread.start()
    
    try:
        # Hauptthread am Leben halten
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Server beendet")

def start_http_server(data_path, port, host):
    """Startet nur HTTP Server"""
    try:
        from app import app
        print(f"\n📝 Starte HTTP Server auf Port {port}...")
        print("🛑 Zum Beenden: Strg+C")
        print("="*50)
        
        app.run(host=host, port=port, debug=False, use_reloader=False, threaded=True)
        
    except KeyboardInterrupt:
        print("\n🛑 Server beendet")
    except Exception as e:
        print(f"❌ Fehler: {e}")
        input("Drücken Sie Enter zum Beenden...")

def start_https_server(data_path, port, host, cert_path, key_path):
    """Startet nur HTTPS Server"""
    try:
        from app import app
        print(f"\n📝 Starte HTTPS Server auf Port {port}...")
        print("🛑 Zum Beenden: Strg+C")
        print("="*50)
        
        ssl_context = (cert_path, key_path)
        app.run(host=host, port=port, debug=False, use_reloader=False, 
               threaded=True, ssl_context=ssl_context)
        
    except KeyboardInterrupt:
        print("\n🛑 Server beendet")
    except Exception as e:
        print(f"❌ Fehler: {e}")
        input("Drücken Sie Enter zum Beenden...")

if __name__ == '__main__':
    main()

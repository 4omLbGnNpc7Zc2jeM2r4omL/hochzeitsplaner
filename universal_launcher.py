#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Universeller Hochzeitsplaner Launcher
Automatische Erkennung: HTTP lokal + HTTPS extern (falls SSL verfügbar)
Unterstützt: Lokale Domains, IPv6 DS-Lite, Fritz!Box Portweiterleitung
"""
import json
import os
import sys
import socket
import platform
import time
import webbrowser
import threading
from pathlib import Path

# DynDNS Manager Import (optional)
try:
    from dyndns_manager import init_dyndns, start_dyndns, stop_dyndns, get_dyndns_status
    DYNDNS_AVAILABLE = True
    print("✅ DynDNS Manager verfügbar")
except ImportError:
    DYNDNS_AVAILABLE = False
    print("⚠️ DynDNS Manager nicht verfügbar")

class UniversalConfig:
    """Universelle Konfiguration für alle Szenarien"""
    
    def __init__(self):
        self.config_file = "launcher_config.json"
        self.config = self.load_config()
        
    def load_config(self):
        """Lädt Konfiguration"""
        default_config = {
            "data_directory": "",
            "http_port": 8080,      # HTTP für lokales Netzwerk
            "https_port": 8443,     # HTTPS für externen Zugriff
            "host": "0.0.0.0",      # Alle IPv4-Interfaces
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
    """Prüft SSL-Zertifikate"""
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
    
    for search_dir in search_dirs:
        if not os.path.exists(search_dir):
            continue
            
        cert_candidate = os.path.join(search_dir, 'ssl_certificate.crt')
        key_candidate = os.path.join(search_dir, 'ssl_private_key.key')
        
        if os.path.exists(cert_candidate) and os.path.exists(key_candidate):
            return True, cert_candidate, key_candidate
    
    return False, None, None

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

def get_ipv6_addresses():
    """Ermittelt öffentliche IPv6-Adressen"""
    import subprocess
    public_ipv6 = []
    
    try:
        result = subprocess.run(['ifconfig'], capture_output=True, text=True)
        lines = result.stdout.split('\n')
        
        for line in lines:
            line = line.strip()
            if line.startswith('inet6'):
                parts = line.split()
                if len(parts) >= 2:
                    ipv6_addr = parts[1]
                    # Nur öffentliche IPv6-Adressen (2a02:908: für Vodafone)
                    if ipv6_addr.startswith('2a02:908:'):
                        public_ipv6.append(ipv6_addr)
    except Exception:
        pass
    
    return public_ipv6

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

def check_port_available(port):
    """Prüft ob Port verfügbar ist"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('localhost', port))
        return True
    except OSError:
        return False

def detect_network_type():
    """Erkennt Netzwerk-Typ (DS-Lite, normale IPv4, etc.)"""
    ipv6_addresses = get_ipv6_addresses()
    
    # Prüfe auf Vodafone DS-Lite
    has_vodafone_ipv6 = any(addr.startswith('2a02:908:') for addr in ipv6_addresses)
    
    if has_vodafone_ipv6:
        return "ds-lite", ipv6_addresses
    else:
        return "standard", []

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
    print("🎉" + "="*70 + "🎉")
    print("           HOCHZEITSPLANER - UNIVERSELLER LAUNCHER")
    print("        🏠 Lokal: HTTP + 🌍 Extern: HTTPS (automatisch)")
    print("         🌐 Unterstützt: DS-Lite, Fritz!Box, lokale Domains")
    print("🎉" + "="*70 + "🎉")
    print()

def main():
    print_banner()
    
    # Konfiguration laden
    config_manager = UniversalConfig()
    config = config_manager.config
    
    # Datenverzeichnis einrichten
    print("📁 Richte Datenverzeichnis ein...")
    data_path = setup_data_directory(config_manager)
    
    # Netzwerk-Typ erkennen
    network_type, ipv6_addresses = detect_network_type()
    
    # SSL-Zertifikate prüfen
    ssl_available, cert_path, key_path = check_ssl_certificates()
    
    # Lokale IP ermitteln
    local_ip = get_local_ip()
    
    # Umgebung vorbereiten
    os.environ['DATA_PATH'] = str(data_path)
    os.environ['FLASK_ENV'] = 'production'
    
    # Ports konfigurieren
    http_port = config.get('http_port', 8080)
    https_port = config.get('https_port', 8443)
    host = config.get('host', '0.0.0.0')
    
    # Port-Verfügbarkeit prüfen
    http_available = check_port_available(http_port)
    https_available = check_port_available(https_port)
    
    print(f"🔍 Netzwerk-Analyse:")
    if network_type == "ds-lite":
        print(f"   🌐 Vodafone DS-Lite erkannt")
        print(f"   📍 Öffentliche IPv6-Adressen: {len(ipv6_addresses)}")
        for addr in ipv6_addresses[:2]:  # Zeige nur die ersten 2
            print(f"      → {addr}")
        if len(ipv6_addresses) > 2:
            print(f"      → ... und {len(ipv6_addresses)-2} weitere")
    else:
        print(f"   🏠 Standard-Netzwerk")
    
    print(f"   🖥️  Lokale IP: {local_ip}")
    print(f"   🔒 SSL-Zertifikate: {'✅ verfügbar' if ssl_available else '❌ nicht verfügbar'}")
    print(f"   📊 HTTP Port {http_port}: {'✅' if http_available else '❌'}")
    print(f"   📊 HTTPS Port {https_port}: {'✅' if https_available else '❌'}")
    
    # Bestimme besten Modus
    if http_available and ssl_available and https_available:
        print(f"\n✅ DUAL-MODE: HTTP lokal + HTTPS extern")
        print("📍 ZUGRIFF-URLS:")
        print(f"   🏠 LOKAL (HTTP - alle Geräte im Netzwerk):")
        print(f"      → http://localhost:{http_port}")
        print(f"      → http://{local_ip}:{http_port}")
        print(f"      → http://hochzeitsplaner.de:{http_port}")
        
        print(f"   🌍 EXTERN (HTTPS):")
        if network_type == "ds-lite":
            print("      💡 DS-Lite: Direkter IPv6-Zugriff (keine Portweiterleitung nötig)")
            for addr in ipv6_addresses[:2]:
                print(f"      → https://[{addr}]:{https_port}")
            print(f"      → https://pascalundkäthe-heiraten.de:{https_port} (nach DNS-Update)")
        else:
            print("      💡 Fritz!Box: Portweiterleitung Port 443→8443 konfigurieren")
            print(f"      → https://pascalundkäthe-heiraten.de")
        
        # Browser öffnen für lokalen Zugriff
        if config.get('auto_open_browser', True):
            open_browser_delayed(f"http://localhost:{http_port}")
        
        # Starte beide Server
        start_dual_servers(data_path, http_port, https_port, host, cert_path, key_path, network_type)
        
    elif http_available:
        print(f"\n📡 HTTP-MODUS (SSL nicht verfügbar)")
        print("📍 ZUGRIFF-URLS:")
        print(f"   🏠 LOKAL: http://localhost:{http_port}")
        print(f"   📱 NETZWERK: http://{local_ip}:{http_port}")
        print(f"   🌐 DOMAIN: http://hochzeitsplaner.de:{http_port}")
        print("   💡 Für HTTPS: SSL-Zertifikate hinzufügen")
        
        # Browser öffnen
        if config.get('auto_open_browser', True):
            open_browser_delayed(f"http://localhost:{http_port}")
        
        start_http_server(data_path, http_port, host)
        
    else:
        print("\n❌ FEHLER: Keine verfügbaren Ports")
        print(f"   Port {http_port} und {https_port} sind belegt")
        print("   💡 Beenden Sie andere Anwendungen oder ändern Sie die Ports")
        input("Drücken Sie Enter zum Beenden...")

def start_dual_servers(data_path, http_port, https_port, host, cert_path, key_path, network_type):
    """Startet HTTP + HTTPS Server parallel"""
    import threading
    from app import app
    
    print(f"\n📝 Starte Dual-Mode Server...")
    
    # DynDNS Manager initialisieren (falls verfügbar)
    if DYNDNS_AVAILABLE:
        try:
            # DynDNS-Konfiguration laden
            if os.path.exists('dyndns_config.json'):
                with open('dyndns_config.json', 'r', encoding='utf-8') as f:
                    dyndns_config = json.load(f)['dyndns']
                
                if dyndns_config.get('enabled', False):
                    manager = init_dyndns(
                        dyndns_config['update_url'],
                        dyndns_config['domain'],
                        dyndns_config.get('interval_minutes', 30)
                    )
                    if manager:
                        start_dyndns()
                        print(f"✅ DynDNS Manager gestartet: {dyndns_config['domain']} (alle {dyndns_config.get('interval_minutes', 30)} min)")
                    else:
                        print("⚠️ DynDNS Manager konnte nicht initialisiert werden")
                else:
                    print("ℹ️ DynDNS ist deaktiviert")
            else:
                print("⚠️ DynDNS-Konfiguration nicht gefunden")
        except Exception as e:
            print(f"❌ DynDNS Manager Fehler: {e}")
    
    print("🛑 Zum Beenden: Strg+C")
    print("="*70)
    
    def run_http():
        try:
            # HTTP auf allen IPv4-Interfaces für lokale Zugriffe
            app.run(host='0.0.0.0', port=http_port, debug=False, use_reloader=False, threaded=True)
        except Exception as e:
            print(f"❌ HTTP Server Fehler: {e}")
    
    def run_https():
        try:
            ssl_context = (cert_path, key_path)
            if network_type == "ds-lite":
                # DS-Lite: HTTPS auf IPv6 für direkte externe Zugriffe
                app.run(host='::', port=https_port, debug=False, use_reloader=False, 
                       threaded=True, ssl_context=ssl_context)
            else:
                # Standard: HTTPS auf allen Interfaces für Fritz!Box Portweiterleitung
                app.run(host='0.0.0.0', port=https_port, debug=False, use_reloader=False, 
                       threaded=True, ssl_context=ssl_context)
        except Exception as e:
            print(f"❌ HTTPS Server Fehler: {e}")
    
    # Threads starten
    http_thread = threading.Thread(target=run_http, daemon=True)
    https_thread = threading.Thread(target=run_https, daemon=True)
    
    http_thread.start()
    time.sleep(1)
    https_thread.start()
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Server beendet")

def start_http_server(data_path, port, host):
    """Startet nur HTTP Server"""
    try:
        from app import app
        print(f"\n📝 Starte HTTP Server...")
        print("🛑 Zum Beenden: Strg+C")
        print("="*50)
        
        app.run(host=host, port=port, debug=False, use_reloader=False, threaded=True)
        
    except KeyboardInterrupt:
        print("\n🛑 Server beendet")
    except Exception as e:
        print(f"❌ Fehler: {e}")
        input("Drücken Sie Enter zum Beenden...")

if __name__ == '__main__':
    main()

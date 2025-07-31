#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
IPv6-Optimierter Launcher für DS-Lite (Vodafone)
Konfiguriert für reine IPv6-Verbindungen ohne IPv4-Portweiterleitung
"""
import json
import os
import sys
import socket
import platform
import time
from pathlib import Path

class IPv6Config:
    """IPv6-optimierte Konfiguration für DS-Lite"""
    
    def __init__(self):
        self.config_file = "launcher_config.json"
        self.config = self.load_config()
        
    def load_config(self):
        """Lädt Konfiguration"""
        default_config = {
            "data_directory": "",
            "http_port": 8080,      # HTTP für lokales Netzwerk
            "https_port": 8443,     # HTTPS für IPv6-Zugriff
            "host": "::",           # IPv6 + IPv4 (dual stack)
            "ipv6_preferred": True, # IPv6 bevorzugen
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

def get_ipv6_addresses():
    """Ermittelt alle IPv6-Adressen"""
    import subprocess
    ipv6_addresses = {}
    
    try:
        result = subprocess.run(['ifconfig'], capture_output=True, text=True)
        lines = result.stdout.split('\n')
        
        current_interface = None
        for line in lines:
            line = line.strip()
            
            # Interface-Name erkennen
            if ':' in line and 'flags=' in line:
                current_interface = line.split(':')[0]
                ipv6_addresses[current_interface] = []
            
            # IPv6-Adressen sammeln
            if line.startswith('inet6') and current_interface:
                parts = line.split()
                if len(parts) >= 2:
                    ipv6_addr = parts[1]
                    # Nur globale und ULA Adressen (keine Link-Local fe80::)
                    if not ipv6_addr.startswith('fe80::') and not ipv6_addr.startswith('::1'):
                        ipv6_addresses[current_interface].append(ipv6_addr)
        
        # Leere Listen entfernen
        ipv6_addresses = {k: v for k, v in ipv6_addresses.items() if v}
        
    except Exception:
        pass
    
    return ipv6_addresses

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

def check_port_available(port, ipv6=True):
    """Prüft ob Port verfügbar ist"""
    try:
        family = socket.AF_INET6 if ipv6 else socket.AF_INET
        addr = ('::1', port) if ipv6 else ('127.0.0.1', port)
        
        with socket.socket(family, socket.SOCK_STREAM) as s:
            s.bind(addr)
        return True
    except OSError:
        return False

def print_banner():
    """Zeigt Banner"""
    print("🎉" + "="*70 + "🎉")
    print("           HOCHZEITSPLANER - IPv6-OPTIMIERT")
    print("        🌐 Für Vodafone DS-Lite (Dual Stack Lite)")
    print("        🏠 HTTP lokal + 🌍 HTTPS über IPv6 direkt")
    print("🎉" + "="*70 + "🎉")
    print()

def print_ds_lite_info():
    """Informiert über DS-Lite Besonderheiten"""
    print("📘 DS-LITE INFORMATION:")
    print("   • Vodafone DS-Lite = Keine öffentliche IPv4")
    print("   • IPv4 Portweiterleitung funktioniert NICHT")
    print("   • IPv6 funktioniert direkt (ohne NAT)")
    print("   • Externe Zugriffe nur über IPv6 möglich")
    print()

def main():
    print_banner()
    print_ds_lite_info()
    
    # Konfiguration laden
    config_manager = IPv6Config()
    config = config_manager.config
    
    # Datenverzeichnis einrichten
    print("📁 Richte Datenverzeichnis ein...")
    data_path = setup_data_directory(config_manager)
    
    # IPv6-Adressen ermitteln
    ipv6_addresses = get_ipv6_addresses()
    
    # SSL-Zertifikate prüfen
    ssl_available, cert_path, key_path = check_ssl_certificates()
    
    # Umgebung vorbereiten
    os.environ['DATA_PATH'] = str(data_path)
    os.environ['FLASK_ENV'] = 'production'
    
    # Ports konfigurieren
    http_port = config.get('http_port', 8080)
    https_port = config.get('https_port', 8443)
    host = config.get('host', '0.0.0.0')  # Explizit alle IPv4-Interfaces + IPv6 dual-stack
    
    # Port-Verfügbarkeit prüfen
    http_available = check_port_available(http_port, False)  # IPv4 für lokal
    https_available = check_port_available(https_port, True)  # IPv6 für extern
    
    print(f"\n🔍 IPv6-Adressen gefunden:")
    for interface, addresses in ipv6_addresses.items():
        print(f"   {interface}:")
        for addr in addresses:
            if addr.startswith('2a02:908:'):  # Öffentliche Vodafone IPv6
                print(f"      🌍 {addr} (ÖFFENTLICH)")
            elif addr.startswith('fda0:') or addr.startswith('fc00:'):
                print(f"      🏠 {addr} (LOKAL)")
            else:
                print(f"      📱 {addr}")
    
    print(f"\n🔍 Port-Status:")
    print(f"   HTTP Port {http_port}: {'✅ verfügbar' if http_available else '❌ belegt'}")
    print(f"   HTTPS Port {https_port}: {'✅ verfügbar' if https_available else '❌ belegt'}")
    print(f"   SSL-Zertifikate: {'✅ gefunden' if ssl_available else '❌ nicht gefunden'}")
    
    print(f"\n🚀 Server-Konfiguration:")
    print(f"📂 Datenverzeichnis: {data_path}")
    print(f"🖥️  Server lauscht auf: alle Interfaces (IPv4 + IPv6)")
    
    # Bestimme Modus
    if http_available and ssl_available and https_available:
        print("\n✅ DUAL-MODE für DS-Lite")
        print("📍 ZUGRIFF-URLS:")
        print(f"   🏠 LOKAL (HTTP - alle lokalen Zugriffe):")
        print(f"      → http://localhost:{http_port}")
        print(f"      → http://192.168.178.96:{http_port}")
        print(f"      → http://hochzeitsplaner.de:{http_port}")
        print(f"   🌍 EXTERN (HTTPS - IPv6 direkt ohne Portweiterleitung):")
        
        # Zeige öffentliche IPv6-Adressen
        for interface, addresses in ipv6_addresses.items():
            for addr in addresses:
                if addr.startswith('2a02:908:'):
                    print(f"      → https://[{addr}]:{https_port}")
        
        print(f"      → https://pascalundkäthe-heiraten.de:{https_port} (nach DNS-Update)")
        
        print(f"\n💡 DS-LITE BESONDERHEITEN:")
        print("   • Fritz!Box Portweiterleitung NICHT nötig für IPv6")
        print("   • Externe Clients brauchen IPv6-Unterstützung")
        print("   • Domain-DNS sollte AAAA-Record verwenden")
        print("   💡 TIPP: Für lokale Domain-Auflösung hosts-Datei konfigurieren")
        
        # Starte beide Server
        start_dual_ipv6_servers(data_path, http_port, https_port, host, cert_path, key_path)
        
    elif http_available:
        print("\n📡 HTTP-MODUS (SSL-Zertifikate nicht verfügbar)")
        print("📍 ZUGRIFF-URLS:")
        print(f"   🏠 LOKAL: http://localhost:{http_port}")
        print(f"   📱 NETZWERK: http://192.168.178.96:{http_port}")
        print(f"   🌐 DOMAIN: http://hochzeitsplaner.de:{http_port}")
        print("   💡 Für externen HTTPS-Zugriff: SSL-Zertifikate hinzufügen")
        
        start_http_server(data_path, http_port, '0.0.0.0')  # Alle IPv4-Interfaces
        
    else:
        print("\n❌ FEHLER: Keine verfügbaren Ports")
        input("Drücken Sie Enter zum Beenden...")

def start_dual_ipv6_servers(data_path, http_port, https_port, host, cert_path, key_path):
    """Startet HTTP + HTTPS für DS-Lite"""
    import threading
    from app import app
    
    print(f"\n📝 Starte DS-Lite optimierte Server...")
    print("🛑 Zum Beenden: Strg+C")
    print("="*70)
    
    def run_http():
        try:
            # HTTP auf IPv6 + IPv4 (Dual Stack) für lokales und externes Netzwerk
            app.run(host='0.0.0.0', port=http_port, debug=False, use_reloader=False, threaded=True)
        except Exception as e:
            print(f"❌ HTTP Server Fehler: {e}")
    
    def run_https():
        try:
            # HTTPS auf IPv6 für externe Zugriffe
            ssl_context = (cert_path, key_path)
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
        
        app.run(host='0.0.0.0', port=port, debug=False, use_reloader=False, threaded=True)
        
    except KeyboardInterrupt:
        print("\n🛑 Server beendet")
    except Exception as e:
        print(f"❌ Fehler: {e}")
        input("Drücken Sie Enter zum Beenden...")

if __name__ == '__main__':
    main()

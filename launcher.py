#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Hochzeitsplaner Optimierter Launcher
Produktivserver mit Gunicorn-Support
"""

import sys
import os
import webbrowser
import time
import threading
import socket
import json
import subprocess
from pathlib import Path
import shutil

# SSL-Zertifikat-Checking importieren
def check_ssl_certificates():
    """Prüft SSL-Zertifikate in verschiedenen Verzeichnissen"""
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
        # Für PyInstaller: Suche launcher_config.json im Executable-Verzeichnis und im aktuellen Arbeitsverzeichnis
        possible_config_paths = []
        
        # 1. Aktuelles Arbeitsverzeichnis (wo die .exe liegt)
        possible_config_paths.append(Path.cwd() / "launcher_config.json")
        
        # 2. Verzeichnis der ausführenden Datei
        if getattr(sys, 'frozen', False):
            # PyInstaller executable
            exe_dir = Path(sys.executable).parent
            possible_config_paths.append(exe_dir / "launcher_config.json")
        else:
            # Development environment
            script_dir = Path(__file__).parent
            possible_config_paths.append(script_dir / "launcher_config.json")
        
        # 3. Fallback: application_path
        possible_config_paths.append(Path(application_path) / "launcher_config.json")
        
        # Finde die erste existierende Konfigurationsdatei
        self.config_file = None
        for config_path in possible_config_paths:
            if config_path.exists():
                self.config_file = config_path
                print(f"📁 Konfiguration gefunden: {config_path}")
                break
        
        # Fallback: Verwende erste Möglichkeit
        if self.config_file is None:
            self.config_file = possible_config_paths[0]
            print(f"📁 Konfiguration wird erstellt: {self.config_file}")
        
        self.default_config = {
            "data_directory": str(Path(application_path) / "data"),
            "ssl_enabled": False,
            "hosts": ["0.0.0.0", "::"],  # Dual-Stack: IPv4 + IPv6
            "port": 8080,  # Standard Port für externe Erreichbarkeit
            "auto_open_browser": True,
            "domain": "pascalundkäthe-heiraten.de",
            "production_server": True,  # Gunicorn verwenden falls verfügbar
            "workers": 4,
            "timeout": 120,
            "first_run": True
        }
        self.config = self.load_config()
        self.setup_ssl()  # SSL-Setup nach dem Laden der Konfiguration
    
    def setup_ssl(self):
        """Prüft und konfiguriert SSL automatisch"""
        ssl_available, cert_path, key_path = check_ssl_certificates()
        
        if ssl_available:
            print(f"🔒 SSL-Zertifikate gefunden:")
            print(f"   📜 Zertifikat: {cert_path}")
            print(f"   🔑 Schlüssel: {key_path}")
            
            # SSL automatisch aktivieren
            self.config['ssl_enabled'] = True
            self.config['ssl_cert_path'] = cert_path
            self.config['ssl_key_path'] = key_path
            
            # Port für HTTPS anpassen falls nötig
            if self.config.get('port', 8080) == 8080:
                self.config['port'] = 8443  # Standard HTTPS Port für lokale Entwicklung
                
        else:
            print("⚠️  Keine SSL-Zertifikate gefunden - verwende HTTP")
            self.config['ssl_enabled'] = False
    
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
        if self.config.get("first_run", True):
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
            
            # First run abschließen
            self.config["first_run"] = False
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
    print("              Produktivversion 2.0.0")
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

def run_flask_dual_stack(config, port):
    """Startet Flask mit IPv4+IPv6 Dual-Stack Support"""
    from app import app
    
    # SSL-Konfiguration vorbereiten
    ssl_context = None
    if config.get('ssl_enabled', False):
        cert_path = config.get('ssl_cert_path')
        key_path = config.get('ssl_key_path')
        if cert_path and key_path and os.path.exists(cert_path) and os.path.exists(key_path):
            ssl_context = (cert_path, key_path)
            print(f"🔒 Flask SSL aktiviert")
        else:
            print(f"⚠️  SSL-Dateien nicht gefunden, verwende HTTP")
    
    # Flask Dual-Stack Workaround für Windows
    # Flask kann nur IPv4 ODER IPv6, nicht beides gleichzeitig
    
    def run_flask_on_host(host, name):
        """Startet Flask auf spezifischem Host"""
        try:
            print(f"🌐 Starte {name} Server auf {host}:{port}")
            app.run(
                host=host,
                port=port,
                debug=False,
                use_reloader=False,
                threaded=True,
                ssl_context=ssl_context
            )
        except Exception as e:
            print(f"❌ {name} Server Fehler: {e}")
    
    # IPv4 und IPv6 Threads starten
    hosts = [
        ("0.0.0.0", "IPv4"),      # IPv4 auf allen Interfaces  
        ("::", "IPv6")            # IPv6 auf allen Interfaces
    ]
    
    threads = []
    for host, name in hosts:
        thread = threading.Thread(
            target=run_flask_on_host, 
            args=(host, name),
            daemon=True
        )
        threads.append(thread)
        thread.start()
    
    print(f"🚀 Dual-Stack Server gestartet!")
    protocol = "https" if ssl_context else "http"
    print(f"📱 IPv4: {protocol}://0.0.0.0:{port}")
    print(f"📱 IPv6: {protocol}://[::]:{port}")
    print(f"🌐 Lokal: {protocol}://localhost:{port}")
    
    # Warten auf Threads
    try:
        for thread in threads:
            thread.join()
    except KeyboardInterrupt:
        print("\n🛑 Dual-Stack Server gestoppt")
        raise

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
    hosts = config.get('hosts', ['0.0.0.0', '::'])
    protocol = "https" if config.get('ssl_enabled', False) else "http"
    url = f"{protocol}://localhost:{port}"
    
    print(f"🚀 Starte Dual-Stack Server...")
    print(f"📂 Datenverzeichnis: {data_path}")
    print(f"🌐 Server-URL: {url}")
    print(f"� IPv4: {protocol}://0.0.0.0:{port}")
    print(f"📱 IPv6: {protocol}://[::]:{port}")
    print(f"�🔗 Externe URL: {protocol}://{config.get('domain', 'ihr-domain.de')}")
    
    if config.get('ssl_enabled', False):
        print("🔒 SSL aktiviert")
    
    # Browser-Thread starten
    if config.get('auto_open_browser', True):
        open_browser_delayed(url)
    
    # Flask App importieren und starten
    try:
        # App importieren
        from app import app
        
        print("📝 Logs werden hier angezeigt...")
        print("🛑 Zum Beenden: Strg+C")
        print("="*60)
        print()
        
        # Produktivserver-Konfiguration mit Gunicorn-Option
        use_production = config.get('production_server', True)
        
        if use_production:
            try:
                # Teste ob Gunicorn verfügbar ist
                subprocess.check_call([sys.executable, '-m', 'gunicorn', '--version'], 
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                
                print("🚀 Starte mit Gunicorn Dual-Stack Produktivserver...")
                print(f"👥 Worker: {config.get('workers', 4)}")
                
                # Gunicorn kann nativ Dual-Stack mit mehreren Bind-Adressen
                binds = []
                for host in hosts:
                    if host == "::":
                        binds.append(f"[{host}]:{port}")  # IPv6 braucht eckige Klammern
                    else:
                        binds.append(f"{host}:{port}")
                
                # Gunicorn-Kommando mit Dual-Stack
                cmd = [
                    sys.executable, '-m', 'gunicorn',
                    '--workers', str(config.get('workers', 4)),
                    '--worker-class', 'gevent',
                    '--timeout', str(config.get('timeout', 120)),
                    '--keep-alive', '5',
                    '--max-requests', '1000',
                    '--max-requests-jitter', '100',
                    '--preload',
                    '--access-logfile', '-',
                    '--error-logfile', '-'
                ]
                
                # SSL-Konfiguration für Gunicorn
                if config.get('ssl_enabled', False):
                    cert_path = config.get('ssl_cert_path')
                    key_path = config.get('ssl_key_path')
                    if cert_path and key_path:
                        cmd.extend(['--certfile', cert_path])
                        cmd.extend(['--keyfile', key_path])
                        print(f"🔒 SSL aktiviert mit Gunicorn")
                
                # Mehrere Bind-Adressen für Dual-Stack
                for bind in binds:
                    cmd.extend(['--bind', bind])
                
                # App Module am Ende
                cmd.append('app:app')
                
                print(f"🌐 Dual-Stack Binds: {', '.join(binds)}")
                subprocess.run(cmd)
                
            except (subprocess.CalledProcessError, FileNotFoundError):
                print("⚠️  Gunicorn nicht verfügbar, verwende Flask Dual-Stack Fallback")
                print("💡 Für Produktivbetrieb installieren Sie: pip install gunicorn gevent")
                use_production = False
        
        if not use_production:
            # Flask Dual-Stack Fallback für Windows
            print("🔧 Starte mit Flask Dual-Stack Development Server...")
            run_flask_dual_stack(config, port)
        
    except KeyboardInterrupt:
        print("\n🛑 Anwendung beendet durch Benutzer")
    except Exception as e:
        print(f"❌ Fehler beim Starten der Anwendung: {e}")
        print("\n📋 Drücken Sie Enter zum Beenden...")
        input()

if __name__ == '__main__':
    main()

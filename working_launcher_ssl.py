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
import platform
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
            "port": 8443,  # Standard-Port für SSL + Fritz!Box Portweiterleitung
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
    """Prüft SSL-Zertifikate und gibt Status zurück - verbesserter Multi-Path-Check"""
    ssl_cert_path = None
    ssl_key_path = None
    
    # Liste aller möglichen Verzeichnisse
    search_dirs = []
    
    if getattr(sys, 'frozen', False):
        # PyInstaller .exe Modus
        exe_dir = os.path.dirname(sys.executable)
        search_dirs.extend([
            exe_dir,  # Hauptverzeichnis der .exe
            os.path.join(exe_dir, '_internal'),  # PyInstaller _internal
        ])
        
        # MEIPASS (temporäres Verzeichnis bei --onefile)
        if hasattr(sys, '_MEIPASS'):
            search_dirs.append(sys._MEIPASS)
    else:
        # Normaler Python-Modus
        script_dir = os.path.dirname(os.path.abspath(__file__))
        search_dirs.append(script_dir)
    
    # Aktuelles Arbeitsverzeichnis auch prüfen
    search_dirs.append(os.getcwd())
    
    # Debug-Ausgabe
    print("🔍 Suche SSL-Zertifikate in folgenden Verzeichnissen:")
    for i, dir_path in enumerate(search_dirs, 1):
        exists = "✅" if os.path.exists(dir_path) else "❌"
        print(f"   {i}. {exists} {dir_path}")
    
    # Durch alle Verzeichnisse suchen
    for search_dir in search_dirs:
        if not os.path.exists(search_dir):
            continue
            
        cert_candidate = os.path.join(search_dir, 'ssl_certificate.crt')
        key_candidate = os.path.join(search_dir, 'ssl_private_key.key')
        
        print(f"\n🔎 Prüfe: {search_dir}")
        print(f"   Zertifikat: {'✅' if os.path.exists(cert_candidate) else '❌'} {cert_candidate}")
        print(f"   Schlüssel:  {'✅' if os.path.exists(key_candidate) else '❌'} {key_candidate}")
        
        if os.path.exists(cert_candidate) and os.path.exists(key_candidate):
            ssl_cert_path = cert_candidate
            ssl_key_path = key_candidate
            print(f"🎯 SSL-Dateien gefunden in: {search_dir}")
            break
    
    if ssl_cert_path and ssl_key_path:
        print("\n🔒 SSL-Zertifikat und Privatschlüssel gefunden")
        print(f"   📜 Zertifikat: {ssl_cert_path}")
        print(f"   🔑 Schlüssel: {ssl_key_path}")
        return True, ssl_cert_path, ssl_key_path
    else:
        print("\n⚠️  SSL-Zertifikatsdateien nicht gefunden!")
        print("🔍 Erwartete Dateien:")
        print("   📄 ssl_certificate.crt")
        print("   📄 ssl_private_key.key")
        print("\n📂 Alle Dateien im Arbeitsverzeichnis:")
        try:
            current_files = os.listdir(os.getcwd())
            ssl_related = [f for f in current_files if 'ssl' in f.lower() or f.endswith('.crt') or f.endswith('.key')]
            if ssl_related:
                for f in ssl_related:
                    print(f"   📁 {f}")
            else:
                print("   ❌ Keine SSL-bezogenen Dateien gefunden")
        except Exception as e:
            print(f"   ❌ Fehler beim Auflisten: {e}")
        
        print("\n👉 Bitte SSL-Zertifikate ins Programmverzeichnis kopieren")
        return False, None, None

def print_banner():
    """Zeigt Banner"""
    print("🎉" + "="*60 + "🎉")
    print("           HOCHZEITSPLANER WEB-ANWENDUNG")
    print("          SSL-Version mit Dual-Domain-Support")
    print("     🌐 Lokal: hochzeitsplaner.de")
    print("     🌍 Internet: xn--pascalundkthe-heiraten-94b.de (pascalundkäthe-heiraten.de)")
    print("🎉" + "="*60 + "🎉")
    print()

def find_available_port(start_port=8443):
    """Findet einen verfügbaren Port - bevorzugt 8443 für Fritz!Box"""
    ports_to_try = [8443, start_port, 8080, 8081, 8082, 5001, 5002, 3000, 3001]
    
    for port in ports_to_try:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('localhost', port))
                return port
        except OSError:
            continue
    
    return 8443  # Fallback auf 8443

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

def configure_domains_automatically():
    """Automatische Domain-Konfiguration für lokales Netzwerk"""
    try:
        print("\n🌐 Konfiguriere lokale Domains automatisch...")
        
        # IP-Adresse ermitteln
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
        except Exception:
            local_ip = "192.168.1.100"
        
        print(f"🏠 Lokale IP-Adresse: {local_ip}")
        
        # Hosts-Datei-Pfad je nach Betriebssystem
        if platform.system() == "Windows":
            hosts_file = r"C:\Windows\System32\drivers\etc\hosts"
        else:
            hosts_file = "/etc/hosts"
        
        # Admin-Rechte prüfen
        admin_rights = False
        if platform.system() == "Windows":
            try:
                import ctypes
                admin_rights = ctypes.windll.shell32.IsUserAnAdmin()
            except:
                admin_rights = False
        else:
            admin_rights = os.geteuid() == 0
        
        if not admin_rights:
            print("⚠️  Keine Administrator-Rechte für automatische Domain-Konfiguration")
            print("\n📋 MANUELLE DOMAIN-KONFIGURATION:")
            print(f"   1. Öffne Terminal/Eingabeaufforderung als Administrator")
            if platform.system() == "Windows":
                print(f"   2. Führe aus: echo {local_ip}  hochzeitsplaner.de >> {hosts_file}")
                print(f"   3. Führe aus: echo {local_ip}  www.hochzeitsplaner.de >> {hosts_file}")
                print(f"   4. Führe aus: echo {local_ip}  xn--pascalundkthe-heiraten-94b.de >> {hosts_file}")
                print(f"   5. Führe aus: echo {local_ip}  www.xn--pascalundkthe-heiraten-94b.de >> {hosts_file}")
            else:
                print(f"   2. Führe aus: sudo sh -c 'echo \"{local_ip}  hochzeitsplaner.de\" >> {hosts_file}'")
                print(f"   3. Führe aus: sudo sh -c 'echo \"{local_ip}  www.hochzeitsplaner.de\" >> {hosts_file}'")
                print(f"   4. Führe aus: sudo sh -c 'echo \"{local_ip}  xn--pascalundkthe-heiraten-94b.de\" >> {hosts_file}'")
                print(f"   5. Führe aus: sudo sh -c 'echo \"{local_ip}  www.xn--pascalundkthe-heiraten-94b.de\" >> {hosts_file}'")
            print("   6. Hochzeitsplaner neu starten")
            
            print("\n🎯 ALTERNATIVE: Fritz!Box-DNS-Konfiguration:")
            print("   → Fritz!Box Web-Interface: fritz.box")
            print("   → Heimnetz → Netzwerk → Netzwerkeinstellungen") 
            print("   → 'Lokale DNS-Abfragen' → 'DNS-Rebind-Protection deaktivieren' für:")
            print("     - hochzeitsplaner.de")
            print("     - xn--pascalundkthe-heiraten-94b.de (pascalundkäthe-heiraten.de)")
            print("   → ODER: Unter 'Lokale DNS-Einträge' beide Domains hinzufügen")
            return False
        
        # Hosts-Datei lesen
        try:
            with open(hosts_file, 'r', encoding='utf-8') as f:
                content = f.read()
        except:
            try:
                with open(hosts_file, 'r', encoding='latin-1') as f:
                    content = f.read()
            except Exception as e:
                print(f"❌ Fehler beim Lesen der hosts-Datei: {e}")
                return False
        
        # Prüfe ob Einträge bereits existieren
        if f"{local_ip}  hochzeitsplaner.de" in content and f"{local_ip}  xn--pascalundkthe-heiraten-94b.de" in content:
            print("✅ Domains bereits korrekt konfiguriert")
            return True
        
        # Alte Einträge entfernen falls vorhanden
        lines = content.splitlines()
        new_lines = []
        for line in lines:
            if not any(domain in line for domain in ['hochzeitsplaner.de', 'xn--pascalundkthe-heiraten-94b.de', 'pascalundkäthe-heiraten.de']):
                new_lines.append(line)
        
        # Neue Einträge hinzufügen
        new_lines.extend([
            "",
            "# Hochzeitsplaner Dual-Domain-Konfiguration",
            f"{local_ip}  hochzeitsplaner.de",
            f"{local_ip}  www.hochzeitsplaner.de", 
            f"{local_ip}  xn--pascalundkthe-heiraten-94b.de",
            f"{local_ip}  www.xn--pascalundkthe-heiraten-94b.de",
            f"{local_ip}  pascalundkäthe-heiraten.de",
            f"{local_ip}  www.pascalundkäthe-heiraten.de"
        ])
        
        # Zurückschreiben
        with open(hosts_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(new_lines))
        
        print("✅ Domain-Konfiguration erfolgreich!")
        print(f"🌐 hochzeitsplaner.de → {local_ip}")
        print(f"🌍 xn--pascalundkthe-heiraten-94b.de (pascalundkäthe-heiraten.de) → {local_ip}")
        return True
        
    except Exception as e:
        print(f"❌ Fehler bei Domain-Konfiguration: {e}")
        return False

def test_domain_connectivity(local_ip, port):
    """Testet ob die Domain-Konfiguration funktioniert"""
    print("\n🔍 Teste Domain-Konnektivität...")
    
    # Teste Domain-Auflösung
    import subprocess
    try:
        # Teste hochzeitsplaner.de
        result = subprocess.run(['ping', '-c', '1', 'hochzeitsplaner.de'], 
                              capture_output=True, text=True, timeout=5)
        if local_ip in result.stdout:
            print("✅ hochzeitsplaner.de zeigt auf lokale IP")
            domain_works = True
        else:
            print("❌ hochzeitsplaner.de zeigt NICHT auf lokale IP")
            print("   → Domain zeigt auf Internet-Server, nicht lokal")
            domain_works = False
    except Exception:
        print("❌ Domain-Test fehlgeschlagen")
        domain_works = False
    
    return domain_works

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
    
    # Domain-Konfiguration automatisch durchführen
    domain_configured = configure_domains_automatically()
    
    # Umgebung vorbereiten
    os.environ['DATA_PATH'] = str(data_path)
    os.environ['FLASK_ENV'] = 'production'
    
    # Port finden - FEST auf 8443 für Fritz!Box Portweiterleitung
    port = 8443  # Fester Port für Fritz!Box Konfiguration
    
    # Prüfe ob Port verfügbar ist
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('localhost', port))
        print(f"✅ Port {port} ist verfügbar")
    except OSError:
        print(f"⚠️  WARNUNG: Port {port} ist bereits belegt!")
        print("🔧 Mögliche Lösungen:")
        print("   • Beenden Sie andere Anwendungen auf Port 8443")
        print("   • Oder ändern Sie die Fritz!Box Portweiterleitung")
        print(f"   • Der Server wird trotzdem versuchen auf Port {port} zu starten")
        print()
    
    # Protocol und URL bestimmen
    host = config.get('host', '0.0.0.0')
    use_ssl = ssl_available and config.get('ssl_enabled', True)
    protocol = "https" if use_ssl else "http"
    url = f"{protocol}://localhost:{port}"  # Für Browser-Öffnung localhost verwenden
    
    # Lokale IP für Ausgabe
    local_ip = get_local_ip()
    
    # Domain-Konnektivität testen (nur wenn SSL verfügbar)
    if use_ssl and domain_configured:
        domain_works = test_domain_connectivity(local_ip, port)
    else:
        domain_works = False
    
    print(f"\n🚀 Starte Server...")
    print(f"📂 Datenverzeichnis: {data_path}")
    print(f"🖥️  Server läuft auf allen Netzwerk-Interfaces")
    print()
    
    if use_ssl:
        print("🔒 SSL aktiviert - Sicherer HTTPS-Modus")
        print("📍 ZUGRIFF-URLS (in Prioritätsreihenfolge):")
        print(f"   🏠 Lokal (immer funktioniert): https://localhost:{port}")
        print(f"   📱 Direkte IP: https://{local_ip}:{port}")
        
        if domain_works:
            print(f"   🌐 Lokale Domain: https://hochzeitsplaner.de:{port}")
            print(f"   🌍 Internet Domain: https://xn--pascalundkthe-heiraten-94b.de:{port}")
            print("   🚀 Fritz!Box Portweiterleitung:")
            print("     → Von Internet: https://xn--pascalundkthe-heiraten-94b.de")
            print("     → Lokal: https://hochzeitsplaner.de")
        else:
            print(f"   ⚠️  Domain nicht verfügbar: https://hochzeitsplaner.de:{port}")
            print(f"   ⚠️  Domain nicht verfügbar: https://xn--pascalundkthe-heiraten-94b.de:{port}")
            print("   💡 Siehe Domain-Konfiguration oben für Lösung")
    else:
        print("⚠️  HTTP-Modus (unverschlüsselt)")
        print("📍 ZUGRIFF-URLS:")
        print(f"   🏠 Lokal: http://localhost:{port}")
        print(f"   📱 Direkte IP: http://{local_ip}:{port}")
        if domain_works:
            print(f"   🌐 Lokale Domain: http://hochzeitsplaner.de:{port}")
            print(f"   🌍 Internet Domain: http://xn--pascalundkthe-heiraten-94b.de:{port}")
    
    print()
    if not domain_works:
        print("💡 DOMAIN-KONFIGURATION:")
        print("   ⚠️  Domains zeigen auf Internet-Server (nicht lokal)")
        print("   🔧 Lösung: Hosts-Datei konfigurieren oder Fritz!Box DNS anpassen")
        print("   📖 Siehe detaillierte Anweisungen oben")
        if platform.system() == "Darwin":  # macOS
            print("   🚀 Schnell-Setup: ./setup_domains_macos.sh ausführen")
    else:
        print("✅ DOMAIN-KONFIGURATION: Erfolgreich eingerichtet")
    
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

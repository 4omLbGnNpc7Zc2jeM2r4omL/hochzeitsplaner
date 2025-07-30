#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Hochzeitsplaner SSL-fähiger Launcher
Startet die Webanwendung mit SSL-Unterstützung und konfigurierbarem Datenverzeichnis
"""

import sys
import os
import webbrowser
import time
import threading
import socket
import ssl
import tkinter as tk
from tkinter import filedialog, messagebox, simpledialog
from pathlib import Path
import shutil
import json

# Stelle sicher, dass wir im richtigen Verzeichnis sind
if getattr(sys, 'frozen', False):
    # Wenn als .exe ausgeführt
    application_path = os.path.dirname(sys.executable)
else:
    # Wenn als Script ausgeführt
    application_path = os.path.dirname(os.path.abspath(__file__))

os.chdir(application_path)

class HochzeitsplanerConfig:
    """Konfiguration für Hochzeitsplaner"""
    
    def __init__(self):
        self.config_file = Path("hochzeitsplaner_config.json")
        self.default_config = {
            "data_directory": str(Path(application_path) / "data"),
            "ssl_enabled": False,
            "ssl_cert_path": "",
            "ssl_key_path": "ssl_private_key.key",
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
                # Merge mit default config für neue Optionen
                merged = self.default_config.copy()
                merged.update(config)
                return merged
            except Exception as e:
                print(f"⚠️  Fehler beim Laden der Konfiguration: {e}")
        
        return self.default_config.copy()
    
    def save_config(self):
        """Speichert Konfiguration in Datei"""
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"❌ Fehler beim Speichern der Konfiguration: {e}")
            return False
    
    def setup_data_directory(self):
        """Richtet Datenverzeichnis ein"""
        data_path = Path(self.config["data_directory"])
        
        # Erstelle Verzeichnis falls nicht vorhanden
        data_path.mkdir(parents=True, exist_ok=True)
        
        # Kopiere Standard-Daten falls Verzeichnis leer ist
        default_data_path = Path(application_path) / "data"
        if default_data_path.exists() and not any(data_path.iterdir()):
            try:
                shutil.copytree(default_data_path, data_path, dirs_exist_ok=True)
                print(f"✅ Standard-Daten nach {data_path} kopiert")
            except Exception as e:
                print(f"⚠️  Fehler beim Kopieren der Standard-Daten: {e}")
        
        return data_path

class ConfigGUI:
    """GUI für Konfiguration"""
    
    def __init__(self, config_manager):
        self.config_manager = config_manager
        self.config = config_manager.config
        self.root = None
        
    def show_config_dialog(self):
        """Zeigt Konfigurationsdialog"""
        self.root = tk.Tk()
        self.root.title("Hochzeitsplaner - Konfiguration")
        self.root.geometry("600x500")
        self.root.resizable(True, True)
        
        # Hauptframe
        main_frame = tk.Frame(self.root, padx=20, pady=20)
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Titel
        title_label = tk.Label(main_frame, text="🎉 Hochzeitsplaner Konfiguration", 
                              font=("Arial", 16, "bold"))
        title_label.pack(pady=(0, 20))
        
        # Datenverzeichnis
        data_frame = tk.LabelFrame(main_frame, text="📁 Datenverzeichnis", padx=10, pady=10)
        data_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.data_var = tk.StringVar(value=self.config["data_directory"])
        data_entry = tk.Entry(data_frame, textvariable=self.data_var, width=50)
        data_entry.pack(side=tk.LEFT, padx=(0, 10))
        
        data_button = tk.Button(data_frame, text="Durchsuchen...", 
                               command=self.browse_data_directory)
        data_button.pack(side=tk.RIGHT)
        
        # SSL-Konfiguration
        ssl_frame = tk.LabelFrame(main_frame, text="🔒 SSL-Konfiguration", padx=10, pady=10)
        ssl_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.ssl_var = tk.BooleanVar(value=self.config["ssl_enabled"])
        ssl_check = tk.Checkbox(ssl_frame, text="SSL aktivieren (HTTPS)", variable=self.ssl_var,
                               command=self.toggle_ssl)
        ssl_check.pack(anchor=tk.W)
        
        # SSL Zertifikat (optional)
        cert_frame = tk.Frame(ssl_frame)
        cert_frame.pack(fill=tk.X, pady=(5, 0))
        
        tk.Label(cert_frame, text="Zertifikat (optional):").pack(anchor=tk.W)
        self.cert_var = tk.StringVar(value=self.config["ssl_cert_path"])
        cert_entry = tk.Entry(cert_frame, textvariable=self.cert_var, width=40)
        cert_entry.pack(side=tk.LEFT, padx=(0, 10))
        
        cert_button = tk.Button(cert_frame, text="Durchsuchen...", 
                               command=self.browse_ssl_cert)
        cert_button.pack(side=tk.RIGHT)
        
        # Server-Konfiguration
        server_frame = tk.LabelFrame(main_frame, text="🌐 Server-Konfiguration", padx=10, pady=10)
        server_frame.pack(fill=tk.X, pady=(0, 10))
        
        # Host
        host_frame = tk.Frame(server_frame)
        host_frame.pack(fill=tk.X)
        tk.Label(host_frame, text="Host:").pack(side=tk.LEFT)
        self.host_var = tk.StringVar(value=self.config["host"])
        host_entry = tk.Entry(host_frame, textvariable=self.host_var, width=20)
        host_entry.pack(side=tk.LEFT, padx=(10, 20))
        
        # Port
        tk.Label(host_frame, text="Port:").pack(side=tk.LEFT)
        self.port_var = tk.StringVar(value=str(self.config["port"]))
        port_entry = tk.Entry(host_frame, textvariable=self.port_var, width=10)
        port_entry.pack(side=tk.LEFT, padx=(10, 0))
        
        # Domain
        domain_frame = tk.Frame(server_frame)
        domain_frame.pack(fill=tk.X, pady=(5, 0))
        tk.Label(domain_frame, text="Domain:").pack(side=tk.LEFT)
        self.domain_var = tk.StringVar(value=self.config["domain"])
        domain_entry = tk.Entry(domain_frame, textvariable=self.domain_var, width=30)
        domain_entry.pack(side=tk.LEFT, padx=(10, 0))
        
        # Optionen
        options_frame = tk.LabelFrame(main_frame, text="⚙️ Optionen", padx=10, pady=10)
        options_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.browser_var = tk.BooleanVar(value=self.config["auto_open_browser"])
        browser_check = tk.Checkbox(options_frame, text="Browser automatisch öffnen", 
                                   variable=self.browser_var)
        browser_check.pack(anchor=tk.W)
        
        # Buttons
        button_frame = tk.Frame(main_frame)
        button_frame.pack(fill=tk.X, pady=(20, 0))
        
        save_button = tk.Button(button_frame, text="💾 Speichern & Starten", 
                               command=self.save_and_start, bg="#4CAF50", fg="white", 
                               font=("Arial", 12, "bold"))
        save_button.pack(side=tk.LEFT, padx=(0, 10))
        
        start_button = tk.Button(button_frame, text="🚀 Direkt starten", 
                                command=self.start_without_save, bg="#2196F3", fg="white")
        start_button.pack(side=tk.LEFT, padx=(0, 10))
        
        cancel_button = tk.Button(button_frame, text="❌ Abbrechen", 
                                 command=self.cancel)
        cancel_button.pack(side=tk.RIGHT)
        
        # Initial SSL state
        self.toggle_ssl()
        
        # Center window
        self.root.eval('tk::PlaceWindow . center')
        
        # Start GUI
        self.root.mainloop()
        
        return hasattr(self, 'result') and self.result
    
    def browse_data_directory(self):
        """Durchsuche Datenverzeichnis"""
        directory = filedialog.askdirectory(
            title="Datenverzeichnis auswählen",
            initialdir=self.data_var.get()
        )
        if directory:
            self.data_var.set(directory)
    
    def browse_ssl_cert(self):
        """Durchsuche SSL-Zertifikat"""
        filename = filedialog.askopenfilename(
            title="SSL-Zertifikat auswählen",
            filetypes=[("Certificate files", "*.crt *.pem *.cert"), ("All files", "*.*")]
        )
        if filename:
            self.cert_var.set(filename)
    
    def toggle_ssl(self):
        """Toggle SSL-spezifische Felder"""
        # Hier könnten wir SSL-spezifische Felder aktivieren/deaktivieren
        pass
    
    def save_and_start(self):
        """Speichere Konfiguration und starte"""
        if self.save_config():
            self.result = True
            self.root.destroy()
    
    def start_without_save(self):
        """Starte ohne zu speichern"""
        self.update_config()
        self.result = True
        self.root.destroy()
    
    def cancel(self):
        """Abbrechen"""
        self.result = False
        self.root.destroy()
    
    def update_config(self):
        """Aktualisiere Konfiguration mit GUI-Werten"""
        try:
            self.config["data_directory"] = self.data_var.get()
            self.config["ssl_enabled"] = self.ssl_var.get()
            self.config["ssl_cert_path"] = self.cert_var.get()
            self.config["host"] = self.host_var.get()
            self.config["port"] = int(self.port_var.get())
            self.config["auto_open_browser"] = self.browser_var.get()
            self.config["domain"] = self.domain_var.get()
        except ValueError:
            messagebox.showerror("Fehler", "Port muss eine gültige Zahl sein!")
            return False
        return True
    
    def save_config(self):
        """Speichere Konfiguration"""
        if not self.update_config():
            return False
        
        self.config_manager.config = self.config
        if self.config_manager.save_config():
            messagebox.showinfo("Erfolg", "Konfiguration gespeichert!")
            return True
        else:
            messagebox.showerror("Fehler", "Konfiguration konnte nicht gespeichert werden!")
            return False

def print_banner():
    """Zeigt Banner"""
    print("🎉" + "="*60 + "🎉")
    print("           HOCHZEITSPLANER WEB-ANWENDUNG")
    print("              SSL-Version mit Konfiguration")
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
    
    return start_port  # Fallback

def create_ssl_context(cert_path=None, key_path=None):
    """Erstellt SSL-Kontext"""
    if not key_path or not Path(key_path).exists():
        print("⚠️  SSL Private Key nicht gefunden, verwende HTTP")
        return None
    
    try:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        
        if cert_path and Path(cert_path).exists():
            # Mit Zertifikat
            context.load_cert_chain(cert_path, key_path)
            print("✅ SSL-Zertifikat geladen")
        else:
            # Self-signed für Entwicklung
            print("⚠️  Kein SSL-Zertifikat angegeben, erstelle selbstsigniertes Zertifikat...")
            # Hier könnten wir ein selbstsigniertes Zertifikat erstellen
            return None
        
        return context
    except Exception as e:
        print(f"❌ SSL-Fehler: {e}")
        return None

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
    config_manager = HochzeitsplanerConfig()
    
    # GUI für Ersteinrichtung oder bei --config
    show_config = len(sys.argv) > 1 and '--config' in sys.argv
    if show_config or not config_manager.config_file.exists():
        print("🔧 Öffne Konfigurationsdialog...")
        gui = ConfigGUI(config_manager)
        if not gui.show_config_dialog():
            print("❌ Konfiguration abgebrochen")
            return
    
    config = config_manager.config
    
    # Datenverzeichnis einrichten
    print(f"📁 Richte Datenverzeichnis ein: {config['data_directory']}")
    data_path = config_manager.setup_data_directory()
    
    # Umgebung vorbereiten
    os.environ['DATA_PATH'] = str(data_path)
    os.environ['FLASK_ENV'] = 'production'
    
    # Port finden
    port = find_available_port(config.get('port', 8080))
    if port != config.get('port', 8080):
        print(f"⚠️  Port {config['port']} belegt, verwende Port {port}")
    
    # SSL-Kontext erstellen
    ssl_context = None
    protocol = "http"
    if config.get('ssl_enabled', False):
        ssl_context = create_ssl_context(
            config.get('ssl_cert_path'),
            config.get('ssl_key_path')
        )
        if ssl_context:
            protocol = "https"
    
    # URL bestimmen
    host = config.get('host', '127.0.0.1')
    if config.get('domain') and ssl_context:
        url = f"{protocol}://{config['domain']}:{port}"
    else:
        url = f"{protocol}://{host}:{port}"
    
    print(f"🚀 Starte Server...")
    print(f"📂 Datenverzeichnis: {data_path}")
    print(f"🌐 Server-URL: {url}")
    if ssl_context:
        print("🔒 SSL aktiviert")
    
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
        print("\n📋 Drücken Sie Enter zum Beenden...")
        input()

if __name__ == '__main__':
    main()

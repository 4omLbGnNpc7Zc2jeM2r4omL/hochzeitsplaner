#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Hochzeitsplaner - Konfigurationsmanager
Verwaltet die initiale Konfiguration und Datenbankpfad-Einstellungen
"""

import os
import json
import sys
import datetime
from pathlib import Path

class ConfigManager:
    def __init__(self):
        """Initialisiert den Konfigurationsmanager"""
        # Bestimme das Konfigurationsverzeichnis
        if getattr(sys, 'frozen', False):
            # Wenn als .exe ausgeführt (PyInstaller)
            self.app_dir = os.path.dirname(sys.executable)
        else:
            # Normal als Python-Script
            self.app_dir = os.path.dirname(os.path.abspath(__file__))
        
        self.config_file = os.path.join(self.app_dir, 'app_config.json')
        self.config = self.load_config()

    def load_config(self):
        """Lädt die Anwendungskonfiguration"""
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Fehler beim Laden der Konfiguration: {e}")
                return {}
        return {}

    def save_config(self):
        """Speichert die Anwendungskonfiguration"""
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"Fehler beim Speichern der Konfiguration: {e}")
            return False

    def is_first_run(self):
        """Prüft, ob dies der erste Start der Anwendung ist"""
        return 'database_path' not in self.config or not self.config.get('setup_completed', False)

    def get_database_path(self):
        """Gibt den konfigurierten Datenbankpfad zurück"""
        if 'database_path' in self.config:
            return self.config['database_path']
        
        # Fallback: Standard-Datenverzeichnis
        return os.path.join(self.app_dir, 'data')

    def configure_database_path(self):
        """Interaktive Konfiguration des Datenbankpfads"""
        print("\n" + "="*60)
        print("🎉 WILLKOMMEN BEIM HOCHZEITSPLANER! 🎉")
        print("="*60)
        print("\nDies ist der erste Start der Anwendung.")
        print("Bitte konfigurieren Sie den Pfad für Ihre Hochzeitsdaten.\n")
        
        # Standard-Pfad vorschlagen
        default_path = os.path.join(self.app_dir, 'data')
        
        print(f"Standard-Datenverzeichnis: {default_path}")
        print("\nOptionen:")
        print("1. Standard-Pfad verwenden (empfohlen)")
        print("2. Benutzerdefinierten Pfad angeben")
        print("3. Vorhandenes Datenverzeichnis auswählen")
        
        while True:
            try:
                choice = input("\nIhre Wahl (1-3): ").strip()
                
                if choice == '1':
                    db_path = default_path
                    break
                elif choice == '2':
                    db_path = input("Geben Sie den gewünschten Datenpfad ein: ").strip()
                    if db_path:
                        db_path = os.path.abspath(db_path)
                        break
                    else:
                        print("❌ Ungültiger Pfad!")
                elif choice == '3':
                    db_path = input("Geben Sie den Pfad zum vorhandenen Datenverzeichnis ein: ").strip()
                    if db_path and os.path.exists(db_path):
                        db_path = os.path.abspath(db_path)
                        break
                    else:
                        print("❌ Verzeichnis existiert nicht!")
                else:
                    print("❌ Ungültige Auswahl! Bitte wählen Sie 1, 2 oder 3.")
            except KeyboardInterrupt:
                print("\n\nSetup abgebrochen.")
                sys.exit(1)
        
        # Verzeichnis erstellen falls nötig
        try:
            os.makedirs(db_path, exist_ok=True)
            print(f"\n✅ Datenverzeichnis konfiguriert: {db_path}")
        except Exception as e:
            print(f"\n❌ Fehler beim Erstellen des Verzeichnisses: {e}")
            return None
        
        # Konfiguration speichern
        self.config['database_path'] = db_path
        self.config['setup_completed'] = True
        self.config['created_at'] = str(datetime.datetime.now())
        
        if self.save_config():
            print("✅ Konfiguration gespeichert!")
            return db_path
        else:
            print("❌ Fehler beim Speichern der Konfiguration!")
            return None

    def reset_configuration(self):
        """Setzt die Konfiguration zurück (für Debugging)"""
        if os.path.exists(self.config_file):
            try:
                os.remove(self.config_file)
                print("✅ Konfiguration zurückgesetzt")
                return True
            except Exception as e:
                print(f"❌ Fehler beim Zurücksetzen: {e}")
                return False
        return True

    def get_app_info(self):
        """Gibt Informationen über die Anwendung zurück"""
        return {
            'app_dir': self.app_dir,
            'config_file': self.config_file,
            'database_path': self.get_database_path(),
            'is_first_run': self.is_first_run(),
            'config': self.config
        }
    
    # Spotify Configuration
    def get_spotify_client_id(self):
        """Holt die Spotify Client ID"""
        return self.config.get('spotify', {}).get('client_id', '')
    
    def get_spotify_client_secret(self):
        """Holt das Spotify Client Secret"""
        return self.config.get('spotify', {}).get('client_secret', '')
    
    def get_spotify_enabled(self):
        """Prüft ob Spotify Integration aktiviert ist"""
        return self.config.get('spotify', {}).get('enabled', False)
    
    def set_spotify_config(self, client_id, client_secret, enabled=True):
        """Setzt die Spotify Konfiguration"""
        if 'spotify' not in self.config:
            self.config['spotify'] = {}
        
        self.config['spotify']['client_id'] = client_id
        self.config['spotify']['client_secret'] = client_secret
        self.config['spotify']['enabled'] = enabled
        
        return self.save_config()

# Für direkten Import
def get_data_directory():
    """Einfache Funktion zum Abrufen des Datenverzeichnisses"""
    import datetime
    
    config_manager = ConfigManager()
    
    if config_manager.is_first_run():
        # Interaktive Konfiguration nur wenn Terminal verfügbar
        if sys.stdin.isatty():
            db_path = config_manager.configure_database_path()
            if db_path:
                return db_path
        
        # Fallback: Standard-Pfad
        db_path = config_manager.get_database_path()
        os.makedirs(db_path, exist_ok=True)
        
        # Automatische Konfiguration für Non-Interactive Mode
        config_manager.config['database_path'] = db_path
        config_manager.config['setup_completed'] = True
        config_manager.config['created_at'] = str(datetime.datetime.now())
        config_manager.save_config()
        
        return db_path
    
    return config_manager.get_database_path()

if __name__ == "__main__":
    """Direkter Aufruf für Konfiguration"""
    import datetime
    
    config_manager = ConfigManager()
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "--reset":
            config_manager.reset_configuration()
            print("Konfiguration zurückgesetzt. Starten Sie die Anwendung neu.")
            sys.exit(0)
        elif sys.argv[1] == "--info":
            info = config_manager.get_app_info()
            print("\n=== ANWENDUNGS-INFORMATIONEN ===")
            for key, value in info.items():
                print(f"{key}: {value}")
            sys.exit(0)
    
    if config_manager.is_first_run():
        db_path = config_manager.configure_database_path()
        if db_path:
            print(f"\n🎊 Setup abgeschlossen! 🎊")
            print(f"Starten Sie jetzt die Anwendung mit: python app.py")
        else:
            print("\n❌ Setup fehlgeschlagen!")
            sys.exit(1)
    else:
        print("\n✅ Anwendung bereits konfiguriert!")
        print(f"Datenverzeichnis: {config_manager.get_database_path()}")
        print("Verwenden Sie --reset um die Konfiguration zurückzusetzen.")

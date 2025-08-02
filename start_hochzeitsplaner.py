#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Hochzeitsplaner - Haupt-Startskript
Führt die initiale Konfiguration durch und startet dann die Hauptanwendung
"""

import sys
import os
import subprocess
from pathlib import Path

def main():
    """Hauptfunktion für den Anwendungsstart"""
    
    # Konfigurationsmanager laden
    try:
        from config_manager import ConfigManager
        
        config_manager = ConfigManager()
        
        # Bei erstem Start: Konfiguration durchführen
        if config_manager.is_first_run():
            print("\n🎉 Willkommen beim Hochzeitsplaner! 🎉")
            print("Führe initiale Konfiguration durch...\n")
            
            # Konfiguration nur wenn interaktives Terminal
            if sys.stdin.isatty():
                db_path = config_manager.configure_database_path()
                if not db_path:
                    print("❌ Konfiguration fehlgeschlagen!")
                    input("Drücken Sie Enter zum Beenden...")
                    return 1
                
                print("\n✅ Konfiguration abgeschlossen!")
                print("Starte Hochzeitsplaner...")
            else:
                print("⚠️ Nicht-interaktiver Modus: Verwende Standard-Konfiguration")
                from config_manager import get_data_directory
                get_data_directory()  # Automatische Konfiguration
        
    except ImportError:
        print("⚠️ Konfigurationsmanager nicht verfügbar - verwende Standard-Einstellungen")
    
    # Hauptanwendung starten
    try:
        # Importiere und starte die app.py direkt
        import app
        
        # Prüfe kritische Abhängigkeiten
        if not app.data_manager:
            print("❌ KRITISCHER FEHLER: DataManager konnte nicht initialisiert werden!")
            return 1
        
        # Verwende die SSL-Funktion mit detaillierter Logging
        return app.start_server_with_ssl()
        
    except KeyboardInterrupt:
        print("\n🛑 Server wird beendet...")
        # E-Mail-Checking stoppen beim Beenden
        if hasattr(app, 'email_manager') and app.email_manager and app.EMAIL_AVAILABLE:
            app.email_manager.stop_email_checking()
        print("👋 Hochzeitsplaner beendet. Auf Wiedersehen!")
        return 0
    except Exception as e:
        print(f"\n❌ Fehler beim Starten der Anwendung: {e}")
        input("Drücken Sie Enter zum Beenden...")
        return 1

if __name__ == "__main__":
    sys.exit(main())

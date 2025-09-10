#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Spotify Setup für Hochzeitsplaner
Hilft beim Einrichten der Spotify API Credentials
"""

import os
import sys
from config_manager import ConfigManager

def setup_spotify():
    """Setup-Wizard für Spotify Integration"""
    print("\n🎵 Spotify Integration Setup für Hochzeitsplaner 🎵")
    print("=" * 50)
    
    print("\nUm die Spotify-Integration zu nutzen, benötigen Sie:")
    print("1. Ein Spotify Developer Account (kostenlos)")
    print("2. Eine registrierte App auf https://developer.spotify.com/dashboard")
    print("3. Client ID und Client Secret Ihrer App")
    
    print("\nAnleitung:")
    print("1. Gehen Sie zu: https://developer.spotify.com/dashboard")
    print("2. Loggen Sie sich mit Ihrem Spotify Account ein")
    print("3. Klicken Sie auf 'Create an App'")
    print("4. Geben Sie einen Namen ein (z.B. 'Hochzeitsplaner')")
    print("5. Kopieren Sie Client ID und Client Secret")
    
    print("\n" + "-" * 50)
    
    config = ConfigManager()
    
    # Aktuelle Konfiguration anzeigen
    if config.get_spotify_enabled():
        print(f"✅ Spotify ist bereits konfiguriert")
        print(f"Client ID: {config.get_spotify_client_id()[:8]}...")
        
        update = input("\nMöchten Sie die Konfiguration aktualisieren? (j/n): ").lower()
        if update != 'j':
            return
    
    # Client ID eingeben
    while True:
        client_id = input("\nSpotify Client ID eingeben: ").strip()
        if len(client_id) >= 32:
            break
        print("❌ Client ID zu kurz. Bitte überprüfen Sie Ihre Eingabe.")
    
    # Client Secret eingeben
    while True:
        client_secret = input("Spotify Client Secret eingeben: ").strip()
        if len(client_secret) >= 32:
            break
        print("❌ Client Secret zu kurz. Bitte überprüfen Sie Ihre Eingabe.")
    
    # Konfiguration speichern
    if config.set_spotify_config(client_id, client_secret, True):
        print("\n✅ Spotify-Konfiguration erfolgreich gespeichert!")
        
        # Test der API
        print("\n🔍 Teste Verbindung zur Spotify API...")
        test_spotify_connection(client_id, client_secret)
        
    else:
        print("\n❌ Fehler beim Speichern der Konfiguration!")

def test_spotify_connection(client_id, client_secret):
    """Testet die Verbindung zur Spotify API"""
    try:
        # Temporäre Spotify Manager Instanz
        import sys
        import os
        sys.path.append(os.path.dirname(__file__))
        
        from spotify_manager import SpotifyManager
        
        # Temporär die Credentials setzen
        spotify = SpotifyManager()
        spotify.client_id = client_id
        spotify.client_secret = client_secret
        
        # Token abrufen
        token = spotify.get_access_token()
        
        if token:
            print("✅ Verbindung zur Spotify API erfolgreich!")
            
            # Test-Suche
            result = spotify.search_tracks("test", limit=1)
            if result.get('success') and result.get('tracks'):
                print("✅ Spotify-Suche funktioniert!")
                print(f"✨ Gefunden: {result['tracks'][0]['name']} von {result['tracks'][0]['artist']}")
            else:
                print("⚠️ Spotify-Suche funktioniert nicht optimal")
                
        else:
            print("❌ Verbindung zur Spotify API fehlgeschlagen!")
            print("Bitte überprüfen Sie Ihre Client ID und Secret.")
            
    except ImportError:
        print("⚠️ Spotify Manager nicht verfügbar - bitte installieren Sie 'requests'")
    except Exception as e:
        print(f"❌ Fehler beim Testen: {e}")

def disable_spotify():
    """Deaktiviert die Spotify Integration"""
    config = ConfigManager()
    
    if not config.get_spotify_enabled():
        print("ℹ️ Spotify Integration ist bereits deaktiviert.")
        return
    
    config.set_spotify_config("", "", False)
    print("✅ Spotify Integration deaktiviert.")

def show_status():
    """Zeigt den aktuellen Status der Spotify Integration"""
    config = ConfigManager()
    
    print("\n🎵 Spotify Integration Status:")
    print("-" * 30)
    
    if config.get_spotify_enabled():
        client_id = config.get_spotify_client_id()
        print(f"Status: ✅ Aktiviert")
        print(f"Client ID: {client_id[:8]}...{client_id[-4:] if len(client_id) > 12 else client_id}")
        
        # Test der aktuellen Konfiguration
        try:
            from spotify_manager import SpotifyManager
            spotify = SpotifyManager()
            if spotify.get_access_token():
                print("API-Test: ✅ Erfolgreich")
            else:
                print("API-Test: ❌ Fehlgeschlagen")
        except:
            print("API-Test: ⚠️ Nicht verfügbar")
    else:
        print("Status: ❌ Nicht konfiguriert")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
        
        if command == "setup":
            setup_spotify()
        elif command == "disable":
            disable_spotify()
        elif command == "status":
            show_status()
        elif command == "test":
            config = ConfigManager()
            if config.get_spotify_enabled():
                test_spotify_connection(
                    config.get_spotify_client_id(),
                    config.get_spotify_client_secret()
                )
            else:
                print("❌ Spotify nicht konfiguriert. Verwenden Sie 'setup' zuerst.")
        else:
            print("Verfügbare Befehle: setup, disable, status, test")
    else:
        setup_spotify()

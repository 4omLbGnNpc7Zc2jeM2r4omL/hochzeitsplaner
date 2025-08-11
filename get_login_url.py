#!/usr/bin/env python3
"""
Login-URL Generator für Nadja Schumacher
"""

import sys
import os
from urllib.parse import urlencode

# Zum Hochzeitsplaner-Verzeichnis wechseln
os.chdir('d:/Hochzeitsplaner')
sys.path.append('.')

# App importieren
from app import app, data_manager

def get_login_url_for_guest(guest_id, base_url="https://pascalundkäthe-heiraten.de"):
    """Generiert Login-URL für einen Gast"""
    try:
        # Gast-Daten aus der Datenbank laden
        guest_data = data_manager.get_guest_by_id(guest_id)
        
        if not guest_data:
            print(f"Fehler: Gast mit ID {guest_id} nicht gefunden")
            return None
            
        guest_code = guest_data.get('guest_code')
        guest_password = guest_data.get('guest_password')
        
        if not guest_code or not guest_password:
            print(f"Fehler: Guest-Code oder Password fehlt für Gast {guest_id}")
            return None
            
        # Login-URL mit Parametern erstellen
        params = {
            'guest_code': guest_code,
            'password': guest_password
        }
        query_string = urlencode(params)
        login_url = f"{base_url}/login?{query_string}"
        
        return {
            'guest_data': guest_data,
            'guest_code': guest_code,
            'guest_password': guest_password,
            'login_url': login_url
        }
        
    except Exception as e:
        print(f"Fehler: {e}")
        return None

if __name__ == "__main__":
    # Gast-ID für Nadja Schumacher
    guest_id = 52
    
    result = get_login_url_for_guest(guest_id)
    
    if result:
        guest_data = result['guest_data']
        print("=" * 60)
        print("LOGIN-URL FUR NADJA SCHUMACHER")
        print("=" * 60)
        print(f"Name: {guest_data.get('Vorname', '')} {guest_data.get('Nachname', '')}")
        print(f"Guest-Code: {result['guest_code']}")
        print(f"Password: {result['guest_password']}")
        print("-" * 60)
        print("LOGIN-URL:")
        print(result['login_url'])
        print("-" * 60)
        print("Diese URL kann direkt an Nadja Schumacher gesendet werden.")
        print("Sie wird automatisch eingeloggt ohne manuelle Eingabe.")
        print("=" * 60)

#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
VAPID-Schlüssel Generator für Push-Benachrichtigungen
Generiert ein neues VAPID-Schlüsselpaar für Web Push Notifications
"""

import json
import os
from pywebpush import WebPushException

def generate_vapid_keys():
    """Generiere ein neues VAPID-Schlüsselpaar"""
    try:
        # VAPID-Schlüssel generieren
        from pywebpush import webpush
        import ecdsa
        import base64
        
        # Private Key generieren
        private_key = ecdsa.SigningKey.generate(curve=ecdsa.NIST256p)
        private_key_der = private_key.to_der()
        private_key_b64 = base64.urlsafe_b64encode(private_key_der).decode('utf-8').rstrip('=')
        
        # Public Key ableiten
        public_key = private_key.get_verifying_key()
        public_key_der = public_key.to_der()
        public_key_b64 = base64.urlsafe_b64encode(public_key_der).decode('utf-8').rstrip('=')
        
        return {
            'private_key': private_key_b64,
            'public_key': public_key_b64
        }
        
    except ImportError:
        print("⚠️ pywebpush oder ecdsa nicht verfügbar")
        print("Installiere mit: pip install pywebpush ecdsa")
        return None
    except Exception as e:
        print(f"❌ Fehler beim Generieren der VAPID-Schlüssel: {e}")
        return None

def update_auth_config(vapid_keys):
    """Aktualisiere auth_config.json mit neuen VAPID-Schlüsseln"""
    config_path = 'auth_config.json'
    
    try:
        # Bestehende Konfiguration laden
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        # VAPID-Schlüssel aktualisieren
        if 'auth' not in config:
            config['auth'] = {}
        
        config['auth']['vapid_keys'] = {
            'public_key': vapid_keys['public_key'],
            'private_key': vapid_keys['private_key'],
            'email': config['auth'].get('vapid_keys', {}).get('email', 'mailto:hochzeitsplaner@schumacher-it-consulting.de')
        }
        
        # Backup erstellen
        backup_path = f"{config_path}.backup"
        with open(backup_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        print(f"✅ Backup erstellt: {backup_path}")
        
        # Neue Konfiguration speichern
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        print(f"✅ VAPID-Schlüssel in {config_path} aktualisiert")
        return True
        
    except Exception as e:
        print(f"❌ Fehler beim Aktualisieren der Konfiguration: {e}")
        return False

def main():
    print("🔑 VAPID-Schlüssel Generator für Hochzeitsplaner")
    print("=" * 50)
    
    # VAPID-Schlüssel generieren
    print("🔄 Generiere VAPID-Schlüsselpaar...")
    vapid_keys = generate_vapid_keys()
    
    if not vapid_keys:
        print("❌ Konnte keine VAPID-Schlüssel generieren")
        return False
    
    print("✅ VAPID-Schlüssel erfolgreich generiert")
    print(f"📋 Public Key (ersten 20 Zeichen): {vapid_keys['public_key'][:20]}...")
    print(f"🔒 Private Key (ersten 20 Zeichen): {vapid_keys['private_key'][:20]}...")
    
    # Konfiguration aktualisieren
    print("\n🔄 Aktualisiere auth_config.json...")
    if update_auth_config(vapid_keys):
        print("\n🎉 Setup erfolgreich abgeschlossen!")
        print("\n📋 Nächste Schritte:")
        print("1. Server neu starten")
        print("2. Als Admin einloggen")
        print("3. Push-Benachrichtigungen in den Einstellungen aktivieren")
        print("4. Test-RSVP über Gast-Dashboard eingeben")
        print("5. Push-Benachrichtigung sollte erscheinen")
        return True
    else:
        print("❌ Setup fehlgeschlagen")
        return False

if __name__ == "__main__":
    main()

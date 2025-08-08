#!/usr/bin/env python3
"""
Schnelle Admin-Erstellung
"""

import sqlite_datenmanager
import sqlite3
import hashlib

def quick_create_admin(username, password):
    """Erstellt schnell einen Admin-Benutzer"""
    
    # DataManager initialisieren
    dm = sqlite_datenmanager.SQLiteHochzeitsDatenManager()
    
    # Passwort hashen
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    # Admin erstellen
    conn = sqlite3.connect('data/hochzeit.db')
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            INSERT INTO admin_users (username, password_hash, is_active)
            VALUES (?, ?, ?)
        """, (username, password_hash, 1))
        
        conn.commit()
        print(f"✅ Admin '{username}' erfolgreich erstellt!")
        
    except sqlite3.IntegrityError:
        print(f"❌ Admin '{username}' existiert bereits!")
    
    finally:
        conn.close()

# Beispiel-Verwendung:
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) != 3:
        print("Verwendung: python quick_admin.py <username> <password>")
        print("Beispiel: python quick_admin.py superadmin MeinSicheresPasswort123")
        sys.exit(1)
    
    username = sys.argv[1]
    password = sys.argv[2]
    
    quick_create_admin(username, password)

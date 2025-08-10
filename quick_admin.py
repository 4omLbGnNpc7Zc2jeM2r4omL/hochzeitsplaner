#!/usr/bin/env python3
"""
Schnelle Admin-Erstellung - Standalone Version
Funktioniert unabhängig von kompilierten .exe Dateien
"""

import sqlite3
import hashlib
import os

def ensure_database_structure():
    """Stellt sicher, dass die Datenbank und Tabellen existieren"""
    
    # Datenbank-Pfad
    db_path = 'data/hochzeit.db'
    
    # Data-Ordner erstellen falls nicht vorhanden
    os.makedirs('data', exist_ok=True)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Admin-Users Tabelle erstellen falls nicht vorhanden
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS admin_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP,
                two_factor_secret TEXT,
                two_factor_enabled INTEGER DEFAULT 0
            )
        """)
        
        # Admin-2FA-Sessions Tabelle erstellen falls nicht vorhanden
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS admin_2fa_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_token TEXT UNIQUE NOT NULL,
                admin_id INTEGER NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (admin_id) REFERENCES admin_users (id)
            )
        """)
        
        # Admin-Trusted-Devices Tabelle erstellen falls nicht vorhanden
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS admin_trusted_devices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_id INTEGER NOT NULL,
                device_fingerprint TEXT NOT NULL,
                device_name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (admin_id) REFERENCES admin_users (id),
                UNIQUE(admin_id, device_fingerprint)
            )
        """)
        
        conn.commit()
        print("✅ Datenbankstruktur überprüft und bereit")
        
    except Exception as e:
        print(f"❌ Fehler beim Erstellen der Datenbankstruktur: {e}")
        raise
    
    finally:
        conn.close()

def quick_create_admin(username, password):
    """Erstellt schnell einen Admin-Benutzer"""
    
    # Datenbankstruktur sicherstellen
    ensure_database_structure()
    
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
        print("ℹ️  2FA ist standardmäßig deaktiviert und kann in den Einstellungen aktiviert werden.")
        
    except sqlite3.IntegrityError:
        print(f"❌ Admin '{username}' existiert bereits!")
    
    except Exception as e:
        print(f"❌ Fehler beim Erstellen des Admins: {e}")
    
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

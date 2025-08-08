#!/usr/bin/env python3
"""
Admin-Benutzer-Management für 2FA-System
"""

import sqlite_datenmanager
import sqlite3
import hashlib
import getpass

def create_admin_user():
    """Erstellt einen neuen Admin-Benutzer interaktiv"""
    print("🔧 Admin-Benutzer erstellen")
    print("=" * 40)
    
    # DataManager initialisieren
    dm = sqlite_datenmanager.SQLiteHochzeitsDatenManager()
    
    # Benutzereingaben
    username = input("Benutzername: ").strip()
    if not username:
        print("❌ Benutzername darf nicht leer sein!")
        return
    
    # Prüfen ob Benutzer bereits existiert
    conn = sqlite3.connect('data/hochzeit.db')
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM admin_users WHERE username = ?", (username,))
    if cursor.fetchone()[0] > 0:
        print(f"❌ Benutzer '{username}' existiert bereits!")
        conn.close()
        return
    
    # Passwort eingeben (versteckt)
    password = getpass.getpass("Passwort: ")
    password_confirm = getpass.getpass("Passwort bestätigen: ")
    
    if password != password_confirm:
        print("❌ Passwörter stimmen nicht überein!")
        conn.close()
        return
    
    if len(password) < 6:
        print("❌ Passwort muss mindestens 6 Zeichen lang sein!")
        conn.close()
        return
    
    # Passwort hashen
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    # Admin-Benutzer erstellen
    cursor.execute("""
        INSERT INTO admin_users (username, password_hash, is_active)
        VALUES (?, ?, ?)
    """, (username, password_hash, 1))
    
    conn.commit()
    conn.close()
    
    print(f"✅ Admin-Benutzer '{username}' erfolgreich erstellt!")
    print("💡 Der Benutzer kann sich jetzt anmelden und 2FA einrichten.")

def list_admin_users():
    """Zeigt alle Admin-Benutzer an"""
    print("👥 Admin-Benutzer-Übersicht")
    print("=" * 40)
    
    conn = sqlite3.connect('data/hochzeit.db')
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, username, is_2fa_enabled, is_active, created_at 
        FROM admin_users 
        ORDER BY created_at
    """)
    
    users = cursor.fetchall()
    conn.close()
    
    if not users:
        print("Keine Admin-Benutzer gefunden.")
        return
    
    print(f"{'ID':<4} {'Benutzername':<20} {'2FA':<5} {'Aktiv':<6} {'Erstellt':<20}")
    print("-" * 60)
    
    for user in users:
        user_id, username, is_2fa, is_active, created_at = user
        status_2fa = "✅" if is_2fa else "❌"
        status_active = "✅" if is_active else "❌"
        created_date = created_at[:10] if created_at else "Unbekannt"
        
        print(f"{user_id:<4} {username:<20} {status_2fa:<5} {status_active:<6} {created_date:<20}")

def change_admin_password():
    """Ändert das Passwort eines Admin-Benutzers"""
    print("🔑 Admin-Passwort ändern")
    print("=" * 40)
    
    # Benutzer auflisten
    list_admin_users()
    print()
    
    username = input("Benutzername: ").strip()
    if not username:
        print("❌ Benutzername darf nicht leer sein!")
        return
    
    conn = sqlite3.connect('data/hochzeit.db')
    cursor = conn.cursor()
    
    # Prüfen ob Benutzer existiert
    cursor.execute("SELECT id FROM admin_users WHERE username = ? AND is_active = 1", (username,))
    user = cursor.fetchone()
    if not user:
        print(f"❌ Aktiver Benutzer '{username}' nicht gefunden!")
        conn.close()
        return
    
    # Neues Passwort eingeben
    new_password = getpass.getpass("Neues Passwort: ")
    password_confirm = getpass.getpass("Passwort bestätigen: ")
    
    if new_password != password_confirm:
        print("❌ Passwörter stimmen nicht überein!")
        conn.close()
        return
    
    if len(new_password) < 6:
        print("❌ Passwort muss mindestens 6 Zeichen lang sein!")
        conn.close()
        return
    
    # Passwort hashen und aktualisieren
    password_hash = hashlib.sha256(new_password.encode()).hexdigest()
    
    cursor.execute("""
        UPDATE admin_users 
        SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
        WHERE username = ?
    """, (password_hash, username))
    
    conn.commit()
    conn.close()
    
    print(f"✅ Passwort für '{username}' erfolgreich geändert!")

def disable_admin_user():
    """Deaktiviert einen Admin-Benutzer"""
    print("🚫 Admin-Benutzer deaktivieren")
    print("=" * 40)
    
    # Benutzer auflisten
    list_admin_users()
    print()
    
    username = input("Benutzername zum Deaktivieren: ").strip()
    if not username:
        print("❌ Benutzername darf nicht leer sein!")
        return
    
    if username == 'admin':
        confirm = input("⚠️ Warnung: Standard-Admin deaktivieren? (ja/nein): ")
        if confirm.lower() != 'ja':
            print("Abgebrochen.")
            return
    
    conn = sqlite3.connect('data/hochzeit.db')
    cursor = conn.cursor()
    
    cursor.execute("""
        UPDATE admin_users 
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE username = ?
    """, (username,))
    
    if cursor.rowcount > 0:
        conn.commit()
        print(f"✅ Benutzer '{username}' deaktiviert!")
    else:
        print(f"❌ Benutzer '{username}' nicht gefunden!")
    
    conn.close()

def main():
    """Hauptmenü für Admin-Verwaltung"""
    while True:
        print("\n" + "="*50)
        print("🔐 2FA Admin-Benutzer-Verwaltung")
        print("="*50)
        print("1. Neuen Admin-Benutzer erstellen")
        print("2. Admin-Benutzer auflisten")
        print("3. Admin-Passwort ändern")
        print("4. Admin-Benutzer deaktivieren")
        print("5. Vertrauenswürdige Geräte verwalten")
        print("6. Beenden")
        print()
        
        choice = input("Wählen Sie eine Option (1-6): ").strip()
        
        if choice == '1':
            create_admin_user()
        elif choice == '2':
            list_admin_users()
        elif choice == '3':
            change_admin_password()
        elif choice == '4':
            disable_admin_user()
        elif choice == '5':
            manage_trusted_devices()
        elif choice == '6':
            print("👋 Auf Wiedersehen!")
            break
        else:
            print("❌ Ungültige Auswahl!")

def manage_trusted_devices():
    """Vertrauenswürdige Geräte verwalten"""
    while True:
        print("\n" + "="*40)
        print("🛡️ Vertrauenswürdige Geräte")
        print("="*40)
        print("1. Alle vertrauenswürdigen Geräte anzeigen")
        print("2. Geräte für bestimmten Admin anzeigen")
        print("3. Vertrauenswürdiges Gerät entfernen")
        print("4. Abgelaufene Geräte bereinigen")
        print("5. Zurück zum Hauptmenü")
        print()
        
        choice = input("Wählen Sie eine Option (1-5): ").strip()
        
        if choice == '1':
            list_all_trusted_devices()
        elif choice == '2':
            list_trusted_devices_for_admin()
        elif choice == '3':
            remove_trusted_device_cli()
        elif choice == '4':
            cleanup_expired_devices()
        elif choice == '5':
            break
        else:
            print("❌ Ungültige Auswahl!")

def list_all_trusted_devices():
    """Zeigt alle vertrauenswürdigen Geräte an"""
    print("🛡️ Alle vertrauenswürdigen Geräte")
    print("=" * 60)
    
    conn = sqlite3.connect('data/hochzeit.db')
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT td.id, au.username, td.device_name, td.ip_address, 
               td.expires_at, td.last_used, td.created_at,
               (td.expires_at < datetime('now')) as is_expired
        FROM admin_trusted_devices td
        JOIN admin_users au ON td.admin_id = au.id
        ORDER BY td.created_at DESC
    """)
    
    devices = cursor.fetchall()
    conn.close()
    
    if not devices:
        print("Keine vertrauenswürdigen Geräte gefunden.")
        return
    
    print(f"{'ID':<4} {'Admin':<15} {'Gerät':<25} {'IP-Adresse':<15} {'Status':<10} {'Erstellt':<12}")
    print("-" * 90)
    
    for device in devices:
        device_id, username, device_name, ip_address, expires_at, last_used, created_at, is_expired = device
        
        status = "❌ Abgelaufen" if is_expired else "✅ Aktiv"
        created_date = created_at[:10] if created_at else "Unbekannt"
        device_name_short = (device_name[:22] + "...") if device_name and len(device_name) > 25 else (device_name or "Unbekannt")
        ip_short = ip_address or "Unbekannt"
        
        print(f"{device_id:<4} {username:<15} {device_name_short:<25} {ip_short:<15} {status:<10} {created_date:<12}")

def list_trusted_devices_for_admin():
    """Zeigt vertrauenswürdige Geräte für einen bestimmten Admin"""
    print("🛡️ Vertrauenswürdige Geräte für Admin")
    print("=" * 40)
    
    # Admin auflisten
    list_admin_users()
    print()
    
    username = input("Admin-Benutzername: ").strip()
    if not username:
        print("❌ Benutzername darf nicht leer sein!")
        return
    
    # DataManager initialisieren
    dm = sqlite_datenmanager.SQLiteHochzeitsDatenManager()
    
    # Admin-ID ermitteln
    conn = sqlite3.connect('data/hochzeit.db')
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM admin_users WHERE username = ? AND is_active = 1", (username,))
    admin_result = cursor.fetchone()
    
    if not admin_result:
        print(f"❌ Aktiver Admin '{username}' nicht gefunden!")
        conn.close()
        return
    
    admin_id = admin_result[0]
    conn.close()
    
    # Geräte für diesen Admin holen
    devices = dm.get_trusted_devices(admin_id)
    
    if not devices:
        print(f"Keine vertrauenswürdigen Geräte für '{username}' gefunden.")
        return
    
    print(f"\nVertrauenswürdige Geräte für '{username}':")
    print("-" * 60)
    
    for device in devices:
        from datetime import datetime
        try:
            expires_dt = datetime.fromisoformat(device['expires_at'])
            is_expired = expires_dt < datetime.now()
            expires_formatted = expires_dt.strftime('%d.%m.%Y %H:%M')
            
            last_used_dt = datetime.fromisoformat(device['last_used'])
            last_used_formatted = last_used_dt.strftime('%d.%m.%Y %H:%M')
        except:
            is_expired = False
            expires_formatted = 'Unbekannt'
            last_used_formatted = 'Unbekannt'
        
        status = "❌ Abgelaufen" if is_expired else "✅ Aktiv"
        
        print(f"ID: {device['id']}")
        print(f"Gerät: {device['device_name'] or 'Unbekannt'}")
        print(f"IP-Adresse: {device['ip_address'] or 'Unbekannt'}")
        print(f"Status: {status}")
        print(f"Gültig bis: {expires_formatted}")
        print(f"Letzter Zugriff: {last_used_formatted}")
        print("-" * 40)

def remove_trusted_device_cli():
    """Entfernt ein vertrauenswürdiges Gerät über CLI"""
    print("🗑️ Vertrauenswürdiges Gerät entfernen")
    print("=" * 40)
    
    # Alle Geräte anzeigen
    list_all_trusted_devices()
    print()
    
    try:
        device_id = int(input("Geräte-ID zum Entfernen: ").strip())
    except ValueError:
        print("❌ Ungültige Geräte-ID!")
        return
    
    # DataManager initialisieren
    dm = sqlite_datenmanager.SQLiteHochzeitsDatenManager()
    
    # Gerät-Informationen holen für Bestätigung
    conn = sqlite3.connect('data/hochzeit.db')
    cursor = conn.cursor()
    cursor.execute("""
        SELECT td.device_name, au.username 
        FROM admin_trusted_devices td
        JOIN admin_users au ON td.admin_id = au.id
        WHERE td.id = ?
    """, (device_id,))
    
    device_info = cursor.fetchone()
    conn.close()
    
    if not device_info:
        print(f"❌ Gerät mit ID {device_id} nicht gefunden!")
        return
    
    device_name, admin_username = device_info
    
    # Bestätigung
    confirm = input(f"Gerät '{device_name}' von Admin '{admin_username}' entfernen? (ja/nein): ")
    if confirm.lower() != 'ja':
        print("Abgebrochen.")
        return
    
    # Entfernen (ohne admin_id da wir die device_id haben)
    conn = sqlite3.connect('data/hochzeit.db')
    cursor = conn.cursor()
    cursor.execute("DELETE FROM admin_trusted_devices WHERE id = ?", (device_id,))
    
    if cursor.rowcount > 0:
        conn.commit()
        print(f"✅ Gerät '{device_name}' erfolgreich entfernt!")
    else:
        print(f"❌ Fehler beim Entfernen des Geräts!")
    
    conn.close()

def cleanup_expired_devices():
    """Bereinigt abgelaufene vertrauenswürdige Geräte"""
    print("🧹 Abgelaufene Geräte bereinigen")
    print("=" * 40)
    
    # DataManager initialisieren
    dm = sqlite_datenmanager.SQLiteHochzeitsDatenManager()
    
    # Anzahl abgelaufener Geräte ermitteln
    conn = sqlite3.connect('data/hochzeit.db')
    cursor = conn.cursor()
    cursor.execute("""
        SELECT COUNT(*) FROM admin_trusted_devices 
        WHERE expires_at < datetime('now')
    """)
    expired_count = cursor.fetchone()[0]
    conn.close()
    
    if expired_count == 0:
        print("✅ Keine abgelaufenen Geräte gefunden.")
        return
    
    print(f"🔍 {expired_count} abgelaufene Geräte gefunden.")
    confirm = input("Alle abgelaufenen Geräte entfernen? (ja/nein): ")
    
    if confirm.lower() != 'ja':
        print("Abgebrochen.")
        return
    
    # Bereinigung durchführen
    dm.cleanup_expired_trusted_devices()
    print(f"✅ {expired_count} abgelaufene Geräte erfolgreich entfernt!")

if __name__ == "__main__":
    main()

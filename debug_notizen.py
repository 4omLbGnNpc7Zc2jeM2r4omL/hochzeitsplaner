#!/usr/bin/env python3
"""
Debug Script für Notizen
"""

import sqlite3
import os
from sqlite_datenmanager import SQLiteDataManager

# Pfad zur Datenbank
db_path = 'data/hochzeit.db'

print("=== NOTIZEN DEBUG ===")
print(f"Datenbank Pfad: {db_path}")
print(f"Datei existiert: {os.path.exists(db_path)}")

if os.path.exists(db_path):
    print(f"Dateigröße: {os.path.getsize(db_path)} Bytes")

# Direkte SQLite Verbindung
try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Prüfe Tabellen
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    print(f"Tabellen: {tables}")
    
    # Prüfe Notizen-Tabelle
    if 'notizen' in tables:
        print("✅ Notizen-Tabelle existiert")
        
        # Struktur anzeigen
        cursor.execute("PRAGMA table_info(notizen)")
        columns = cursor.fetchall()
        print("Spalten:")
        for col in columns:
            print(f"  - {col[1]} ({col[2]})")
        
        # Anzahl Einträge
        cursor.execute("SELECT COUNT(*) FROM notizen")
        count = cursor.fetchone()[0]
        print(f"Anzahl Notizen: {count}")
        
        # Testdaten einfügen
        cursor.execute("""
            INSERT INTO notizen (titel, inhalt, kategorie, prioritaet, erstellt_von) 
            VALUES (?, ?, ?, ?, ?)
        """, ("Test Notiz", "Das ist ein Test", "Test", "Normal", "admin"))
        
        notiz_id = cursor.lastrowid
        conn.commit()
        print(f"✅ Test-Notiz erstellt mit ID: {notiz_id}")
        
        # Alle Notizen anzeigen
        cursor.execute("SELECT * FROM notizen")
        notizen = cursor.fetchall()
        print(f"Alle Notizen ({len(notizen)}):")
        for notiz in notizen:
            print(f"  - {notiz}")
            
    else:
        print("❌ Notizen-Tabelle existiert nicht")
        print("Erstelle Tabelle...")
        cursor.execute("""
            CREATE TABLE notizen (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                titel TEXT NOT NULL,
                inhalt TEXT,
                kategorie TEXT DEFAULT 'Allgemein',
                prioritaet TEXT DEFAULT 'Normal',
                erstellt_von TEXT,
                erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
                bearbeitet_am DATETIME DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT chk_prioritaet CHECK (prioritaet IN ('Niedrig', 'Normal', 'Hoch', 'Dringend'))
            )
        """)
        conn.commit()
        print("✅ Notizen-Tabelle erstellt")
    
    conn.close()
    
except Exception as e:
    print(f"❌ SQLite Fehler: {e}")

# DataManager Test
try:
    print("\n=== DATAMANAGER TEST ===")
    dm = SQLiteDataManager('data')
    print("✅ DataManager initialisiert")
    
    # Test get_notizen
    notizen = dm.get_notizen()
    print(f"get_notizen() Ergebnis: {len(notizen)} Notizen")
    for notiz in notizen[:3]:
        print(f"  - {notiz}")
    
    # Test add_notiz
    test_data = {
        'titel': 'Debug Test Notiz',
        'inhalt': 'Das ist eine Debug-Notiz',
        'kategorie': 'Debug',
        'prioritaet': 'Normal',
        'erstellt_von': 'debug_script'
    }
    
    new_id = dm.add_notiz(test_data)
    print(f"add_notiz() Ergebnis: {new_id}")
    
    # Nochmal laden
    notizen = dm.get_notizen()
    print(f"Nach Hinzufügen: {len(notizen)} Notizen")
    
except Exception as e:
    print(f"❌ DataManager Fehler: {e}")
    import traceback
    traceback.print_exc()

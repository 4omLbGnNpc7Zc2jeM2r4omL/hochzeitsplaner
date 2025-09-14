#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SQLite DataManager für Hochzeitsplaner
Ersetzt den pandas-basierten DataManager durch SQLite-Datenbankoperationen
"""

import sqlite3
import json
import os
import logging
import threading
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
import hashlib
import random
import string

# Pandas als Lazy Import - nur laden wenn Excel-Features benötigt werden
pd = None

def get_pandas():
    """Lazy Loading für Pandas - nur laden wenn Excel-Features benötigt werden"""
    global pd
    if pd is None:
        try:
            import pandas as pd_module
            pd = pd_module
            logger.info("📊 Pandas geladen für Excel-Funktionen")
        except ImportError:
            logger.warning("❌ Pandas nicht verfügbar - Excel-Import/Export deaktiviert")
            pd = False  # Flag um wiederholte Import-Versuche zu vermeiden
    return pd if pd is not False else None

logger = logging.getLogger(__name__)

class SQLiteHochzeitsDatenManager:
    """
    Zentraler Datenmanager für Hochzeitsdaten mit SQLite-Backend
    """
    
    def __init__(self, data_directory: str = None):
        """
        Initialisiert den SQLite DataManager
        
        Args:
            data_directory: Pfad zum Datenverzeichnis (Standard: ./data)
        """
        # Logger initialisieren
        self.logger = logging.getLogger(__name__)
        
        self.data_directory = data_directory or os.path.join(os.path.dirname(__file__), 'data')
        self.data_dir = self.data_directory  # Alias für Kompatibilität
        self.db_path = os.path.join(self.data_directory, 'hochzeit.db')
        self.schema_path = os.path.join(os.path.dirname(__file__), 'database', 'schema.sql')
        
        # Thread-Lock für threadsichere Operationen
        self._lock = threading.RLock()
        
        # Datenverzeichnis erstellen falls nicht vorhanden
        os.makedirs(self.data_directory, exist_ok=True)
        os.makedirs(os.path.dirname(self.schema_path), exist_ok=True)
        
        # Datenbank initialisieren
        self._init_database()
    
    def _init_database(self):
        """Initialisiert die SQLite-Datenbank mit Schema"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                conn.execute("PRAGMA foreign_keys = ON")
                conn.execute("PRAGMA busy_timeout = 30000")  # 30 Sekunden
                conn.execute("PRAGMA journal_mode = WAL")     # Write-Ahead Logging für bessere Concurrency
                
                # 2FA Admin-Tabelle erstellen falls nicht vorhanden
                self._ensure_2fa_admin_table(conn)
                
                # Prüfe, ob tischplanung_config bereits existiert und welches Schema es hat
                cursor = conn.cursor()
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='tischplanung_config'")
                table_exists = cursor.fetchone() is not None
                
                if table_exists:
                    # Prüfe, welches Schema die Tabelle hat
                    cursor.execute("PRAGMA table_info(tischplanung_config)")
                    columns = [row[1] for row in cursor.fetchall()]
                    has_key_column = 'key' in columns
                    has_specific_columns = 'standard_tisch_groesse' in columns
                    
                    if has_key_column and not has_specific_columns:
                        # Alte key/value Struktur erkannt - Schema anpassen erforderlich
                        logger.info("🔄 Konvertiere tischplanung_config von key/value zu spezifischen Spalten...")
                        self._migrate_tischplanung_config(conn)
                
                # Schema laden und ausführen (mit verbesserter Fehlerbehandlung)
                if os.path.exists(self.schema_path):
                    self._apply_schema_safely(conn)
                else:
                    # Basis-Schema falls Datei nicht vorhanden
                    self._create_basic_schema(conn)
                
                conn.commit()
                conn.close()
                
                # Tischplanung-Tabellen initialisieren
                self._init_tischplanung_tables()
                
                # Alle wichtigen Tabellen sicherstellen
                self._ensure_all_tables()
                
                # Checkliste-Tabelle migrieren falls nötig
                self._migrate_checkliste_table()
                
                # Budget-Tabelle migrieren falls nötig
                self._migrate_budget_table()
                
                # Seite-Constraint Migration für dynamische Werte
                self._migrate_seite_constraint()
                
        except Exception as e:
            logger.error(f"Fehler bei Datenbankinitialisierung: {e}")
            raise
    
    def _apply_schema_safely(self, conn):
        """Wendet das Schema sicher an und überspringt bereits existierende Tabellen"""
        try:
            with open(self.schema_path, 'r', encoding='utf-8') as f:
                schema_content = f.read()
            
            # Teile Schema in einzelne CREATE TABLE Statements
            statements = []
            current_statement = []
            in_create_table = False
            
            for line in schema_content.split('\n'):
                line = line.strip()
                if not line or line.startswith('--'):
                    continue
                
                if line.upper().startswith('CREATE TABLE'):
                    in_create_table = True
                    current_statement = [line]
                elif in_create_table:
                    current_statement.append(line)
                    if ');' in line:
                        statements.append('\n'.join(current_statement))
                        current_statement = []
                        in_create_table = False
                else:
                    # Andere Statements (PRAGMA, etc.)
                    if line.strip():
                        statements.append(line)
            
            # Führe jedes Statement einzeln aus
            for statement in statements:
                try:
                    if statement.upper().startswith('CREATE TABLE'):
                        # Extrahiere Tabellennamen
                        table_name = statement.split('(')[0].split()[-1].strip()
                        if 'IF NOT EXISTS' not in statement.upper():
                            # Füge IF NOT EXISTS hinzu wenn nicht vorhanden
                            statement = statement.replace('CREATE TABLE', 'CREATE TABLE IF NOT EXISTS')
                    
                    conn.execute(statement)
                    
                except sqlite3.OperationalError as e:
                    if 'already exists' in str(e).lower():
                        logger.info(f"ℹ️  Tabelle existiert bereits - überspringe")
                    else:
                        logger.warning(f"Schema-Statement übersprungen: {e}")
                        
            logger.info("📋 Schema erfolgreich angewendet")
            
        except Exception as e:
            logger.error(f"Fehler beim Anwenden des Schemas: {e}")
            # Fallback auf Basis-Schema
            self._create_basic_schema(conn)
    
    def _create_basic_schema(self, conn):
        """Erstellt das Basis-Schema falls schema.sql nicht vorhanden"""
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS gaeste (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vorname TEXT NOT NULL,
                nachname TEXT,
                kategorie TEXT DEFAULT 'Familie',
                seite TEXT DEFAULT 'Käthe',
                status TEXT DEFAULT 'Offen',
                anzahl_personen INTEGER DEFAULT 1,
                kind INTEGER DEFAULT 0,
                begleitung INTEGER DEFAULT 0,
                optional INTEGER DEFAULT 0,
                weisser_saal INTEGER DEFAULT 0,
                anzahl_essen INTEGER DEFAULT 0,
                anzahl_party INTEGER DEFAULT 0,
                zum_weisser_saal TEXT DEFAULT 'Nein',
                zum_essen TEXT DEFAULT 'Nein',
                zur_party TEXT DEFAULT 'Nein',
                zum_standesamt TEXT DEFAULT 'Nein',
                email TEXT,
                kontakt TEXT,
                adresse TEXT,
                bemerkungen TEXT,
                guest_code TEXT UNIQUE,
                guest_password TEXT,
                max_personen INTEGER,
                last_modified INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS einstellungen (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                schluessel TEXT NOT NULL UNIQUE,
                wert TEXT,
                typ TEXT DEFAULT 'string',
                beschreibung TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            INSERT OR IGNORE INTO einstellungen (schluessel, wert, typ, beschreibung) VALUES
                ('hochzeitsdatum', '2025-09-01', 'date', 'Datum der Hochzeit'),
                ('hochzeitszeit', '15:00', 'time', 'Uhrzeit der Hochzeit'),
                ('braut_name', 'Käthe', 'string', 'Name der Braut'),
                ('braeutigam_name', 'Pascal', 'string', 'Name des Bräutigams');
            
            -- Notizliste Tabelle
            CREATE TABLE IF NOT EXISTS notizen (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                titel TEXT NOT NULL,
                inhalt TEXT,
                kategorie TEXT DEFAULT 'Allgemein',
                prioritaet TEXT DEFAULT 'Normal',
                erstellt_von TEXT,
                erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
                bearbeitet_am DATETIME DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT chk_prioritaet CHECK (prioritaet IN ('Niedrig', 'Normal', 'Hoch', 'Dringend'))
            );
            
            -- DJ-Benutzer Tabelle
            CREATE TABLE IF NOT EXISTS dj_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                display_name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME
            );
        """)
    
    def _migrate_tischplanung_config(self, conn):
        """Migriert tischplanung_config von key/value zu spezifischen Spalten"""
        try:
            cursor = conn.cursor()
            
            # Alte Werte auslesen
            cursor.execute("SELECT key, value FROM tischplanung_config")
            old_data = {row[0]: row[1] for row in cursor.fetchall()}
            
            # Tabelle löschen und neu erstellen
            cursor.execute("DROP TABLE IF EXISTS tischplanung_config")
            cursor.execute("""
                CREATE TABLE tischplanung_config (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    standard_tisch_groesse INTEGER DEFAULT 8,
                    automatische_zuordnung BOOLEAN DEFAULT FALSE,
                    beruecksichtige_alter BOOLEAN DEFAULT TRUE,
                    beruecksichtige_seite BOOLEAN DEFAULT TRUE,
                    beruecksichtige_kategorie BOOLEAN DEFAULT TRUE,
                    min_beziehung_staerke INTEGER DEFAULT 0,
                    layout_breite REAL DEFAULT 800.0,
                    layout_hoehe REAL DEFAULT 600.0,
                    tisch_durchmesser REAL DEFAULT 120.0,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Werte übertragen (falls vorhanden)
            standard_groesse = int(old_data.get('standard_tisch_groesse', '8'))
            auto_assign = old_data.get('auto_assign_enabled', 'false').lower() == 'true'
            
            cursor.execute("""
                INSERT INTO tischplanung_config 
                (id, standard_tisch_groesse, automatische_zuordnung)
                VALUES (1, ?, ?)
            """, (standard_groesse, auto_assign))
            
            logger.info("✅ tischplanung_config erfolgreich migriert")
            
        except Exception as e:
            logger.error(f"Fehler bei Migration von tischplanung_config: {e}")
            raise
    
    def _ensure_all_tables(self):
        """Stellt sicher, dass alle wichtigen Tabellen existieren"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                cursor = conn.cursor()
                
                # Prüfe welche Tabellen existieren
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                existing_tables = {row[0] for row in cursor.fetchall()}
                
                logger.info(f"Vorhandene Tabellen: {existing_tables}")
                
                # Notizen-Tabelle sicherstellen
                if 'notizen' not in existing_tables:
                    logger.info("🔄 Erstelle Notizen-Tabelle...")
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
                    logger.info("✅ Notizen-Tabelle erstellt")
                
                # Weitere wichtige Tabellen überprüfen
                required_tables = {
                    'gaeste': """
                        CREATE TABLE gaeste (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            vorname TEXT NOT NULL,
                            nachname TEXT,
                            kategorie TEXT DEFAULT 'Familie',
                            seite TEXT DEFAULT 'Käthe',
                            status TEXT DEFAULT 'Offen',
                            anzahl_personen INTEGER DEFAULT 1,
                            kind INTEGER DEFAULT 0,
                            begleitung INTEGER DEFAULT 0,
                            optional INTEGER DEFAULT 0,
                            weisser_saal INTEGER DEFAULT 0,
                            anzahl_essen INTEGER DEFAULT 0,
                            anzahl_party INTEGER DEFAULT 0,
                            zum_weisser_saal TEXT DEFAULT 'Nein',
                            zum_essen TEXT DEFAULT 'Nein',
                            zur_party TEXT DEFAULT 'Nein',
                            zum_standesamt TEXT DEFAULT 'Nein',
                            email TEXT,
                            kontakt TEXT,
                            adresse TEXT,
                            bemerkungen TEXT,
                            guest_code TEXT UNIQUE,
                            guest_password TEXT,
                            max_personen INTEGER,
                            last_modified INTEGER,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        )
                    """,
                    'einstellungen': """
                        CREATE TABLE einstellungen (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            schluessel TEXT NOT NULL UNIQUE,
                            wert TEXT,
                            typ TEXT DEFAULT 'string',
                            beschreibung TEXT,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        )
                    """,
                    'geschenkliste': """
                        CREATE TABLE geschenkliste (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            name TEXT NOT NULL,
                            beschreibung TEXT,
                            preis REAL,
                            waehrung TEXT DEFAULT 'EUR',
                            link TEXT,
                            ist_geldgeschenk INTEGER DEFAULT 0,
                            paypal_link TEXT,
                            ausgewaehlt_von_gast_id INTEGER,
                            ausgewaehlt_am DATETIME,
                            erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            prioritaet TEXT DEFAULT 'Normal',
                            kategorie TEXT DEFAULT 'Allgemein',
                            bild_url TEXT,
                            menge INTEGER DEFAULT 1,
                            ausgewaehlt_menge INTEGER DEFAULT 0,
                            FOREIGN KEY (ausgewaehlt_von_gast_id) REFERENCES gaeste(id) ON DELETE SET NULL,
                            CONSTRAINT chk_ist_geldgeschenk CHECK (ist_geldgeschenk IN (0, 1)),
                            CONSTRAINT chk_prioritaet_geschenk CHECK (prioritaet IN ('Niedrig', 'Normal', 'Hoch')),
                            CONSTRAINT chk_menge CHECK (menge >= 1),
                            CONSTRAINT chk_ausgewaehlt_menge CHECK (ausgewaehlt_menge >= 0 AND ausgewaehlt_menge <= menge)
                        )
                    """,
                    'hochzeitstag_checkliste': """
                        CREATE TABLE hochzeitstag_checkliste (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            titel TEXT NOT NULL,
                            beschreibung TEXT,
                            kategorie TEXT DEFAULT 'Allgemein',
                            prioritaet INTEGER DEFAULT 1,
                            uhrzeit TEXT,
                            erledigt INTEGER DEFAULT 0,
                            erledigt_am DATETIME,
                            erledigt_von TEXT,
                            sort_order INTEGER DEFAULT 0,
                            ist_standard INTEGER DEFAULT 0,
                            faellig_wochen_vor_hochzeit INTEGER,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            notizen TEXT,
                            CONSTRAINT chk_erledigt CHECK (erledigt IN (0, 1))
                        )
                    """,
                    'playlist_vorschlaege': """
                        CREATE TABLE playlist_vorschlaege (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            gast_id INTEGER,
                            kuenstler TEXT NOT NULL,
                            titel TEXT NOT NULL,
                            album TEXT,
                            genre TEXT,
                            anlass TEXT NOT NULL,
                            kommentar TEXT,
                            votes INTEGER DEFAULT 0,
                            status TEXT DEFAULT 'Vorgeschlagen',
                            spotify_id TEXT,
                            spotify_url TEXT,
                            preview_url TEXT,
                            image_url TEXT,
                            duration_ms INTEGER,
                            release_date TEXT,
                            popularity INTEGER,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (gast_id) REFERENCES gaeste(id) ON DELETE SET NULL
                        )
                    """,
                    'playlist_votes': """
                        CREATE TABLE playlist_votes (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            vorschlag_id INTEGER NOT NULL,
                            gast_id INTEGER,
                            vote_type TEXT DEFAULT 'up',
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (vorschlag_id) REFERENCES playlist_vorschlaege(id) ON DELETE CASCADE,
                            FOREIGN KEY (gast_id) REFERENCES gaeste(id) ON DELETE SET NULL,
                            UNIQUE(vorschlag_id, gast_id)
                        )
                    """,
                    'push_subscriptions': """
                        CREATE TABLE push_subscriptions (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id TEXT NOT NULL,
                            user_role TEXT DEFAULT 'admin',
                            endpoint TEXT NOT NULL,
                            p256dh_key TEXT NOT NULL,
                            auth_key TEXT NOT NULL,
                            user_agent TEXT,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
                            is_active INTEGER DEFAULT 1,
                            UNIQUE(user_id, endpoint)
                        )
                    """
                }
                
                for table_name, create_sql in required_tables.items():
                    if table_name not in existing_tables:
                        logger.info(f"🔄 Erstelle {table_name}-Tabelle...")
                        cursor.execute(create_sql)
                        logger.info(f"✅ {table_name}-Tabelle erstellt")
                
                conn.commit()
                conn.close()
                
                # Spalten in bestehenden Tabellen sicherstellen
                self._ensure_table_columns()
                
                logger.info("✅ Alle wichtigen Tabellen überprüft und sichergestellt")
                
        except Exception as e:
            logger.error(f"Fehler beim Sicherstellen der Tabellen: {e}")
            raise
    
    def _ensure_table_columns(self):
        """Stellt sicher, dass alle erforderlichen Spalten in bestehenden Tabellen vorhanden sind"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                cursor = conn.cursor()
                
                # Definition der erforderlichen Spalten pro Tabelle
                required_columns = {
                    'playlist_vorschlaege': {
                        'spotify_id': 'TEXT',
                        'spotify_url': 'TEXT',
                        'preview_url': 'TEXT',
                        'image_url': 'TEXT',
                        'duration_ms': 'INTEGER',
                        'release_date': 'TEXT',
                        'popularity': 'INTEGER'
                    },
                    'gaeste': {
                        'first_login': 'INTEGER DEFAULT 1',
                        'first_login_at': 'DATETIME',
                        'guest_code': 'TEXT UNIQUE',
                        'guest_password': 'TEXT',
                        'max_personen': 'INTEGER'
                    }
                }
                
                for table_name, columns in required_columns.items():
                    # Prüfe ob Tabelle existiert
                    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
                    if not cursor.fetchone():
                        logger.info(f"ℹ️  Tabelle {table_name} existiert nicht - überspringe Spalten-Check")
                        continue
                    
                    # Prüfe existierende Spalten
                    cursor.execute(f"PRAGMA table_info({table_name})")
                    existing_columns = {row[1] for row in cursor.fetchall()}
                    
                    # Füge fehlende Spalten hinzu
                    for col_name, col_type in columns.items():
                        if col_name not in existing_columns:
                            try:
                                cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}")
                                logger.info(f"✅ Spalte {col_name} zu {table_name} hinzugefügt")
                            except sqlite3.OperationalError as e:
                                if 'duplicate column name' in str(e):
                                    logger.info(f"ℹ️  Spalte {col_name} in {table_name} existiert bereits")
                                else:
                                    logger.error(f"❌ Fehler beim Hinzufügen von {col_name} zu {table_name}: {e}")
                
                conn.commit()
                conn.close()
                logger.info("🔧 Spalten-Überprüfung abgeschlossen")
                
        except Exception as e:
            logger.error(f"Fehler beim Sicherstellen der Spalten: {e}")
            raise
    
    def _get_connection(self, timeout: float = 30.0) -> sqlite3.Connection:
        """Erstellt eine sichere Datenbankverbindung mit optimierten Einstellungen"""
        conn = sqlite3.connect(self.db_path, timeout=timeout)
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA busy_timeout = 30000")
        conn.execute("PRAGMA journal_mode = WAL")
        return conn
    
    def _migrate_checkliste_table(self):
        """Migriert die hochzeitstag_checkliste Tabelle zur neuen Struktur"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                cursor = conn.cursor()
                
                # Prüfen ob Tabelle existiert
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='hochzeitstag_checkliste'")
                if not cursor.fetchone():
                    logger.info("📋 Checkliste-Tabelle existiert nicht - wird erstellt")
                    conn.close()
                    return
                
                # Aktuelle Spalten prüfen
                cursor.execute("PRAGMA table_info(hochzeitstag_checkliste)")
                columns = {row[1]: row[2] for row in cursor.fetchall()}
                
                logger.info(f"📋 Aktuelle Checkliste-Spalten: {list(columns.keys())}")
                
                # Prüfen ob uhrzeit Spalte fehlt
                missing_columns = []
                expected_columns = {
                    'uhrzeit': 'TEXT',
                    'erledigt_von': 'TEXT', 
                    'sort_order': 'INTEGER',
                    'created_at': 'DATETIME',
                    'updated_at': 'DATETIME'
                }
                
                for col_name, col_type in expected_columns.items():
                    if col_name not in columns:
                        missing_columns.append((col_name, col_type))
                
                # Fehlende Spalten hinzufügen
                for col_name, col_type in missing_columns:
                    logger.info(f"📋 Füge fehlende Spalte hinzu: {col_name}")
                    default_value = ""
                    if col_type == 'INTEGER':
                        default_value = "DEFAULT 0"
                    elif col_type == 'DATETIME':
                        default_value = "DEFAULT CURRENT_TIMESTAMP"
                    
                    alter_sql = f"ALTER TABLE hochzeitstag_checkliste ADD COLUMN {col_name} {col_type} {default_value}"
                    cursor.execute(alter_sql)
                
                # Priorität von TEXT zu INTEGER migrieren falls nötig
                if 'prioritaet' in columns and columns['prioritaet'] == 'TEXT':
                    logger.info("📋 Migriere Priorität von TEXT zu INTEGER")
                    # Backup der Daten
                    cursor.execute("SELECT id, prioritaet FROM hochzeitstag_checkliste")
                    priority_data = cursor.fetchall()
                    
                    # Priorität-Mapping
                    priority_map = {
                        'Niedrig': 1,
                        'Normal': 2, 
                        'Hoch': 3,
                        'Kritisch': 4
                    }
                    
                    # Temporäre Spalte hinzufügen
                    cursor.execute("ALTER TABLE hochzeitstag_checkliste ADD COLUMN prioritaet_new INTEGER DEFAULT 1")
                    
                    # Daten konvertieren
                    for row_id, old_priority in priority_data:
                        new_priority = priority_map.get(old_priority, 1)
                        cursor.execute("UPDATE hochzeitstag_checkliste SET prioritaet_new = ? WHERE id = ?", 
                                     (new_priority, row_id))
                    
                    # Tabelle neu erstellen
                    cursor.execute("""
                        CREATE TABLE hochzeitstag_checkliste_new (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            titel TEXT NOT NULL,
                            beschreibung TEXT,
                            kategorie TEXT DEFAULT 'Allgemein',
                            prioritaet INTEGER DEFAULT 1,
                            uhrzeit TEXT,
                            erledigt INTEGER DEFAULT 0,
                            erledigt_am DATETIME,
                            erledigt_von TEXT,
                            sort_order INTEGER DEFAULT 0,
                            ist_standard INTEGER DEFAULT 0,
                            faellig_wochen_vor_hochzeit INTEGER,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            notizen TEXT,
                            CONSTRAINT chk_erledigt CHECK (erledigt IN (0, 1))
                        )
                    """)
                    
                    # Daten kopieren
                    cursor.execute("""
                        INSERT INTO hochzeitstag_checkliste_new 
                        (id, titel, beschreibung, kategorie, prioritaet, uhrzeit, erledigt, 
                         erledigt_am, erledigt_von, sort_order, ist_standard, 
                         faellig_wochen_vor_hochzeit, created_at, updated_at, notizen)
                        SELECT id, titel, beschreibung, kategorie, prioritaet_new, 
                               COALESCE(uhrzeit, ''), erledigt, erledigt_am, 
                               COALESCE(erledigt_von, ''), COALESCE(sort_order, 0), 
                               COALESCE(ist_standard, 0), faellig_wochen_vor_hochzeit,
                               COALESCE(created_at, CURRENT_TIMESTAMP), 
                               COALESCE(updated_at, CURRENT_TIMESTAMP), notizen
                        FROM hochzeitstag_checkliste
                    """)
                    
                    # Alte Tabelle löschen und neue umbenennen
                    cursor.execute("DROP TABLE hochzeitstag_checkliste")
                    cursor.execute("ALTER TABLE hochzeitstag_checkliste_new RENAME TO hochzeitstag_checkliste")
                    
                    logger.info("✅ Checkliste-Tabelle erfolgreich migriert")
                
                conn.commit()
                conn.close()
                
        except Exception as e:
            logger.error(f"Fehler bei Checkliste-Migration: {e}")
            # Bei Fehler versuchen wir die Tabelle neu zu erstellen
            try:
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                cursor = conn.cursor()
                cursor.execute("DROP TABLE IF EXISTS hochzeitstag_checkliste")
                cursor.execute("""
                    CREATE TABLE hochzeitstag_checkliste (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        titel TEXT NOT NULL,
                        beschreibung TEXT,
                        kategorie TEXT DEFAULT 'Allgemein',
                        prioritaet INTEGER DEFAULT 1,
                        uhrzeit TEXT,
                        erledigt INTEGER DEFAULT 0,
                        erledigt_am DATETIME,
                        erledigt_von TEXT,
                        sort_order INTEGER DEFAULT 0,
                        ist_standard INTEGER DEFAULT 0,
                        faellig_wochen_vor_hochzeit INTEGER,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        notizen TEXT,
                        CONSTRAINT chk_erledigt CHECK (erledigt IN (0, 1))
                    )
                """)
                conn.commit()
                conn.close()
                logger.info("✅ Checkliste-Tabelle neu erstellt nach Migrationsfehler")
            except Exception as e2:
                logger.error(f"Fehler beim Neuerstellen der Checkliste-Tabelle: {e2}")
    
    def _migrate_budget_table(self):
        """Migriert die Budget-Tabelle um Einnahmen/Geldgeschenke zu unterstützen"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                cursor = conn.cursor()
                
                # Prüfen ob Budget-Tabelle existiert
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='budget'")
                if not cursor.fetchone():
                    logger.info("💰 Budget-Tabelle existiert nicht - wird erstellt")
                    conn.close()
                    return
                
                # Aktuelle Spalten prüfen
                cursor.execute("PRAGMA table_info(budget)")
                columns = {row[1]: row[2] for row in cursor.fetchall()}
                
                logger.info(f"💰 Aktuelle Budget-Spalten: {list(columns.keys())}")
                
                # Prüfen ob 'typ' Spalte fehlt
                if 'typ' not in columns:
                    logger.info("💰 Füge 'typ' Spalte zur Budget-Tabelle hinzu")
                    cursor.execute("ALTER TABLE budget ADD COLUMN typ TEXT DEFAULT 'Ausgabe'")
                    
                    # Constraint hinzufügen (SQLite hat Einschränkungen bei ALTER TABLE mit CONSTRAINT)
                    # Wir erstellen eine neue Tabelle mit dem Constraint
                    logger.info("💰 Erstelle Budget-Tabelle mit Constraint neu...")
                    
                    # Backup der bestehenden Daten
                    cursor.execute("SELECT * FROM budget")
                    budget_data = cursor.fetchall()
                    
                    # Neue Tabelle erstellen
                    cursor.execute("""
                        CREATE TABLE budget_new (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            kategorie TEXT NOT NULL,
                            beschreibung TEXT NOT NULL,
                            details TEXT,
                            menge REAL DEFAULT 1.0,
                            einzelpreis REAL DEFAULT 0.0,
                            gesamtpreis REAL DEFAULT 0.0,
                            ausgegeben REAL DEFAULT 0.0,
                            typ TEXT DEFAULT 'Ausgabe',
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            CONSTRAINT chk_typ CHECK (typ IN ('Ausgabe', 'Einnahme'))
                        )
                    """)
                    
                    # Daten kopieren (alle bestehenden als 'Ausgabe' markieren)
                    for row in budget_data:
                        cursor.execute("""
                            INSERT INTO budget_new 
                            (id, kategorie, beschreibung, details, menge, einzelpreis, 
                             gesamtpreis, ausgegeben, typ, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Ausgabe', ?, ?)
                        """, row)
                    
                    # Alte Tabelle löschen und neue umbenennen
                    cursor.execute("DROP TABLE budget")
                    cursor.execute("ALTER TABLE budget_new RENAME TO budget")
                    
                    logger.info("✅ Budget-Tabelle erfolgreich migriert für Einnahmen/Ausgaben")
                
                conn.commit()
                conn.close()
                
        except Exception as e:
            logger.error(f"Fehler bei Budget-Migration: {e}")
    
    def _migrate_seite_constraint(self):
        """Entfernt die statische chk_seite Constraint für dynamische Seite-Werte"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                cursor = conn.cursor()
                
                # Prüfe ob die alte Constraint noch existiert
                cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='gaeste'")
                table_sql = cursor.fetchone()
                
                if table_sql and 'chk_seite' in table_sql[0]:
                    logger.info("🔄 Migriere Gaeste-Tabelle für dynamische Seite-Werte...")
                    
                    # Hole aktuelle Brautpaar-Namen aus Einstellungen
                    cursor.execute("SELECT wert FROM einstellungen WHERE schluessel = 'braut_name'")
                    braut_result = cursor.fetchone()
                    braut_name = braut_result[0] if braut_result else 'Käthe'
                    
                    cursor.execute("SELECT wert FROM einstellungen WHERE schluessel = 'braeutigam_name'")
                    braeutigam_result = cursor.fetchone()
                    braeutigam_name = braeutigam_result[0] if braeutigam_result else 'Pascal'
                    
                    # 1. Erstelle temporäre Tabelle ohne chk_seite Constraint
                    cursor.execute("""
                        CREATE TABLE gaeste_temp (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            vorname TEXT NOT NULL,
                            nachname TEXT,
                            kategorie TEXT DEFAULT 'Familie',
                            seite TEXT DEFAULT 'Käthe',
                            status TEXT DEFAULT 'Offen',
                            anzahl_personen INTEGER DEFAULT 1,
                            kind INTEGER DEFAULT 0,
                            begleitung INTEGER DEFAULT 0,
                            optional INTEGER DEFAULT 0,
                            weisser_saal INTEGER DEFAULT 0,
                            anzahl_essen INTEGER DEFAULT 0,
                            anzahl_party INTEGER DEFAULT 0,
                            zum_weisser_saal TEXT DEFAULT 'Nein',
                            zum_essen TEXT DEFAULT 'Nein',
                            zur_party TEXT DEFAULT 'Nein',
                            zum_standesamt TEXT DEFAULT 'Nein',
                            email TEXT,
                            kontakt TEXT,
                            adresse TEXT,
                            bemerkungen TEXT,
                            guest_code TEXT UNIQUE,
                            guest_password TEXT,
                            max_personen INTEGER,
                            first_login INTEGER DEFAULT 1,
                            first_login_at DATETIME,
                            last_modified INTEGER,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            CONSTRAINT chk_status CHECK (status IN ('Offen', 'Zugesagt', 'Abgesagt', 'offen', 'zugesagt', 'abgesagt')),
                            CONSTRAINT chk_teilnahme CHECK (zum_weisser_saal IN ('Ja', 'Nein')),
                            CONSTRAINT chk_essen CHECK (zum_essen IN ('Ja', 'Nein')),
                            CONSTRAINT chk_party CHECK (zur_party IN ('Ja', 'Nein')),
                            CONSTRAINT chk_standesamt CHECK (zum_standesamt IN ('Ja', 'Nein'))
                        )
                    """)
                    
                    # 2. Kopiere Daten und korrigiere Seite-Werte
                    cursor.execute("SELECT * FROM gaeste")
                    guests = cursor.fetchall()
                    
                    # Hole Spalten-Info
                    cursor.execute("PRAGMA table_info(gaeste)")
                    columns = [col[1] for col in cursor.fetchall()]
                    
                    valid_values = [braut_name, braeutigam_name, 'Beide']
                    updated_count = 0
                    
                    for guest in guests:
                        guest_dict = dict(zip(columns, guest))
                        
                        # Korrigiere seite-Wert falls nötig
                        current_seite = guest_dict.get('seite')
                        if current_seite and current_seite not in valid_values:
                            if current_seite in ['Braut', 'Käthe']:
                                guest_dict['seite'] = braut_name
                            elif current_seite in ['Bräutigam', 'Pascal']:
                                guest_dict['seite'] = braeutigam_name
                            elif current_seite in ['Beide', 'Gemeinsam']:
                                guest_dict['seite'] = 'Beide'
                            else:
                                guest_dict['seite'] = braut_name  # Standardwert
                            updated_count += 1
                            logger.info(f"Gast {guest_dict['id']}: Seite '{current_seite}' -> '{guest_dict['seite']}'")
                        
                        # Füge Daten in temporäre Tabelle ein
                        placeholders = ', '.join(['?' for _ in columns])
                        values = [guest_dict[col] for col in columns]
                        cursor.execute(f"INSERT INTO gaeste_temp ({', '.join(columns)}) VALUES ({placeholders})", values)
                    
                    # 3. Ersetze alte Tabelle
                    cursor.execute("DROP TABLE gaeste")
                    cursor.execute("ALTER TABLE gaeste_temp RENAME TO gaeste")
                    
                    logger.info(f"✅ Gaeste-Tabelle migriert! {updated_count} Seiten-Werte aktualisiert")
                
                else:
                    # Constraint bereits entfernt, nur Daten prüfen
                    cursor.execute("SELECT wert FROM einstellungen WHERE schluessel = 'braut_name'")
                    braut_result = cursor.fetchone()
                    braut_name = braut_result[0] if braut_result else 'Käthe'
                    
                    cursor.execute("SELECT wert FROM einstellungen WHERE schluessel = 'braeutigam_name'")
                    braeutigam_result = cursor.fetchone()
                    braeutigam_name = braeutigam_result[0] if braeutigam_result else 'Pascal'
                    
                    # Prüfe und korrigiere ungültige Seite-Werte
                    cursor.execute("SELECT id, seite FROM gaeste")
                    guests = cursor.fetchall()
                    
                    valid_values = [braut_name, braeutigam_name, 'Beide']
                    updated_count = 0
                    
                    for guest_id, current_seite in guests:
                        if current_seite and current_seite not in valid_values:
                            new_seite = braut_name  # Standardwert
                            if current_seite in ['Braut', 'Käthe']:
                                new_seite = braut_name
                            elif current_seite in ['Bräutigam', 'Pascal']:
                                new_seite = braeutigam_name
                            elif current_seite in ['Beide', 'Gemeinsam']:
                                new_seite = 'Beide'
                            
                            cursor.execute("UPDATE gaeste SET seite = ? WHERE id = ?", (new_seite, guest_id))
                            updated_count += 1
                            logger.info(f"Gast {guest_id}: Seite '{current_seite}' -> '{new_seite}'")
                    
                    if updated_count > 0:
                        logger.info(f"✅ {updated_count} Gäste-Seiten korrigiert")
                
                conn.commit()
                conn.close()
                
        except Exception as e:
            logger.error(f"Fehler bei Seite-Constraint Migration: {e}")
    
    # =============================================================================
    # Legacy Data Migration 
    # =============================================================================
    
    def _migrate_legacy_data(self):
        """Migriert vorhandene JSON-Daten zu SQLite - nur einmal"""
        try:
            # Migration-Tracking-Tabelle erstellen
            with self._lock:
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                cursor = conn.cursor()
                
                # Migration-Tracking-Tabelle
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS migration_status (
                        migration_name TEXT PRIMARY KEY,
                        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Prüfen ob Legacy-Migration bereits durchgeführt wurde
                cursor.execute("SELECT migration_name FROM migration_status WHERE migration_name = 'legacy_data_migration'")
                if cursor.fetchone():
                    logger.info("✅ Legacy-Migration bereits durchgeführt - überspringe")
                    conn.close()
                    return
                
                conn.close()
            
            logger.info("🔄 Starte Legacy-Migration...")
            
            # Sicherstellen, dass first_login Spalten existieren
            self._migrate_first_login_columns()
            
            # Gästeliste migrieren
            gaesteliste_path = os.path.join(self.data_directory, 'gaesteliste.json')
            if os.path.exists(gaesteliste_path):
                self._migrate_gaesteliste(gaesteliste_path)
            
            # Weitere Legacy-Dateien migrieren
            self._migrate_settings()
            self._migrate_zeitplan()
            self._migrate_aufgaben()
            self._migrate_budget()
            
            # Migration als abgeschlossen markieren
            with self._lock:
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                cursor = conn.cursor()
                cursor.execute("INSERT OR IGNORE INTO migration_status (migration_name) VALUES ('legacy_data_migration')")
                conn.commit()
                conn.close()
                
            logger.info("✅ Legacy-Migration abgeschlossen")
            
        except Exception as e:
            logger.error(f"Fehler bei Legacy-Migration: {e}")
    
    # =============================================================================
    # 2FA Admin Authentication Methods
    # =============================================================================
    
    def _ensure_2fa_admin_table(self, conn):
        """Stellt sicher, dass die 2FA Admin-Tabelle existiert"""
        try:
            cursor = conn.cursor()
            
            # Admin-Benutzer Tabelle für 2FA
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS admin_users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    totp_secret TEXT,
                    is_2fa_enabled INTEGER DEFAULT 0,
                    backup_codes TEXT,
                    failed_2fa_attempts INTEGER DEFAULT 0,
                    last_failed_2fa DATETIME,
                    is_active INTEGER DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # 2FA Session Tracking
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS admin_2fa_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    admin_id INTEGER NOT NULL,
                    session_token TEXT NOT NULL UNIQUE,
                    is_verified INTEGER DEFAULT 0,
                    verification_attempts INTEGER DEFAULT 0,
                    expires_at DATETIME NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
                )
            """)
            
            # Trusted Devices Tabelle für "Dieses Gerät merken" Funktionalität
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS admin_trusted_devices (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    admin_id INTEGER NOT NULL,
                    device_fingerprint TEXT NOT NULL,
                    device_name TEXT,
                    user_agent TEXT,
                    ip_address TEXT,
                    expires_at DATETIME NOT NULL,
                    last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE,
                    UNIQUE(admin_id, device_fingerprint)
                )
            """)
            
            # Default Admin erstellen falls noch keiner existiert
            cursor.execute("SELECT COUNT(*) FROM admin_users")
            admin_count = cursor.fetchone()[0]
            
            if admin_count == 0:
                import hashlib
                import secrets
                
                # Default Admin-Benutzer erstellen
                default_password = "admin123"  # WARNUNG: In Produktion ändern!
                password_hash = hashlib.sha256(default_password.encode()).hexdigest()
                
                cursor.execute("""
                    INSERT INTO admin_users (username, password_hash, is_active)
                    VALUES (?, ?, ?)
                """, ("admin", password_hash, 1))
                
                logger.info("🔑 Default Admin-Benutzer erstellt (Benutzername: admin, Passwort: admin123)")
                logger.warning("⚠️  WARNUNG: Ändern Sie das Standard-Admin-Passwort sofort!")
            
            conn.commit()
            
        except Exception as e:
            logger.error(f"Fehler beim Erstellen der 2FA Admin-Tabelle: {e}")
            raise
    
    # =============================================================================
    # Gäste-Management
    # =============================================================================
    
    def _migrate_first_login_columns(self):
        """Migriert die first_login Spalten falls sie noch nicht existieren"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                cursor = conn.cursor()
                
                # Prüfen ob first_login Spalte bereits existiert
                cursor.execute("PRAGMA table_info(gaeste)")
                columns = [column[1] for column in cursor.fetchall()]
                
                if 'first_login' not in columns:
                    logger.info("Füge first_login Spalte zur gaeste Tabelle hinzu...")
                    cursor.execute("ALTER TABLE gaeste ADD COLUMN first_login INTEGER DEFAULT 1")
                    logger.info("✅ first_login Spalte hinzugefügt")
                
                if 'first_login_at' not in columns:
                    logger.info("Füge first_login_at Spalte zur gaeste Tabelle hinzu...")
                    cursor.execute("ALTER TABLE gaeste ADD COLUMN first_login_at DATETIME")
                    logger.info("✅ first_login_at Spalte hinzugefügt")
                
                # Update für existierende Gäste: setze first_login auf 1 falls NULL
                cursor.execute("UPDATE gaeste SET first_login = 1 WHERE first_login IS NULL")
                updated_count = cursor.rowcount
                
                if updated_count > 0:
                    logger.info(f"✅ {updated_count} Gäste auf first_login = 1 gesetzt")
                
                conn.commit()
                conn.close()
                
        except Exception as e:
            logger.error(f"Fehler bei First-Login-Migration: {e}")
            raise
    
    def _migrate_gaesteliste(self, json_path: str):
        """Migriert Gästeliste von JSON zu SQLite"""
        try:
            # Prüfen ob bereits Daten in der DB vorhanden sind
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM gaeste")
                existing_count = cursor.fetchone()[0]
                
                if existing_count > 0:
                    conn.close()
                    return
                
                # JSON-Daten laden
                with open(json_path, 'r', encoding='utf-8') as f:
                    gaeste_data = json.load(f)
                
                migrated_count = 0
                for guest in gaeste_data:
                    try:
                        # Daten bereinigen und mappieren
                        guest_data = self._clean_guest_data(guest)
                        
                        # In Datenbank einfügen
                        cursor.execute("""
                            INSERT INTO gaeste (
                                vorname, nachname, kategorie, seite, status, anzahl_personen,
                                kind, begleitung, optional, weisser_saal, anzahl_essen, anzahl_party,
                                zum_weisser_saal, zum_essen, zur_party, zum_standesamt,
                                email, kontakt, adresse, bemerkungen, guest_code, guest_password,
                                max_personen, last_modified
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            guest_data.get('vorname', ''),
                            guest_data.get('nachname', ''),
                            guest_data.get('kategorie', 'Familie'),
                            guest_data.get('seite', 'Käthe'),
                            guest_data.get('status', 'Offen'),
                            guest_data.get('anzahl_personen', 1),
                            guest_data.get('kind', 0),
                            guest_data.get('begleitung', 0),
                            guest_data.get('optional', 0),
                            guest_data.get('weisser_saal', 0),
                            guest_data.get('anzahl_essen', 0),
                            guest_data.get('anzahl_party', 0),
                            guest_data.get('zum_weisser_saal', 'Nein'),
                            guest_data.get('zum_essen', 'Nein'),
                            guest_data.get('zur_party', 'Nein'),
                            guest_data.get('zum_standesamt', 'Nein'),
                            guest_data.get('email', None),
                            guest_data.get('kontakt', None),
                            guest_data.get('adresse', None),
                            guest_data.get('bemerkungen', None),
                            guest_data.get('guest_code', None),
                            guest_data.get('guest_password', None),
                            guest_data.get('max_personen', None),
                            guest_data.get('last_modified', None)
                        ))
                        migrated_count += 1
                        
                    except Exception as e:
                        logger.error(f"Fehler bei Migration von Gast {guest}: {e}")
                        continue
                
                conn.commit()
                conn.close()
                
                # JSON-Backup erstellen
                backup_path = json_path + '.migrated_backup'
                os.rename(json_path, backup_path)
                
        except Exception as e:
            logger.error(f"Fehler bei Gästeliste-Migration: {e}")
    
    def _clean_guest_data(self, guest: dict) -> dict:
        """Bereinigt Gast-Daten für SQLite-Import"""
        def safe_get(key, default=None):
            value = guest.get(key, default)
            if value is None or (isinstance(value, str) and value.lower() in ['nan', 'nat', 'null']):
                return default
            return value
        
        def safe_int(value, default=0):
            try:
                if value is None:
                    return default
                return int(float(value))
            except (ValueError, TypeError):
                return default
        
        def safe_str(value, default=''):
            if value is None:
                return default
            return str(value).strip()
        
        return {
            'vorname': safe_str(safe_get('Vorname')),
            'nachname': safe_str(safe_get('Nachname')),
            'kategorie': safe_str(safe_get('Kategorie', 'Familie')),
            'seite': safe_str(safe_get('Seite', 'Käthe')),
            'status': safe_str(safe_get('Status', 'Offen')),
            'anzahl_personen': safe_int(safe_get('Anzahl_Personen'), 1),
            'kind': safe_int(safe_get('Kind'), 0),
            'begleitung': safe_int(safe_get('Begleitung'), 0),
            'optional': safe_int(safe_get('Optional'), 0),
            'weisser_saal': safe_int(safe_get('Weisser_Saal'), 0),
            'anzahl_essen': safe_int(safe_get('Anzahl_Essen'), 0),
            'anzahl_party': safe_int(safe_get('Anzahl_Party'), 0),
            'zum_weisser_saal': safe_str(safe_get('Zum_Weisser_Saal', 'Nein')),
            'zum_essen': safe_str(safe_get('Zum_Essen', 'Nein')),
            'zur_party': safe_str(safe_get('Zur_Party', 'Nein')),
            'zum_standesamt': safe_str(safe_get('Zum_Standesamt', 'Nein')),
            'email': safe_get('Email'),
            'kontakt': safe_get('Kontakt'),
            'adresse': safe_get('Adresse'),
            'bemerkungen': safe_get('Bemerkungen'),
            'guest_code': safe_get('guest_code'),
            'guest_password': safe_get('guest_password'),
            'max_personen': safe_get('max_personen'),
            'last_modified': safe_get('last_modified')
        }
    
    def _migrate_settings(self):
        """Migriert Einstellungen von JSON zu SQLite"""
        settings_path = os.path.join(self.data_directory, 'settings.json')
        if not os.path.exists(settings_path):
            return
        
        try:
            with open(settings_path, 'r', encoding='utf-8') as f:
                settings_data = json.load(f)
            
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                for key, value in settings_data.items():
                    cursor.execute("""
                        INSERT OR REPLACE INTO einstellungen (schluessel, wert, typ)
                        VALUES (?, ?, ?)
                    """, (key, str(value), type(value).__name__))
                
                conn.commit()
                conn.close()
            
            # Backup erstellen
            backup_path = settings_path + '.migrated_backup'
            os.rename(settings_path, backup_path)
            
        except Exception as e:
            logger.error(f"Fehler bei Einstellungen-Migration: {e}")
    
    def _migrate_zeitplan(self):
        """Migriert Zeitplan von JSON zu SQLite"""
        zeitplan_path = os.path.join(self.data_directory, 'zeitplan.json')
        if not os.path.exists(zeitplan_path):
            return
        
        try:
            with open(zeitplan_path, 'r', encoding='utf-8') as f:
                zeitplan_data = json.load(f)
            
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                # Prüfen ob bereits Zeitplan-Daten vorhanden sind
                cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='zeitplan'")
                table_exists = cursor.fetchone()[0] > 0
                
                # Zeitplan-Tabelle erstellen falls nicht vorhanden
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS zeitplan (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        titel TEXT NOT NULL,
                        beschreibung TEXT,
                        start_zeit DATETIME NOT NULL,
                        end_zeit DATETIME,
                        ort TEXT,
                        kategorie TEXT DEFAULT 'Allgemein',
                        farbe TEXT DEFAULT '#007bff',
                        wichtig BOOLEAN DEFAULT 0,
                        nur_brautpaar BOOLEAN DEFAULT 0,
                        eventteile TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                if table_exists:
                    cursor.execute("SELECT COUNT(*) FROM zeitplan")
                    existing_count = cursor.fetchone()[0]
                    if existing_count > 0:
                        conn.close()
                        return
                
                migrated_count = 0
                for event in zeitplan_data:
                    try:
                        # Legacy-Format zu neuem Format konvertieren
                        titel = event.get('Programmpunkt', '')
                        start_zeit = f"2025-09-01 {event.get('Uhrzeit', '00:00')}:00"
                        end_zeit = f"2025-09-01 {event.get('EndZeit', '00:00')}:00" if event.get('EndZeit') else None
                        
                        # Farbe basierend auf Status
                        status = event.get('Status', 'Geplant')
                        if status == 'Gebucht':
                            farbe = '#28a745'  # Grün
                        elif status == 'Bestätigt':
                            farbe = '#007bff'  # Blau
                        else:
                            farbe = '#ffc107'  # Gelb
                        
                        # Public-Flag für nur_brautpaar invertieren
                        nur_brautpaar = not bool(event.get('public', 0))
                        
                        cursor.execute("""
                            INSERT INTO zeitplan (
                                titel, beschreibung, start_zeit, end_zeit, ort, kategorie,
                                farbe, wichtig, nur_brautpaar, eventteile
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            titel,
                            event.get('Verantwortlich', ''),
                            start_zeit,
                            end_zeit,
                            '',  # Ort nicht in Legacy-Daten
                            status,
                            farbe,
                            0,  # wichtig
                            nur_brautpaar,
                            json.dumps(event.get('eventteile', []))
                        ))
                        migrated_count += 1
                        
                    except Exception as e:
                        logger.error(f"Fehler bei Migration von Zeitplan-Eintrag {event}: {e}")
                        continue
                
                conn.commit()
                conn.close()
                
                logger.info(f"{migrated_count} Zeitplan-Einträge migriert")
                
                # JSON-Backup erstellen
                backup_path = zeitplan_path + '.migrated_backup'
                if not os.path.exists(backup_path):
                    os.rename(zeitplan_path, backup_path)
                
        except Exception as e:
            logger.error(f"Fehler bei Zeitplan-Migration: {e}")
    
    def _migrate_aufgaben(self):
        """Migriert Aufgaben von JSON zu SQLite"""
        aufgaben_path = os.path.join(self.data_directory, 'aufgaben.json')
        if not os.path.exists(aufgaben_path):
            return
        
        try:
            with open(aufgaben_path, 'r', encoding='utf-8') as f:
                aufgaben_data = json.load(f)
            
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                # Aufgaben-Tabelle erstellen falls nicht vorhanden
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS aufgaben (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        titel TEXT NOT NULL,
                        beschreibung TEXT,
                        status TEXT DEFAULT 'Offen',
                        prioritaet TEXT DEFAULT 'Normal',
                        kategorie TEXT DEFAULT 'Allgemein',
                        faellig_am DATE,
                        zugewiesen_an TEXT,
                        notizen TEXT,
                        erstellt_von TEXT DEFAULT 'Unbekannt',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Migration: erstellt_von Feld hinzufügen falls es nicht existiert
                try:
                    cursor.execute("ALTER TABLE aufgaben ADD COLUMN erstellt_von TEXT DEFAULT 'Unbekannt'")
                    print("✅ erstellt_von Feld zur aufgaben Tabelle hinzugefügt")
                except sqlite3.OperationalError as e:
                    if "duplicate column name" in str(e).lower():
                        print("ℹ️  erstellt_von Feld bereits vorhanden")
                    else:
                        print(f"⚠️  Fehler beim Hinzufügen des erstellt_von Feldes: {e}")
                
                
                # Prüfen ob bereits Aufgaben vorhanden sind
                cursor.execute("SELECT COUNT(*) FROM aufgaben")
                existing_count = cursor.fetchone()[0]
                if existing_count > 0:
                    conn.close()
                    return
                
                migrated_count = 0
                for aufgabe in aufgaben_data:
                    try:
                        cursor.execute("""
                            INSERT INTO aufgaben (
                                titel, beschreibung, status, prioritaet, kategorie,
                                faellig_am, zugewiesen_an, notizen
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            aufgabe.get('titel', aufgabe.get('name', '')),
                            aufgabe.get('beschreibung', ''),
                            aufgabe.get('status', 'Offen'),
                            aufgabe.get('prioritaet', 'Normal'),
                            aufgabe.get('kategorie', 'Allgemein'),
                            aufgabe.get('faellig_am'),
                            aufgabe.get('zugewiesen_an', aufgabe.get('verantwortlich', '')),
                            aufgabe.get('notizen', '')
                        ))
                        migrated_count += 1
                        
                    except Exception as e:
                        logger.error(f"Fehler bei Migration von Aufgabe {aufgabe}: {e}")
                        continue
                
                conn.commit()
                conn.close()
                
                logger.info(f"{migrated_count} Aufgaben migriert")
                
                # JSON-Backup erstellen
                backup_path = aufgaben_path + '.migrated_backup'
                if not os.path.exists(backup_path):
                    os.rename(aufgaben_path, backup_path)
                
        except Exception as e:
            logger.error(f"Fehler bei Aufgaben-Migration: {e}")
    
    def _migrate_budget(self):
        """Migriert Budget von JSON zu SQLite"""
        budget_path = os.path.join(self.data_directory, 'budget.json')
        if not os.path.exists(budget_path):
            return
        
        try:
            with open(budget_path, 'r', encoding='utf-8') as f:
                budget_data = json.load(f)
            
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                # Budget-Tabelle erstellen falls nicht vorhanden (einfache Struktur)
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS budget (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        kategorie TEXT NOT NULL,
                        beschreibung TEXT NOT NULL,
                        details TEXT,
                        menge REAL DEFAULT 1.0,
                        einzelpreis REAL DEFAULT 0.0,
                        gesamtpreis REAL DEFAULT 0.0,
                        ausgegeben REAL DEFAULT 0.0,
                        typ TEXT DEFAULT 'Ausgabe',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT chk_typ CHECK (typ IN ('Ausgabe', 'Einnahme'))
                    )
                """)
                
                # Prüfen ob bereits Budget-Daten vorhanden sind
                cursor.execute("SELECT COUNT(*) FROM budget")
                existing_count = cursor.fetchone()[0]
                if existing_count > 0:
                    conn.close()
                    return
                
                migrated_count = 0
                
                # Wenn budget_data eine Liste von Budget-Posten ist (wie in der backup-Datei)
                if isinstance(budget_data, list):
                    for item in budget_data:
                        try:
                            cursor.execute("""
                                INSERT INTO budget (
                                    kategorie, beschreibung, details, menge,
                                    einzelpreis, gesamtpreis, ausgegeben
                                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                            """, (
                                item.get('kategorie', 'Sonstiges'),
                                item.get('beschreibung', ''),
                                item.get('details', ''),
                                float(item.get('menge', 1.0)),
                                float(item.get('einzelpreis', 0.0)),
                                float(item.get('gesamtpreis', 0.0)),
                                float(item.get('ausgegeben', 0.0))
                            ))
                            migrated_count += 1
                        except Exception as e:
                            logger.error(f"Fehler bei Migration von Budget-Eintrag {item}: {e}")
                            continue
                
                # Andernfalls versuchen Legacy-Format mit Kategorien
                elif isinstance(budget_data, dict) and 'kategorien' in budget_data:
                    for kategorie in budget_data['kategorien']:
                        try:
                            cursor.execute("""
                                INSERT INTO budget (
                                    kategorie, beschreibung, details, menge,
                                    einzelpreis, gesamtpreis, ausgegeben
                                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                            """, (
                                kategorie.get('name', 'Sonstiges'),
                                kategorie.get('beschreibung', kategorie.get('name', '')),
                                '',
                                1.0,
                                float(kategorie.get('geplant', 0)),
                                float(kategorie.get('geplant', 0)),
                                float(kategorie.get('ausgegeben', 0))
                            ))
                            migrated_count += 1
                        except Exception as e:
                            logger.error(f"Fehler bei Migration von Budget-Kategorie {kategorie}: {e}")
                            continue
                
                conn.commit()
                conn.close()
                
                logger.info(f"{migrated_count} Budget-Einträge migriert")
                
                # JSON-Backup erstellen
                backup_path = budget_path + '.migrated_backup'
                if not os.path.exists(backup_path):
                    os.rename(budget_path, backup_path)
                
        except Exception as e:
            logger.error(f"Fehler bei Budget-Migration: {e}")
    
    # =============================================================================
    # Gäste-Management
    # =============================================================================
    
    def get_gaeste_list(self) -> List[Dict[str, Any]]:
        """Gibt alle Gäste als Liste zurück"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT * FROM gaeste WHERE kategorie != 'System' OR kategorie IS NULL ORDER BY id
                """)
                
                rows = cursor.fetchall()
                conn.close()
                
                # Zu Dict konvertieren
                gaeste = []
                for row in rows:
                    guest = dict(row)
                    # Legacy-Format für Kompatibilität
                    guest['Vorname'] = guest['vorname']
                    guest['Nachname'] = guest['nachname']
                    guest['Kategorie'] = guest['kategorie']
                    guest['Seite'] = guest['seite']
                    guest['Status'] = guest['status']
                    guest['Anzahl_Personen'] = guest['anzahl_personen']
                    guest['Kind'] = guest['kind']
                    guest['Begleitung'] = guest['begleitung']
                    guest['Optional'] = guest['optional']
                    guest['Weisser_Saal'] = guest['weisser_saal']
                    guest['Anzahl_Essen'] = guest['anzahl_essen']
                    guest['Anzahl_Party'] = guest['anzahl_party']
                    guest['Zum_Weisser_Saal'] = guest['zum_weisser_saal']
                    guest['Zum_Essen'] = guest['zum_essen']
                    guest['Zur_Party'] = guest['zur_party']
                    guest['Zum_Standesamt'] = guest['zum_standesamt']
                    guest['Email'] = guest['email']
                    guest['Kontakt'] = guest['kontakt']
                    guest['Adresse'] = guest['adresse']
                    guest['Bemerkungen'] = guest['bemerkungen']
                    gaeste.append(guest)
                
                return gaeste
                
        except Exception as e:
            logger.error(f"Fehler beim Laden der Gästeliste: {e}")
            return []
    
    def get_all_guests(self) -> list:
        """Gibt alle Gäste zurück (ohne System-Gäste)"""
        try:
            with self._get_connection() as conn:
                cursor = conn.execute("SELECT * FROM gaeste WHERE kategorie != 'System' OR kategorie IS NULL ORDER BY nachname, vorname")
                columns = [description[0] for description in cursor.description]
                rows = cursor.fetchall()
                
                guests = []
                for row in rows:
                    guests.append(dict(zip(columns, row)))
                
                return guests
                
        except Exception as e:
            logger.error(f"Fehler beim Laden aller Gäste: {e}")
            return []

    def get_all_guests_including_system(self) -> list:
        """Gibt alle Gäste zurück (inklusive System-Gäste für Admin-Funktionen)"""
        try:
            with self._get_connection() as conn:
                cursor = conn.execute("SELECT * FROM gaeste ORDER BY nachname, vorname")
                columns = [description[0] for description in cursor.description]
                rows = cursor.fetchall()
                
                guests = []
                for row in rows:
                    guests.append(dict(zip(columns, row)))
                
                return guests
                
        except Exception as e:
            logger.error(f"Fehler beim Laden aller Gäste inklusive System: {e}")
            return []
    
    def find_guest_by(self, guest_id=None, guest_code=None, email=None) -> Dict[str, Any]:
        """Findet einen Gast nach ID, Code oder Email"""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                
                # Priorität: ID > Code > Email
                if guest_id is not None:
                    cursor.execute("SELECT * FROM gaeste WHERE id = ?", (guest_id,))
                elif guest_code:
                    cursor.execute("SELECT * FROM gaeste WHERE UPPER(guest_code) = UPPER(?)", (guest_code,))
                elif email:
                    cursor.execute("SELECT * FROM gaeste WHERE LOWER(email) = LOWER(?)", (email,))
                else:
                    return {}
                
                row = cursor.fetchone()
                if row:
                    columns = [description[0] for description in cursor.description]
                    guest = dict(zip(columns, row))
                    
                    # Bestimme das echte Maximum für max_personen
                    original_max = guest.get('max_personen')
                    if not original_max:
                        # Fallback: Berechne aus vorhandenen Event-Feldern
                        event_anzahlen = []
                        for field in ['anzahl_personen', 'anzahl_essen', 'anzahl_party', 'weisser_saal']:
                            val = guest.get(field)
                            if val and val > 0:
                                event_anzahlen.append(int(val))
                        original_max = max(event_anzahlen) if event_anzahlen else 1
                    
                    guest['max_personen'] = original_max
                    return guest
                
                return {}
                
        except Exception as e:
            logger.error(f"Fehler beim Suchen des Gastes: {e}")
            return {}
    
    def get_guest_by_id(self, guest_id: int) -> Dict[str, Any]:
        """Gibt einen Gast basierend auf der ID zurück"""
        return self.find_guest_by(guest_id=guest_id)
    
    def add_guest_to_db(self, guest_data: Dict[str, Any]) -> bool:
        """Fügt einen neuen Gast zur Datenbank hinzu"""
        try:
            # Teilnahme-Logik anwenden
            guest_data = self._apply_participation_logic(guest_data)
            
            # Normalisiere Werte für CHECK constraints
            status = guest_data.get('status', guest_data.get('Status', 'Offen'))
            if isinstance(status, str):
                status = status.strip().title()  # "offen" -> "Offen"
                if status.lower() in ['zugesagt', 'ja']:
                    status = 'Zugesagt'
                elif status.lower() in ['abgesagt', 'nein']:
                    status = 'Abgesagt'
                else:
                    status = 'Offen'
            
            # Verwende Validierungsfunktion für Seite-Wert
            seite_value = guest_data.get('seite', guest_data.get('Seite', ''))
            validated_seite = self._validate_seite_value(seite_value)
            
            with self._lock:
                conn = self._get_connection()
                cursor = conn.cursor()
                
                cursor.execute("""
                    INSERT INTO gaeste (
                        vorname, nachname, kategorie, seite, status, anzahl_personen,
                        kind, begleitung, optional, weisser_saal, anzahl_essen, anzahl_party,
                        zum_weisser_saal, zum_essen, zur_party, zum_standesamt,
                        email, kontakt, adresse, bemerkungen, guest_code, guest_password,
                        max_personen, last_modified
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    guest_data.get('vorname', guest_data.get('Vorname', '')),
                    guest_data.get('nachname', guest_data.get('Nachname', '')),
                    guest_data.get('kategorie', guest_data.get('Kategorie', 'Familie')),
                    validated_seite,  # Verwende validierten Wert
                    status,
                    guest_data.get('anzahl_personen', guest_data.get('Anzahl_Personen', 1)),
                    guest_data.get('kind', guest_data.get('Kind', 0)),
                    guest_data.get('begleitung', guest_data.get('Begleitung', 0)),
                    guest_data.get('optional', guest_data.get('Optional', 0)),
                    guest_data.get('weisser_saal', guest_data.get('Weisser_Saal', 0)),
                    guest_data.get('anzahl_essen', guest_data.get('Anzahl_Essen', 0)),
                    guest_data.get('anzahl_party', guest_data.get('Anzahl_Party', 0)),
                    guest_data.get('zum_weisser_saal', guest_data.get('Zum_Weisser_Saal', 'Nein')),
                    guest_data.get('zum_essen', guest_data.get('Zum_Essen', 'Nein')),
                    guest_data.get('zur_party', guest_data.get('Zur_Party', 'Nein')),
                    guest_data.get('zum_standesamt', guest_data.get('Zum_Standesamt', 'Nein')),
                    guest_data.get('email', guest_data.get('Email')),
                    guest_data.get('kontakt', guest_data.get('Kontakt')),
                    guest_data.get('adresse', guest_data.get('Adresse')),
                    guest_data.get('bemerkungen', guest_data.get('Bemerkungen')),
                    guest_data.get('guest_code'),
                    guest_data.get('guest_password'),
                    guest_data.get('max_personen'),
                    guest_data.get('last_modified', int(datetime.now().timestamp() * 1000))
                ))
                
                conn.commit()
                conn.close()
                
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Hinzufügen von Gast: {e}")
            return False

    def delete_guest(self, guest_id: int) -> bool:
        """Löscht einen Gast aus der Datenbank"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute("DELETE FROM gaeste WHERE id = ?", (guest_id,))
                
                conn.commit()
                deleted_rows = cursor.rowcount
                conn.close()
                
                return deleted_rows > 0
                
        except Exception as e:
            logger.error(f"Fehler beim Löschen von Gast {guest_id}: {e}")
            return False
    
    def _validate_seite_value(self, seite: str) -> str:
        """Validiert und normalisiert den Seite-Wert basierend auf den aktuellen Einstellungen"""
        if not seite:
            return self.get_setting('braut_name', 'Käthe')
        
        # Hole aktuelle Namen aus den Einstellungen
        braut_name = self.get_setting('braut_name', 'Käthe')
        braeutigam_name = self.get_setting('braeutigam_name', 'Pascal')
        
        # Normalisiere und validiere den Wert
        seite = seite.strip()
        valid_values = [braut_name, braeutigam_name, 'Beide']
        
        # Direkter Match
        if seite in valid_values:
            return seite
        
        # Legacy-Werte konvertieren
        if seite.lower() in ['braut', 'käthe', 'kaethe']:
            return braut_name
        elif seite.lower() in ['bräutigam', 'braeutigam', 'pascal']:
            return braeutigam_name
        elif seite.lower() in ['beide', 'gemeinsam']:
            return 'Beide'
        
        # Fallback auf Braut-Seite
        logger.warning(f"Unbekannter Seite-Wert '{seite}', verwende '{braut_name}'")
        return braut_name

    def update_guest(self, guest_id: int, guest_data: Dict[str, Any]) -> bool:
        """Aktualisiert einen vorhandenen Gast"""
        try:
            # Teilnahme-Logik anwenden
            guest_data = self._apply_participation_logic(guest_data)
            
            # Seite-Wert validieren und normalisieren
            seite_value = guest_data.get('Seite', guest_data.get('seite', ''))
            validated_seite = self._validate_seite_value(seite_value)
            
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute("""
                    UPDATE gaeste SET
                        vorname = ?, nachname = ?, kategorie = ?, seite = ?, status = ?,
                        anzahl_personen = ?, kind = ?, begleitung = ?, optional = ?,
                        weisser_saal = ?, anzahl_essen = ?, anzahl_party = ?,
                        zum_weisser_saal = ?, zum_essen = ?, zur_party = ?, zum_standesamt = ?,
                        email = ?, kontakt = ?, adresse = ?, bemerkungen = ?,
                        last_modified = ?
                    WHERE id = ?
                """, (
                    guest_data.get('Vorname', ''),
                    guest_data.get('Nachname', ''),
                    guest_data.get('Kategorie', 'Familie'),
                    validated_seite,  # Verwende validierten Wert
                    guest_data.get('Status', 'Offen'),
                    guest_data.get('Anzahl_Personen', 1),
                    guest_data.get('Kind', 0),
                    guest_data.get('Begleitung', 0),
                    guest_data.get('Optional', 0),
                    guest_data.get('Weisser_Saal', 0),
                    guest_data.get('Anzahl_Essen', 0),
                    guest_data.get('Anzahl_Party', 0),
                    guest_data.get('Zum_Weisser_Saal', 'Nein'),
                    guest_data.get('Zum_Essen', 'Nein'),
                    guest_data.get('Zur_Party', 'Nein'),
                    guest_data.get('Zum_Standesamt', 'Nein'),
                    guest_data.get('Email'),
                    guest_data.get('Kontakt'),
                    guest_data.get('Adresse'),
                    guest_data.get('Bemerkungen'),
                    int(datetime.now().timestamp() * 1000),
                    guest_id
                ))
                
                conn.commit()
                conn.close()
                
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Aktualisieren von Gast: {e}")
            return False
    
    def update_guest_rsvp(self, guest_id: int, status: str, anzahl_personen: int, bemerkungen: str = '', last_modified_check: int = None) -> Dict[str, Any]:
        """Aktualisiert die RSVP-Daten eines Gastes mit Conflict Detection"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                # Aktuelle Daten laden für Conflict Detection
                cursor.execute("SELECT * FROM gaeste WHERE id = ?", (guest_id,))
                row = cursor.fetchone()
                if not row:
                    conn.close()
                    return {'success': False, 'message': 'Gast nicht gefunden'}
                
                columns = [description[0] for description in cursor.description]
                current_guest = dict(zip(columns, row))
                
                # Conflict Detection
                if last_modified_check and current_guest.get('last_modified'):
                    if current_guest['last_modified'] > last_modified_check:
                        conn.close()
                        return {
                            'success': False, 
                            'conflict': True,
                            'message': 'Die Daten wurden zwischenzeitlich von einer anderen Session geändert.',
                            'current_data': {
                                'status': current_guest.get('status', 'Offen'),
                                'personen': current_guest.get('anzahl_personen', 1),
                                'notiz': current_guest.get('bemerkungen', ''),
                                'last_modified': current_guest.get('last_modified')
                            }
                        }
                
                # Status normalisieren
                if status.lower() in ['zugesagt', 'ja']:
                    status = 'Zugesagt'
                elif status.lower() in ['abgesagt', 'nein']:
                    status = 'Abgesagt'
                else:
                    status = 'Offen'
                
                # Anzahl Personen validieren
                max_personen = current_guest.get('max_personen')
                if not max_personen:
                    # Fallback: Berechne aus Event-Feldern
                    event_anzahlen = []
                    for field in ['anzahl_personen', 'anzahl_essen', 'anzahl_party', 'weisser_saal']:
                        val = current_guest.get(field)
                        if val and val > 0:
                            event_anzahlen.append(int(val))
                    max_personen = max(event_anzahlen) if event_anzahlen else 1
                
                if anzahl_personen > max_personen:
                    conn.close()
                    return {
                        'success': False,
                        'message': f'Maximale Personenzahl ({max_personen}) überschritten'
                    }
                
                # Update durchführen
                new_timestamp = int(datetime.now().timestamp() * 1000)
                cursor.execute("""
                    UPDATE gaeste SET
                        status = ?,
                        anzahl_personen = ?,
                        bemerkungen = ?,
                        last_modified = ?
                    WHERE id = ?
                """, (status, anzahl_personen, bemerkungen, new_timestamp, guest_id))
                
                conn.commit()
                conn.close()
                
                return {
                    'success': True,
                    'message': 'RSVP erfolgreich aktualisiert',
                    'last_modified': new_timestamp
                }
                
        except Exception as e:
            logger.error(f"Fehler beim RSVP-Update: {e}")
            return {'success': False, 'message': 'Fehler beim Aktualisieren'}
    
    def get_all_guests(self) -> list:
        """Gibt alle Gäste zurück (ohne System-Gäste)"""
        try:
            with self._get_connection() as conn:
                cursor = conn.execute("SELECT * FROM gaeste WHERE kategorie != 'System' OR kategorie IS NULL ORDER BY nachname, vorname")
                columns = [description[0] for description in cursor.description]
                rows = cursor.fetchall()
                
                guests = []
                for row in rows:
                    guests.append(dict(zip(columns, row)))
                
                return guests
                
        except Exception as e:
            logger.error(f"Fehler beim Laden aller Gäste: {e}")
            return []
        """Löscht einen Gast"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute("DELETE FROM gaeste WHERE id = ?", (guest_id,))
                
                conn.commit()
                conn.close()
                
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Löschen von Gast: {e}")
            return False
    
    def _apply_participation_logic(self, guest_data: Dict[str, Any]) -> Dict[str, Any]:
        """Wendet die automatische Teilnahme-Logik an"""
        # Anzahl-Werte extrahieren
        weisser_saal = int(guest_data.get('Weisser_Saal', 0))
        anzahl_essen = int(guest_data.get('Anzahl_Essen', 0))
        anzahl_party = int(guest_data.get('Anzahl_Party', 0))
        
        # Hierarchische Logik anwenden
        final_essen = max(anzahl_essen, weisser_saal)
        final_party = max(anzahl_party, final_essen)
        
        # Aktualisierte Werte setzen
        guest_data['Anzahl_Essen'] = final_essen
        guest_data['Anzahl_Party'] = final_party
        
        # Ja/Nein-Felder setzen
        guest_data['Zum_Weisser_Saal'] = 'Ja' if weisser_saal > 0 else 'Nein'
        guest_data['Zum_Essen'] = 'Ja' if final_essen > 0 else 'Nein'
        guest_data['Zur_Party'] = 'Ja' if final_party > 0 else 'Nein'
        
        return guest_data
    
    # =============================================================================
    # Einstellungen
    # =============================================================================
    
    def get_setting(self, key: str, default: Any = None) -> Any:
        """Lädt eine Einstellung"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute("SELECT wert, typ FROM einstellungen WHERE schluessel = ?", (key,))
                row = cursor.fetchone()
                conn.close()
                
                if row:
                    value, typ = row
                    # Typkonvertierung
                    if typ == 'int':
                        return int(value)
                    elif typ == 'float':
                        return float(value)
                    elif typ == 'bool' or typ == 'boolean':
                        return value.lower() in ('true', '1', 'yes', 'on')
                    elif typ == 'json':
                        try:
                            return json.loads(value)
                        except json.JSONDecodeError:
                            logger.warning(f"Konnte JSON für Einstellung '{key}' nicht parsen: {value}")
                            return default
                    else:
                        return value
                
                return default
                
        except Exception as e:
            logger.error(f"Fehler beim Laden von Einstellung {key}: {e}")
            return default
    
    def set_setting(self, key: str, value: Any, description: str = None) -> bool:
        """Speichert eine Einstellung und überschreibt bestehende Werte"""
        try:
            # Typ bestimmen
            typ = type(value).__name__
            if typ == 'bool':
                typ = 'boolean'
            elif typ in ['dict', 'list']:
                typ = 'json'
                value = json.dumps(value, ensure_ascii=False)
            
            # Wert zu String konvertieren (None wird zu leerer String)
            if value is None:
                value_str = ''
            else:
                value_str = str(value)
            
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                # Prüfe ob der Schlüssel bereits existiert
                cursor.execute("SELECT wert FROM einstellungen WHERE schluessel = ?", (key,))
                existing = cursor.fetchone()
                
                if existing:
                    # Update existierender Eintrag
                    cursor.execute("""
                        UPDATE einstellungen 
                        SET wert = ?, typ = ?, beschreibung = COALESCE(?, beschreibung), updated_at = CURRENT_TIMESTAMP
                        WHERE schluessel = ?
                    """, (value_str, typ, description, key))
                    logger.debug(f"Setting '{key}' updated: '{existing[0]}' -> '{value_str}'")
                else:
                    # Neuer Eintrag
                    cursor.execute("""
                        INSERT INTO einstellungen (schluessel, wert, typ, beschreibung)
                        VALUES (?, ?, ?, ?)
                    """, (key, value_str, typ, description))
                    logger.debug(f"Setting '{key}' created with value: '{value_str}'")
                
                conn.commit()
                conn.close()
                
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Speichern von Einstellung {key}: {e}")
            return False
    
    # =============================================================================
    # Guest Credentials
    # =============================================================================
    
    def generate_guest_credentials(self) -> bool:
        """Generiert Login-Credentials für alle Gäste"""
        try:
            gaeste = self.get_gaeste_list()
            
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                for guest in gaeste:
                    if not guest.get('guest_code'):
                        # Code generieren
                        guest_code = self._generate_guest_code(guest['Vorname'], guest['Nachname'])
                        guest_password = self._generate_guest_password(guest['Nachname'])
                        
                        cursor.execute("""
                            UPDATE gaeste SET guest_code = ?, guest_password = ?, max_personen = ?
                            WHERE id = ?
                        """, (guest_code, guest_password, guest['Anzahl_Personen'], guest['id']))
                
                conn.commit()
                conn.close()
                
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Generieren der Guest-Credentials: {e}")
            return False
    
    def get_guest_credentials_list(self) -> List[Dict[str, Any]]:
        """Gibt eine Liste aller Gast-Credentials zurück"""
        try:
            with self._get_connection() as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute("""
                    SELECT id, vorname, nachname, guest_code, guest_password, email, status
                    FROM gaeste
                    ORDER BY id
                """)
                
                rows = cursor.fetchall()
                
                credentials_list = []
                for row in rows:
                    guest_dict = dict(row)
                    
                    credentials_list.append({
                        'index': guest_dict['id'],
                        'vorname': guest_dict.get('vorname', ''),
                        'nachname': guest_dict.get('nachname', ''),
                        'login_code': guest_dict.get('guest_code', ''),
                        'password': guest_dict.get('guest_password', ''),
                        'email': guest_dict.get('email', ''),
                        'status': guest_dict.get('status', 'Offen')
                    })
                
                return credentials_list
                
        except Exception as e:
            logger.error(f"Fehler beim Abrufen der Credentials-Liste: {e}")
            return []
    
    def _get_credentials_from_sqlite(self) -> List[Dict[str, Any]]:
        """Fallback: Lade Credentials aus SQLite"""
        try:
            guests = self.get_all_guests()
            credentials_list = []
            for guest in guests:
                credentials_list.append({
                    'index': guest.get('id'),
                    'vorname': guest.get('vorname', ''),
                    'nachname': guest.get('nachname', ''),
                    'login_code': guest.get('guest_code', ''),
                    'password': guest.get('guest_password', ''),
                    'email': guest.get('email', ''),
                    'status': guest.get('status', 'Offen')
                })
            return credentials_list
        except Exception as e:
            logger.error(f"Fehler beim Laden aus SQLite: {e}")
            return []
    
    def _generate_guest_code(self, vorname: str, nachname: str) -> str:
        """Generiert einen Guest-Code"""
        # Bereinige Namen
        vorname_clean = ''.join(c.upper() for c in vorname if c.isalnum())[:8]
        nachname_clean = ''.join(c.upper() for c in nachname if c.isalnum())[:8]
        
        # Random-Nummer
        random_num = random.randint(1000, 9999)
        
        return f"{vorname_clean}{nachname_clean[:2]}{random_num}"
    
    def _generate_guest_password(self, nachname: str) -> str:
        """Generiert ein Guest-Passwort"""
        nachname_clean = ''.join(c.lower() for c in nachname if c.isalnum())
        random_num = random.randint(1000, 9999)
        return f"{nachname_clean}{random_num}"
    
    # =============================================================================
    # Hilfsfunktionen
    # =============================================================================
    
    def get_lock(self):
        """Gibt den Thread-Lock zurück"""
        return self._lock
    
    def backup_database(self, backup_path: str = None) -> bool:
        """Erstellt ein Backup der Datenbank"""
        try:
            if not backup_path:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                backup_path = os.path.join(self.data_directory, f'hochzeit_backup_{timestamp}.db')
            
            with self._lock:
                # SQLite-Backup mit VACUUM INTO
                conn = sqlite3.connect(self.db_path)
                conn.execute(f"VACUUM INTO '{backup_path}'")
                conn.close()
            
            return True
            
        except Exception as e:
            logger.error(f"Fehler beim Erstellen des Backups: {e}")
            return False
    
    def import_excel_gaesteliste(self, file_path: str, sheet_name: str = 0) -> bool:
        """
        Importiert Gästeliste aus Excel-Datei
        
        Args:
            file_path: Pfad zur Excel-Datei
            sheet_name: Name oder Index des Arbeitsblatts
            
        Returns:
            True bei Erfolg, False bei Fehler
        """
        try:
            # Pandas laden wenn nötig
            pd = get_pandas()
            if not pd:
                logger.error("Pandas ist nicht verfügbar für Excel-Import")
                return False
            
            # Excel-Datei lesen
            df = pd.read_excel(file_path, sheet_name=sheet_name)
            
            # Spalten standardisieren
            df = self._standardize_guest_columns(df)
            
            # Validierung
            if self._validate_guest_data(df):
                # Bestehende Gäste löschen (kompletter Import)
                with self._get_connection() as conn:
                    conn.execute("DELETE FROM gaeste")
                    conn.commit()
                
                # Neue Gäste einfügen
                imported_count = 0
                for _, row in df.iterrows():
                    guest_data = self._prepare_guest_data_for_insert(row)
                    if self.add_guest(guest_data):
                        imported_count += 1
                
                return True
            else:
                logger.error("Validierung der Gästeliste fehlgeschlagen")
                return False
                
        except Exception as e:
            logger.error(f"Fehler beim Excel-Import: {e}")
            return False
    
    def _standardize_guest_columns(self, df):
        """Standardisiert Spaltennamen für Import"""
        # Excel-Datei verwendet bereits die korrekten deutschen Spaltennamen
        # Keine Anpassungen nötig, da wir das korrekte Mapping in _prepare_guest_data_for_insert haben
        return df
    
    def _validate_guest_data(self, df):
        """Validiert die Gästedaten"""
        required_columns = ['Vorname']
        
        # Prüfe erforderliche Spalten
        for col in required_columns:
            if col not in df.columns:
                logger.error(f"Erforderliche Spalte fehlt: {col}")
                return False
        
        # Prüfe leere Vornamen (pandas-spezifisch falls verfügbar)
        if pd and hasattr(df['Vorname'], 'isna'):
            if df['Vorname'].isna().any():
                logger.error("Leere Vornamen gefunden")
                return False
        else:
            # Fallback ohne pandas
            if any(not str(name).strip() for name in df['Vorname'] if name is not None):
                logger.error("Leere Vornamen gefunden")
                return False
        
        return True
    
    def _prepare_guest_data_for_insert(self, row):
        """Bereitet DataFrame-Zeile für Datenbank-Insert vor"""
        def safe_str(value, default=''):
            if value is None:
                return default
            if pd and hasattr(pd, 'isna') and pd.isna(value):
                return default
            str_value = str(value).strip()
            if str_value.lower() in ['nan', 'none', 'null', '']:
                return default
            return str_value
        
        def safe_int(value, default=0):
            try:
                if value is None:
                    return default
                if pd and hasattr(pd, 'isna') and pd.isna(value):
                    return default
                str_value = str(value).strip()
                if str_value.lower() in ['nan', 'none', 'null', '']:
                    return default
                return int(float(value))
            except (ValueError, TypeError):
                return default
        
        # Korrekte Zuordnung basierend auf der tatsächlichen Excel-Struktur
        return {
            'Vorname': safe_str(row.get('Vorname')),
            'Nachname': safe_str(row.get('Nachname')),
            'Kategorie': safe_str(row.get('Kategorie', 'Familie')),
            'Seite': safe_str(row.get('Seite', 'Käthe')),
            'Status': safe_str(row.get('Status', 'Offen')),
            'Anzahl_Personen': safe_int(row.get('Anzahl_Personen', 1)),
            'Kind': safe_int(row.get('Kind', 0)),
            'Begleitung': safe_int(row.get('Begleitung', 0)),  # In Excel als numerischer Wert
            'Optional': safe_int(row.get('Optional', 0)),
            'Weisser_Saal': safe_int(row.get('Weisser_Saal', 0)),
            'Anzahl_Essen': safe_int(row.get('Anzahl_Essen', 0)),
            'Anzahl_Party': safe_int(row.get('Anzahl_Party', 0)),
            'Zum_Weisser_Saal': safe_str(row.get('Zum_Weisser_Saal', 'Nein')),
            'Zum_Essen': safe_str(row.get('Zum_Essen', 'Nein')),
            'Zur_Party': safe_str(row.get('Zur_Party', 'Nein')),
            'Zum_Standesamt': safe_str(row.get('Zum_Standesamt', 'Nein')),  # Nicht in Excel, aber Schema-kompatibel
            'Email': safe_str(row.get('Email')),
            'Kontakt': safe_str(row.get('Kontakt')),
            'Adresse': safe_str(row.get('Adresse')),
            'Bemerkungen': safe_str(row.get('Bemerkungen')),
            'guest_code': safe_str(row.get('guest_code')),
            'guest_password': safe_str(row.get('guest_password')),
            'max_personen': safe_int(row.get('Max_Personen')),  # Korrekte Spalte aus Excel
            'last_modified': safe_int(row.get('last_modified'))
        }
    
    def export_to_excel(self, excel_path: str) -> bool:
        """Exportiert Daten nach Excel (Kompatibilität)"""
        try:
            # Pandas laden wenn nötig
            pd = get_pandas()
            if not pd:
                logger.error("Pandas ist nicht verfügbar für Excel-Export")
                return False
            
            # Gästeliste laden
            gaeste = self.get_gaeste_list()
            
            # DataFrame erstellen
            df = pd.DataFrame(gaeste)
            
            # Excel-Export
            with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
                df.to_excel(writer, sheet_name='Gaesteliste', index=False)
            
            return True
            
        except Exception as e:
            logger.error(f"Fehler beim Excel-Export: {e}")
            return False
    
    # =============================================================================
    # Kompatibilitätsmethoden für pandas DataManager
    # =============================================================================
    
    def load_gaesteliste(self):
        """Lädt Gästeliste (Kompatibilität mit pandas DataManager)"""
        # SQLite Version lädt automatisch aus der Datenbank
        pass
    
    def save_gaesteliste(self):
        """Speichert Gästeliste (Kompatibilität mit pandas DataManager)"""
        # SQLite Version speichert automatisch bei jeder Operation
        pass
    
    @property
    def gaesteliste_df(self):
        """Emuliert pandas DataFrame für Kompatibilität"""
        pd = get_pandas()
        if not pd:
            # Fallback: Leere Liste für Kompatibilität
            logger.warning("Pandas nicht verfügbar - DataFrame-Kompatibilität eingeschränkt")
            return []
        
        try:
            guests = self.get_all_guests()
            return pd.DataFrame(guests)
        except Exception as e:
            logger.error(f"Fehler beim Erstellen der DataFrame: {e}")
            return pd.DataFrame()
    
    def get_guest_statistics(self) -> dict:
        """Berechnet erweiterte Gäste-Statistiken"""
        try:
            guests = self.get_all_guests()
            if not guests:
                return {
                    'gesamt': 0,
                    'zusagen': 0,
                    'absagen': 0,
                    'offen': 0,
                    'personen_gesamt': 0,
                    'personen_zusagen': 0,
                    'personen_absagen': 0,
                    'personen_offen': 0,
                    'kathe_seite': 0,
                    'pascal_seite': 0,
                    'gemeinsam': 0,
                    'antwort_rate': 0,
                    'zusage_rate': 0
                }
            
            gesamt = len(guests)
            zusagen = len([g for g in guests if g.get('status', '').lower() in ['zugesagt', 'zusage']])
            absagen = len([g for g in guests if g.get('status', '').lower() in ['abgesagt', 'absage']])
            offen = gesamt - zusagen - absagen
            
            personen_gesamt = sum(g.get('anzahl_personen', 1) for g in guests)
            personen_zusagen = sum(g.get('anzahl_personen', 1) for g in guests if g.get('status', '').lower() in ['zugesagt', 'zusage'])
            personen_absagen = sum(g.get('anzahl_personen', 1) for g in guests if g.get('status', '').lower() in ['abgesagt', 'absage'])
            personen_offen = personen_gesamt - personen_zusagen - personen_absagen
            
            kathe_seite = len([g for g in guests if g.get('seite', '').lower() == 'käthe'])
            pascal_seite = len([g for g in guests if g.get('seite', '').lower() == 'pascal'])
            gemeinsam = len([g for g in guests if g.get('seite', '').lower() in ['beide', 'gemeinsam']])
            
            antwort_rate = ((zusagen + absagen) / gesamt * 100) if gesamt > 0 else 0
            zusage_rate = (zusagen / gesamt * 100) if gesamt > 0 else 0
            
            return {
                'gesamt': gesamt,
                'zusagen': zusagen,
                'absagen': absagen,
                'offen': offen,
                'personen_gesamt': personen_gesamt,
                'personen_zusagen': personen_zusagen,
                'personen_absagen': personen_absagen,
                'personen_offen': personen_offen,
                'kathe_seite': kathe_seite,
                'pascal_seite': pascal_seite,
                'gemeinsam': gemeinsam,
                'antwort_rate': round(antwort_rate, 1),
                'zusage_rate': round(zusage_rate, 1)
            }
            
        except Exception as e:
            logger.error(f"Fehler bei der Statistik-Berechnung: {e}")
            return {
                'gesamt': 0, 'zusagen': 0, 'absagen': 0, 'offen': 0,
                'personen_gesamt': 0, 'personen_zusagen': 0, 'personen_absagen': 0, 'personen_offen': 0,
                'kathe_seite': 0, 'pascal_seite': 0, 'gemeinsam': 0,
                'antwort_rate': 0, 'zusage_rate': 0
            }
    
    def lade_budget(self):
        """Lädt Budget-Daten (Kompatibilität)"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                # Einfache Budget-Tabelle verwenden
                cursor.execute("""
                    SELECT 
                        id,
                        kategorie,
                        beschreibung,
                        details,
                        menge,
                        einzelpreis,
                        gesamtpreis,
                        ausgegeben,
                        typ
                    FROM budget 
                    ORDER BY 
                        typ DESC,
                        CASE 
                            WHEN details LIKE '%Personen ×%' OR details LIKE '%Kinder ×%' OR details = 'Pauschalpreis' THEN 0
                            ELSE 1 
                        END,
                        kategorie, 
                        beschreibung
                """)
                
                rows = cursor.fetchall()
                conn.close()
                
                budget_data = []
                for row in rows:
                    budget_data.append(dict(row))
                
                # Für API-Kompatibilität: Konvertiere zu pandas DataFrame falls pandas verfügbar
                if pd is not None and budget_data:
                    try:
                        df = pd.DataFrame(budget_data)
                        return df
                    except Exception as e:
                        logger.warning(f"Fehler bei DataFrame-Konvertierung, gebe Liste zurück: {e}")
                        return budget_data
                else:
                    # Falls pandas nicht verfügbar oder keine Daten, gebe Liste zurück
                    return budget_data
                
        except Exception as e:
            logger.error(f"Fehler beim Laden der Budget-Daten: {e}")
            # Leere DataFrame zurückgeben für API-Kompatibilität
            if pd is not None:
                return pd.DataFrame()
            return []
    
    def speichere_budget(self, budget_df):
        """Speichert Budget-Daten (Kompatibilität)"""
        try:
            if pd is None or budget_df is None:
                return False
            
            with self._get_connection() as conn:
                # Erstelle Budget-Tabelle falls nicht vorhanden
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS budget (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        kategorie TEXT DEFAULT 'Sonstiges',
                        beschreibung TEXT,
                        details TEXT,
                        menge REAL DEFAULT 1,
                        einzelpreis REAL DEFAULT 0,
                        gesamtpreis REAL DEFAULT 0,
                        ausgegeben REAL DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Alte Budget-Einträge löschen
                conn.execute("DELETE FROM budget")
                
                # Neue Einträge hinzufügen
                for _, row in budget_df.iterrows():
                    conn.execute("""
                        INSERT INTO budget (
                            kategorie, beschreibung, details, menge, 
                            einzelpreis, gesamtpreis, ausgegeben
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (
                        str(row.get('kategorie', '')),
                        str(row.get('beschreibung', '')),
                        str(row.get('details', '')),
                        float(row.get('menge', 0)),
                        float(row.get('einzelpreis', 0)),
                        float(row.get('gesamtpreis', 0)),
                        float(row.get('ausgegeben', 0))
                    ))
                
                conn.commit()
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Speichern des Budgets: {e}")
            return False
    
    def load_kosten_config(self) -> dict:
        """Lädt Kostenkonfiguration aus SQLite"""
        try:
            # Lade aus SQLite-Einstellungen
            fixed_costs = {}
            detailed_costs = {}
            manual_guest_counts = {}
            fixed_income = {}  # Neue Variable für Einnahmen
            
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                # Lade fixed_costs aus SQLite
                cursor.execute("SELECT wert FROM einstellungen WHERE schluessel = 'kosten_fixed_costs'")
                row = cursor.fetchone()
                if row and row[0]:
                    try:
                        fixed_costs = json.loads(row[0])
                    except:
                        pass
                
                # Lade fixed_income aus SQLite (neu)
                cursor.execute("SELECT wert FROM einstellungen WHERE schluessel = 'kosten_fixed_income'")
                row = cursor.fetchone()
                if row and row[0]:
                    try:
                        fixed_income = json.loads(row[0])
                    except:
                        pass
                
                # Lade detailed_costs aus SQLite
                cursor.execute("SELECT wert FROM einstellungen WHERE schluessel = 'kosten_detailed_costs'")
                row = cursor.fetchone()
                if row and row[0]:
                    try:
                        detailed_costs = json.loads(row[0])
                    except:
                        pass
                
                # Lade manual_guest_counts aus SQLite
                cursor.execute("SELECT wert FROM einstellungen WHERE schluessel = 'kosten_manual_guest_counts'")
                row = cursor.fetchone()
                if row and row[0]:
                    try:
                        manual_guest_counts = json.loads(row[0])
                    except:
                        pass
                        pass
                        
                conn.close()
            
            # Wenn keine Daten in SQLite, erstelle Defaults
            if not fixed_costs and not detailed_costs:
                default_config = {
                    "fixed_costs": {
                        "Location Miete": 2000,
                        "Dekoration": 500,
                        "Musik/DJ": 800,
                        "Fotograf": 1200,
                        "Sonstiges": 300
                    },
                    "fixed_income": {
                        "Geldgeschenk Eltern Braut": 2000,
                        "Geldgeschenk Eltern Bräutigam": 2000,
                        "Geschenke Gäste (geschätzt)": 1500
                    },
                    "detailed_costs": {
                        "weisser_saal": {
                            "Grundgebühr": 50,
                            "Service": 25
                        },
                        "essen": {
                            "Hauptgang": 35,
                            "Getränke": 15,
                            "Dessert": 8
                        },
                        "party": {
                            "Buffet": 20,
                            "Bar": 25
                        }
                    }
                }
                
                # Speichere Standard-Konfiguration in SQLite
                self.save_kosten_config(default_config)
                return default_config
            
            return {
                "fixed_costs": fixed_costs,
                "fixed_income": fixed_income,
                "detailed_costs": detailed_costs,
                "manual_guest_counts": manual_guest_counts
            }
                
        except Exception as e:
            logger.error(f"Fehler beim Laden der Kostenkonfiguration aus SQLite: {e}")
            return {}
    
    def save_kosten_config(self, config: dict) -> bool:
        """Speichert Kostenkonfiguration in SQLite"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                if 'fixed_costs' in config:
                    cursor.execute("INSERT OR REPLACE INTO einstellungen (schluessel, wert, typ) VALUES (?, ?, ?)", 
                                 ('kosten_fixed_costs', json.dumps(config['fixed_costs']), 'json'))
                
                if 'fixed_income' in config:
                    cursor.execute("INSERT OR REPLACE INTO einstellungen (schluessel, wert, typ) VALUES (?, ?, ?)", 
                                 ('kosten_fixed_income', json.dumps(config['fixed_income']), 'json'))
                
                if 'detailed_costs' in config:
                    cursor.execute("INSERT OR REPLACE INTO einstellungen (schluessel, wert, typ) VALUES (?, ?, ?)", 
                                 ('kosten_detailed_costs', json.dumps(config['detailed_costs']), 'json'))
                
                if 'manual_guest_counts' in config:
                    cursor.execute("INSERT OR REPLACE INTO einstellungen (schluessel, wert, typ) VALUES (?, ?, ?)", 
                                 ('kosten_manual_guest_counts', json.dumps(config['manual_guest_counts']), 'json'))
                
                conn.commit()
                conn.close()
                
                logger.info("Kostenkonfiguration in SQLite gespeichert")
                return True
            
        except Exception as e:
            logger.error(f"Fehler beim Speichern der Kostenkonfiguration in SQLite: {e}")
            return False
    
    def generate_all_guest_credentials(self, force_regenerate=False) -> bool:
        """
        Generiert Credentials für alle Gäste
        
        Args:
            force_regenerate (bool): Falls True, werden auch bestehende Credentials überschrieben
        """
        try:
            updated_count = 0
            
            with self._get_connection() as conn:
                # Alle Gäste mit ihren aktuellen Credentials laden
                conn.row_factory = sqlite3.Row  # Wichtig für dict() Konvertierung
                cursor = conn.execute("""
                    SELECT id, vorname, nachname, guest_code, guest_password 
                    FROM gaeste
                """)
                guests = [dict(row) for row in cursor.fetchall()]
            
                for guest in guests:
                    # Prüfe ob Credentials generiert werden sollen
                    should_generate = force_regenerate or not guest.get('guest_code') or not guest.get('guest_password')
                    
                    if should_generate:
                        # Generiere neue Credentials
                        guest_code = self._generate_guest_code(guest.get('vorname', ''), guest.get('nachname', ''))
                        guest_password = self._generate_guest_password(guest.get('nachname', ''))
                        
                        # Update Credentials direkt in der Datenbank
                        cursor.execute("""
                            UPDATE gaeste 
                            SET guest_code = ?, guest_password = ? 
                            WHERE id = ?
                        """, (guest_code, guest_password, guest['id']))
                        
                        updated_count += 1
                
                conn.commit()
            
            logger.info(f"Credentials für {updated_count} Gäste {'neu generiert' if force_regenerate else 'generiert'}")
            return True
            
        except Exception as e:
            logger.error(f"Fehler beim Generieren der Credentials: {e}")
            return False
    
    def reset_first_login_for_all_guests(self) -> int:
        """
        Setzt den First-Login-Status für alle Gäste zurück
        
        Returns:
            int: Anzahl der aktualisierten Gäste
        """
        try:
            with self._get_connection() as conn:
                cursor = conn.execute("""
                    UPDATE gaeste 
                    SET first_login = 1, first_login_at = NULL 
                    WHERE first_login = 0 OR first_login IS NULL
                """)
                updated_count = cursor.rowcount
                
            logger.info(f"First-Login-Status für {updated_count} Gäste zurückgesetzt")
            return updated_count
            
        except Exception as e:
            logger.error(f"Fehler beim Zurücksetzen des First-Login-Status: {e}")
            return 0
    
    def _generate_guest_code(self, vorname: str, nachname: str) -> str:
        """Generiert einen eindeutigen Gast-Code"""
        try:
            # Basis-Code aus Namen erstellen
            base_code = f"{vorname[:6].upper()}{nachname[:6].upper()}"
            base_code = ''.join(c for c in base_code if c.isalnum())
            
            # Zufällige Zahlen hinzufügen
            random_num = random.randint(1000, 9999)
            guest_code = f"{base_code}{random_num}"
            
            # Eindeutigkeit prüfen
            counter = 1
            original_code = guest_code
            while self._guest_code_exists(guest_code):
                guest_code = f"{original_code}{counter}"
                counter += 1
                if counter > 100:  # Sicherheitsgrenze
                    break
            
            return guest_code
            
        except Exception as e:
            logger.error(f"Fehler beim Generieren des Guest-Codes: {e}")
            return f"GUEST{random.randint(10000, 99999)}"
    
    def _generate_guest_password(self, nachname: str) -> str:
        """Generiert ein Gast-Passwort"""
        try:
            # Basis-Passwort aus Nachname
            base_password = nachname.lower() if nachname else "hochzeit"
            
            # Zufällige Zahlen hinzufügen
            random_num = random.randint(1000, 9999)
            return f"{base_password}{random_num}"
            
        except Exception as e:
            logger.error(f"Fehler beim Generieren des Passworts: {e}")
            return f"password{random.randint(1000, 9999)}"
    
    def _guest_code_exists(self, guest_code: str) -> bool:
        """Prüft ob ein Guest-Code bereits existiert"""
        try:
            with self._get_connection() as conn:
                cursor = conn.execute(
                    "SELECT COUNT(*) FROM gaeste WHERE guest_code = ?",
                    (guest_code,)
                )
                return cursor.fetchone()[0] > 0
                
        except Exception as e:
            logger.error(f"Fehler beim Prüfen des Guest-Codes: {e}")
            return False
    
    # =============================================================================
    # Zeitplan und Aufgaben Methoden
    # =============================================================================
    
    def get_zeitplan(self) -> list:
        """Lädt alle Zeitplan-Einträge"""
        try:
            with self._get_connection() as conn:
                cursor = conn.execute("""
                    SELECT * FROM zeitplan 
                    ORDER BY start_zeit
                """)
                columns = [description[0] for description in cursor.description]
                rows = cursor.fetchall()
                
                zeitplan = []
                for row in rows:
                    entry = dict(zip(columns, row))
                    # Legacy-Kompatibilität
                    entry['datum'] = entry.get('start_zeit', '')
                    entry['uhrzeit'] = entry.get('start_zeit', '')
                    zeitplan.append(entry)
                
                return zeitplan
                
        except Exception as e:
            logger.error(f"Fehler beim Laden des Zeitplans: {e}")
            return []
    
    def add_zeitplan_eintrag(self, eintrag: dict) -> bool:
        """Fügt einen neuen Zeitplan-Eintrag hinzu"""
        try:
            with self._get_connection() as conn:
                conn.execute("""
                    INSERT INTO zeitplan (
                        titel, beschreibung, start_zeit, end_zeit, 
                        kategorie, ort, wichtig
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    eintrag.get('titel', ''),
                    eintrag.get('beschreibung', ''),
                    eintrag.get('start_zeit', eintrag.get('datum', '')),
                    eintrag.get('end_zeit', ''),
                    eintrag.get('kategorie', ''),
                    eintrag.get('ort', ''),
                    bool(eintrag.get('wichtig', eintrag.get('wichtigkeit', 'normal') == 'hoch'))
                ))
                conn.commit()
                logger.info(f"Zeitplan-Eintrag hinzugefügt: {eintrag.get('titel', '')}")
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Hinzufügen des Zeitplan-Eintrags: {e}")
            return False
    
    def update_zeitplan_eintrag(self, eintrag_id: int, eintrag: dict) -> bool:
        """Aktualisiert einen Zeitplan-Eintrag"""
        try:
            with self._get_connection() as conn:
                conn.execute("""
                    UPDATE zeitplan SET 
                        titel=?, beschreibung=?, start_zeit=?, end_zeit=?, 
                        kategorie=?, ort=?, wichtig=?
                    WHERE id=?
                """, (
                    eintrag.get('titel', ''),
                    eintrag.get('beschreibung', ''),
                    eintrag.get('start_zeit', eintrag.get('datum', '')),
                    eintrag.get('end_zeit', ''),
                    eintrag.get('kategorie', ''),
                    eintrag.get('ort', ''),
                    bool(eintrag.get('wichtig', eintrag.get('wichtigkeit', 'normal') == 'hoch')),
                    eintrag_id
                ))
                conn.commit()
                logger.info(f"Zeitplan-Eintrag aktualisiert: ID {eintrag_id}")
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Aktualisieren des Zeitplan-Eintrags: {e}")
            return False
    
    def delete_zeitplan_eintrag(self, eintrag_id: int) -> bool:
        """Löscht einen Zeitplan-Eintrag"""
        try:
            with self._get_connection() as conn:
                conn.execute("DELETE FROM zeitplan WHERE id=?", (eintrag_id,))
                conn.commit()
                logger.info(f"Zeitplan-Eintrag gelöscht: ID {eintrag_id}")
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Löschen des Zeitplan-Eintrags: {e}")
            return False
    
    def get_aufgaben(self) -> list:
        """Lädt alle Aufgaben"""
        try:
            with self._get_connection() as conn:
                cursor = conn.execute("""
                    SELECT * FROM aufgaben 
                    ORDER BY faellig_am, prioritaet DESC
                """)
                columns = [description[0] for description in cursor.description]
                rows = cursor.fetchall()
                
                aufgaben = []
                for row in rows:
                    aufgabe = dict(zip(columns, row))
                    # Legacy-Kompatibilität
                    aufgabe['faelligkeitsdatum'] = aufgabe.get('faellig_am', '')
                    aufgabe['zustaendig'] = aufgabe.get('zugewiesen_an', '')
                    aufgaben.append(aufgabe)
                
                return aufgaben
                
        except Exception as e:
            logger.error(f"Fehler beim Laden der Aufgaben: {e}")
            return []
    
    def add_aufgabe(self, aufgabe: dict) -> bool:
        """Fügt eine neue Aufgabe hinzu"""
        try:
            # Gültige Werte definieren
            valid_priorities = ['Niedrig', 'Normal', 'Hoch']
            valid_status = ['Offen', 'In Bearbeitung', 'Abgeschlossen', 'Verschoben']
            
            # Priorität validieren und normalisieren
            prioritaet = aufgabe.get('prioritaet', 'Normal')
            if prioritaet == 'Mittel':  # JavaScript sendet "Mittel", aber DB erwartet "Normal"
                prioritaet = 'Normal'
            if prioritaet not in valid_priorities:
                prioritaet = 'Normal'
            
            # Status validieren
            status = aufgabe.get('status', 'Offen')
            if status not in valid_status:
                status = 'Offen'
            
            # Fälligkeitsdatum normalisieren (kann leer sein)
            faellig_am = aufgabe.get('faellig_am', aufgabe.get('faelligkeitsdatum', ''))
            if faellig_am in [None, 'null', 'undefined']:
                faellig_am = ''
            
            # Zuständiger normalisieren
            zugewiesen_an = aufgabe.get('zugewiesen_an', aufgabe.get('zustaendig', ''))
            if not zugewiesen_an:
                zugewiesen_an = 'Braut'  # Standardwert
            # Akzeptiere "Beide" für Kontakt-Aufgaben
            valid_assignments = ['Braut', 'Bräutigam', 'Beide']
            if zugewiesen_an not in valid_assignments:
                zugewiesen_an = 'Braut'
            
            # Erstellt von
            erstellt_von = aufgabe.get('erstellt_von', 'System')
            
            with self._get_connection() as conn:
                cursor = conn.execute("""
                    INSERT INTO aufgaben (
                        titel, beschreibung, kategorie, prioritaet, 
                        faellig_am, status, zugewiesen_an, erstellt_von
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    str(aufgabe.get('titel', '')).strip(),
                    str(aufgabe.get('beschreibung', '')).strip(),
                    str(aufgabe.get('kategorie', '')).strip(),
                    prioritaet,
                    faellig_am,
                    status,
                    zugewiesen_an,
                    erstellt_von
                ))
                conn.commit()
                aufgabe_id = cursor.lastrowid
                logger.info(f"Aufgabe hinzugefügt: {aufgabe.get('titel', '')} (ID: {aufgabe_id})")
                return aufgabe_id
                
        except Exception as e:
            logger.error(f"Fehler beim Hinzufügen der Aufgabe: {e}")
            return False
    
    def update_aufgabe(self, aufgabe_id: int, aufgabe: dict) -> bool:
        """Aktualisiert eine Aufgabe"""
        try:
            logger.info(f"UPDATE AUFGABE - ID {aufgabe_id}, Daten: {aufgabe}")
            
            # Gültige Werte definieren
            valid_priorities = ['Niedrig', 'Normal', 'Hoch']
            valid_status = ['Offen', 'In Bearbeitung', 'Abgeschlossen', 'Verschoben']
            
            # Priorität validieren und normalisieren
            prioritaet = aufgabe.get('prioritaet', 'Normal')
            if prioritaet == 'Mittel':  # JavaScript sendet "Mittel", aber DB erwartet "Normal"
                prioritaet = 'Normal'
            if prioritaet not in valid_priorities:
                prioritaet = 'Normal'
            
            # Status validieren
            status = aufgabe.get('status', 'Offen')
            if status not in valid_status:
                status = 'Offen'
            
            # Fälligkeitsdatum normalisieren (kann leer sein)
            faellig_am = aufgabe.get('faellig_am', aufgabe.get('faelligkeitsdatum', ''))
            if faellig_am in [None, 'null', 'undefined']:
                faellig_am = ''
            logger.info(f"Fälligkeitsdatum verarbeitet: faellig_am='{faellig_am}' (Original: faelligkeitsdatum='{aufgabe.get('faelligkeitsdatum', 'NOT_SET')}')")
            
            # Zuständiger normalisieren
            zugewiesen_an = aufgabe.get('zugewiesen_an', aufgabe.get('zustaendig', ''))
            if not zugewiesen_an:
                zugewiesen_an = 'Braut'  # Standardwert
            # Akzeptiere "Beide" für Kontakt-Aufgaben
            valid_assignments = ['Braut', 'Bräutigam', 'Beide']
            if zugewiesen_an not in valid_assignments:
                zugewiesen_an = 'Braut'
            
            with self._get_connection() as conn:
                conn.execute("""
                    UPDATE aufgaben SET 
                        titel=?, beschreibung=?, kategorie=?, prioritaet=?, 
                        faellig_am=?, status=?, zugewiesen_an=?
                    WHERE id=?
                """, (
                    str(aufgabe.get('titel', '')).strip(),
                    str(aufgabe.get('beschreibung', '')).strip(),
                    str(aufgabe.get('kategorie', '')).strip(),
                    prioritaet,
                    faellig_am,
                    status,
                    zugewiesen_an,
                    aufgabe_id
                ))
                conn.commit()
                logger.info(f"Aufgabe aktualisiert: ID {aufgabe_id} - Felder: faellig_am='{faellig_am}', zugewiesen_an='{zugewiesen_an}', prioritaet='{prioritaet}'")
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Aktualisieren der Aufgabe: {e}")
            return False
    
    def delete_aufgabe(self, aufgabe_id: int) -> bool:
        """Löscht eine Aufgabe"""
        try:
            with self._get_connection() as conn:
                conn.execute("DELETE FROM aufgaben WHERE id=?", (aufgabe_id,))
                conn.commit()
                logger.info(f"Aufgabe gelöscht: ID {aufgabe_id}")
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Löschen der Aufgabe: {e}")
            return False
    
    # =============================================================================
    # Settings und Konfiguration
    # =============================================================================
    
    def load_settings(self) -> dict:
        """Lädt Einstellungen aus SQLite-Datenbank"""
        try:
            # Alle Einstellungen aus SQLite laden
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute("SELECT schluessel, wert, typ FROM einstellungen")
                rows = cursor.fetchall()
                conn.close()
                
                settings = {}
                for key, value, typ in rows:
                    # Typkonvertierung
                    if typ == 'int':
                        settings[key] = int(value) if value else 0
                    elif typ == 'float':
                        settings[key] = float(value) if value else 0.0
                    elif typ == 'bool' or typ == 'boolean':
                        settings[key] = value.lower() in ('true', '1', 'yes', 'on') if value else False
                    elif typ == 'json' and value:
                        # JSON-String parsen
                        try:
                            settings[key] = json.loads(value)
                        except json.JSONDecodeError:
                            logger.warning(f"Konnte JSON für Einstellung '{key}' nicht parsen: {value}")
                            settings[key] = value
                    elif typ == 'dict' and value:
                        # JSON-String parsen mit Fallback für Python-Dict-Format
                        try:
                            settings[key] = json.loads(value)
                        except json.JSONDecodeError:
                            # Fallback: Versuche Python eval() für Dict-Strings mit einfachen Anführungszeichen
                            try:
                                import ast
                                settings[key] = ast.literal_eval(value)
                            except:
                                logger.warning(f"Konnte Einstellung '{key}' nicht als Dict parsen: {value}")
                                settings[key] = value
                    else:
                        settings[key] = value if value else ""
                
                # Einfach alle Settings direkt zurückgeben ohne Auto-Initialisierung
                return settings
                
        except Exception as e:
            logger.error(f"Fehler beim Laden der Einstellungen aus SQLite: {e}")
            return {}
    
    def save_settings(self, settings: dict) -> bool:
        """Speichert Einstellungen in SQLite-Datenbank"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                # Strukturierte Settings in SQLite speichern
                if 'hochzeit' in settings:
                    hochzeit = settings['hochzeit']
                    
                    # Prüfe ob hochzeit ein String ist (aus SQLite geladen) oder ein Dict (neu)
                    if isinstance(hochzeit, str):
                        try:
                            hochzeit = json.loads(hochzeit.replace("'", '"'))
                        except Exception as e:
                            logger.warning(f"Fehler beim Parsen von Hochzeit-String: {e}")
                            hochzeit = {}
                    
                    if isinstance(hochzeit, dict):
                        if 'datum' in hochzeit:
                            cursor.execute("INSERT OR REPLACE INTO einstellungen (schluessel, wert, typ) VALUES (?, ?, ?)", 
                                         ('hochzeitsdatum', str(hochzeit['datum']), 'string'))
                        if 'location' in hochzeit:
                            # Prüfe ob location ein Objekt ist, dann serialisiere es als JSON
                            location_value = hochzeit['location']
                            if isinstance(location_value, dict):
                                location_value = json.dumps(location_value)
                            else:
                                location_value = str(location_value)
                            cursor.execute("INSERT OR REPLACE INTO einstellungen (schluessel, wert, typ) VALUES (?, ?, ?)", 
                                         ('hochzeitsort', location_value, 'string'))
                        if 'brautpaar' in hochzeit and isinstance(hochzeit['brautpaar'], dict):
                            brautpaar = hochzeit['brautpaar']
                            if 'braut' in brautpaar:
                                cursor.execute("INSERT OR REPLACE INTO einstellungen (schluessel, wert, typ) VALUES (?, ?, ?)", 
                                             ('braut_name', brautpaar['braut'], 'string'))
                            if 'braeutigam' in brautpaar:
                                cursor.execute("INSERT OR REPLACE INTO einstellungen (schluessel, wert, typ) VALUES (?, ?, ?)", 
                                             ('braeutigam_name', brautpaar['braeutigam'], 'string'))
                
                if 'ui' in settings:
                    ui = settings['ui']
                    # Prüfe ob ui ein String ist (aus SQLite geladen) oder ein Dict (neu)
                    if isinstance(ui, str):
                        try:
                            ui = json.loads(ui.replace("'", '"'))
                        except:
                            ui = {}
                            
                    if isinstance(ui, dict):
                        if 'theme' in ui:
                            cursor.execute("INSERT OR REPLACE INTO einstellungen (schluessel, wert, typ) VALUES (?, ?, ?)", 
                                         ('ui_theme', ui['theme'], 'string'))
                        if 'language' in ui:
                            cursor.execute("INSERT OR REPLACE INTO einstellungen (schluessel, wert, typ) VALUES (?, ?, ?)", 
                                         ('ui_language', ui['language'], 'string'))
                
                if 'features' in settings:
                    features = settings['features']
                    # Prüfe ob features ein String ist (aus SQLite geladen) oder ein Dict (neu)
                    if isinstance(features, str):
                        try:
                            features = json.loads(features.replace("'", '"'))
                        except:
                            features = {}
                            
                    if isinstance(features, dict):
                        if 'guest_dashboard' in features:
                            cursor.execute("INSERT OR REPLACE INTO einstellungen (schluessel, wert, typ) VALUES (?, ?, ?)", 
                                         ('guest_dashboard_enabled', str(features['guest_dashboard']), 'boolean'))
                        if 'qr_codes' in features:
                            cursor.execute("INSERT OR REPLACE INTO einstellungen (schluessel, wert, typ) VALUES (?, ?, ?)", 
                                         ('qr_codes_enabled', str(features['qr_codes']), 'boolean'))
                        if 'email_notifications' in features:
                            cursor.execute("INSERT OR REPLACE INTO einstellungen (schluessel, wert, typ) VALUES (?, ?, ?)", 
                                         ('email_notifications_enabled', str(features['email_notifications']), 'boolean'))
                
                # Alle anderen direkten Settings speichern (einschließlich hochzeitslocation_name)
                for key, value in settings.items():
                    if key not in ['hochzeit', 'ui', 'features']:
                        typ = type(value).__name__
                        if typ == 'bool':
                            typ = 'boolean'
                        cursor.execute("INSERT OR REPLACE INTO einstellungen (schluessel, wert, typ) VALUES (?, ?, ?)", 
                                     (key, str(value), typ))
                
                conn.commit()
                conn.close()
                return True
            
        except Exception as e:
            logger.error(f"Fehler beim Speichern der Einstellungen in SQLite: {e}")
            return False
    
    def save_invitation_generator_settings(self, settings: dict) -> bool:
        """
        Speichert Einstellungen des Einladungs-Generators in der Datenbank
        
        Args:
            settings: Dictionary mit Einstellungen (primaryColor, accentColor, etc.)
        
        Returns:
            bool: Erfolg des Speichervorgangs
        """
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                # Alle Einstellungen mit Präfix 'invitation_' speichern
                for key, value in settings.items():
                    setting_key = f"invitation_{key}"
                    
                    # Typ bestimmen
                    typ = type(value).__name__
                    if typ == 'bool':
                        typ = 'boolean'
                    elif typ in ['dict', 'list']:
                        typ = 'json'
                        value = json.dumps(value, ensure_ascii=False)
                    
                    # Wert zu String konvertieren
                    value_str = str(value) if value is not None else ''
                    
                    cursor.execute("""
                        INSERT OR REPLACE INTO einstellungen (schluessel, wert, typ, beschreibung, updated_at)
                        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """, (setting_key, value_str, typ, f"Einladungs-Generator: {key}"))
                
                conn.commit()
                conn.close()
                
                logger.info(f"✅ Einladungs-Generator Einstellungen gespeichert: {len(settings)} Werte")
                return True
                
        except Exception as e:
            logger.error(f"❌ Fehler beim Speichern der Einladungs-Generator Einstellungen: {e}")
            return False
    
    def load_invitation_generator_settings(self) -> dict:
        """
        Lädt Einstellungen des Einladungs-Generators aus der Datenbank
        
        Returns:
            dict: Dictionary mit Einstellungen oder Default-Werte
        """
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                # Alle invitation_* Einstellungen laden
                cursor.execute("""
                    SELECT schluessel, wert, typ 
                    FROM einstellungen 
                    WHERE schluessel LIKE 'invitation_%'
                """)
                rows = cursor.fetchall()
                conn.close()
                
                settings = {}
                for key, value, typ in rows:
                    # Entferne 'invitation_' Präfix
                    clean_key = key.replace('invitation_', '', 1)
                    
                    # Typkonvertierung
                    if typ == 'int':
                        settings[clean_key] = int(value) if value else 0
                    elif typ == 'float':
                        settings[clean_key] = float(value) if value else 0.0
                    elif typ == 'bool' or typ == 'boolean':
                        settings[clean_key] = value.lower() in ('true', '1', 'yes', 'on') if value else False
                    elif typ == 'json' and value:
                        try:
                            settings[clean_key] = json.loads(value)
                        except json.JSONDecodeError:
                            logger.warning(f"Konnte JSON für Einstellung '{clean_key}' nicht parsen: {value}")
                            settings[clean_key] = value
                    else:
                        settings[clean_key] = value if value else ""
                
                # Fallback: Standard-Werte wenn keine Einstellungen vorhanden
                if not settings:
                    # Versuche Brautpaar-Namen aus allgemeinen Einstellungen zu laden
                    braut_name = self.get_setting('braut_name', 'Braut')
                    braeutigam_name = self.get_setting('braeutigam_name', 'Bräutigam')
                    hochzeitsdatum = self.get_setting('hochzeitsdatum', 'Unser großer Tag')
                    
                    settings = {
                        'primaryColor': '#8b7355',
                        'accentColor': '#d4af37', 
                        'backgroundColor': '#ffffff',
                        'titleText': f"{braut_name} und {braeutigam_name} heiraten",
                        'dateText': hochzeitsdatum,
                        'greetingText': 'Liebe Familie,\nliebe Freunde,',
                        'invitationText': 'Ihr seid herzlich zu unserer Hochzeit eingeladen!\n\nDer QR Code ist euer magisches Portal zu unserem Hochzeitschaos!',
                        'fontSize': 100,
                        'qrSize': 120,
                        'includePhoto': True,
                        'showLoginData': True,
                        'elegantFont': True,
                        'template': 'elegant'
                    }
                    
                    logger.info("📋 Standard-Einstellungen für Einladungs-Generator geladen")
                else:
                    logger.info(f"✅ Einladungs-Generator Einstellungen geladen: {len(settings)} Werte")
                
                return settings
                
        except Exception as e:
            logger.error(f"❌ Fehler beim Laden der Einladungs-Generator Einstellungen: {e}")
            # Fallback: Standard-Werte
            return {
                'primaryColor': '#8b7355',
                'accentColor': '#d4af37', 
                'backgroundColor': '#ffffff',
                'titleText': 'Brautpaar heiratet',
                'dateText': 'Unser großer Tag',
                'greetingText': 'Liebe Familie,\nliebe Freunde,',
                'invitationText': 'Ihr seid herzlich zu unserer Hochzeit eingeladen!\n\nDer QR Code ist euer magisches Portal zu unserem Hochzeitschaos!',
                'fontSize': 100,
                'qrSize': 120,
                'includePhoto': True,
                'showLoginData': True,
                'elegantFont': True,
                'template': 'elegant'
            }
    
    def load_hochzeit_config(self) -> dict:
        """Lädt Hochzeit-Konfiguration aus SQLite"""
        try:
            # Lade aus SQLite-Einstellungen
            config = {}
            
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                # Lade komplette Hochzeitskonfiguration aus SQLite
                cursor.execute("SELECT wert FROM einstellungen WHERE schluessel = 'hochzeit_config'")
                row = cursor.fetchone()
                if row and row[0]:
                    try:
                        config = json.loads(row[0])
                    except:
                        pass
                        
                conn.close()
            
            # Wenn keine Daten in SQLite, erstelle Defaults
            if not config:
                default_config = {
                    "braut": "",
                    "braeutigam": "",
                    "datum": "",
                    "uhrzeit": "",
                    "location": "",
                    "adresse": "",
                    "motto": "",
                    "dresscode": ""
                }
                
                # Speichere Standard-Konfiguration in SQLite
                self.save_hochzeit_config(default_config)
                return default_config
            
            return config
                
        except Exception as e:
            logger.error(f"Fehler beim Laden der Hochzeitskonfiguration aus SQLite: {e}")
            return {}
    
    def save_hochzeit_config(self, config: dict) -> bool:
        """Speichert Hochzeit-Konfiguration in SQLite"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute("INSERT OR REPLACE INTO einstellungen (schluessel, wert, typ) VALUES (?, ?, ?)", 
                             ('hochzeit_config', json.dumps(config), 'json'))
                
                conn.commit()
                conn.close()
                
                logger.info("Hochzeitskonfiguration in SQLite gespeichert")
                return True
            
        except Exception as e:
            logger.error(f"Fehler beim Speichern der Hochzeitskonfiguration in SQLite: {e}")
            return False
    
    # =============================================================================
    # Erweiterte Budget-Methoden
    # =============================================================================
    
    def get_budget_summary(self) -> dict:
        """Gibt Budget-Zusammenfassung zurück"""
        try:
            with self._get_connection() as conn:
                cursor = conn.execute("""
                    SELECT 
                        SUM(CASE WHEN typ = 'Ausgabe' THEN gesamtpreis ELSE 0 END) as total_planned_expenses,
                        SUM(CASE WHEN typ = 'Ausgabe' THEN ausgegeben ELSE 0 END) as total_spent_expenses,
                        SUM(CASE WHEN typ = 'Einnahme' THEN gesamtpreis ELSE 0 END) as total_planned_income,
                        SUM(CASE WHEN typ = 'Einnahme' THEN ausgegeben ELSE 0 END) as total_received_income,
                        kategorie,
                        typ
                    FROM budget 
                    GROUP BY kategorie, typ
                """)
                rows = cursor.fetchall()
                
                total_planned_expenses = 0
                total_spent_expenses = 0
                total_planned_income = 0
                total_received_income = 0
                categories = {}
                
                for row in rows:
                    planned_exp = row[0] or 0
                    spent_exp = row[1] or 0
                    planned_inc = row[2] or 0
                    received_inc = row[3] or 0
                    kategorie = row[4] or 'Sonstiges'
                    typ = row[5] or 'Ausgabe'
                    
                    if typ == 'Ausgabe':
                        total_planned_expenses += planned_exp
                        total_spent_expenses += spent_exp
                    else:  # Einnahme
                        total_planned_income += planned_inc
                        total_received_income += received_inc
                    
                    if kategorie not in categories:
                        categories[kategorie] = {
                            'planned_expenses': 0,
                            'spent_expenses': 0,
                            'planned_income': 0,
                            'received_income': 0
                        }
                    
                    if typ == 'Ausgabe':
                        categories[kategorie]['planned_expenses'] += planned_exp
                        categories[kategorie]['spent_expenses'] += spent_exp
                    else:
                        categories[kategorie]['planned_income'] += planned_inc
                        categories[kategorie]['received_income'] += received_inc
                
                # Netto-Berechnung: Ausgaben minus Einnahmen
                total_planned_net = total_planned_expenses - total_planned_income
                total_spent_net = total_spent_expenses - total_received_income
                remaining_net = total_planned_net - total_spent_net
                
                return {
                    'planned': total_planned_expenses,
                    'spent': total_spent_expenses,
                    'income_planned': total_planned_income,
                    'income_received': total_received_income,
                    'net_planned': total_planned_net,
                    'net_spent': total_spent_net,
                    'remaining': remaining_net,
                    'categories': categories
                }
                
        except Exception as e:
            logger.error(f"Fehler beim Abrufen der Budget-Zusammenfassung: {e}")
            return {
                'planned': 0,
                'spent': 0,
                'income_planned': 0,
                'income_received': 0,
                'net_planned': 0,
                'net_spent': 0,
                'remaining': 0,
                'categories': {}
            }
    
    def get_cost_setting(self, event_type: str, default_value: float) -> float:
        """Gibt Kostenkonstante für ein Event zurück"""
        try:
            config = self.load_kosten_config()
            return config.get('fixed_costs', {}).get(event_type, default_value)
        except Exception as e:
            logger.error(f"Fehler beim Laden der Kostenkonstante für {event_type}: {e}")
            return default_value
    
    def get_detailed_cost_breakdown(self, event_type: str) -> dict:
        """Gibt detaillierte Kostenaufschlüsselung für ein Event zurück"""
        try:
            config = self.load_kosten_config()
            breakdown = config.get('detailed_costs', {}).get(event_type, {})
            
            # Standard-Werte falls nicht konfiguriert
            if not breakdown:
                if event_type == 'standesamt':
                    breakdown = {
                        'Getränke': 15.0,
                        'Snacks': 10.0
                    }
                elif event_type == 'essen':
                    breakdown = {
                        'Hauptgang': 35.0,
                        'Getränke': 20.0
                    }
                elif event_type == 'party':
                    breakdown = {
                        'Getränke': 25.0,
                        'Mitternachtssnack': 8.0
                    }
                else:
                    breakdown = {'Pauschale': self.get_cost_setting(event_type, 0.0)}
            
            return breakdown
        except Exception as e:
            logger.error(f"Fehler beim Laden der detaillierten Kosten für {event_type}: {e}")
            return {'Pauschale': self.get_cost_setting(event_type, 0.0)}
    
    def set_detailed_cost_breakdown(self, event_type: str, breakdown: dict) -> bool:
        """Setzt detaillierte Kostenaufschlüsselung für ein Event"""
        try:
            config = self.load_kosten_config()
            if 'detailed_costs' not in config:
                config['detailed_costs'] = {}
            config['detailed_costs'][event_type] = breakdown
            
            # Auch Gesamtsumme als fixed_cost aktualisieren
            total_cost = sum(breakdown.values())
            if 'fixed_costs' not in config:
                config['fixed_costs'] = {}
            config['fixed_costs'][event_type] = total_cost
            
            self.save_kosten_config(config)
            return True
            
        except Exception as e:
            logger.error(f"Fehler beim Setzen der detaillierten Kosten für {event_type}: {e}")
            return False
    
    def calculate_guest_costs(self, guest_stats: dict = None) -> dict:
        """Berechnet Kosten basierend auf Gäste-Statistiken"""
        try:
            if guest_stats is None:
                guest_stats = self.get_guest_statistics()
            
            config = self.load_kosten_config()
            detailed_costs = config.get('detailed_costs', {})
            
            costs = {}
            
            # Berechne Kosten für verschiedene Events
            for event_type, breakdown in detailed_costs.items():
                event_cost = 0
                for cost_item, cost_per_person in breakdown.items():
                    # Unterschiedliche Gäste-Zahlen für verschiedene Events
                    if event_type == 'standesamt':
                        guest_count = guest_stats.get('personen_zusagen', 0) * 0.5  # Nur ein Teil beim Standesamt
                    elif event_type == 'essen':
                        guest_count = guest_stats.get('personen_zusagen', 0)  # Alle beim Essen
                    elif event_type == 'party':
                        guest_count = guest_stats.get('personen_zusagen', 0) * 0.8  # Nicht alle bei Party
                    else:
                        guest_count = guest_stats.get('personen_zusagen', 0)
                    
                    item_cost = guest_count * cost_per_person
                    event_cost += item_cost
                    
                costs[event_type] = {
                    'total': event_cost,
                    'breakdown': breakdown,
                    'guest_count': guest_count
                }
            
            # Gesamtkosten berechnen
            total_cost = sum(event['total'] for event in costs.values())
            
            return {
                'events': costs,
                'total': total_cost,
                'guest_stats': guest_stats
            }
            
        except Exception as e:
            logger.error(f"Fehler bei der Kostenberechnung: {e}")
            return {'events': {}, 'total': 0, 'guest_stats': {}}
    
    # =============================================================================
    # Authentifizierung und Guest-Zugang
    # =============================================================================
    
    def authenticate_guest(self, guest_code: str, password: str) -> dict:
        """Authentifiziert einen Gast"""
        try:
            with self._get_connection() as conn:
                cursor = conn.execute("""
                    SELECT id, vorname, nachname, guest_code, status 
                    FROM gaeste 
                    WHERE guest_code = ? AND guest_password = ?
                """, (guest_code, password))
                guest = cursor.fetchone()
                
                if guest:
                    return {
                        'success': True,
                        'guest_id': guest[0],
                        'vorname': guest[1],
                        'nachname': guest[2],
                        'guest_code': guest[3],
                        'status': guest[4]
                    }
                else:
                    return {'success': False, 'message': 'Ungültige Zugangsdaten'}
                    
        except Exception as e:
            logger.error(f"Fehler bei der Gast-Authentifizierung: {e}")
            return {'success': False, 'message': 'Authentifizierungsfehler'}
    
    def get_guest_by_code(self, guest_code: str) -> dict:
        """Gibt Gast-Daten anhand des Guest-Codes zurück"""
        try:
            with self._get_connection() as conn:
                cursor = conn.execute("""
                    SELECT * FROM gaeste WHERE guest_code = ?
                """, (guest_code,))
                columns = [description[0] for description in cursor.description]
                row = cursor.fetchone()
                
                if row:
                    return dict(zip(columns, row))
                else:
                    return {}
                    
        except Exception as e:
            logger.error(f"Fehler beim Laden des Gastes mit Code {guest_code}: {e}")
            return {}
    
    def update_guest_status(self, guest_id: int, status: str, teilnahme: dict = None) -> bool:
        """Aktualisiert Gast-Status und Teilnahme-Details"""
        try:
            with self._get_connection() as conn:
                # Basis-Update
                update_data = {'status': status}
                
                # Teilnahme-Details hinzufügen falls vorhanden
                if teilnahme:
                    update_data.update({
                        'standesamt': teilnahme.get('standesamt', False),
                        'kaffee_kuchen': teilnahme.get('kaffee_kuchen', False),
                        'essen': teilnahme.get('essen', False),
                        'party': teilnahme.get('party', False),
                        'anmerkungen': teilnahme.get('anmerkungen', '')
                    })
                
                # SQL-Update generieren
                set_clause = ', '.join([f"{key}=?" for key in update_data.keys()])
                values = list(update_data.values()) + [guest_id]
                
                conn.execute(f"""
                    UPDATE gaeste SET {set_clause} WHERE id=?
                """, values)
                
                conn.commit()
                logger.info(f"Gast-Status aktualisiert: ID {guest_id}, Status {status}")
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Aktualisieren des Gast-Status: {e}")
            return False
    
    # =============================================================================
    # Weitere Kompatibilitätsmethoden
    # =============================================================================
    
    def save_zeitplan(self):
        """Speichert Zeitplan (Kompatibilität - SQLite speichert automatisch)"""
        pass
    
    def lade_zeitplan(self):
        """Lädt Zeitplan (Kompatibilität - SQLite lädt automatisch)"""
        return self.get_zeitplan()
    
    def save_aufgaben(self) -> bool:
        """Speichert Aufgaben (Kompatibilität - SQLite speichert automatisch)"""
        return True
    
    def lade_aufgaben(self):
        """Lädt Aufgaben (Kompatibilität - SQLite lädt automatisch)"""
        return self.get_aufgaben()
    
    def save_budget(self):
        """Speichert Budget (Kompatibilität - SQLite speichert automatisch)"""
        pass
    
    def load_config(self) -> dict:
        """Lädt allgemeine Konfiguration (Kompatibilität)"""
        # Kombiniert verschiedene Config-Dateien
        config = {}
        config.update(self.load_hochzeit_config())
        config.update(self.load_settings())
        config.update(self.load_kosten_config())
        return config
    
    def save_config(self, config: dict) -> bool:
        """Speichert allgemeine Konfiguration (Kompatibilität)"""
        try:
            # Aufteilen in verschiedene Config-Dateien
            success = True
            
            if 'braut' in config or 'braeutigam' in config:
                hochzeit_config = {k: v for k, v in config.items() 
                                 if k in ['braut', 'braeutigam', 'datum', 'location', 'adresse']}
                success &= self.save_hochzeit_config(hochzeit_config)
            
            if 'ui' in config or 'features' in config:
                settings = {k: v for k, v in config.items() 
                           if k in ['ui', 'features', 'hochzeit']}
                success &= self.save_settings(settings)
            
            if 'fixed_costs' in config or 'detailed_costs' in config:
                kosten_config = {k: v for k, v in config.items() 
                               if k in ['fixed_costs', 'detailed_costs', 'cost_settings']}
                success &= self.save_kosten_config(kosten_config)
            
            return success
            
        except Exception as e:
            logger.error(f"Fehler beim Speichern der Konfiguration: {e}")
            return False

    def get_app_config(self, config_key: str) -> dict:
        """Lädt eine spezifische App-Konfiguration"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Stelle sicher, dass die Tabelle existiert
                cursor.execute('''
                CREATE TABLE IF NOT EXISTS app_config (
                    key TEXT PRIMARY KEY,
                    value TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                ''')
                
                cursor.execute('SELECT value FROM app_config WHERE key = ?', (config_key,))
                result = cursor.fetchone()
                
                if result:
                    import json
                    return json.loads(result[0])
                else:
                    return None
                    
        except Exception as e:
            logger.error(f"Fehler beim Laden der App-Konfiguration '{config_key}': {e}")
            return None

    def save_app_config(self, config_key: str, config_value: dict) -> bool:
        """Speichert eine spezifische App-Konfiguration"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Stelle sicher, dass die Tabelle existiert
                cursor.execute('''
                CREATE TABLE IF NOT EXISTS app_config (
                    key TEXT PRIMARY KEY,
                    value TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                ''')
                
                import json
                config_json = json.dumps(config_value, ensure_ascii=False)
                
                cursor.execute('''
                INSERT OR REPLACE INTO app_config (key, value, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ''', (config_key, config_json))
                
                conn.commit()
                logger.info(f"App-Konfiguration '{config_key}' erfolgreich gespeichert")
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Speichern der App-Konfiguration '{config_key}': {e}")
            return False
    
    def backup_database(self) -> bool:
        """Erstellt ein Backup der SQLite-Datenbank"""
        try:
            from datetime import datetime
            import shutil
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = f"{self.db_path}.backup_{timestamp}"
            
            shutil.copy2(self.db_path, backup_path)
            return True
            
        except Exception as e:
            logger.error(f"Fehler beim Erstellen des Datenbank-Backups: {e}")
            return False
    
    def get_database_stats(self) -> dict:
        """Gibt Datenbank-Statistiken zurück"""
        try:
            with self._get_connection() as conn:
                stats = {}
                
                # Tabellen-Statistiken
                cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = [row[0] for row in cursor.fetchall()]
                
                for table in tables:
                    cursor = conn.execute(f"SELECT COUNT(*) FROM {table}")
                    count = cursor.fetchone()[0]
                    stats[f"{table}_count"] = count
                
                # Datenbank-Größe
                cursor = conn.execute("PRAGMA page_count")
                page_count = cursor.fetchone()[0]
                cursor = conn.execute("PRAGMA page_size")
                page_size = cursor.fetchone()[0]
                stats['db_size_bytes'] = page_count * page_size
                
                return stats
                
        except Exception as e:
            logger.error(f"Fehler beim Abrufen der Datenbank-Statistiken: {e}")
            return {}
    
    def validate_data_integrity(self) -> dict:
        """Validiert die Datenintegrität"""
        try:
            issues = []
            warnings = []
            
            with self._get_connection() as conn:
                # Prüfe auf doppelte Guest-Codes
                cursor = conn.execute("""
                    SELECT guest_code, COUNT(*) 
                    FROM gaeste 
                    WHERE guest_code IS NOT NULL 
                    GROUP BY guest_code 
                    HAVING COUNT(*) > 1
                """)
                duplicates = cursor.fetchall()
                if duplicates:
                    issues.append(f"Doppelte Guest-Codes gefunden: {len(duplicates)}")
                
                # Prüfe auf Gäste ohne Status
                cursor = conn.execute("SELECT COUNT(*) FROM gaeste WHERE status IS NULL OR status = ''")
                no_status = cursor.fetchone()[0]
                if no_status > 0:
                    warnings.append(f"Gäste ohne Status: {no_status}")
                
                # Prüfe Budget-Konsistenz
                cursor = conn.execute("SELECT COUNT(*) FROM budget WHERE gesamtpreis < 0")
                negative_budget = cursor.fetchone()[0]
                if negative_budget > 0:
                    issues.append(f"Budget-Einträge mit negativen Preisen: {negative_budget}")
                
                return {
                    'valid': len(issues) == 0,
                    'issues': issues,
                    'warnings': warnings
                }
                
        except Exception as e:
            logger.error(f"Fehler bei der Datenvalidierung: {e}")
            return {'valid': False, 'issues': [f"Validierungsfehler: {e}"], 'warnings': []}
    
    # =============================================================================
    # Weitere fehlende Methoden für vollständige Kompatibilität
    # =============================================================================
    
    def load_aufgaben(self) -> list:
        """Lädt Aufgaben (Kompatibilität - gleich wie get_aufgaben)"""
        return self.get_aufgaben()
    
    def load_zeitplan(self):
        """Lädt Zeitplan (Kompatibilität - SQLite lädt automatisch)"""
        # Für Kompatibilität - manche APIs erwarten load_zeitplan()
        pass
    
    def add_aufgabe(self, aufgabe_data: dict) -> int:
        """Fügt eine neue Aufgabe hinzu und gibt die ID zurück"""
        try:
            with self._get_connection() as conn:
                cursor = conn.execute("""
                    INSERT INTO aufgaben (
                        titel, beschreibung, kategorie, prioritaet, 
                        faellig_am, status, zugewiesen_an, erstellt_von
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    aufgabe_data.get('titel', ''),
                    aufgabe_data.get('beschreibung', ''),
                    aufgabe_data.get('kategorie', ''),
                    aufgabe_data.get('prioritaet', 'Normal'),
                    aufgabe_data.get('faellig_am', aufgabe_data.get('faelligkeitsdatum', '')),
                    aufgabe_data.get('status', 'Offen'),
                    aufgabe_data.get('zugewiesen_an', aufgabe_data.get('zustaendig', '')),
                    aufgabe_data.get('erstellt_von', '')
                ))
                aufgabe_id = cursor.lastrowid
                conn.commit()
                logger.info(f"Aufgabe hinzugefügt: {aufgabe_data.get('titel', '')} (ID: {aufgabe_id})")
                return aufgabe_id
                
        except Exception as e:
            logger.error(f"Fehler beim Hinzufügen der Aufgabe: {e}")
            return 0
    
    def get_aufgaben_statistics(self) -> dict:
        """Berechnet Aufgaben-Statistiken"""
        try:
            with self._get_connection() as conn:
                # Gesamtzahl und Status-Verteilung
                cursor = conn.execute("""
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'erledigt' THEN 1 ELSE 0 END) as erledigt,
                        SUM(CASE WHEN status = 'in_bearbeitung' THEN 1 ELSE 0 END) as in_bearbeitung,
                        SUM(CASE WHEN status = 'offen' THEN 1 ELSE 0 END) as offen
                    FROM aufgaben
                """)
                row = cursor.fetchone()
                
                # Prioritäts-Verteilung
                cursor = conn.execute("""
                    SELECT prioritaet, COUNT(*) as count 
                    FROM aufgaben 
                    GROUP BY prioritaet
                """)
                prioritaeten = {row[0]: row[1] for row in cursor.fetchall()}
                
                # Kategorien-Verteilung
                cursor = conn.execute("""
                    SELECT kategorie, COUNT(*) as count 
                    FROM aufgaben 
                    WHERE kategorie IS NOT NULL AND kategorie != ''
                    GROUP BY kategorie
                """)
                kategorien = {row[0]: row[1] for row in cursor.fetchall()}
                
                # Zuständigkeits-Verteilung
                cursor = conn.execute("""
                    SELECT zugewiesen_an, COUNT(*) as count 
                    FROM aufgaben 
                    WHERE zugewiesen_an IS NOT NULL AND zugewiesen_an != ''
                    GROUP BY zugewiesen_an
                """)
                zustaendigkeiten = {row[0]: row[1] for row in cursor.fetchall()}
                
                return {
                    'total': row[0],
                    'erledigt': row[1],
                    'in_bearbeitung': row[2],
                    'offen': row[3],
                    'prioritaeten': prioritaeten,
                    'kategorien': kategorien,
                    'zustaendigkeiten': zustaendigkeiten,
                    'completion_rate': round((row[1] / row[0] * 100), 1) if row[0] > 0 else 0
                }
                
        except Exception as e:
            logger.error(f"Fehler bei der Aufgaben-Statistik: {e}")
            return {
                'total': 0, 'erledigt': 0, 'in_bearbeitung': 0, 'offen': 0,
                'prioritaeten': {}, 'kategorien': {}, 'zustaendigkeiten': {},
                'completion_rate': 0
            }
    
    def get_settings(self) -> dict:
        """Lädt Einstellungen (Kompatibilität - gleich wie load_settings)"""
        return self.load_settings()
    def get_setting(self, key: str, default=None):
        """Gibt eine einzelne Einstellung zurück"""
        try:
            settings = self.load_settings()
            
            # Nested keys unterstützen (z.B. "ui.theme")
            if '.' in key:
                keys = key.split('.')
                current = settings
                for k in keys:
                    if isinstance(current, dict) and k in current:
                        current = current[k]
                    else:
                        return default
                return current
            else:
                return settings.get(key, default)
                
        except Exception as e:
            logger.error(f"Fehler beim Laden der Einstellung {key}: {e}")
            return default
    
    # =============================================================================
    # Zeitplan-Kompatibilität (DataFrame-Style)
    # =============================================================================
    
    @property
    def zeitplan_df(self):
        """Emuliert pandas DataFrame für Zeitplan"""
        if pd is None:
            return []
        
        try:
            zeitplan = self.get_zeitplan()
            if not zeitplan:
                return pd.DataFrame()
            
            # Konvertiere zu DataFrame
            df = pd.DataFrame(zeitplan)
            
            # Legacy-Spalten-Mapping
            if 'titel' in df.columns:
                df['Programmpunkt'] = df['titel']
            if 'uhrzeit' in df.columns:
                df['Uhrzeit'] = df['uhrzeit']
            if 'beschreibung' in df.columns:
                df['Dauer'] = df['beschreibung']
            if 'ort' in df.columns:
                df['Verantwortlich'] = df['ort']
            if 'wichtigkeit' in df.columns:
                df['Status'] = df['wichtigkeit']
            
            return df
            
        except Exception as e:
            logger.error(f"Fehler beim Erstellen der Zeitplan-DataFrame: {e}")
            return pd.DataFrame()
    
    @zeitplan_df.setter
    def zeitplan_df(self, df):
        """Setzt den Zeitplan aus einer DataFrame"""
        try:
            if df is None or (hasattr(df, 'empty') and df.empty):
                return
            
            # Lösche alle bestehenden Zeitplan-Einträge
            with self._get_connection() as conn:
                conn.execute("DELETE FROM zeitplan")
                
                # Füge neue Einträge hinzu
                for _, row in df.iterrows():
                    conn.execute("""
                        INSERT INTO zeitplan (
                            titel, beschreibung, datum, uhrzeit, 
                            kategorie, ort, wichtigkeit
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (
                        str(row.get('Programmpunkt', row.get('titel', ''))),
                        str(row.get('Dauer', row.get('beschreibung', ''))),
                        str(row.get('Datum', row.get('datum', ''))),
                        str(row.get('Uhrzeit', row.get('uhrzeit', ''))),
                        str(row.get('Kategorie', row.get('kategorie', 'Allgemein'))),
                        str(row.get('Verantwortlich', row.get('ort', ''))),
                        str(row.get('Status', row.get('wichtigkeit', 'normal')))
                    ))
                
                conn.commit()
                logger.info(f"Zeitplan aus DataFrame gespeichert: {len(df)} Einträge")
                
        except Exception as e:
            logger.error(f"Fehler beim Setzen des Zeitplan-DataFrames: {e}")
    
    # =============================================================================
    # Budget-Kompatibilität (DataFrame-Style) 
    # =============================================================================
    
    @property
    def budget_df(self):
        """Emuliert pandas DataFrame für Budget"""
        if pd is None:
            return []
        
        try:
            budget = self.lade_budget()
            return budget  # lade_budget gibt bereits DataFrame zurück
            
        except Exception as e:
            logger.error(f"Fehler beim Erstellen der Budget-DataFrame: {e}")
            return pd.DataFrame()
    
    @budget_df.setter  
    def budget_df(self, df):
        """Setzt das Budget aus einer DataFrame"""
        try:
            self.speichere_budget(df)
        except Exception as e:
            logger.error(f"Fehler beim Setzen der Budget-DataFrame: {e}")
    
    # =============================================================================
    # Guest-Methoden für API-Kompatibilität
    # =============================================================================
    
    def add_guest(self, guest_data: dict) -> bool:
        """Fügt einen neuen Gast hinzu (API-Kompatibilität)"""
        try:
            # Direkte Verwendung der add_guest_to_db Methode mit korrektem Mapping
            return self.add_guest_to_db(guest_data)
            
        except Exception as e:
            logger.error(f"Fehler beim Hinzufügen des Gastes: {e}")
            return False
    
    # =============================================================================
    # Fehlende Methoden für API-Kompatibilität
    # =============================================================================
    
    def load_zeitplan(self):
        """Lädt Zeitplan (API-Kompatibilität)"""
        return self.get_zeitplan()
    
    def load_aufgaben(self):
        """Lädt Aufgaben (API-Kompatibilität)"""
        return self.get_aufgaben()
    
    def get_aufgaben_statistics(self) -> dict:
        """Gibt Aufgaben-Statistiken zurück"""
        try:
            aufgaben = self.get_aufgaben()
            from datetime import datetime
            
            total = len(aufgaben)
            offen = len([a for a in aufgaben if a.get('status', '') == 'Offen'])
            in_bearbeitung = len([a for a in aufgaben if a.get('status', '') == 'In Bearbeitung'])
            abgeschlossen = len([a for a in aufgaben if a.get('status', '') == 'Abgeschlossen'])
            
            # Überfällige Aufgaben berechnen
            heute = datetime.now().date()
            ueberfaellig = 0
            
            for aufgabe in aufgaben:
                if aufgabe.get('status', '') != 'Abgeschlossen' and aufgabe.get('faelligkeitsdatum'):
                    try:
                        if isinstance(aufgabe['faelligkeitsdatum'], str):
                            faellig_datum = datetime.strptime(aufgabe['faelligkeitsdatum'], '%Y-%m-%d').date()
                        else:
                            faellig_datum = aufgabe['faelligkeitsdatum']
                        
                        if faellig_datum < heute:
                            ueberfaellig += 1
                    except (ValueError, TypeError):
                        continue
            
            # Fortschritt in Prozent berechnen
            fortschritt_prozent = round((abgeschlossen / total * 100) if total > 0 else 0, 1)
            
            return {
                'gesamt': total,
                'offen': offen,
                'in_bearbeitung': in_bearbeitung,
                'abgeschlossen': abgeschlossen,
                'ueberfaellig': ueberfaellig,
                'fortschritt_prozent': fortschritt_prozent
            }
            
        except Exception as e:
            logger.error(f"Fehler bei Aufgaben-Statistiken: {e}")
            return {
                'gesamt': 0, 
                'offen': 0, 
                'in_bearbeitung': 0, 
                'abgeschlossen': 0,
                'ueberfaellig': 0,
                'fortschritt_prozent': 0
            }
    
    def get_settings(self) -> dict:
        """Lädt Einstellungen (API-Kompatibilität)"""
        return self.load_settings()
    
    def _get_connection(self):
        """Gibt eine SQLite-Datenbankverbindung zurück"""
        return sqlite3.connect(self.db_path)
    
    def add_budget_item(self, item: dict) -> bool:
        """Fügt einen Budget-Eintrag hinzu"""
        try:
            with self._get_connection() as conn:
                conn.execute("""
                    INSERT INTO budget (
                        kategorie, beschreibung, details, menge, 
                        einzelpreis, gesamtpreis, ausgegeben, typ
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    item.get('kategorie', ''),
                    item.get('beschreibung', ''),
                    item.get('details', ''),
                    float(item.get('menge', 0)),
                    float(item.get('einzelpreis', 0)),
                    float(item.get('gesamtpreis', 0)),
                    float(item.get('ausgegeben', 0)),
                    item.get('typ', 'Ausgabe')
                ))
                conn.commit()
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Hinzufügen des Budget-Eintrags: {e}")
            return False
    
    def update_budget_item(self, item_id: int, item: dict) -> bool:
        """Aktualisiert einen Budget-Eintrag"""
        try:
            with self._get_connection() as conn:
                conn.execute("""
                    UPDATE budget SET 
                        kategorie=?, beschreibung=?, details=?, menge=?, 
                        einzelpreis=?, gesamtpreis=?, ausgegeben=?, typ=?
                    WHERE id=?
                """, (
                    item.get('kategorie', ''),
                    item.get('beschreibung', ''),
                    item.get('details', ''),
                    float(item.get('menge', 0)),
                    float(item.get('einzelpreis', 0)),
                    float(item.get('gesamtpreis', 0)),
                    float(item.get('ausgegeben', 0)),
                    item.get('typ', 'Ausgabe'),
                    item_id
                ))
                conn.commit()
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Aktualisieren des Budget-Eintrags: {e}")
            return False
    
    def delete_budget_item(self, item_id: int) -> bool:
        """Löscht einen Budget-Eintrag"""
        try:
            with self._get_connection() as conn:
                conn.execute("DELETE FROM budget WHERE id=?", (item_id,))
                conn.commit()
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Löschen des Budget-Eintrags: {e}")
            return False

    # =============================================================================
    # Zeitplan-Funktionen
    # =============================================================================
    
    def add_zeitplan_entry(self, entry_data):
        """Fügt einen neuen Zeitplan-Eintrag hinzu"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute("""
                    INSERT INTO zeitplan (
                        titel, beschreibung, start_zeit, end_zeit, ort, kategorie,
                        farbe, wichtig, nur_brautpaar, eventteile
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    entry_data.get('titel', ''),
                    entry_data.get('beschreibung', ''),
                    entry_data.get('start_zeit', ''),
                    entry_data.get('end_zeit', ''),
                    entry_data.get('ort', ''),
                    entry_data.get('kategorie', 'Allgemein'),
                    entry_data.get('farbe', '#007bff'),
                    entry_data.get('wichtig', False),
                    entry_data.get('nur_brautpaar', False),
                    json.dumps(entry_data.get('eventteile', []))
                ))
                
                conn.commit()
                entry_id = cursor.lastrowid
                conn.close()
                return entry_id
                
        except Exception as e:
            logger.error(f"Fehler beim Hinzufügen des Zeitplan-Eintrags: {e}")
            return None
    
    def get_zeitplan(self, nur_oeffentlich=False):
        """Gibt alle Zeitplan-Einträge zurück"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                query = "SELECT * FROM zeitplan"
                if nur_oeffentlich:
                    query += " WHERE nur_brautpaar = 0"
                query += " ORDER BY start_zeit"
                
                cursor.execute(query)
                
                entries = []
                for row in cursor.fetchall():
                    entry = dict(row)
                    # Eventteile JSON parsen
                    if entry['eventteile']:
                        try:
                            entry['eventteile'] = json.loads(entry['eventteile'])
                        except:
                            entry['eventteile'] = []
                    else:
                        entry['eventteile'] = []
                    
                    # Legacy-Format für Frontend-Kompatibilität
                    entry['Programmpunkt'] = entry['titel']
                    entry['Verantwortlich'] = entry['beschreibung']
                    entry['Status'] = entry['kategorie']
                    entry['public'] = not bool(entry['nur_brautpaar'])
                    
                    # Zeit-Felder extrahieren aus DATETIME-Format
                    if entry['start_zeit']:
                        # Format: "2025-09-01 15:00:00" -> "15:00"
                        try:
                            start_time = entry['start_zeit'].split(' ')[1][:5]  # "15:00:00" -> "15:00"
                            entry['Uhrzeit'] = start_time  # Legacy-Kompatibilität
                            entry['uhrzeit'] = start_time  # Neue Frontend-Kompatibilität
                        except:
                            entry['Uhrzeit'] = '00:00'
                            entry['uhrzeit'] = '00:00'
                    else:
                        entry['Uhrzeit'] = '00:00'
                        entry['uhrzeit'] = '00:00'
                    
                    if entry['end_zeit']:
                        try:
                            end_time = entry['end_zeit'].split(' ')[1][:5]  # "15:00:00" -> "15:00"
                            entry['EndZeit'] = end_time
                        except:
                            entry['EndZeit'] = None
                    else:
                        entry['EndZeit'] = None
                    
                    # Dauer berechnen
                    if entry['start_zeit'] and entry['end_zeit']:
                        try:
                            from datetime import datetime
                            start_dt = datetime.strptime(entry['start_zeit'], '%Y-%m-%d %H:%M:%S')
                            end_dt = datetime.strptime(entry['end_zeit'], '%Y-%m-%d %H:%M:%S')
                            duration = end_dt - start_dt
                            total_minutes = int(duration.total_seconds() // 60)
                            hours = int(duration.total_seconds() // 3600)
                            minutes = int((duration.total_seconds() % 3600) // 60)
                            entry['Dauer'] = f"{hours:02d}:{minutes:02d}"  # Legacy-Format "HH:MM"
                            entry['dauer'] = str(total_minutes)  # Neue Frontend-Kompatibilität in Minuten
                        except:
                            entry['Dauer'] = ''
                            entry['dauer'] = ''
                    else:
                        entry['Dauer'] = ''
                        entry['dauer'] = ''
                    
                    entries.append(entry)
                
                conn.close()
                return entries
                
        except Exception as e:
            logger.error(f"Fehler beim Abrufen der Zeitplan-Daten: {e}")
            return []
    
    def update_zeitplan_entry(self, entry_id, entry_data):
        """Aktualisiert einen Zeitplan-Eintrag"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute("""
                    UPDATE zeitplan SET
                        titel = ?, beschreibung = ?, start_zeit = ?, end_zeit = ?,
                        ort = ?, kategorie = ?, farbe = ?, wichtig = ?, 
                        nur_brautpaar = ?, eventteile = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (
                    entry_data.get('titel', ''),
                    entry_data.get('beschreibung', ''),
                    entry_data.get('start_zeit', ''),
                    entry_data.get('end_zeit', ''),
                    entry_data.get('ort', ''),
                    entry_data.get('kategorie', 'Allgemein'),
                    entry_data.get('farbe', '#007bff'),
                    entry_data.get('wichtig', False),
                    entry_data.get('nur_brautpaar', False),
                    json.dumps(entry_data.get('eventteile', [])),
                    entry_id
                ))
                
                conn.commit()
                conn.close()
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Aktualisieren des Zeitplan-Eintrags: {e}")
            return False
    
    def delete_zeitplan_entry(self, entry_id):
        """Löscht einen Zeitplan-Eintrag"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute("DELETE FROM zeitplan WHERE id = ?", (entry_id,))
                
                conn.commit()
                conn.close()
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Löschen des Zeitplan-Eintrags: {e}")
            return False

    # =============================================================================
    # Aufgaben-Funktionen
    # =============================================================================
    
    def add_aufgabe(self, aufgabe_data):
        """Fügt eine neue Aufgabe hinzu"""
        print("=== ADD AUFGABE DEBUG ===")
        print(f"Input aufgabe_data: {aufgabe_data}")
        
        # Field mapping: Frontend → SQLite
        faellig_am_value = aufgabe_data.get('faellig_am') or aufgabe_data.get('faelligkeitsdatum', '')
        zugewiesen_an_value = aufgabe_data.get('zugewiesen_an') or aufgabe_data.get('zustaendig', '')
        prioritaet_value = aufgabe_data.get('prioritaet', 'Normal')
        erstellt_von_value = aufgabe_data.get('erstellt_von', 'Unbekannt')
        
        # Normalize prioritaet value for CHECK constraint
        if prioritaet_value == 'Mittel':
            prioritaet_value = 'Normal'
            print(f"Priorität normalisiert: 'Mittel' → 'Normal'")
            
        print(f"Field Mapping:")
        print(f"  faelligkeitsdatum → faellig_am: '{aufgabe_data.get('faelligkeitsdatum')}' → '{faellig_am_value}'")
        print(f"  zustaendig → zugewiesen_an: '{aufgabe_data.get('zustaendig')}' → '{zugewiesen_an_value}'")
        print(f"  prioritaet: '{aufgabe_data.get('prioritaet')}' → '{prioritaet_value}'")
        print(f"  erstellt_von: '{erstellt_von_value}'")
        
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                # Check if values are valid for CHECK constraints
                if prioritaet_value not in ['Hoch', 'Normal', 'Niedrig']:
                    print(f"⚠️  WARNUNG: Unbekannte Priorität '{prioritaet_value}', verwende 'Normal'")
                    prioritaet_value = 'Normal'
                
                status_value = aufgabe_data.get('status', 'Offen')
                if status_value not in ['Offen', 'In Bearbeitung', 'Abgeschlossen', 'Verschoben']:
                    print(f"⚠️  WARNUNG: Unbekannter Status '{status_value}', verwende 'Offen'")
                    status_value = 'Offen'
                
                sql_params = (
                    aufgabe_data.get('titel', ''),
                    aufgabe_data.get('beschreibung', ''),
                    status_value,
                    prioritaet_value,
                    aufgabe_data.get('kategorie', 'Allgemein'),
                    faellig_am_value if faellig_am_value else None,  # Handle empty strings
                    zugewiesen_an_value,
                    aufgabe_data.get('notizen', ''),
                    erstellt_von_value
                )
                
                print(f"SQL Parameters: {sql_params}")
                
                cursor.execute("""
                    INSERT INTO aufgaben (
                        titel, beschreibung, status, prioritaet, kategorie,
                        faellig_am, zugewiesen_an, notizen, erstellt_von
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, sql_params)
                
                conn.commit()
                aufgabe_id = cursor.lastrowid
                conn.close()
                
                print(f"✅ Aufgabe erfolgreich hinzugefügt mit ID: {aufgabe_id}")
                print("=========================")
                return aufgabe_id
                
        except sqlite3.IntegrityError as e:
            print(f"❌ SQLite Constraint Fehler: {e}")
            print(f"SQL Parameters waren: {sql_params}")
            print("=========================")
            logger.error(f"SQLite Constraint Fehler beim Hinzufügen der Aufgabe: {e}")
            return None
        except Exception as e:
            print(f"❌ Fehler beim Hinzufügen der Aufgabe: {e}")
            print("=========================")
            logger.error(f"Fehler beim Hinzufügen der Aufgabe: {e}")
            return None
    
    def get_aufgaben(self):
        """Gibt alle Aufgaben zurück"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT * FROM aufgaben ORDER BY 
                        CASE prioritaet 
                            WHEN 'Hoch' THEN 1 
                            WHEN 'Normal' THEN 2 
                            WHEN 'Niedrig' THEN 3 
                        END,
                        faellig_am, id
                """)
                
                raw_aufgaben = [dict(row) for row in cursor.fetchall()]
                conn.close()
                
                # Field mapping: SQLite → Frontend
                aufgaben = []
                for aufgabe in raw_aufgaben:
                    mapped_aufgabe = dict(aufgabe)  # Copy all fields
                    
                    # Map SQLite fields to Frontend fields
                    if 'faellig_am' in aufgabe and aufgabe['faellig_am']:
                        mapped_aufgabe['faelligkeitsdatum'] = aufgabe['faellig_am']
                    else:
                        mapped_aufgabe['faelligkeitsdatum'] = ''
                        
                    if 'zugewiesen_an' in aufgabe and aufgabe['zugewiesen_an']:
                        mapped_aufgabe['zustaendig'] = aufgabe['zugewiesen_an']
                    else:
                        mapped_aufgabe['zustaendig'] = 'Braut'  # Default
                    
                    aufgaben.append(mapped_aufgabe)
                    
                return aufgaben
                
        except Exception as e:
            logger.error(f"Fehler beim Abrufen der Aufgaben: {e}")
            return []
    
    def update_aufgabe(self, aufgabe_id, aufgabe_data):
        """Aktualisiert eine Aufgabe"""
        # Field mapping: Frontend → SQLite
        faellig_am_value = aufgabe_data.get('faellig_am') or aufgabe_data.get('faelligkeitsdatum', '')
        zugewiesen_an_value = aufgabe_data.get('zugewiesen_an') or aufgabe_data.get('zustaendig', '')
        prioritaet_value = aufgabe_data.get('prioritaet', 'Normal')
        erstellt_von_value = aufgabe_data.get('erstellt_von', 'Unbekannt')
        
        # Normalize prioritaet value for CHECK constraint
        if prioritaet_value == 'Mittel':
            prioritaet_value = 'Normal'
        
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                # Check if values are valid for CHECK constraints
                if prioritaet_value not in ['Hoch', 'Normal', 'Niedrig']:
                    print(f"⚠️  WARNUNG: Unbekannte Priorität '{prioritaet_value}', verwende 'Normal'")
                    prioritaet_value = 'Normal'
                
                status_value = aufgabe_data.get('status', 'Offen')
                if status_value not in ['Offen', 'In Bearbeitung', 'Abgeschlossen', 'Verschoben']:
                    print(f"⚠️  WARNUNG: Unbekannter Status '{status_value}', verwende 'Offen'")
                    status_value = 'Offen'
                
                sql_params = (
                    aufgabe_data.get('titel', ''),
                    aufgabe_data.get('beschreibung', ''),
                    status_value,
                    prioritaet_value,
                    aufgabe_data.get('kategorie', 'Allgemein'),
                    faellig_am_value if faellig_am_value else None,  # Handle empty strings
                    zugewiesen_an_value,
                    aufgabe_data.get('notizen', ''),
                    aufgabe_id
                )
                
                print(f"SQL Parameters: {sql_params}")
                
                cursor.execute("""
                    UPDATE aufgaben SET
                        titel = ?, beschreibung = ?, status = ?, prioritaet = ?,
                        kategorie = ?, faellig_am = ?, zugewiesen_an = ?, 
                        notizen = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, sql_params)
                
                rows_affected = cursor.rowcount
                conn.commit()
                conn.close()
                
                print(f"✅ Aufgabe erfolgreich aktualisiert. Rows affected: {rows_affected}")
                print("============================")
                return True
                
        except sqlite3.IntegrityError as e:
            print(f"❌ SQLite Constraint Fehler beim Update: {e}")
            print(f"SQL Parameters waren: {sql_params}")
            print("============================")
            logger.error(f"SQLite Constraint Fehler beim Aktualisieren der Aufgabe: {e}")
            return False
        except Exception as e:
            print(f"❌ Fehler beim Aktualisieren der Aufgabe: {e}")
            print("============================")
            logger.error(f"Fehler beim Aktualisieren der Aufgabe: {e}")
            return False
    
    def delete_aufgabe(self, aufgabe_id):
        """Löscht eine Aufgabe"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute("DELETE FROM aufgaben WHERE id = ?", (aufgabe_id,))
                
                conn.commit()
                conn.close()
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Löschen der Aufgabe: {e}")
            return False

    # ============================
    # Upload Management Methoden
    # ============================
    
    def get_upload_settings(self):
        """Lädt die Upload-Einstellungen"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT schluessel, wert FROM einstellungen 
                    WHERE schluessel LIKE 'upload_%'
                """)
                
                settings = {}
                for row in cursor.fetchall():
                    key = row[0]
                    value = row[1]
                    
                    # Versuche JSON zu parsen, falls nicht möglich nutze String
                    try:
                        settings[key] = json.loads(value)
                    except:
                        settings[key] = value
                
                conn.close()
                
                # Standard-Werte setzen falls nicht vorhanden
                defaults = {
                    'upload_enabled': True,
                    'upload_path': '',
                    'upload_max_size_mb': 50,
                    'upload_allowed_extensions': 'jpg,jpeg,png,gif,mp4,mov,avi'
                }
                
                for key, default_value in defaults.items():
                    if key not in settings:
                        settings[key] = default_value
                
                return settings
                
        except Exception as e:
            logger.error(f"Fehler beim Laden der Upload-Einstellungen: {e}")
            return {
                'upload_enabled': True,
                'upload_path': '',
                'upload_max_size_mb': 50,
                'upload_allowed_extensions': 'jpg,jpeg,png,gif,mp4,mov,avi'
            }
    
    def save_upload_settings(self, settings):
        """Speichert die Upload-Einstellungen"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                for key, value in settings.items():
                    if key.startswith('upload_'):
                        # Als JSON speichern
                        json_value = json.dumps(value)
                        
                        cursor.execute("""
                            INSERT OR REPLACE INTO einstellungen (schluessel, wert)
                            VALUES (?, ?)
                        """, (key, json_value))
                
                conn.commit()
                conn.close()
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Speichern der Upload-Einstellungen: {e}")
            return False
    
    def add_upload(self, gast_id, original_filename, filename, file_path, file_size, mime_type, beschreibung=''):
        """Fügt einen neuen Upload hinzu"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                # Bestimme file_type aus mime_type oder filename
                file_type = self._get_file_type_from_mime(mime_type) or self._get_file_type_from_filename(filename)
                
                cursor.execute("""
                    INSERT INTO gaeste_uploads 
                    (gast_id, original_filename, filename, file_path, file_size, file_type, mime_type, beschreibung, admin_approved, upload_date)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
                """, (gast_id, original_filename, filename, file_path, file_size, file_type, mime_type, beschreibung))
                
                upload_id = cursor.lastrowid
                conn.commit()
                conn.close()
                
                logger.info(f"Upload hinzugefügt: ID {upload_id}, Datei {original_filename}, Pfad {file_path}")
                return upload_id
                
        except Exception as e:
            logger.error(f"Fehler beim Hinzufügen des Uploads: {e}")
            return None
    
    def add_admin_upload(self, admin_user, original_filename, filename, file_path, file_size, mime_type, beschreibung=''):
        """Fügt einen Admin-Upload hinzu - wird automatisch genehmigt"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                # Bestimme file_type aus mime_type oder filename
                file_type = self._get_file_type_from_mime(mime_type) or self._get_file_type_from_filename(filename)
                
                # Prüfe ob Admin-Gast existiert, wenn nicht erstelle ihn
                admin_gast_id = self._get_or_create_admin_guest()
                
                # Admin-Upload mit admin_gast_id und automatischer Genehmigung
                beschreibung_mit_admin = f"{beschreibung} (Admin: {admin_user})" if beschreibung else f"Admin-Upload von {admin_user}"
                
                cursor.execute("""
                    INSERT INTO gaeste_uploads 
                    (gast_id, original_filename, filename, file_path, file_size, file_type, mime_type, beschreibung, admin_approved, upload_date)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
                """, (admin_gast_id, original_filename, filename, file_path, file_size, file_type, mime_type, beschreibung_mit_admin))
                
                upload_id = cursor.lastrowid
                conn.commit()
                conn.close()
                
                logger.info(f"Admin-Upload hinzugefügt und genehmigt: ID {upload_id}, Datei {original_filename}, Admin {admin_user}")
                return upload_id
                
        except Exception as e:
            logger.error(f"Fehler beim Hinzufügen des Admin-Uploads: {e}")
            return None
    
    def _get_or_create_admin_guest(self):
        """Erstellt oder holt den Admin-Gast-Eintrag"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Prüfe ob Admin-Gast bereits existiert
            cursor.execute("SELECT id FROM gaeste WHERE guest_code = 'admin_uploads'")
            result = cursor.fetchone()
            
            if result:
                conn.close()
                return result[0]
            
            # Erstelle Admin-Gast
            cursor.execute("""
                INSERT INTO gaeste 
                (vorname, nachname, kategorie, seite, status, guest_code, guest_password, max_personen, first_login)
                VALUES ('Administrator', 'Uploads', 'System', 'Beide', 'Zugesagt', 'admin_uploads', NULL, 0, 0)
            """)
            
            admin_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            logger.info(f"Admin-Gast erstellt mit ID: {admin_id}")
            return admin_id
            
        except Exception as e:
            logger.error(f"Fehler beim Erstellen des Admin-Gastes: {e}")
            return 1  # Fallback auf ersten Gast
    
    def _get_file_type_from_mime(self, mime_type):
        """Bestimmt file_type aus MIME-Type"""
        if not mime_type:
            return None
        
        mime_lower = mime_type.lower()
        if mime_lower.startswith('image/'):
            return 'image'
        elif mime_lower.startswith('video/'):
            return 'video'
        elif mime_lower.startswith('audio/'):
            return 'audio'
        elif 'pdf' in mime_lower:
            return 'document'
        elif any(x in mime_lower for x in ['text/', 'application/msword', 'application/vnd.openxmlformats']):
            return 'document'
        else:
            return 'other'
    
    def _get_file_type_from_filename(self, filename):
        """Bestimmt file_type aus Dateiendung"""
        if not filename or '.' not in filename:
            return 'other'
        
        ext = filename.split('.')[-1].lower()
        
        if ext in ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg']:
            return 'image'
        elif ext in ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv']:
            return 'video'
        elif ext in ['mp3', 'wav', 'flac', 'aac', 'ogg']:
            return 'audio'
        elif ext in ['pdf', 'doc', 'docx', 'txt', 'rtf']:
            return 'document'
        else:
            return 'other'
    
    def get_guest_uploads(self, gast_id):
        """Lädt alle Uploads eines Gastes"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT id, original_filename, filename, file_path, file_size, file_type, mime_type, 
                           beschreibung, upload_date
                    FROM gaeste_uploads 
                    WHERE gast_id = ?
                    ORDER BY upload_date DESC
                """, (gast_id,))
                
                uploads = []
                for row in cursor.fetchall():
                    uploads.append({
                        'id': row[0],
                        'original_filename': row[1],
                        'filename': row[2],
                        'file_path': row[3],
                        'file_size': row[4],
                        'file_type': row[5],
                        'mime_type': row[6],
                        'beschreibung': row[7],
                        'upload_date': row[8]
                    })
                
                conn.close()
                return uploads
                
        except Exception as e:
            logger.error(f"Fehler beim Laden der Gast-Uploads: {e}")
            return []
    
    def get_upload_by_id(self, upload_id):
        """Lädt einen Upload anhand der ID"""
        try:
            logger.info(f"🎯 Database: get_upload_by_id called for ID: {upload_id}")
            
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                logger.info(f"📡 Database: Executing query for upload ID: {upload_id}")
                cursor.execute("""
                    SELECT gu.id, gu.gast_id, gu.original_filename, gu.filename, gu.file_path,
                           gu.file_size, gu.file_type, gu.mime_type, gu.beschreibung, gu.upload_date,
                           gu.admin_approved, g.vorname, g.nachname
                    FROM gaeste_uploads gu
                    JOIN gaeste g ON gu.gast_id = g.id
                    WHERE gu.id = ?
                """, (upload_id,))
                
                row = cursor.fetchone()
                conn.close()
                
                if row:
                    upload = {
                        'id': row[0],
                        'gast_id': row[1],
                        'original_filename': row[2],
                        'filename': row[3],
                        'file_path': row[4],
                        'file_size': row[5],
                        'file_type': row[6],
                        'mime_type': row[7],
                        'beschreibung': row[8],
                        'upload_date': row[9],
                        'admin_approved': row[10],
                        'gast_vorname': row[11],
                        'gast_nachname': row[12]
                    }
                    logger.info(f"📋 Database: Found upload {upload_id}: {upload['original_filename']} (approved: {upload['admin_approved']})")
                    return upload
                else:
                    logger.warning(f"📭 Database: Upload {upload_id} not found in database")
                    return None
                
        except Exception as e:
            logger.error(f"❌ Database: Fehler beim Laden des Uploads {upload_id}: {e}")
            return None
    
    def delete_upload(self, upload_id):
        """Löscht einen Upload"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute("DELETE FROM gaeste_uploads WHERE id = ?", (upload_id,))
                
                rows_affected = cursor.rowcount
                conn.commit()
                conn.close()
                
                return rows_affected > 0
                
        except Exception as e:
            logger.error(f"Fehler beim Löschen des Uploads: {e}")
            return False
    
    def get_upload_statistics(self):
        """Lädt Upload-Statistiken für Admin"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                # Gesamt-Uploads
                cursor.execute("SELECT COUNT(*) FROM gaeste_uploads")
                total_uploads = cursor.fetchone()[0]
                
                # Gesamt-Größe
                cursor.execute("SELECT COALESCE(SUM(file_size), 0) FROM gaeste_uploads")
                total_size = cursor.fetchone()[0]
                
                # Bilder zählen (nach file_type)
                cursor.execute("SELECT COUNT(*) FROM gaeste_uploads WHERE file_type = 'image'")
                total_images = cursor.fetchone()[0]
                
                # Videos zählen (nach file_type)
                cursor.execute("SELECT COUNT(*) FROM gaeste_uploads WHERE file_type = 'video'")
                total_videos = cursor.fetchone()[0]
                
                # Aktive Gäste (mit Uploads)
                cursor.execute("""
                    SELECT COUNT(DISTINCT gast_id) FROM gaeste_uploads
                """)
                active_guests = cursor.fetchone()[0]
                
                # Uploads der letzten 7 Tage
                cursor.execute("""
                    SELECT COUNT(*) FROM gaeste_uploads 
                    WHERE upload_date >= datetime('now', '-7 days')
                """)
                recent_uploads = cursor.fetchone()[0]
                
                conn.close()
                
                return {
                    'total_uploads': total_uploads,
                    'total_images': total_images,
                    'total_videos': total_videos,
                    'total_size': total_size,
                    'active_guests': active_guests,
                    'recent_uploads': recent_uploads
                }
                
        except Exception as e:
            logger.error(f"Fehler beim Laden der Upload-Statistiken: {e}")
            return {
                'total_uploads': 0,
                'total_images': 0,
                'total_videos': 0,
                'total_size': 0,
                'active_guests': 0,
                'recent_uploads': 0
            }
    
    def get_all_uploads(self):
        """Lädt alle Uploads für Admin"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT gu.id, gu.gast_id, gu.original_filename, gu.filename, gu.file_path,
                           gu.file_size, gu.file_type, gu.mime_type, gu.beschreibung, gu.upload_date,
                           gu.admin_approved, g.vorname, g.nachname
                    FROM gaeste_uploads gu
                    JOIN gaeste g ON gu.gast_id = g.id
                    ORDER BY gu.upload_date DESC
                """)
                
                uploads = []
                for row in cursor.fetchall():
                    uploads.append({
                        'id': row[0],
                        'gast_id': row[1],
                        'original_filename': row[2],
                        'filename': row[3],
                        'file_path': row[4],
                        'file_size': row[5],
                        'file_type': row[6],
                        'mime_type': row[7],
                        'beschreibung': row[8],
                        'upload_date': row[9],
                        'admin_approved': row[10],
                        'gast_vorname': row[11],
                        'gast_nachname': row[12]
                    })
                
                conn.close()
                return uploads
                
        except Exception as e:
            logger.error(f"Fehler beim Laden aller Uploads: {e}")
            return []
    
    def get_guests_with_uploads(self):
        """Lädt Gäste mit Upload-Anzahl für Filter"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT g.id, g.vorname, g.nachname, COUNT(gu.id) as upload_count
                    FROM gaeste g
                    JOIN gaeste_uploads gu ON g.id = gu.gast_id
                    GROUP BY g.id, g.vorname, g.nachname
                    ORDER BY upload_count DESC, g.nachname, g.vorname
                """)
                
                guests = []
                for row in cursor.fetchall():
                    guests.append({
                        'id': row[0],
                        'vorname': row[1],
                        'nachname': row[2],
                        'upload_count': row[3]
                    })
                
                conn.close()
                return guests
                
        except Exception as e:
            logger.error(f"Fehler beim Laden der Gäste mit Uploads: {e}")
            return []
    
    def get_upload_details(self, upload_id):
        """Lädt detaillierte Upload-Informationen"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT gu.id, gu.gast_id, gu.original_filename, gu.filename, gu.file_path,
                           gu.file_size, gu.file_type, gu.mime_type, gu.beschreibung, gu.upload_date,
                           g.vorname, g.nachname, g.email
                    FROM gaeste_uploads gu
                    JOIN gaeste g ON gu.gast_id = g.id
                    WHERE gu.id = ?
                """, (upload_id,))
                
                row = cursor.fetchone()
                conn.close()
                
                if row:
                    return {
                        'id': row[0],
                        'gast_id': row[1],
                        'original_filename': row[2],
                        'filename': row[3],
                        'file_path': row[4],
                        'file_size': row[5],
                        'file_type': row[6],
                        'mime_type': row[7],
                        'beschreibung': row[8],
                        'upload_date': row[9],
                        'gast_vorname': row[10],
                        'gast_nachname': row[11],
                        'gast_email': row[12]
                    }
                
                return None
                
        except Exception as e:
            logger.error(f"Fehler beim Laden der Upload-Details: {e}")
            return None

    # =============================================================================
    # PHOTO GALLERY METHODEN
    # =============================================================================
    
    def approve_upload(self, upload_id):
        """Genehmigt einen Upload für die Foto-Galerie"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute("""
                    UPDATE gaeste_uploads 
                    SET admin_approved = 1, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ? AND admin_approved = 0
                """, (upload_id,))
                
                rows_affected = cursor.rowcount
                conn.commit()
                conn.close()
                
                if rows_affected > 0:
                    logger.info(f"Upload {upload_id} wurde genehmigt")
                    return True
                else:
                    logger.warning(f"Upload {upload_id} nicht gefunden oder bereits genehmigt")
                    return False
                
        except Exception as e:
            logger.error(f"Fehler beim Genehmigen des Uploads: {e}")
            return False
    
    def reject_upload(self, upload_id):
        """Lehnt einen Upload ab (setzt admin_approved auf -1)"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute("""
                    UPDATE gaeste_uploads 
                    SET admin_approved = -1, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (upload_id,))
                
                rows_affected = cursor.rowcount
                conn.commit()
                conn.close()
                
                if rows_affected > 0:
                    logger.info(f"Upload {upload_id} wurde abgelehnt")
                    return True
                else:
                    logger.warning(f"Upload {upload_id} nicht gefunden")
                    return False
                
        except Exception as e:
            logger.error(f"Fehler beim Ablehnen des Uploads: {e}")
            return False
    
    def get_pending_uploads(self):
        """Lädt alle noch nicht genehmigten Uploads (admin_approved = 0)"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT gu.id, gu.gast_id, gu.original_filename, gu.filename, gu.file_path,
                           gu.file_size, gu.file_type, gu.mime_type, gu.beschreibung, gu.upload_date,
                           gu.admin_approved, g.vorname, g.nachname
                    FROM gaeste_uploads gu
                    JOIN gaeste g ON gu.gast_id = g.id
                    WHERE gu.admin_approved = 0
                    ORDER BY gu.upload_date DESC
                """)
                
                uploads = []
                for row in cursor.fetchall():
                    uploads.append({
                        'id': row[0],
                        'gast_id': row[1],
                        'original_filename': row[2],
                        'filename': row[3],
                        'file_path': row[4],
                        'file_size': row[5],
                        'file_type': row[6],
                        'mime_type': row[7],
                        'beschreibung': row[8],
                        'upload_date': row[9],
                        'admin_approved': row[10],
                        'gast_vorname': row[11],
                        'gast_nachname': row[12]
                    })
                
                conn.close()
                return uploads
                
        except Exception as e:
            logger.error(f"Fehler beim Laden der ausstehenden Uploads: {e}")
            return []
    
    def get_approved_uploads(self):
        """Lädt alle genehmigten Uploads für die Foto-Galerie (admin_approved = 1)"""
        try:
            logger.info("🎯 Database: get_approved_uploads called")
            
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                logger.info("📡 Database: Executing query for approved uploads...")
                cursor.execute("""
                    SELECT gu.id, gu.gast_id, gu.original_filename, gu.filename, gu.file_path,
                           gu.file_size, gu.file_type, gu.mime_type, gu.beschreibung, gu.upload_date,
                           gu.admin_approved, 
                           CASE 
                               WHEN g.guest_code = 'admin_uploads' THEN 'Brautpaar'
                               ELSE COALESCE(g.vorname, 'Administrator') 
                           END as vorname, 
                           CASE 
                               WHEN g.guest_code = 'admin_uploads' THEN ''
                               ELSE COALESCE(g.nachname, '') 
                           END as nachname
                    FROM gaeste_uploads gu
                    LEFT JOIN gaeste g ON gu.gast_id = g.id
                    WHERE gu.admin_approved = 1
                    ORDER BY gu.upload_date DESC
                """)
                
                rows = cursor.fetchall()
                logger.info(f"📦 Database: Found {len(rows)} approved uploads in database")
                
                uploads = []
                for row in rows:
                    upload = {
                        'id': row[0],
                        'gast_id': row[1],
                        'original_filename': row[2],
                        'filename': row[3],
                        'file_path': row[4],
                        'file_size': row[5],
                        'file_type': row[6],
                        'mime_type': row[7],
                        'beschreibung': row[8],
                        'upload_date': row[9],
                        'admin_approved': row[10],
                        'gast_vorname': row[11],
                        'gast_nachname': row[12]
                    }
                    uploads.append(upload)
                    logger.info(f"📋 Database: Upload {upload['id']}: {upload['original_filename']} by {upload['gast_vorname']} {upload['gast_nachname']}")
                
                conn.close()
                logger.info(f"✅ Database: Returning {len(uploads)} approved uploads")
                return uploads
                
        except Exception as e:
            logger.error(f"❌ Database: Fehler beim Laden der genehmigten Uploads: {e}")
            return []

    # =============================================================================
    # TISCHPLANUNG METHODEN
    # =============================================================================
    
    def _init_tischplanung_tables(self):
        """Initialisiert die Tischplanung-Tabellen"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                # Tische Tabelle
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS tische (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        beschreibung TEXT,
                        max_personen INTEGER NOT NULL DEFAULT 8,
                        x_position REAL DEFAULT 0.0,
                        y_position REAL DEFAULT 0.0,
                        farbe TEXT DEFAULT '#007bff',
                        aktiv BOOLEAN DEFAULT 1,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Beziehungen zwischen Gästen
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS gast_beziehungen (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        gast_id_1 INTEGER NOT NULL,
                        gast_id_2 INTEGER NOT NULL,
                        beziehungstyp TEXT NOT NULL DEFAULT 'neutral',
                        staerke INTEGER DEFAULT 0,
                        notizen TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (gast_id_1) REFERENCES gaeste (id) ON DELETE CASCADE,
                        FOREIGN KEY (gast_id_2) REFERENCES gaeste (id) ON DELETE CASCADE,
                        CONSTRAINT unique_beziehung UNIQUE (gast_id_1, gast_id_2),
                        CONSTRAINT no_self_relation CHECK (gast_id_1 != gast_id_2)
                    )
                """)
                
                # Tischzuordnungen
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS tisch_zuordnungen (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        tisch_id INTEGER NOT NULL,
                        gast_id INTEGER NOT NULL,
                        position INTEGER,
                        zugeordnet_von TEXT,
                        zugeordnet_am DATETIME DEFAULT CURRENT_TIMESTAMP,
                        notizen TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (tisch_id) REFERENCES tische (id) ON DELETE CASCADE,
                        FOREIGN KEY (gast_id) REFERENCES gaeste (id) ON DELETE CASCADE,
                        CONSTRAINT unique_gast_tisch UNIQUE (gast_id),
                        CONSTRAINT unique_tisch_position UNIQUE (tisch_id, position)
                    )
                """)
                
                # Tischplanung Konfiguration
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS tischplanung_config (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        standard_tisch_groesse INTEGER DEFAULT 8,
                        automatische_zuordnung BOOLEAN DEFAULT 0,
                        beruecksichtige_alter BOOLEAN DEFAULT 1,
                        beruecksichtige_seite BOOLEAN DEFAULT 1,
                        beruecksichtige_kategorie BOOLEAN DEFAULT 1,
                        min_beziehung_staerke INTEGER DEFAULT 0,
                        layout_breite REAL DEFAULT 800.0,
                        layout_hoehe REAL DEFAULT 600.0,
                        tisch_durchmesser REAL DEFAULT 120.0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Indizes
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_beziehungen_gast1 ON gast_beziehungen(gast_id_1)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_beziehungen_gast2 ON gast_beziehungen(gast_id_2)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_zuordnungen_tisch ON tisch_zuordnungen(tisch_id)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_zuordnungen_gast ON tisch_zuordnungen(gast_id)")
                
                # Standard-Konfiguration
                cursor.execute("INSERT OR IGNORE INTO tischplanung_config (id, standard_tisch_groesse) VALUES (1, 8)")
                
                # Beispiel-Tische (nur beim ersten Mal)
                cursor.execute("SELECT COUNT(*) FROM tische")
                if cursor.fetchone()[0] == 0:
                    beispiel_tische = [
                        ('Tisch 1', 'Brautpaar-Tisch', 8, 400, 100, '#e74c3c'),
                        ('Tisch 2', 'Familie Braut', 8, 200, 250, '#3498db'),
                        ('Tisch 3', 'Familie Bräutigam', 8, 600, 250, '#2ecc71'),
                        ('Tisch 4', 'Freunde', 8, 100, 400, '#f39c12'),
                        ('Tisch 5', 'Kollegen', 8, 500, 400, '#9b59b6'),
                        ('Tisch 6', 'Weitere Gäste', 8, 300, 500, '#95a5a6')
                    ]
                    
                    cursor.executemany("""
                        INSERT INTO tische (name, beschreibung, max_personen, x_position, y_position, farbe)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, beispiel_tische)
                
                conn.commit()
                conn.close()
                logger.info("✅ Tischplanung-Tabellen initialisiert")
                
        except Exception as e:
            logger.error(f"❌ Fehler beim Initialisieren der Tischplanung-Tabellen: {e}")
    
    def get_tische(self):
        """Lädt alle Tische"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT id, name, beschreibung, max_personen, x_position, y_position, 
                           farbe, aktiv, created_at, updated_at
                    FROM tische
                    WHERE aktiv = 1
                    ORDER BY name
                """)
                
                tische = []
                for row in cursor.fetchall():
                    tische.append({
                        'id': row[0],
                        'name': row[1],
                        'beschreibung': row[2],
                        'max_personen': row[3],
                        'x_position': row[4],
                        'y_position': row[5],
                        'farbe': row[6],
                        'aktiv': bool(row[7]),
                        'created_at': row[8],
                        'updated_at': row[9]
                    })
                
                conn.close()
                return tische
                
        except Exception as e:
            logger.error(f"Fehler beim Laden der Tische: {e}")
            return []
    
    def add_tisch(self, tisch_data):
        """Fügt einen neuen Tisch hinzu"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute("""
                    INSERT INTO tische (name, beschreibung, max_personen, x_position, y_position, farbe)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    tisch_data.get('name'),
                    tisch_data.get('beschreibung', ''),
                    tisch_data.get('max_personen', 8),
                    tisch_data.get('x_position', 0.0),
                    tisch_data.get('y_position', 0.0),
                    tisch_data.get('farbe', '#007bff')
                ))
                
                tisch_id = cursor.lastrowid
                conn.commit()
                conn.close()
                
                logger.info(f"✅ Tisch '{tisch_data.get('name')}' hinzugefügt (ID: {tisch_id})")
                return tisch_id
                
        except Exception as e:
            logger.error(f"Fehler beim Hinzufügen des Tisches: {e}")
            return None
    
    def update_tisch(self, tisch_id, tisch_data):
        """Aktualisiert einen Tisch"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                # Erst den aktuellen Tisch laden für fehlende Werte
                cursor.execute("SELECT name, beschreibung, max_personen, farbe FROM tische WHERE id = ?", (tisch_id,))
                current = cursor.fetchone()
                
                if not current:
                    conn.close()
                    return False
                
                # Fehlende Werte mit aktuellen Werten auffüllen
                name = tisch_data.get('name') or current[0]
                beschreibung = tisch_data.get('beschreibung') if 'beschreibung' in tisch_data else current[1]
                max_personen = tisch_data.get('max_personen') if 'max_personen' in tisch_data else current[2]
                farbe = tisch_data.get('farbe') if 'farbe' in tisch_data else current[3]
                
                cursor.execute("""
                    UPDATE tische 
                    SET name = ?, beschreibung = ?, max_personen = ?, 
                        x_position = ?, y_position = ?, farbe = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (
                    name,
                    beschreibung,
                    max_personen,
                    tisch_data.get('x_position', 0.0),
                    tisch_data.get('y_position', 0.0),
                    farbe,
                    tisch_id
                ))
                
                success = cursor.rowcount > 0
                conn.commit()
                conn.close()
                
                if success:
                    logger.info(f"✅ Tisch {tisch_id} aktualisiert")
                return success
                
        except Exception as e:
            logger.error(f"Fehler beim Aktualisieren des Tisches: {e}")
            return False
    
    def delete_tisch(self, tisch_id):
        """Löscht einen Tisch (soft delete)"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                # Erst alle Zuordnungen entfernen
                cursor.execute("DELETE FROM tisch_zuordnungen WHERE tisch_id = ?", (tisch_id,))
                
                # Dann Tisch deaktivieren
                cursor.execute("UPDATE tische SET aktiv = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (tisch_id,))
                
                success = cursor.rowcount > 0
                conn.commit()
                conn.close()
                
                if success:
                    logger.info(f"✅ Tisch {tisch_id} gelöscht")
                return success
                
        except Exception as e:
            logger.error(f"Fehler beim Löschen des Tisches: {e}")
            return False
    
    def get_gast_beziehungen(self, gast_id=None):
        """Lädt Beziehungen zwischen Gästen"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                if gast_id:
                    cursor.execute("""
                        SELECT gb.id, gb.gast_id_1, gb.gast_id_2, gb.beziehungstyp, gb.staerke, gb.notizen,
                               g1.vorname as vorname1, g1.nachname as nachname1,
                               g2.vorname as vorname2, g2.nachname as nachname2
                        FROM gast_beziehungen gb
                        LEFT JOIN gaeste g1 ON gb.gast_id_1 = g1.id
                        LEFT JOIN gaeste g2 ON gb.gast_id_2 = g2.id
                        WHERE gb.gast_id_1 = ? OR gb.gast_id_2 = ?
                    """, (gast_id, gast_id))
                else:
                    cursor.execute("""
                        SELECT gb.id, gb.gast_id_1, gb.gast_id_2, gb.beziehungstyp, gb.staerke, gb.notizen,
                               g1.vorname as vorname1, g1.nachname as nachname1,
                               g2.vorname as vorname2, g2.nachname as nachname2
                        FROM gast_beziehungen gb
                        LEFT JOIN gaeste g1 ON gb.gast_id_1 = g1.id
                        LEFT JOIN gaeste g2 ON gb.gast_id_2 = g2.id
                    """)
                
                beziehungen = []
                for row in cursor.fetchall():
                    # Spezialbehandlung für Brautpaar-ID (-1)
                    gast1_name = "Brautpaar" if row[1] == -1 else f"{row[6] or ''} {row[7] or ''}".strip()
                    gast2_name = "Brautpaar" if row[2] == -1 else f"{row[8] or ''} {row[9] or ''}".strip()
                    
                    # Fallback falls Namen leer sind
                    if not gast1_name or gast1_name == " ":
                        gast1_name = f"Gast {row[1]}" if row[1] != -1 else "Brautpaar"
                    if not gast2_name or gast2_name == " ":
                        gast2_name = f"Gast {row[2]}" if row[2] != -1 else "Brautpaar"
                    
                    beziehungen.append({
                        'id': row[0],
                        'gast_id_1': row[1],
                        'gast_id_2': row[2],
                        'beziehungstyp': row[3],
                        'staerke': row[4],
                        'notizen': row[5],
                        'gast1_name': gast1_name,
                        'gast2_name': gast2_name
                    })
                
                conn.close()
                logger.info(f"✅ {len(beziehungen)} Beziehungen geladen")
                return beziehungen
                
        except Exception as e:
            logger.error(f"Fehler beim Laden der Beziehungen: {e}")
            return []
    
    def add_gast_beziehung(self, gast_id_1, gast_id_2, beziehungstyp, staerke, notizen=""):
        """Fügt eine Beziehung zwischen zwei Gästen hinzu"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                # Spezialbehandlung für Brautpaar-ID (-1)
                # Nur normale IDs sortieren, Brautpaar-ID immer als erste Position
                if gast_id_1 == -1 or gast_id_2 == -1:
                    # Brautpaar-Beziehung: -1 immer als erste ID
                    if gast_id_2 == -1 and gast_id_1 != -1:
                        gast_id_1, gast_id_2 = gast_id_2, gast_id_1
                else:
                    # Normale Gäste: kleinere ID zuerst für Eindeutigkeit
                    if gast_id_1 > gast_id_2:
                        gast_id_1, gast_id_2 = gast_id_2, gast_id_1
                
                logger.info(f"💒 Speichere Beziehung: Gast {gast_id_1} <-> Gast {gast_id_2}, Typ: {beziehungstyp}")
                
                cursor.execute("""
                    INSERT OR REPLACE INTO gast_beziehungen 
                    (gast_id_1, gast_id_2, beziehungstyp, staerke, notizen)
                    VALUES (?, ?, ?, ?, ?)
                """, (gast_id_1, gast_id_2, beziehungstyp, staerke, notizen))
                
                beziehung_id = cursor.lastrowid
                conn.commit()
                conn.close()
                
                logger.info(f"✅ Beziehung zwischen Gast {gast_id_1} und {gast_id_2} hinzugefügt (ID: {beziehung_id})")
                return beziehung_id
                
        except Exception as e:
            logger.error(f"Fehler beim Hinzufügen der Beziehung: {e}")
            return None
    
    def delete_gast_beziehung(self, beziehung_id):
        """Löscht eine Beziehung"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute("DELETE FROM gast_beziehungen WHERE id = ?", (beziehung_id,))
                
                success = cursor.rowcount > 0
                conn.commit()
                conn.close()
                
                if success:
                    logger.info(f"✅ Beziehung {beziehung_id} gelöscht")
                return success
                
        except Exception as e:
            logger.error(f"Fehler beim Löschen der Beziehung: {e}")
            return False
    
    def get_tisch_zuordnungen(self, tisch_id=None):
        """Lädt Tischzuordnungen"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                if tisch_id:
                    cursor.execute("""
                        SELECT tz.id, tz.tisch_id, tz.gast_id, tz.position, tz.zugeordnet_von, tz.notizen,
                               g.vorname, g.nachname, g.anzahl_personen,
                               t.name as tisch_name
                        FROM tisch_zuordnungen tz
                        JOIN gaeste g ON tz.gast_id = g.id
                        JOIN tische t ON tz.tisch_id = t.id
                        WHERE tz.tisch_id = ?
                        ORDER BY tz.position
                    """, (tisch_id,))
                else:
                    cursor.execute("""
                        SELECT tz.id, tz.tisch_id, tz.gast_id, tz.position, tz.zugeordnet_von, tz.notizen,
                               g.vorname, g.nachname, g.anzahl_personen,
                               t.name as tisch_name
                        FROM tisch_zuordnungen tz
                        JOIN gaeste g ON tz.gast_id = g.id
                        JOIN tische t ON tz.tisch_id = t.id
                        ORDER BY tz.tisch_id, tz.position
                    """)
                
                zuordnungen = []
                for row in cursor.fetchall():
                    zuordnungen.append({
                        'id': row[0],
                        'tisch_id': row[1],
                        'gast_id': row[2],
                        'position': row[3],
                        'zugeordnet_von': row[4],
                        'notizen': row[5],
                        'gast_name': f"{row[6]} {row[7] or ''}".strip(),
                        'anzahl_personen': row[8],
                        'tisch_name': row[9]
                    })
                
                conn.close()
                return zuordnungen
                
        except Exception as e:
            logger.error(f"Fehler beim Laden der Tischzuordnungen: {e}")
            return []
    
    def assign_gast_to_tisch(self, gast_id, tisch_id, position=None, zugeordnet_von="System"):
        """Weist einen Gast einem Tisch zu"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                # Prüfen ob Tisch voll ist
                cursor.execute("""
                    SELECT COUNT(*), t.max_personen 
                    FROM tisch_zuordnungen tz
                    JOIN tische t ON tz.tisch_id = t.id
                    WHERE tz.tisch_id = ?
                    GROUP BY t.max_personen
                """, (tisch_id,))
                
                result = cursor.fetchone()
                if result and result[0] >= result[1]:
                    conn.close()
                    return False, "Tisch ist bereits voll"
                
                # Bestehende Zuordnung entfernen
                cursor.execute("DELETE FROM tisch_zuordnungen WHERE gast_id = ?", (gast_id,))
                
                # Neue Zuordnung hinzufügen
                cursor.execute("""
                    INSERT INTO tisch_zuordnungen (tisch_id, gast_id, position, zugeordnet_von)
                    VALUES (?, ?, ?, ?)
                """, (tisch_id, gast_id, position, zugeordnet_von))
                
                conn.commit()
                conn.close()
                
                logger.info(f"✅ Gast {gast_id} zu Tisch {tisch_id} zugeordnet")
                return True, "Erfolgreich zugeordnet"
                
        except Exception as e:
            logger.error(f"Fehler beim Zuordnen des Gastes: {e}")
            return False, str(e)
    
    def unassign_gast_from_tisch(self, gast_id):
        """Entfernt einen Gast von seinem Tisch"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute("DELETE FROM tisch_zuordnungen WHERE gast_id = ?", (gast_id,))
                
                success = cursor.rowcount > 0
                conn.commit()
                conn.close()
                
                if success:
                    logger.info(f"✅ Gast {gast_id} von Tisch entfernt")
                return success
                
        except Exception as e:
            logger.error(f"Fehler beim Entfernen des Gastes: {e}")
            return False
    
    def clear_all_tisch_zuordnungen(self):
        """Entfernt alle Tischzuordnungen"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute("DELETE FROM tisch_zuordnungen")
                
                deleted_count = cursor.rowcount
                conn.commit()
                conn.close()
                
                logger.info(f"✅ {deleted_count} Tischzuordnungen entfernt")
                return deleted_count
                
        except Exception as e:
            logger.error(f"Fehler beim Entfernen aller Zuordnungen: {e}")
            return 0
    
    def get_tischplanung_config(self):
        """Lädt die Tischplanung-Konfiguration"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                # Prüfe zuerst, ob die Tabelle das alte Schema (key/value) oder neue Schema (spezifische Spalten) hat
                cursor.execute("PRAGMA table_info(tischplanung_config)")
                columns = [col[1] for col in cursor.fetchall()]
                
                if 'key' in columns and 'value' in columns:
                    # Altes Schema: key/value Paare
                    cursor.execute("SELECT key, value FROM tischplanung_config")
                    rows = cursor.fetchall()
                    config = {}
                    for key, value in rows:
                        # Konvertiere String-Werte zu entsprechenden Typen
                        if value.lower() in ['true', 'false']:
                            config[key] = value.lower() == 'true'
                        elif value.isdigit():
                            config[key] = int(value)
                        elif value.replace('.', '').isdigit():
                            config[key] = float(value)
                        else:
                            config[key] = value
                    
                    # Standard-Werte für fehlende Keys
                    defaults = {
                        'standard_tisch_groesse': 8,
                        'automatische_zuordnung': False,
                        'beruecksichtige_alter': True,
                        'beruecksichtige_seite': True,
                        'beruecksichtige_kategorie': True,
                        'min_beziehung_staerke': 0,
                        'layout_breite': 800.0,
                        'layout_hoehe': 600.0,
                        'tisch_durchmesser': 120.0
                    }
                    
                    for key, default_value in defaults.items():
                        if key not in config:
                            config[key] = default_value
                    
                    conn.close()
                    return config
                    
                else:
                    # Neues Schema: spezifische Spalten
                    cursor.execute("SELECT * FROM tischplanung_config WHERE id = 1")
                    row = cursor.fetchone()
                    conn.close()
                    
                    if row:
                        return {
                            'standard_tisch_groesse': row[1] if len(row) > 1 else 8,
                            'automatische_zuordnung': bool(row[2]) if len(row) > 2 else False,
                            'beruecksichtige_alter': bool(row[3]) if len(row) > 3 else True,
                            'beruecksichtige_seite': bool(row[4]) if len(row) > 4 else True,
                            'beruecksichtige_kategorie': bool(row[5]) if len(row) > 5 else True,
                            'min_beziehung_staerke': row[6] if len(row) > 6 else 0,
                            'layout_breite': row[7] if len(row) > 7 else 800.0,
                            'layout_hoehe': row[8] if len(row) > 8 else 600.0,
                            'tisch_durchmesser': row[9] if len(row) > 9 else 120.0
                        }
                    else:
                        # Standard-Konfiguration zurückgeben
                        return {
                            'standard_tisch_groesse': 8,
                            'automatische_zuordnung': False,
                            'beruecksichtige_alter': True,
                            'beruecksichtige_seite': True,
                            'beruecksichtige_kategorie': True,
                            'min_beziehung_staerke': 0,
                            'layout_breite': 800.0,
                            'layout_hoehe': 600.0,
                            'tisch_durchmesser': 120.0
                        }
                
        except Exception as e:
            logger.error(f"Fehler beim Laden der Tischplanung-Konfiguration: {e}")
            # Standard-Konfiguration zurückgeben
            return {
                'standard_tisch_groesse': 8,
                'automatische_zuordnung': False,
                'beruecksichtige_alter': True,
                'beruecksichtige_seite': True,
                'beruecksichtige_kategorie': True,
                'min_beziehung_staerke': 0,
                'layout_breite': 800.0,
                'layout_hoehe': 600.0,
                'tisch_durchmesser': 120.0
            }
                
        except Exception as e:
            logger.error(f"Fehler beim Laden der Tischplanung-Konfiguration: {e}")
            return {}
    
    def update_tischplanung_config(self, config_data):
        """Aktualisiert die Tischplanung-Konfiguration"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute("""
                    INSERT OR REPLACE INTO tischplanung_config 
                    (id, standard_tisch_groesse, automatische_zuordnung, beruecksichtige_alter,
                     beruecksichtige_seite, beruecksichtige_kategorie, min_beziehung_staerke,
                     layout_breite, layout_hoehe, tisch_durchmesser, updated_at)
                    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """, (
                    config_data.get('standard_tisch_groesse', 8),
                    config_data.get('automatische_zuordnung', False),
                    config_data.get('beruecksichtige_alter', True),
                    config_data.get('beruecksichtige_seite', True),
                    config_data.get('beruecksichtige_kategorie', True),
                    config_data.get('min_beziehung_staerke', 0),
                    config_data.get('layout_breite', 800.0),
                    config_data.get('layout_hoehe', 600.0),
                    config_data.get('tisch_durchmesser', 120.0)
                ))
                
                conn.commit()
                conn.close()
                
                logger.info("✅ Tischplanung-Konfiguration aktualisiert")
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Aktualisieren der Konfiguration: {e}")
            return False

    # =============================================================================
    # 2FA Admin Authentication Methods
    # =============================================================================
    
    def verify_admin_credentials(self, username, password):
        """Überprüft Admin-Anmeldedaten und gibt Admin-ID zurück"""
        try:
            import hashlib
            password_hash = hashlib.sha256(password.encode()).hexdigest()
            
            with self._lock:
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT id, is_2fa_enabled FROM admin_users 
                    WHERE username = ? AND password_hash = ? AND is_active = 1
                """, (username, password_hash))
                
                result = cursor.fetchone()
                conn.close()
                
                if result:
                    return {
                        'admin_id': result[0],
                        'is_2fa_enabled': bool(result[1]),
                        'valid': True
                    }
                else:
                    return {'valid': False}
                    
        except Exception as e:
            logger.error(f"Fehler bei Admin-Anmeldung: {e}")
            return {'valid': False}
    
    def get_admin_2fa_secret(self, admin_id):
        """Holt das 2FA-Secret eines Admins"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT totp_secret, is_2fa_enabled FROM admin_users 
                    WHERE id = ? AND is_active = 1
                """, (admin_id,))
                
                result = cursor.fetchone()
                conn.close()
                
                if result:
                    return {
                        'totp_secret': result[0],
                        'is_2fa_enabled': bool(result[1])
                    }
                else:
                    return None
                    
        except Exception as e:
            logger.error(f"Fehler beim Abrufen des 2FA-Secrets: {e}")
            return None
    
    def setup_admin_2fa(self, admin_id, totp_secret, backup_codes):
        """Aktiviert 2FA für einen Admin"""
        try:
            import json
            
            with self._lock:
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                cursor = conn.cursor()
                
                cursor.execute("""
                    UPDATE admin_users 
                    SET totp_secret = ?, is_2fa_enabled = 1, backup_codes = ?, 
                        failed_2fa_attempts = 0, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ? AND is_active = 1
                """, (totp_secret, json.dumps(backup_codes), admin_id))
                
                conn.commit()
                conn.close()
                
                logger.info(f"✅ 2FA aktiviert für Admin-ID: {admin_id}")
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Aktivieren von 2FA: {e}")
            return False
    
    def disable_admin_2fa(self, admin_id):
        """Deaktiviert 2FA für einen Admin"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                cursor = conn.cursor()
                
                cursor.execute("""
                    UPDATE admin_users 
                    SET totp_secret = NULL, is_2fa_enabled = 0, backup_codes = NULL,
                        failed_2fa_attempts = 0, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ? AND is_active = 1
                """, (admin_id,))
                
                conn.commit()
                conn.close()
                
                logger.info(f"✅ 2FA deaktiviert für Admin-ID: {admin_id}")
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Deaktivieren von 2FA: {e}")
            return False
    
    def verify_admin_2fa_token(self, admin_id, token):
        """Überprüft einen 2FA-Token oder Backup-Code"""
        try:
            import json
            import pyotp
            from datetime import datetime, timedelta
            
            with self._lock:
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                cursor = conn.cursor()
                
                # Admin-Daten abrufen
                cursor.execute("""
                    SELECT totp_secret, backup_codes, failed_2fa_attempts, last_failed_2fa
                    FROM admin_users 
                    WHERE id = ? AND is_active = 1 AND is_2fa_enabled = 1
                """, (admin_id,))
                
                result = cursor.fetchone()
                if not result:
                    conn.close()
                    return False
                
                totp_secret, backup_codes_json, failed_attempts, last_failed = result
                
                # Rate Limiting prüfen
                if failed_attempts >= 5:
                    if last_failed:
                        last_failed_dt = datetime.fromisoformat(last_failed.replace('Z', '+00:00'))
                        if datetime.now() - last_failed_dt < timedelta(minutes=15):
                            conn.close()
                            logger.warning(f"2FA Rate Limit erreicht für Admin-ID: {admin_id}")
                            return False
                
                # TOTP-Token prüfen
                if totp_secret:
                    totp = pyotp.TOTP(totp_secret)
                    if totp.verify(token, valid_window=1):  # 30s Fenster
                        # Erfolgreiche Verifikation - Fehlschläge zurücksetzen
                        cursor.execute("""
                            UPDATE admin_users 
                            SET failed_2fa_attempts = 0, last_failed_2fa = NULL
                            WHERE id = ?
                        """, (admin_id,))
                        conn.commit()
                        conn.close()
                        return True
                
                # Backup-Code prüfen
                if backup_codes_json:
                    backup_codes = json.loads(backup_codes_json)
                    if token in backup_codes:
                        # Backup-Code entfernen (einmalige Verwendung)
                        backup_codes.remove(token)
                        cursor.execute("""
                            UPDATE admin_users 
                            SET backup_codes = ?, failed_2fa_attempts = 0, last_failed_2fa = NULL
                            WHERE id = ?
                        """, (json.dumps(backup_codes), admin_id))
                        conn.commit()
                        conn.close()
                        logger.info(f"Backup-Code verwendet für Admin-ID: {admin_id}")
                        return True
                
                # Fehlgeschlagener Versuch
                cursor.execute("""
                    UPDATE admin_users 
                    SET failed_2fa_attempts = failed_2fa_attempts + 1, 
                        last_failed_2fa = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (admin_id,))
                conn.commit()
                conn.close()
                
                return False
                
        except Exception as e:
            logger.error(f"Fehler bei 2FA-Verifikation: {e}")
            return False
    
    def create_2fa_session(self, admin_id):
        """Erstellt eine 2FA-Session für Admin-Login"""
        try:
            import secrets
            from datetime import datetime, timedelta
            
            session_token = secrets.token_urlsafe(32)
            expires_at = datetime.now() + timedelta(minutes=10)  # 10 Minuten
            
            with self._lock:
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                cursor = conn.cursor()
                
                # Alte Sessions löschen
                cursor.execute("DELETE FROM admin_2fa_sessions WHERE admin_id = ?", (admin_id,))
                
                # Neue Session erstellen
                cursor.execute("""
                    INSERT INTO admin_2fa_sessions 
                    (admin_id, session_token, expires_at)
                    VALUES (?, ?, ?)
                """, (admin_id, session_token, expires_at.isoformat()))
                
                conn.commit()
                conn.close()
                
                return session_token
                
        except Exception as e:
            logger.error(f"Fehler beim Erstellen der 2FA-Session: {e}")
            return None
    
    def verify_2fa_session(self, session_token):
        """Überprüft und markiert eine 2FA-Session als verifiziert"""
        try:
            from datetime import datetime
            
            with self._lock:
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                cursor = conn.cursor()
                
                # Session finden und prüfen
                cursor.execute("""
                    SELECT admin_id, expires_at FROM admin_2fa_sessions
                    WHERE session_token = ? AND is_verified = 0
                """, (session_token,))
                
                result = cursor.fetchone()
                if not result:
                    conn.close()
                    return None
                
                admin_id, expires_at_str = result
                expires_at = datetime.fromisoformat(expires_at_str)
                
                # Prüfen ob Session noch gültig
                if datetime.now() > expires_at:
                    cursor.execute("DELETE FROM admin_2fa_sessions WHERE session_token = ?", (session_token,))
                    conn.commit()
                    conn.close()
                    return None
                
                # Session als verifiziert markieren
                cursor.execute("""
                    UPDATE admin_2fa_sessions 
                    SET is_verified = 1 
                    WHERE session_token = ?
                """, (session_token,))
                
                conn.commit()
                conn.close()
                
                return admin_id
                
        except Exception as e:
            logger.error(f"Fehler bei 2FA-Session-Verifikation: {e}")
            return None
    
    def cleanup_expired_2fa_sessions(self):
        """Entfernt abgelaufene 2FA-Sessions"""
        try:
            from datetime import datetime
            
            with self._lock:
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                cursor = conn.cursor()
                
                cursor.execute("""
                    DELETE FROM admin_2fa_sessions 
                    WHERE expires_at < ?
                """, (datetime.now().isoformat(),))
                
                deleted_count = cursor.rowcount
                conn.commit()
                conn.close()
                
                if deleted_count > 0:
                    logger.info(f"🧹 {deleted_count} abgelaufene 2FA-Sessions entfernt")
                
        except Exception as e:
            logger.error(f"Fehler beim Bereinigen der 2FA-Sessions: {e}")

    # ================= TRUSTED DEVICES MANAGEMENT =================
    
    def create_device_fingerprint(self, user_agent: str, ip_address: str) -> str:
        """
        Erstellt einen eindeutigen Fingerprint für ein Gerät
        
        Args:
            user_agent: Browser User-Agent String
            ip_address: IP-Adresse des Clients
            
        Returns:
            Eindeutiger Device-Fingerprint
        """
        import hashlib
        
        # Kombiniere verschiedene Eigenschaften für Fingerprinting
        fingerprint_data = f"{user_agent}:{ip_address}"
        
        # SHA256 Hash für eindeutigen Fingerprint
        fingerprint = hashlib.sha256(fingerprint_data.encode('utf-8')).hexdigest()
        
        return fingerprint
    
    def add_trusted_device(self, admin_id: int, device_fingerprint: str, 
                          device_name: str = None, user_agent: str = None, 
                          ip_address: str = None, trust_days: int = 30) -> bool:
        """
        Fügt ein vertrauenswürdiges Gerät hinzu
        
        Args:
            admin_id: ID des Admin-Benutzers
            device_fingerprint: Eindeutiger Device-Fingerprint
            device_name: Benutzerfreundlicher Gerätename
            user_agent: Browser User-Agent
            ip_address: IP-Adresse
            trust_days: Anzahl Tage, für die das Gerät vertrauenswürdig ist
            
        Returns:
            True bei Erfolg, False bei Fehler
        """
        try:
            from datetime import datetime, timedelta
            
            expires_at = datetime.now() + timedelta(days=trust_days)
            
            with self._lock:
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                cursor = conn.cursor()
                
                # Gerät hinzufügen oder aktualisieren
                cursor.execute("""
                    INSERT OR REPLACE INTO admin_trusted_devices 
                    (admin_id, device_fingerprint, device_name, user_agent, ip_address, expires_at, last_used)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (admin_id, device_fingerprint, device_name, user_agent, ip_address, 
                      expires_at.isoformat(), datetime.now().isoformat()))
                
                conn.commit()
                conn.close()
                
                logger.info(f"✅ Vertrauenswürdiges Gerät hinzugefügt für Admin ID {admin_id}")
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Hinzufügen des vertrauenswürdigen Geräts: {e}")
            return False
    
    def is_trusted_device(self, admin_id: int, device_fingerprint: str) -> bool:
        """
        Prüft, ob ein Gerät als vertrauenswürdig markiert ist
        
        Args:
            admin_id: ID des Admin-Benutzers  
            device_fingerprint: Device-Fingerprint zum Prüfen
            
        Returns:
            True wenn Gerät vertrauenswürdig und nicht abgelaufen
        """
        try:
            from datetime import datetime
            
            with self._lock:
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT id, expires_at FROM admin_trusted_devices
                    WHERE admin_id = ? AND device_fingerprint = ? AND expires_at > ?
                """, (admin_id, device_fingerprint, datetime.now().isoformat()))
                
                result = cursor.fetchone()
                
                if result:
                    # Letzten Zugriff aktualisieren
                    cursor.execute("""
                        UPDATE admin_trusted_devices 
                        SET last_used = ?
                        WHERE id = ?
                    """, (datetime.now().isoformat(), result[0]))
                    
                    conn.commit()
                    conn.close()
                    
                    logger.info(f"✅ Vertrauenswürdiges Gerät erkannt für Admin ID {admin_id}")
                    return True
                else:
                    conn.close()
                    return False
                    
        except Exception as e:
            logger.error(f"Fehler beim Prüfen des vertrauenswürdigen Geräts: {e}")
            return False
    
    def get_trusted_devices(self, admin_id: int) -> List[Dict[str, Any]]:
        """
        Holt alle vertrauenswürdigen Geräte für einen Admin
        
        Args:
            admin_id: ID des Admin-Benutzers
            
        Returns:
            Liste der vertrauenswürdigen Geräte
        """
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT id, device_fingerprint, device_name, user_agent, 
                           ip_address, expires_at, last_used, created_at
                    FROM admin_trusted_devices
                    WHERE admin_id = ?
                    ORDER BY last_used DESC
                """, (admin_id,))
                
                devices = []
                for row in cursor.fetchall():
                    devices.append({
                        'id': row[0],
                        'device_fingerprint': row[1],
                        'device_name': row[2],
                        'user_agent': row[3],
                        'ip_address': row[4],
                        'expires_at': row[5],
                        'last_used': row[6],
                        'created_at': row[7]
                    })
                
                conn.close()
                return devices
                
        except Exception as e:
            logger.error(f"Fehler beim Abrufen der vertrauenswürdigen Geräte: {e}")
            return []
    
    def remove_trusted_device(self, admin_id: int, device_id: int = None, 
                             device_fingerprint: str = None) -> bool:
        """
        Entfernt ein vertrauenswürdiges Gerät
        
        Args:
            admin_id: ID des Admin-Benutzers
            device_id: ID des zu entfernenden Geräts
            device_fingerprint: Fingerprint des zu entfernenden Geräts
            
        Returns:
            True bei Erfolg
        """
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                cursor = conn.cursor()
                
                if device_id:
                    cursor.execute("""
                        DELETE FROM admin_trusted_devices
                        WHERE admin_id = ? AND id = ?
                    """, (admin_id, device_id))
                elif device_fingerprint:
                    cursor.execute("""
                        DELETE FROM admin_trusted_devices
                        WHERE admin_id = ? AND device_fingerprint = ?
                    """, (admin_id, device_fingerprint))
                else:
                    conn.close()
                    return False
                
                removed_count = cursor.rowcount
                conn.commit()
                conn.close()
                
                if removed_count > 0:
                    logger.info(f"🗑️ Vertrauenswürdiges Gerät entfernt für Admin ID {admin_id}")
                    return True
                else:
                    return False
                    
        except Exception as e:
            logger.error(f"Fehler beim Entfernen des vertrauenswürdigen Geräts: {e}")
            return False
    
    def cleanup_expired_trusted_devices(self):
        """Entfernt abgelaufene vertrauenswürdige Geräte"""
        try:
            from datetime import datetime
            
            with self._lock:
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                cursor = conn.cursor()
                
                cursor.execute("""
                    DELETE FROM admin_trusted_devices 
                    WHERE expires_at < ?
                """, (datetime.now().isoformat(),))
                
                deleted_count = cursor.rowcount
                conn.commit()
                conn.close()
                
                if deleted_count > 0:
                    logger.info(f"🧹 {deleted_count} abgelaufene vertrauenswürdige Geräte entfernt")
                
        except Exception as e:
            logger.error(f"Fehler beim Bereinigen der vertrauenswürdigen Geräte: {e}")

    # =============================================================================
    # NOTIZLISTE FUNKTIONEN
    # =============================================================================

    def get_notizen(self):
        """Lädt alle Notizen"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT id, titel, inhalt, kategorie, prioritaet, erstellt_von, 
                           erstellt_am, bearbeitet_am
                    FROM notizen 
                    ORDER BY 
                        CASE prioritaet 
                            WHEN 'Dringend' THEN 1 
                            WHEN 'Hoch' THEN 2 
                            WHEN 'Normal' THEN 3 
                            WHEN 'Niedrig' THEN 4 
                            ELSE 5 
                        END,
                        bearbeitet_am DESC
                """)
                
                notizen = []
                for row in cursor.fetchall():
                    notizen.append({
                        'id': row[0],
                        'titel': row[1],
                        'inhalt': row[2] or '',
                        'kategorie': row[3] or 'Allgemein',
                        'prioritaet': row[4] or 'Normal',
                        'erstellt_von': row[5] or '',
                        'erstellt_am': row[6],
                        'aktualisiert_am': row[7]  # JavaScript erwartet aktualisiert_am
                    })
                
                conn.close()
                return notizen
                
        except Exception as e:
            logger.error(f"Fehler beim Laden der Notizen: {e}")
            return []

    def add_notiz(self, notiz_data):
        """Fügt eine neue Notiz hinzu"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                cursor = conn.cursor()
                
                cursor.execute("""
                    INSERT INTO notizen (titel, inhalt, kategorie, prioritaet, erstellt_von, erstellt_am, bearbeitet_am)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    notiz_data['titel'],
                    notiz_data.get('inhalt', ''),
                    notiz_data.get('kategorie', 'Allgemein'),
                    notiz_data.get('prioritaet', 'Normal'),
                    notiz_data.get('erstellt_von', ''),
                    notiz_data.get('erstellt_am'),
                    notiz_data.get('bearbeitet_am')
                ))
                
                notiz_id = cursor.lastrowid
                conn.commit()
                conn.close()
                
                logger.info(f"✅ Neue Notiz erstellt: {notiz_data['titel']} (ID: {notiz_id})")
                return notiz_id
                
        except Exception as e:
            logger.error(f"Fehler beim Hinzufügen der Notiz: {e}")
            return None

    def update_notiz(self, notiz_id, notiz_data):
        """Aktualisiert eine bestehende Notiz"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                cursor = conn.cursor()
                
                # Prüfe ob Notiz existiert
                cursor.execute("SELECT id FROM notizen WHERE id = ?", (notiz_id,))
                if not cursor.fetchone():
                    conn.close()
                    return False
                
                cursor.execute("""
                    UPDATE notizen 
                    SET titel = ?, inhalt = ?, kategorie = ?, prioritaet = ?, bearbeitet_am = ?
                    WHERE id = ?
                """, (
                    notiz_data['titel'],
                    notiz_data.get('inhalt', ''),
                    notiz_data.get('kategorie', 'Allgemein'),
                    notiz_data.get('prioritaet', 'Normal'),
                    notiz_data.get('bearbeitet_am'),
                    notiz_id
                ))
                
                conn.commit()
                conn.close()
                
                logger.info(f"✅ Notiz aktualisiert: ID {notiz_id}")
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Aktualisieren der Notiz: {e}")
            return False

    def delete_notiz(self, notiz_id):
        """Löscht eine Notiz"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                cursor = conn.cursor()
                
                # Hole Titel für Logging
                cursor.execute("SELECT titel FROM notizen WHERE id = ?", (notiz_id,))
                result = cursor.fetchone()
                if not result:
                    conn.close()
                    return False
                
                titel = result[0]
                
                cursor.execute("DELETE FROM notizen WHERE id = ?", (notiz_id,))
                conn.commit()
                conn.close()
                
                logger.info(f"✅ Notiz gelöscht: {titel} (ID: {notiz_id})")
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Löschen der Notiz: {e}")
            return False

    def get_notiz_by_id(self, notiz_id):
        """Lädt eine spezifische Notiz"""
        try:
            with self._lock:
                conn = sqlite3.connect(self.db_path, timeout=30.0)
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT id, titel, inhalt, kategorie, prioritaet, erstellt_von, 
                           erstellt_am, bearbeitet_am
                    FROM notizen WHERE id = ?
                """, (notiz_id,))
                
                row = cursor.fetchone()
                conn.close()
                
                if row:
                    return {
                        'id': row[0],
                        'titel': row[1],
                        'inhalt': row[2] or '',
                        'kategorie': row[3] or 'Allgemein',
                        'prioritaet': row[4] or 'Normal',
                        'erstellt_von': row[5] or '',
                        'erstellt_am': row[6],
                        'bearbeitet_am': row[7]
                    }
                return None
                
        except Exception as e:
            logger.error(f"Fehler beim Laden der Notiz: {e}")
            return None

    # =================================================================
    # Hochzeitstag Checkliste Methoden (unabhängig vom Aufgabenplaner)
    # =================================================================
    
    def get_checkliste_items(self) -> list:
        """Alle Checkliste-Einträge abrufen"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, titel, beschreibung, kategorie, prioritaet, uhrzeit, 
                       erledigt, erledigt_am, erledigt_von, created_at, updated_at, sort_order
                FROM hochzeitstag_checkliste 
                ORDER BY erledigt ASC, sort_order ASC, prioritaet DESC, uhrzeit ASC
            """)
            
            rows = cursor.fetchall()
            conn.close()
            
            items = []
            for row in rows:
                items.append({
                    'id': row[0],
                    'titel': row[1] or '',
                    'beschreibung': row[2] or '',
                    'kategorie': row[3] or 'Allgemein',
                    'prioritaet': row[4] or 1,  # Priority ist INTEGER
                    'uhrzeit': row[5] or '',
                    'erledigt': bool(row[6]),
                    'erledigt_am': row[7],
                    'erledigt_von': row[8] or '',
                    'created_at': row[9],
                    'updated_at': row[10],
                    'sort_order': row[11] or 0
                })
            
            return items
            
        except Exception as e:
            logger.error(f"Fehler beim Laden der Checkliste: {e}")
            return []
    
    def add_checkliste_item(self, item_data: dict) -> int:
        """Neuen Checkliste-Eintrag hinzufügen"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO hochzeitstag_checkliste 
                (titel, beschreibung, kategorie, prioritaet, uhrzeit, erledigt, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                item_data.get('titel', ''),
                item_data.get('beschreibung', ''),
                item_data.get('kategorie', 'Allgemein'),
                item_data.get('prioritaet', 1),  # Priority ist INTEGER
                item_data.get('uhrzeit', ''),
                0,  # erledigt = False
                item_data.get('sort_order', 0)
            ))
            
            item_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            logger.info(f"Checkliste-Eintrag erstellt: {item_data.get('titel')} (ID: {item_id})")
            return item_id
            
        except Exception as e:
            logger.error(f"Fehler beim Erstellen des Checkliste-Eintrags: {e}")
            return 0
    
    def update_checkliste_item(self, item_id: int, item_data: dict) -> bool:
        """Checkliste-Eintrag aktualisieren"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Wenn erledigt-Status geändert wird, erledigt_am setzen
            erledigt_am = None
            if item_data.get('erledigt'):
                erledigt_am = datetime.now().isoformat()
            
            cursor.execute("""
                UPDATE hochzeitstag_checkliste 
                SET titel = ?, beschreibung = ?, kategorie = ?, prioritaet = ?, 
                    uhrzeit = ?, erledigt = ?, erledigt_am = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (
                item_data.get('titel', ''),
                item_data.get('beschreibung', ''),
                item_data.get('kategorie', 'Allgemein'),
                item_data.get('prioritaet', 1),  # Priority ist INTEGER
                item_data.get('uhrzeit', ''),
                1 if item_data.get('erledigt') else 0,
                erledigt_am,
                item_id
            ))
            
            conn.commit()
            affected_rows = cursor.rowcount
            conn.close()
            
            if affected_rows > 0:
                logger.info(f"Checkliste-Eintrag aktualisiert: ID {item_id}")
                return True
            else:
                logger.warning(f"Checkliste-Eintrag nicht gefunden: ID {item_id}")
                return False
                
        except Exception as e:
            logger.error(f"Fehler beim Aktualisieren des Checkliste-Eintrags: {e}")
            return False
    
    def delete_checkliste_item(self, item_id: int) -> bool:
        """Checkliste-Eintrag löschen"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("DELETE FROM hochzeitstag_checkliste WHERE id = ?", (item_id,))
            
            conn.commit()
            affected_rows = cursor.rowcount
            conn.close()
            
            if affected_rows > 0:
                logger.info(f"Checkliste-Eintrag gelöscht: ID {item_id}")
                return True
            else:
                logger.warning(f"Checkliste-Eintrag nicht gefunden: ID {item_id}")
                return False
                
        except Exception as e:
            logger.error(f"Fehler beim Löschen des Checkliste-Eintrags: {e}")
            return False
    
    def toggle_checkliste_item(self, item_id: int) -> bool:
        """Erledigt-Status eines Checkliste-Eintrags umschalten"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Aktueller Status ermitteln
            cursor.execute("SELECT erledigt FROM hochzeitstag_checkliste WHERE id = ?", (item_id,))
            row = cursor.fetchone()
            
            if not row:
                conn.close()
                return False
            
            new_status = 0 if row[0] else 1
            erledigt_am = datetime.now().isoformat() if new_status else None
            
            cursor.execute("""
                UPDATE hochzeitstag_checkliste 
                SET erledigt = ?, erledigt_am = ?
                WHERE id = ?
            """, (new_status, erledigt_am, item_id))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Checkliste-Eintrag Status geändert: ID {item_id} -> {'erledigt' if new_status else 'offen'}")
            return True
            
        except Exception as e:
            logger.error(f"Fehler beim Umschalten des Checkliste-Status: {e}")
            return False
    
    def create_standard_checkliste(self) -> int:
        """Standard Hochzeitstag-Checkliste erstellen"""
        try:
            # Prüfen ob bereits Standard-Einträge existieren
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM hochzeitstag_checkliste")
            existing_count = cursor.fetchone()[0]
            conn.close()
            
            if existing_count > 0:
                logger.info("Checkliste bereits vorhanden, keine Standard-Einträge erstellt")
                return 0
            
            # Standard Hochzeitstag-Checkliste
            standard_items = [
                {
                    'titel': '🌅 Morgenroutine & Aufstehen',
                    'beschreibung': 'Entspannt aufstehen, duschen und ausgiebig frühstücken',
                    'kategorie': 'Vorbereitung',
                    'prioritaet': 3,  # Hoch = 3
                    'uhrzeit': '07:00',
                    'sort_order': 1
                },
                {
                    'titel': '💆‍♀️ Wellness & Entspannung',
                    'beschreibung': 'Zeit für sich nehmen, entspannen und mental vorbereiten',
                    'kategorie': 'Vorbereitung', 
                    'prioritaet': 2,  # Normal = 2
                    'uhrzeit': '08:00',
                    'sort_order': 2
                },
                {
                    'titel': '🥂 Sekt-Frühstück mit Familie',
                    'beschreibung': 'Gemeinsames Frühstück mit den wichtigsten Personen',
                    'kategorie': 'Familie',
                    'prioritaet': 3,  # Hoch = 3
                    'uhrzeit': '09:00',
                    'sort_order': 3
                },
                {
                    'titel': '💇‍♀️ Friseur Termin',
                    'beschreibung': 'Haare stylen und Make-up Probe',
                    'kategorie': 'Beauty',
                    'prioritaet': 4,  # Kritisch = 4
                    'uhrzeit': '10:00',
                    'sort_order': 4
                },
                {
                    'titel': '👗 Anziehen & finale Vorbereitung',
                    'beschreibung': 'Brautkleid/Anzug anziehen und letzte Details',
                    'kategorie': 'Anziehen',
                    'prioritaet': 4,  # Kritisch = 4
                    'uhrzeit': '11:00',
                    'sort_order': 5
                },
                {
                    'titel': '📸 Getting Ready Fotos',
                    'beschreibung': 'Fotos vom Anziehen und der Vorbereitung',
                    'kategorie': 'Fotografie',
                    'prioritaet': 2,  # Normal = 2
                    'uhrzeit': '11:30',
                    'sort_order': 6
                },
                {
                    'titel': '🚗 Fahrt zur Trauung',
                    'beschreibung': 'Rechtzeitige Ankunft am Trauungsort',
                    'kategorie': 'Transport',
                    'prioritaet': 4,  # Kritisch = 4
                    'uhrzeit': '12:00',
                    'sort_order': 7
                },
                {
                    'titel': '💒 Trauungszeremonie',
                    'beschreibung': 'Der wichtigste Moment des Tages',
                    'kategorie': 'Zeremonie',
                    'prioritaet': 4,  # Kritisch = 4
                    'uhrzeit': '13:00',
                    'sort_order': 8
                },
                {
                    'titel': '🎊 Gratulationen & Empfang',
                    'beschreibung': 'Empfang der Gäste und Gratulationen',
                    'kategorie': 'Feier',
                    'prioritaet': 3,  # Hoch = 3
                    'uhrzeit': '14:00',
                    'sort_order': 9
                },
                {
                    'titel': '📷 Gruppenfotos',
                    'beschreibung': 'Fotos mit Familie und Freunden',
                    'kategorie': 'Fotografie',
                    'prioritaet': 3,  # Hoch = 3
                    'uhrzeit': '14:30',
                    'sort_order': 10
                },
                {
                    'titel': '🍽️ Hochzeitsessen',
                    'beschreibung': 'Gemeinsames Festessen mit allen Gästen',
                    'kategorie': 'Catering',
                    'prioritaet': 3,  # Hoch = 3
                    'uhrzeit': '15:30',
                    'sort_order': 11
                },
                {
                    'titel': '🎤 Reden & Danksagungen',
                    'beschreibung': 'Reden von Familie und Freunden',
                    'kategorie': 'Programm',
                    'prioritaet': 2,  # Normal = 2
                    'uhrzeit': '17:00',
                    'sort_order': 12
                },
                {
                    'titel': '🎂 Anschnitt der Hochzeitstorte',
                    'beschreibung': 'Gemeinsamer Anschnitt der Hochzeitstorte',
                    'kategorie': 'Zeremonie',
                    'prioritaet': 3,  # Hoch = 3
                    'uhrzeit': '18:00',
                    'sort_order': 13
                },
                {
                    'titel': '💃 Eröffnungstanz',
                    'beschreibung': 'Der erste Tanz als Ehepaar',
                    'kategorie': 'Tanz',
                    'prioritaet': 3,  # Hoch = 3
                    'uhrzeit': '19:00',
                    'sort_order': 14
                },
                {
                    'titel': '🎉 Party & Feier bis spät',
                    'beschreibung': 'Feiern und tanzen mit Familie und Freunden',
                    'kategorie': 'Party',
                    'prioritaet': 2,  # Normal = 2
                    'uhrzeit': '20:00',
                    'sort_order': 15
                }
            ]
            
            created_count = 0
            for item in standard_items:
                item_id = self.add_checkliste_item(item)
                if item_id > 0:
                    created_count += 1
            
            logger.info(f"Standard Hochzeitstag-Checkliste erstellt: {created_count} Einträge")
            return created_count
            
        except Exception as e:
            logger.error(f"Fehler beim Erstellen der Standard-Checkliste: {e}")
            return 0

    # =============================================================================
    # Geldgeschenk Konfiguration Management
    # =============================================================================
    
    def get_geldgeschenk_config(self):
        """
        Lädt die Geldgeschenk-Konfiguration
        
        Returns:
            Dict: Geldgeschenk-Konfiguration oder None
        """
        try:
            with self._lock:
                conn = self._get_connection()
                cursor = conn.cursor()
                
                cursor.execute("SELECT * FROM geldgeschenk_config WHERE id = 1")
                result = cursor.fetchone()
                conn.close()
                
                if result:
                    columns = [description[0] for description in cursor.description]
                    config = dict(zip(columns, result))
                    logger.info("✅ Geldgeschenk-Konfiguration geladen")
                    return config
                
                return None
                
        except Exception as e:
            logger.error(f"Fehler beim Laden der Geldgeschenk-Konfiguration: {e}")
            return None
    
    def save_geldgeschenk_config(self, name, beschreibung, paypal_link, aktiv=1):
        """
        Speichert oder aktualisiert die Geldgeschenk-Konfiguration
        
        Args:
            name: Name des Geldgeschenks
            beschreibung: Beschreibung (optional)
            paypal_link: PayPal-Link
            aktiv: Aktiv-Status (0/1)
            
        Returns:
            bool: Erfolg
        """
        try:
            with self._lock:
                conn = self._get_connection()
                cursor = conn.cursor()
                
                # Prüfe ob bereits eine Konfiguration existiert
                cursor.execute("SELECT id FROM geldgeschenk_config WHERE id = 1")
                exists = cursor.fetchone()
                
                if exists:
                    # Update
                    cursor.execute("""
                        UPDATE geldgeschenk_config 
                        SET name = ?, beschreibung = ?, paypal_link = ?, aktiv = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE id = 1
                    """, (name, beschreibung, paypal_link, aktiv))
                else:
                    # Insert
                    cursor.execute("""
                        INSERT INTO geldgeschenk_config (id, name, beschreibung, paypal_link, aktiv)
                        VALUES (1, ?, ?, ?, ?)
                    """, (name, beschreibung, paypal_link, aktiv))
                
                conn.commit()
                conn.close()
                
                logger.info(f"✅ Geldgeschenk-Konfiguration gespeichert: {name}")
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Speichern der Geldgeschenk-Konfiguration: {e}")
            return False
    
    def waehle_geldgeschenk_aus(self, gast_id, betrag=None, notiz=None):
        """
        Wählt das Geldgeschenk für einen Gast aus
        
        Args:
            gast_id: ID des Gastes
            betrag: Optional: gewählter Betrag
            notiz: Optional: Nachricht/Notiz
            
        Returns:
            bool: Erfolg
        """
        try:
            with self._lock:
                conn = self._get_connection()
                cursor = conn.cursor()
                
                # Prüfe ob Gast bereits Geldgeschenk ausgewählt hat
                cursor.execute("SELECT id FROM geldgeschenk_auswahlen WHERE gast_id = ?", (gast_id,))
                exists = cursor.fetchone()
                
                if exists:
                    logger.warning(f"Gast {gast_id} hat bereits ein Geldgeschenk ausgewählt")
                    return False
                
                # Neue Auswahl speichern
                cursor.execute("""
                    INSERT INTO geldgeschenk_auswahlen (gast_id, betrag, notiz)
                    VALUES (?, ?, ?)
                """, (gast_id, betrag, notiz))
                
                conn.commit()
                conn.close()
                
                logger.info(f"✅ Geldgeschenk für Gast {gast_id} ausgewählt")
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Auswählen des Geldgeschenks: {e}")
            return False
    
    def gebe_geldgeschenk_frei(self, gast_id):
        """
        Gibt das Geldgeschenk eines Gastes frei
        
        Args:
            gast_id: ID des Gastes
            
        Returns:
            bool: Erfolg
        """
        try:
            with self._lock:
                conn = self._get_connection()
                cursor = conn.cursor()
                
                cursor.execute("DELETE FROM geldgeschenk_auswahlen WHERE gast_id = ?", (gast_id,))
                affected = cursor.rowcount
                
                conn.commit()
                conn.close()
                
                if affected > 0:
                    logger.info(f"✅ Geldgeschenk für Gast {gast_id} freigegeben")
                    return True
                
                return False
                
        except Exception as e:
            logger.error(f"Fehler beim Freigeben des Geldgeschenks: {e}")
            return False
    
    def get_geldgeschenk_auswahlen(self):
        """
        Lädt alle Geldgeschenk-Auswahlen
        
        Returns:
            List[Dict]: Liste der Auswahlen
        """
        try:
            with self._lock:
                conn = self._get_connection()
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT ga.*, g.vorname || ' ' || COALESCE(g.nachname, '') as gast_name
                    FROM geldgeschenk_auswahlen ga
                    LEFT JOIN gaeste g ON ga.gast_id = g.id
                    ORDER BY ga.ausgewaehlt_am DESC
                """)
                
                columns = [description[0] for description in cursor.description]
                auswahlen = [dict(zip(columns, row)) for row in cursor.fetchall()]
                conn.close()
                
                logger.info(f"✅ {len(auswahlen)} Geldgeschenk-Auswahlen geladen")
                return auswahlen
                
        except Exception as e:
            logger.error(f"Fehler beim Laden der Geldgeschenk-Auswahlen: {e}")
            return []

    # =============================================================================
    # Geschenkliste Management (ohne Geldgeschenke)
    # =============================================================================
    
    def get_geschenkliste(self, only_available=False):
        """
        Lädt alle Geschenke aus der Geschenkliste
        
        Args:
            only_available: Nur verfügbare Geschenke laden (nicht ausgewählt)
        
        Returns:
            List[Dict]: Liste der Geschenke
        """
        try:
            with self._lock:
                conn = self._get_connection()
                cursor = conn.cursor()
                
                query = """
                    SELECT g.*, ga.vorname || ' ' || COALESCE(ga.nachname, '') as ausgewaehlt_von_name
                    FROM geschenkliste g
                    LEFT JOIN gaeste ga ON g.ausgewaehlt_von_gast_id = ga.id
                """
                
                if only_available:
                    query += " WHERE g.ausgewaehlt_menge < g.menge OR g.ausgewaehlt_menge IS NULL"
                
                query += " ORDER BY g.kategorie, g.prioritaet DESC, g.name"
                
                cursor.execute(query)
                columns = [description[0] for description in cursor.description]
                geschenke = [dict(zip(columns, row)) for row in cursor.fetchall()]
                conn.close()
                
                logger.info(f"✅ {len(geschenke)} Geschenke geladen (only_available: {only_available})")
                return geschenke
                
        except Exception as e:
            logger.error(f"Fehler beim Laden der Geschenkliste: {e}")
            return []
    
    def get_geschenk_by_id(self, geschenk_id):
        """
        Lädt ein einzelnes Geschenk anhand der ID
        
        Args:
            geschenk_id: ID des Geschenks
            
        Returns:
            Dict: Geschenk-Daten oder None
        """
        try:
            with self._lock:
                conn = self._get_connection()
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT g.*, ga.vorname || ' ' || COALESCE(ga.nachname, '') as ausgewaehlt_von_name
                    FROM geschenkliste g
                    LEFT JOIN gaeste ga ON g.ausgewaehlt_von_gast_id = ga.id
                    WHERE g.id = ?
                """, (geschenk_id,))
                
                row = cursor.fetchone()
                conn.close()
                
                if row:
                    columns = [description[0] for description in cursor.description]
                    return dict(zip(columns, row))
                return None
                
        except Exception as e:
            logger.error(f"Fehler beim Laden des Geschenks {geschenk_id}: {e}")
            return None
    
    def add_geschenk(self, geschenk_data):
        """
        Fügt ein neues Geschenk zur Liste hinzu
        
        Args:
            geschenk_data: Dictionary mit Geschenk-Daten
            
        Returns:
            int: ID des neuen Geschenks oder 0 bei Fehler
        """
        try:
            with self._lock:
                conn = self._get_connection()
                cursor = conn.cursor()
                
                cursor.execute("""
                    INSERT INTO geschenkliste (
                        name, beschreibung, preis, waehrung, link,
                        prioritaet, kategorie, bild_url, menge
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    geschenk_data.get('name'),
                    geschenk_data.get('beschreibung'),
                    geschenk_data.get('preis'),
                    geschenk_data.get('waehrung', 'EUR'),
                    geschenk_data.get('link'),
                    geschenk_data.get('prioritaet', 'Normal'),
                    geschenk_data.get('kategorie', 'Allgemein'),
                    geschenk_data.get('bild_url'),
                    geschenk_data.get('menge', 1)
                ))
                
                geschenk_id = cursor.lastrowid
                conn.commit()
                conn.close()
                
                logger.info(f"✅ Geschenk '{geschenk_data.get('name')}' hinzugefügt (ID: {geschenk_id})")
                return geschenk_id
                
        except Exception as e:
            logger.error(f"Fehler beim Hinzufügen des Geschenks: {e}")
            return 0
    
    def update_geschenk(self, geschenk_id, geschenk_data):
        """
        Aktualisiert ein vorhandenes Geschenk
        
        Args:
            geschenk_id: ID des zu aktualisierenden Geschenks
            geschenk_data: Dictionary mit neuen Daten
            
        Returns:
            bool: True bei Erfolg, False bei Fehler
        """
        try:
            with self._lock:
                conn = self._get_connection()
                cursor = conn.cursor()
                
                # Dynamisches Update basierend auf vorhandenen Schlüsseln
                set_clauses = []
                values = []
                
                updatable_fields = [
                    'name', 'beschreibung', 'preis', 'waehrung', 'link', 
                    'prioritaet', 'kategorie', 'bild_url', 'menge'
                ]
                
                for field in updatable_fields:
                    if field in geschenk_data:
                        set_clauses.append(f"{field} = ?")
                        values.append(geschenk_data[field])
                
                if not set_clauses:
                    return True  # Nichts zu aktualisieren
                
                query = f"UPDATE geschenkliste SET {', '.join(set_clauses)} WHERE id = ?"
                values.append(geschenk_id)
                
                cursor.execute(query, values)
                success = cursor.rowcount > 0
                conn.commit()
                conn.close()
                
                if success:
                    logger.info(f"✅ Geschenk {geschenk_id} aktualisiert")
                else:
                    logger.warning(f"⚠️ Geschenk {geschenk_id} nicht gefunden")
                
                return success
                
        except Exception as e:
            logger.error(f"Fehler beim Aktualisieren des Geschenks {geschenk_id}: {e}")
            return False
    
    def delete_geschenk(self, geschenk_id):
        """
        Löscht ein Geschenk aus der Liste
        
        Args:
            geschenk_id: ID des zu löschenden Geschenks
            
        Returns:
            bool: True bei Erfolg, False bei Fehler
        """
        try:
            with self._lock:
                conn = self._get_connection()
                cursor = conn.cursor()
                
                cursor.execute("DELETE FROM geschenkliste WHERE id = ?", (geschenk_id,))
                success = cursor.rowcount > 0
                conn.commit()
                conn.close()
                
                if success:
                    logger.info(f"✅ Geschenk {geschenk_id} gelöscht")
                else:
                    logger.warning(f"⚠️ Geschenk {geschenk_id} nicht gefunden")
                
                return success
                
        except Exception as e:
            logger.error(f"Fehler beim Löschen des Geschenks {geschenk_id}: {e}")
            return False
    
    def waehle_geschenk_aus(self, geschenk_id, gast_id, menge=1):
        """
        Wählt ein Geschenk für einen Gast aus
        
        Args:
            geschenk_id: ID des Geschenks
            gast_id: ID des Gastes
            menge: Anzahl der auszuwählenden Geschenke
            
        Returns:
            bool: True bei Erfolg, False bei Fehler
        """
        try:
            with self._lock:
                conn = self._get_connection()
                cursor = conn.cursor()
                
                # Prüfe verfügbare Menge
                cursor.execute("""
                    SELECT menge, ausgewaehlt_menge, name 
                    FROM geschenkliste WHERE id = ?
                """, (geschenk_id,))
                
                result = cursor.fetchone()
                if not result:
                    logger.error(f"Geschenk {geschenk_id} nicht gefunden")
                    return False
                
                verfuegbare_menge, ausgewaehlt_menge, name = result
                ausgewaehlt_menge = ausgewaehlt_menge or 0
                verfuegbar = verfuegbare_menge - ausgewaehlt_menge
                
                if menge > verfuegbar:
                    logger.error(f"Nicht genügend Geschenke verfügbar: {verfuegbar} < {menge}")
                    return False
                
                # Aktualisiere Auswahl
                neue_ausgewaehlt_menge = ausgewaehlt_menge + menge
                
                cursor.execute("""
                    UPDATE geschenkliste 
                    SET ausgewaehlt_menge = ?,
                        ausgewaehlt_von_gast_id = ?,
                        ausgewaehlt_am = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (neue_ausgewaehlt_menge, gast_id, geschenk_id))
                
                success = cursor.rowcount > 0
                conn.commit()
                conn.close()
                
                if success:
                    logger.info(f"✅ Geschenk '{name}' (Menge: {menge}) von Gast {gast_id} ausgewählt")
                else:
                    logger.error(f"Fehler beim Auswählen des Geschenks {geschenk_id}")
                
                return success
                
        except Exception as e:
            logger.error(f"Fehler beim Auswählen des Geschenks: {e}")
            return False
    
    def gebe_geschenk_frei(self, geschenk_id, gast_id=None, menge=None):
        """
        Gibt ein ausgewähltes Geschenk wieder frei
        
        Args:
            geschenk_id: ID des Geschenks
            gast_id: Optional - Nur freigeben wenn dieser Gast es ausgewählt hat
            menge: Optional - Anzahl freizugeben (Standard: alle)
            
        Returns:
            bool: True bei Erfolg, False bei Fehler
        """
        try:
            with self._lock:
                conn = self._get_connection()
                cursor = conn.cursor()
                
                # Lade aktuellen Status
                cursor.execute("""
                    SELECT ausgewaehlt_menge, ausgewaehlt_von_gast_id, name, menge
                    FROM geschenkliste WHERE id = ?
                """, (geschenk_id,))
                
                result = cursor.fetchone()
                if not result:
                    return False
                
                ausgewaehlt_menge, ausgewaehlt_von_gast_id, name, total_menge = result
                
                # Prüfe Berechtigung falls gast_id angegeben
                if gast_id and ausgewaehlt_von_gast_id != gast_id:
                    logger.error(f"Gast {gast_id} kann Geschenk {geschenk_id} nicht freigeben (gehört Gast {ausgewaehlt_von_gast_id})")
                    return False
                
                # Berechne neue Menge
                if menge is None:
                    neue_menge = 0  # Alles freigeben
                else:
                    neue_menge = max(0, (ausgewaehlt_menge or 0) - menge)
                
                # Update oder Zurücksetzen
                if neue_menge == 0:
                    cursor.execute("""
                        UPDATE geschenkliste 
                        SET ausgewaehlt_menge = 0,
                            ausgewaehlt_von_gast_id = NULL,
                            ausgewaehlt_am = NULL
                        WHERE id = ?
                    """, (geschenk_id,))
                else:
                    cursor.execute("""
                        UPDATE geschenkliste 
                        SET ausgewaehlt_menge = ?
                        WHERE id = ?
                    """, (neue_menge, geschenk_id))
                
                success = cursor.rowcount > 0
                conn.commit()
                conn.close()
                
                if success:
                    logger.info(f"✅ Geschenk '{name}' freigegeben (neue Menge: {neue_menge})")
                
                return success
                
        except Exception as e:
            logger.error(f"Fehler beim Freigeben des Geschenks: {e}")
            return False
    
    def get_geschenke_by_gast(self, gast_id):
        """
        Lädt alle von einem Gast ausgewählten Geschenke
        
        Args:
            gast_id: ID des Gastes
            
        Returns:
            List[Dict]: Liste der ausgewählten Geschenke
        """
        try:
            with self._lock:
                conn = self._get_connection()
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT * FROM geschenkliste 
                    WHERE ausgewaehlt_von_gast_id = ?
                    ORDER BY ausgewaehlt_am DESC
                """, (gast_id,))
                
                columns = [description[0] for description in cursor.description]
                geschenke = [dict(zip(columns, row)) for row in cursor.fetchall()]
                conn.close()
                
                return geschenke
                
        except Exception as e:
            logger.error(f"Fehler beim Laden der Geschenke für Gast {gast_id}: {e}")
            return []
    
    def get_geschenkliste_statistiken(self):
        """
        Lädt Statistiken zur Geschenkliste
        
        Returns:
            Dict: Statistiken (total, ausgewählt, verfügbar, geldgeschenke)
        """
        try:
            with self._lock:
                conn = self._get_connection()
                cursor = conn.cursor()
                
                # Gesamtstatistiken - verwende nur existierende Spalten
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total_geschenke,
                        COUNT(CASE WHEN ausgewaehlt_von_gast_id IS NOT NULL THEN 1 END) as ausgewaehlt_geschenke,
                        COUNT(CASE WHEN ausgewaehlt_von_gast_id IS NULL THEN 1 END) as verfuegbar_geschenke,
                        COUNT(CASE WHEN name LIKE '%Geld%' OR name LIKE '%Geldgeschenk%' OR beschreibung LIKE '%Geld%' THEN 1 END) as geldgeschenke,
                        SUM(CASE WHEN preis IS NOT NULL THEN preis ELSE 0 END) as gesamtwert
                    FROM geschenkliste
                """)
                
                stats = cursor.fetchone()
                conn.close()
                
                if stats:
                    return {
                        'total_geschenke': stats[0],
                        'ausgewaehlt_geschenke': stats[1] or 0,  # Anzahl ausgewählter Geschenke
                        'verfuegbar_geschenke': stats[2] or 0,   # Anzahl verfügbarer Geschenke
                        'geldgeschenke': stats[3] or 0,         # Geschenke mit "Geld" im Namen/Beschreibung
                        'gesamtwert': stats[4] or 0
                    }
                
                return {}
                
        except Exception as e:
            self.logger.error(f"Fehler beim Laden der Geschenkliste-Statistiken: {e}")
            return {}

    # =============================================================================
    # Playlist Management
    # =============================================================================
    
    def get_playlist_vorschlaege(self):
        """Alle Playlist-Vorschläge mit Voting-Informationen und Spotify-Daten abrufen"""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT 
                    p.*,
                    g.vorname || ' ' || COALESCE(g.nachname, '') as gast_name,
                    (SELECT COUNT(*) FROM playlist_votes WHERE vorschlag_id = p.id) as vote_count
                FROM playlist_vorschlaege p
                LEFT JOIN gaeste g ON p.gast_id = g.id
                ORDER BY vote_count DESC, p.created_at DESC
            """)
            
            vorschlaege = [dict(row) for row in cursor.fetchall()]
            conn.close()
            
            self.logger.info(f"✅ {len(vorschlaege)} Playlist-Vorschläge geladen")
            return vorschlaege
            
        except Exception as e:
            self.logger.error(f"Fehler beim Laden der Playlist-Vorschläge: {e}")
            return []

    def get_playlist_vorschlaege_for_guests(self):
        """Playlist-Vorschläge für Gäste - nur 'Vorgeschlagen', sortiert nach Votes"""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT 
                    p.*,
                    g.vorname || ' ' || COALESCE(g.nachname, '') as gast_name,
                    (SELECT COUNT(*) FROM playlist_votes WHERE vorschlag_id = p.id) as vote_count
                FROM playlist_vorschlaege p
                LEFT JOIN gaeste g ON p.gast_id = g.id
                WHERE p.status = 'Vorgeschlagen'
                ORDER BY vote_count DESC, p.created_at DESC
            """)
            
            vorschlaege = [dict(row) for row in cursor.fetchall()]
            conn.close()
            
            self.logger.info(f"✅ {len(vorschlaege)} Playlist-Vorschläge für Gäste geladen")
            return vorschlaege
            
        except Exception as e:
            self.logger.error(f"Fehler beim Laden der Playlist-Vorschläge für Gäste: {e}")
            return []
    
    def add_playlist_vorschlag(self, gast_id, kuenstler, titel, album=None, anlass='Allgemein', kommentar=None, spotify_data=None):
        """Neuen Playlist-Vorschlag hinzufügen mit optionalen Spotify-Daten"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Basis-Daten
            columns = ['gast_id', 'kuenstler', 'titel', 'album', 'anlass', 'kommentar']
            values = [gast_id, kuenstler, titel, album, anlass, kommentar]
            placeholders = ['?'] * 6
            
            # Spotify-Daten hinzufügen, falls vorhanden
            if spotify_data:
                spotify_fields = [
                    ('spotify_id', 'spotify_id'),
                    ('spotify_url', 'spotify_url'),
                    ('preview_url', 'preview_url'),
                    ('image_url', 'image_url'),
                    ('duration_ms', 'duration_ms'),
                    ('release_date', 'release_date'),
                    ('popularity', 'popularity')
                ]
                
                for field_name, data_key in spotify_fields:
                    if spotify_data.get(data_key):
                        columns.append(field_name)
                        values.append(spotify_data[data_key])
                        placeholders.append('?')
            
            query = f"""
                INSERT INTO playlist_vorschlaege ({', '.join(columns)})
                VALUES ({', '.join(placeholders)})
            """
            
            cursor.execute(query, values)
            conn.commit()
            vorschlag_id = cursor.lastrowid
            conn.close()
            
            self.logger.info(f"✅ Playlist-Vorschlag hinzugefügt: {kuenstler} - {titel}")
            return vorschlag_id
            
        except Exception as e:
            self.logger.error(f"Fehler beim Hinzufügen des Playlist-Vorschlags: {e}")
            return None
    
    def vote_playlist_vorschlag(self, gast_id, vorschlag_id):
        """Für einen Playlist-Vorschlag voten (einmalig pro Gast)"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Prüfen ob bereits gevotet
            cursor.execute("""
                SELECT id FROM playlist_votes 
                WHERE gast_id = ? AND vorschlag_id = ?
            """, (gast_id, vorschlag_id))
            
            if cursor.fetchone():
                conn.close()
                return False  # Bereits gevotet
            
            # Vote hinzufügen
            cursor.execute("""
                INSERT INTO playlist_votes (gast_id, vorschlag_id, vote_type)
                VALUES (?, ?, 'up')
            """, (gast_id, vorschlag_id))
            
            conn.commit()
            conn.close()
            
            self.logger.info(f"✅ Vote hinzugefügt: Gast {gast_id} für Vorschlag {vorschlag_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"Fehler beim Voten: {e}")
            return False
    
    def update_playlist_status(self, vorschlag_id, status):
        """Status eines Playlist-Vorschlags aktualisieren (DJ-Funktion)"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                UPDATE playlist_vorschlaege 
                SET status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (status, vorschlag_id))
            
            conn.commit()
            affected_rows = cursor.rowcount
            conn.close()
            
            if affected_rows > 0:
                self.logger.info(f"✅ Playlist-Status aktualisiert: {vorschlag_id} -> {status}")
                return True
            
            return False
            
        except Exception as e:
            self.logger.error(f"Fehler beim Status-Update: {e}")
            return False
    
    def delete_playlist_vorschlag(self, vorschlag_id, gast_id=None):
        """Playlist-Vorschlag löschen (nur eigene oder als Admin)"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Prüfe ob der Vorschlag existiert und berechtigt ist
            if gast_id:
                cursor.execute("""
                    SELECT id FROM playlist_vorschlaege 
                    WHERE id = ? AND gast_id = ?
                """, (vorschlag_id, gast_id))
            else:
                # Admin-Zugriff - kann alle löschen
                cursor.execute("""
                    SELECT id FROM playlist_vorschlaege 
                    WHERE id = ?
                """, (vorschlag_id,))
            
            if not cursor.fetchone():
                conn.close()
                return False
            
            # Lösche zuerst die Votes
            cursor.execute("DELETE FROM playlist_votes WHERE vorschlag_id = ?", (vorschlag_id,))
            
            # Lösche den Vorschlag
            cursor.execute("DELETE FROM playlist_vorschlaege WHERE id = ?", (vorschlag_id,))
            
            conn.commit()
            affected_rows = cursor.rowcount
            conn.close()
            
            if affected_rows > 0:
                self.logger.info(f"✅ Playlist-Vorschlag gelöscht: {vorschlag_id}")
                return True
            
            return False
            
        except Exception as e:
            self.logger.error(f"Fehler beim Löschen: {e}")
            return False

    def is_track_already_processed(self, kuenstler, titel):
        """Prüft ob ein Track bereits akzeptiert oder abgelehnt wurde"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT COUNT(*) FROM playlist_vorschlaege 
                WHERE LOWER(kuenstler) = LOWER(?) 
                AND LOWER(titel) = LOWER(?) 
                AND status IN ('Akzeptiert', 'Abgelehnt')
            """, (kuenstler, titel))
            
            count = cursor.fetchone()[0]
            conn.close()
            
            return count > 0
            
        except Exception as e:
            self.logger.error(f"Fehler beim Prüfen des Track-Status: {e}")
            return False
    
    def verify_dj_login(self, username, password):
        """DJ-Login verifizieren"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Erstelle Standard-DJ-Account falls nicht vorhanden
            cursor.execute("SELECT id FROM dj_users WHERE username = ?", (username,))
            if not cursor.fetchone() and username == 'dj' and password == 'dj2025':
                password_hash = hashlib.sha256(password.encode()).hexdigest()
                cursor.execute("""
                    INSERT INTO dj_users (username, password_hash, display_name)
                    VALUES (?, ?, ?)
                """, (username, password_hash, 'DJ'))
                conn.commit()
                self.logger.info("✅ Standard-DJ-Account erstellt")
            
            # Login verifizieren
            password_hash = hashlib.sha256(password.encode()).hexdigest()
            cursor.execute("""
                SELECT id FROM dj_users 
                WHERE username = ? AND password_hash = ?
            """, (username, password_hash))
            
            result = cursor.fetchone()
            
            if result:
                # Last login aktualisieren
                cursor.execute("""
                    UPDATE dj_users SET last_login = CURRENT_TIMESTAMP 
                    WHERE username = ?
                """, (username,))
                conn.commit()
                self.logger.info(f"✅ DJ-Login erfolgreich: {username}")
            
            conn.close()
            return bool(result)
            
        except Exception as e:
            self.logger.error(f"Fehler beim DJ-Login: {e}")
            return False

    # =============================================================================
    # Aufgaben-Erinnerungen
    # =============================================================================
    
    def check_and_create_task_reminders(self):
        """Prüft Aufgaben und erstellt Erinnerungen 3 Tage vor Deadline"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Aufgaben finden, die in 3 Tagen fällig sind und noch keine Erinnerung haben
            drei_tage_vorher = datetime.now() + timedelta(days=3)
            
            cursor.execute("""
                SELECT a.id, a.titel, a.deadline, a.zustaendig_email
                FROM aufgaben a
                LEFT JOIN aufgaben_erinnerungen r ON a.id = r.aufgabe_id
                WHERE a.deadline IS NOT NULL 
                AND DATE(a.deadline) = DATE(?)
                AND a.erledigt = 0
                AND r.id IS NULL
                AND a.zustaendig_email IS NOT NULL
            """, (drei_tage_vorher.strftime('%Y-%m-%d'),))
            
            aufgaben = cursor.fetchall()
            
            for aufgabe in aufgaben:
                # Erinnerung erstellen
                cursor.execute("""
                    INSERT INTO aufgaben_erinnerungen 
                    (aufgabe_id, erinnerungs_datum, email_gesendet)
                    VALUES (?, ?, 0)
                """, (aufgabe[0], drei_tage_vorher))
                
                self.logger.info(f"📋 Erinnerung erstellt für Aufgabe: {aufgabe[1]}")
            
            conn.commit()
            conn.close()
            
            return len(aufgaben)
            
        except Exception as e:
            self.logger.error(f"Fehler beim Erstellen der Aufgaben-Erinnerungen: {e}")
            return 0
    
    def get_pending_task_reminders(self):
        """Alle noch nicht gesendeten Erinnerungen abrufen"""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT 
                    r.id as reminder_id,
                    r.erinnerungs_datum,
                    a.id as aufgabe_id,
                    a.titel,
                    a.beschreibung,
                    a.deadline,
                    a.zustaendig_email,
                    a.zustaendig
                FROM aufgaben_erinnerungen r
                JOIN aufgaben a ON r.aufgabe_id = a.id
                WHERE r.email_gesendet = 0
                AND DATE(r.erinnerungs_datum) <= DATE('now')
                ORDER BY r.erinnerungs_datum
            """)
            
            reminders = [dict(row) for row in cursor.fetchall()]
            conn.close()
            
            return reminders
            
        except Exception as e:
            self.logger.error(f"Fehler beim Laden der Erinnerungen: {e}")
            return []
    
    def mark_reminder_sent(self, reminder_id):
        """Erinnerung als gesendet markieren"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                UPDATE aufgaben_erinnerungen 
                SET email_gesendet = 1, gesendet_am = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (reminder_id,))
            
            conn.commit()
            conn.close()
            
            self.logger.info(f"✅ Erinnerung {reminder_id} als gesendet markiert")
            return True
            
        except Exception as e:
            self.logger.error(f"Fehler beim Markieren der Erinnerung: {e}")
            return False

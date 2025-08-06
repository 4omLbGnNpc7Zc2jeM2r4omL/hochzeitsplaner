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
                
                # Schema laden und ausführen (aber nur wenn nötig)
                if os.path.exists(self.schema_path):
                    # Sichere Schema-Ausführung: Probiere es und handhabe Konflikte
                    try:
                        with open(self.schema_path, 'r', encoding='utf-8') as f:
                            schema_sql = f.read()
                        
                        # Falls tischplanung_config bereits existiert, führe nur den nicht-konfliktträchigen Teil aus
                        if table_exists and has_specific_columns:
                            # Führe Schema ohne tischplanung_config aus
                            schema_lines = schema_sql.split('\n')
                            safe_lines = []
                            skip_until_semicolon = False
                            
                            for line in schema_lines:
                                if 'tischplanung_config' in line:
                                    skip_until_semicolon = True
                                    continue
                                elif skip_until_semicolon:
                                    if ';' in line:
                                        skip_until_semicolon = False
                                    continue
                                else:
                                    safe_lines.append(line)
                            
                            schema_sql = '\n'.join(safe_lines)
                        
                        conn.executescript(schema_sql)
                        
                    except sqlite3.OperationalError as e:
                        if 'tischplanung_config' in str(e):
                            logger.warning(f"Schema-Konflikt ignoriert: {e}")
                        else:
                            raise
                else:
                    # Basis-Schema falls Datei nicht vorhanden
                    self._create_basic_schema(conn)
                
                conn.commit()
                conn.close()
                
                # Tischplanung-Tabellen initialisieren
                self._init_tischplanung_tables()
                
        except Exception as e:
            logger.error(f"Fehler bei Datenbankinitialisierung: {e}")
            raise
    
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
    
    def _get_connection(self, timeout: float = 30.0) -> sqlite3.Connection:
        """Erstellt eine sichere Datenbankverbindung mit optimierten Einstellungen"""
        conn = sqlite3.connect(self.db_path, timeout=timeout)
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA busy_timeout = 30000")
        conn.execute("PRAGMA journal_mode = WAL")
        return conn
    
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
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
                    SELECT * FROM gaeste ORDER BY id
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
        """Gibt alle Gäste zurück"""
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
            logger.error(f"Fehler beim Laden aller Gäste: {e}")
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
            
            seite = guest_data.get('seite', guest_data.get('Seite', 'Käthe'))
            if isinstance(seite, str):
                seite = seite.strip()
                if seite.lower() in ['käthe', 'kaethe']:
                    seite = 'Käthe'
                elif seite.lower() == 'pascal':
                    seite = 'Pascal'
                else:
                    seite = 'Beide'
            
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
                    seite,
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
    
    def update_guest(self, guest_id: int, guest_data: Dict[str, Any]) -> bool:
        """Aktualisiert einen vorhandenen Gast"""
        try:
            # Teilnahme-Logik anwenden
            guest_data = self._apply_participation_logic(guest_data)
            
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
                    guest_data.get('Seite', 'Käthe'),
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
        """Gibt alle Gäste zurück"""
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
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT id, vorname, nachname, guest_code, guest_password, email, status
                    FROM gaeste
                    ORDER BY vorname, nachname
                """)
                
                rows = cursor.fetchall()
                conn.close()
                
                credentials_list = []
                for row in rows:
                    credentials_list.append({
                        'index': row['id'],
                        'vorname': row['vorname'] or '',
                        'nachname': row['nachname'] or '',
                        'login_code': row['guest_code'] or '',
                        'password': row['guest_password'] or '',
                        'email': row['email'] or '',
                        'status': row['status'] or 'Offen'
                    })
                
                return credentials_list
                
        except Exception as e:
            logger.error(f"Fehler beim Abrufen der Credentials-Liste: {e}")
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
                        ausgegeben
                    FROM budget 
                    ORDER BY 
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
    
    def generate_all_guest_credentials(self) -> bool:
        """Generiert Credentials für alle Gäste die noch keine haben"""
        try:
            updated_count = 0
            guests = self.get_all_guests()
            
            for guest in guests:
                if not guest.get('guest_code') or not guest.get('guest_password'):
                    # Generiere neue Credentials
                    guest_code = self._generate_guest_code(guest.get('vorname', ''), guest.get('nachname', ''))
                    guest_password = self._generate_guest_password(guest.get('nachname', ''))
                    
                    # Update Gast
                    update_data = {
                        'guest_code': guest_code,
                        'guest_password': guest_password
                    }
                    
                    if self.update_guest(guest['id'], update_data):
                        updated_count += 1
            
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
                        SUM(gesamtpreis) as total_planned,
                        SUM(ausgegeben) as total_spent,
                        kategorie
                    FROM budget 
                    GROUP BY kategorie
                """)
                rows = cursor.fetchall()
                
                total_planned = 0
                total_spent = 0
                categories = {}
                
                for row in rows:
                    planned = row[0] or 0
                    spent = row[1] or 0
                    kategorie = row[2] or 'Sonstiges'
                    
                    total_planned += planned
                    total_spent += spent
                    categories[kategorie] = {
                        'planned': planned,
                        'spent': spent
                    }
                
                remaining = total_planned - total_spent
                
                return {
                    'planned': total_planned,
                    'spent': total_spent,
                    'remaining': remaining,
                    'categories': categories
                }
                
        except Exception as e:
            logger.error(f"Fehler beim Abrufen der Budget-Zusammenfassung: {e}")
            return {
                'planned': 0,
                'spent': 0,
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
            
            total = len(aufgaben)
            offen = len([a for a in aufgaben if a.get('status', '').lower() == 'offen'])
            in_progress = len([a for a in aufgaben if a.get('status', '').lower() == 'in bearbeitung'])
            erledigt = len([a for a in aufgaben if a.get('status', '').lower() == 'erledigt'])
            
            # Prioritäten-Statistiken
            hoch = len([a for a in aufgaben if a.get('prioritaet', '').lower() == 'hoch'])
            normal = len([a for a in aufgaben if a.get('prioritaet', '').lower() == 'normal'])
            niedrig = len([a for a in aufgaben if a.get('prioritaet', '').lower() == 'niedrig'])
            
            return {
                'total': total,
                'offen': offen,
                'in_progress': in_progress,
                'erledigt': erledigt,
                'prioritaet': {
                    'hoch': hoch,
                    'normal': normal,
                    'niedrig': niedrig
                },
                'completion_rate': round((erledigt / total * 100) if total > 0 else 0, 1)
            }
            
        except Exception as e:
            logger.error(f"Fehler bei Aufgaben-Statistiken: {e}")
            return {
                'total': 0, 'offen': 0, 'in_progress': 0, 'erledigt': 0,
                'prioritaet': {'hoch': 0, 'normal': 0, 'niedrig': 0},
                'completion_rate': 0
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
                        einzelpreis, gesamtpreis, ausgegeben
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    item.get('kategorie', ''),
                    item.get('beschreibung', ''),
                    item.get('details', ''),
                    float(item.get('menge', 0)),
                    float(item.get('einzelpreis', 0)),
                    float(item.get('gesamtpreis', 0)),
                    float(item.get('ausgegeben', 0))
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
                        einzelpreis=?, gesamtpreis=?, ausgegeben=?
                    WHERE id=?
                """, (
                    item.get('kategorie', ''),
                    item.get('beschreibung', ''),
                    item.get('details', ''),
                    float(item.get('menge', 0)),
                    float(item.get('einzelpreis', 0)),
                    float(item.get('gesamtpreis', 0)),
                    float(item.get('ausgegeben', 0)),
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
                    (gast_id, original_filename, filename, file_path, file_size, file_type, mime_type, beschreibung, upload_date)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """, (gast_id, original_filename, filename, file_path, file_size, file_type, mime_type, beschreibung))
                
                upload_id = cursor.lastrowid
                conn.commit()
                conn.close()
                
                logger.info(f"Upload hinzugefügt: ID {upload_id}, Datei {original_filename}, Pfad {file_path}")
                return upload_id
                
        except Exception as e:
            logger.error(f"Fehler beim Hinzufügen des Uploads: {e}")
            return None
    
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
            with self._lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT gu.id, gu.gast_id, gu.original_filename, gu.filename, gu.file_path,
                           gu.file_size, gu.file_type, gu.mime_type, gu.beschreibung, gu.upload_date,
                           g.vorname, g.nachname
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
                        'gast_nachname': row[11]
                    }
                
                return None
                
        except Exception as e:
            logger.error(f"Fehler beim Laden des Uploads: {e}")
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
                           g.vorname, g.nachname
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
                        'gast_vorname': row[10],
                        'gast_nachname': row[11]
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

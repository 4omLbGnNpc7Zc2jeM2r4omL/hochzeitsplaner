-- Hochzeitsplaner SQLite Schema
-- Erstellt: 2025-08-02
-- Version: 1.1

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Gaesteliste Tabelle
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
    first_login INTEGER DEFAULT 1, -- 1 = noch nicht eingeloggt, 0 = bereits eingeloggt
    first_login_at DATETIME, -- Zeitstempel des ersten Logins
    last_modified INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_status CHECK (status IN ('Offen', 'Zugesagt', 'Abgesagt', 'offen', 'zugesagt', 'abgesagt')),
    CONSTRAINT chk_seite CHECK (seite IN ('Käthe', 'Pascal', 'Beide')),
    CONSTRAINT chk_teilnahme CHECK (zum_weisser_saal IN ('Ja', 'Nein')),
    CONSTRAINT chk_essen CHECK (zum_essen IN ('Ja', 'Nein')),
    CONSTRAINT chk_party CHECK (zur_party IN ('Ja', 'Nein')),
    CONSTRAINT chk_standesamt CHECK (zum_standesamt IN ('Ja', 'Nein'))
);

-- Zeitplan Tabelle
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
    eventteile TEXT, -- JSON Array für Event-Teile
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Budget Kategorien
CREATE TABLE IF NOT EXISTS budget_kategorien (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    geplant REAL DEFAULT 0.0,
    ausgegeben REAL DEFAULT 0.0,
    farbe TEXT DEFAULT '#007bff',
    beschreibung TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Budget Posten
CREATE TABLE IF NOT EXISTS budget_posten (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kategorie_id INTEGER NOT NULL,
    titel TEXT NOT NULL,
    beschreibung TEXT,
    geplant REAL DEFAULT 0.0,
    ausgegeben REAL DEFAULT 0.0,
    datum DATE,
    anbieter TEXT,
    notizen TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kategorie_id) REFERENCES budget_kategorien(id) ON DELETE CASCADE
);

-- Aufgaben
CREATE TABLE IF NOT EXISTS aufgaben (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titel TEXT NOT NULL,
    beschreibung TEXT,
    kategorie TEXT DEFAULT 'Allgemein',
    status TEXT DEFAULT 'Offen',
    prioritaet TEXT DEFAULT 'Normal',
    faellig_am DATE,
    zugewiesen_an TEXT,
    erstellt_von TEXT,
    notizen TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_aufgaben_status CHECK (status IN ('Offen', 'In Bearbeitung', 'Erledigt', 'Verschoben')),
    CONSTRAINT chk_prioritaet CHECK (prioritaet IN ('Niedrig', 'Normal', 'Hoch', 'Kritisch'))
);

-- Kosten Tracking (erweiterte Budget-Verfolgung)
CREATE TABLE IF NOT EXISTS kosten (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titel TEXT NOT NULL,
    kategorie TEXT,
    betrag REAL NOT NULL,
    datum DATE NOT NULL,
    beschreibung TEXT,
    typ TEXT DEFAULT 'Ausgabe',
    zahlungsart TEXT DEFAULT 'Bar',
    beleg_pfad TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_typ CHECK (typ IN ('Ausgabe', 'Einnahme'))
);

-- Einstellungen
CREATE TABLE IF NOT EXISTS einstellungen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schluessel TEXT NOT NULL UNIQUE,
    wert TEXT,
    typ TEXT DEFAULT 'string',
    beschreibung TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indizes für Performance
CREATE INDEX IF NOT EXISTS idx_gaeste_seite ON gaeste(seite);
CREATE INDEX IF NOT EXISTS idx_gaeste_status ON gaeste(status);
CREATE INDEX IF NOT EXISTS idx_gaeste_guest_code ON gaeste(guest_code);
CREATE INDEX IF NOT EXISTS idx_zeitplan_start ON zeitplan(start_zeit);
CREATE INDEX IF NOT EXISTS idx_budget_kategorie ON budget_posten(kategorie_id);
CREATE INDEX IF NOT EXISTS idx_aufgaben_status ON aufgaben(status);
CREATE INDEX IF NOT EXISTS idx_aufgaben_faellig ON aufgaben(faellig_am);
CREATE INDEX IF NOT EXISTS idx_kosten_datum ON kosten(datum);
CREATE INDEX IF NOT EXISTS idx_kosten_kategorie ON kosten(kategorie);

-- Trigger für automatische updated_at Felder
CREATE TRIGGER IF NOT EXISTS update_gaeste_timestamp 
    AFTER UPDATE ON gaeste
    FOR EACH ROW
    BEGIN
        UPDATE gaeste SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_zeitplan_timestamp 
    AFTER UPDATE ON zeitplan
    FOR EACH ROW
    BEGIN
        UPDATE zeitplan SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_budget_kategorien_timestamp 
    AFTER UPDATE ON budget_kategorien
    FOR EACH ROW
    BEGIN
        UPDATE budget_kategorien SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_budget_posten_timestamp 
    AFTER UPDATE ON budget_posten
    FOR EACH ROW
    BEGIN
        UPDATE budget_posten SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_aufgaben_timestamp 
    AFTER UPDATE ON aufgaben
    FOR EACH ROW
    BEGIN
        UPDATE aufgaben SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_kosten_timestamp 
    AFTER UPDATE ON kosten
    FOR EACH ROW
    BEGIN
        UPDATE kosten SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_einstellungen_timestamp 
    AFTER UPDATE ON einstellungen
    FOR EACH ROW
    BEGIN
        UPDATE einstellungen SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Standard-Einstellungen
INSERT OR IGNORE INTO einstellungen (schluessel, wert, typ, beschreibung) VALUES
    ('hochzeitsdatum', '2026-07-25', 'date', 'Datum der Hochzeit'),
    ('hochzeitszeit', '11:30', 'time', 'Uhrzeit der Hochzeit'),
    ('braut_name', 'Käthe', 'string', 'Name der Braut'),
    ('braeutigam_name', 'Pascal', 'string', 'Name des Bräutigams'),
    ('hochzeitsort', '', 'string', 'Ort der Hochzeit'),
    ('budget_gesamt', '30000.0', 'float', 'Gesamtbudget'),
    ('email_enabled', 'false', 'boolean', 'E-Mail Benachrichtigungen aktiviert'),
    ('app_version', '2.0.0', 'string', 'Anwendungsversion'),
    ('last_backup', '', 'datetime', 'Letztes Backup'),
    ('guest_login_enabled', 'true', 'boolean', 'Gäste-Login aktiviert'),
    ('upload_path', '', 'string', 'Pfad für Gäste-Uploads'),
    ('upload_max_size_mb', '50', 'integer', 'Maximale Upload-Größe in MB'),
    ('upload_allowed_extensions', 'jpg,jpeg,png,gif,mp4,mov,avi', 'string', 'Erlaubte Dateierweiterungen');

-- Standard Budget-Kategorien
INSERT OR IGNORE INTO budget_kategorien (name, geplant, farbe, beschreibung) VALUES
    ('Location', 3000.0, '#e74c3c', 'Hochzeitslocation und Saal'),
    ('Catering', 2500.0, '#f39c12', 'Essen und Getränke'),
    ('Kleidung', 1500.0, '#9b59b6', 'Brautkleid, Anzug, Accessoires'),
    ('Dekoration', 800.0, '#1abc9c', 'Blumen, Tischdeko, Kerzen'),
    ('Fotografie', 1200.0, '#3498db', 'Fotograf und Videoaufnahmen'),
    ('Musik', 600.0, '#e67e22', 'DJ, Band, Technik'),
    ('Transport', 400.0, '#34495e', 'Hochzeitsauto, Transport'),
    ('Sonstiges', 500.0, '#95a5a6', 'Weitere Ausgaben');

-- Gäste-Uploads Tabelle
CREATE TABLE IF NOT EXISTS gaeste_uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gast_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_type TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    beschreibung TEXT,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_visible INTEGER DEFAULT 1,
    admin_approved INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (gast_id) REFERENCES gaeste (id) ON DELETE CASCADE
);

-- Tischplanung Tabellen
CREATE TABLE IF NOT EXISTS tische (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    max_personen INTEGER DEFAULT 8,
    x_position INTEGER DEFAULT 100,
    y_position INTEGER DEFAULT 100,
    farbe TEXT DEFAULT '#007bff',
    form TEXT DEFAULT 'round',
    notizen TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Gast-Beziehungen für Tischplanung
CREATE TABLE IF NOT EXISTS gast_beziehungen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gast_id_1 INTEGER NOT NULL,
    gast_id_2 INTEGER NOT NULL,
    beziehungstyp TEXT NOT NULL,
    staerke INTEGER DEFAULT 0, -- -3 bis +3 (negativ = sollen getrennt werden, positiv = sollen zusammen)
    notizen TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (gast_id_1) REFERENCES gaeste (id) ON DELETE CASCADE,
    FOREIGN KEY (gast_id_2) REFERENCES gaeste (id) ON DELETE CASCADE,
    UNIQUE(gast_id_1, gast_id_2)
);

-- Tisch-Zuordnungen
CREATE TABLE IF NOT EXISTS tisch_zuordnungen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gast_id INTEGER NOT NULL,
    tisch_id INTEGER NOT NULL,
    position INTEGER, -- Position am Tisch (1-12)
    zugeordnet_von TEXT,
    zugeordnet_am DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (gast_id) REFERENCES gaeste (id) ON DELETE CASCADE,
    FOREIGN KEY (tisch_id) REFERENCES tische (id) ON DELETE CASCADE,
    UNIQUE(gast_id) -- Ein Gast kann nur einem Tisch zugeordnet werden
);

-- Tischplanung-Konfiguration
CREATE TABLE IF NOT EXISTS tischplanung_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    beschreibung TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Standard Tischplanung-Konfiguration
INSERT OR IGNORE INTO tischplanung_config (key, value, beschreibung) VALUES
    ('standard_tisch_groesse', '8', 'Standard-Anzahl Personen pro Tisch'),
    ('min_tisch_groesse', '4', 'Minimale Anzahl Personen pro Tisch'),
    ('max_tisch_groesse', '12', 'Maximale Anzahl Personen pro Tisch'),
    ('auto_assign_enabled', 'true', 'Automatische Zuweisung aktiviert');

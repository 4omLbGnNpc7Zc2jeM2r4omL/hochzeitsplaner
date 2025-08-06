-- Tischplanung Schema für Hochzeitsplaner
-- Erstellt: 2025-08-04
-- Für runde Tische mit Beziehungen zwischen Gästen

-- Tische Tabelle
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
);

-- Beziehungen zwischen Gästen
CREATE TABLE IF NOT EXISTS gast_beziehungen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gast_id_1 INTEGER NOT NULL,
    gast_id_2 INTEGER NOT NULL,
    beziehungstyp TEXT NOT NULL DEFAULT 'neutral',
    staerke INTEGER DEFAULT 0, -- -3 (sehr negativ) bis +3 (sehr positiv)
    notizen TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (gast_id_1) REFERENCES gaeste (id) ON DELETE CASCADE,
    FOREIGN KEY (gast_id_2) REFERENCES gaeste (id) ON DELETE CASCADE,
    CONSTRAINT chk_beziehungstyp CHECK (beziehungstyp IN (
        'familie', 'freunde', 'beste_freunde', 'kollegen', 'bekannte', 
        'partner', 'ex_partner', 'ehemalige_kollegen', 'studienfreunde',
        'nachbarn', 'verwandte', 'neutral', 'konflikt', 'spinnen_sich_nicht',
        'geschaeftlich', 'sportverein', 'hobby'
    )),
    CONSTRAINT chk_staerke CHECK (staerke BETWEEN -3 AND 3),
    CONSTRAINT unique_beziehung UNIQUE (gast_id_1, gast_id_2),
    CONSTRAINT no_self_relation CHECK (gast_id_1 != gast_id_2)
);

-- Tischzuordnungen
CREATE TABLE IF NOT EXISTS tisch_zuordnungen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tisch_id INTEGER NOT NULL,
    gast_id INTEGER NOT NULL,
    position INTEGER, -- Position am runden Tisch (1-max_personen)
    zugeordnet_von TEXT,
    zugeordnet_am DATETIME DEFAULT CURRENT_TIMESTAMP,
    notizen TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tisch_id) REFERENCES tische (id) ON DELETE CASCADE,
    FOREIGN KEY (gast_id) REFERENCES gaeste (id) ON DELETE CASCADE,
    CONSTRAINT unique_gast_tisch UNIQUE (gast_id),
    CONSTRAINT unique_tisch_position UNIQUE (tisch_id, position)
);

-- Tischplanung Konfiguration
CREATE TABLE IF NOT EXISTS tischplanung_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    standard_tisch_groesse INTEGER DEFAULT 8,
    automatische_zuordnung BOOLEAN DEFAULT 0,
    berücksichtige_alter BOOLEAN DEFAULT 1,
    berücksichtige_seite BOOLEAN DEFAULT 1,
    berücksichtige_kategorie BOOLEAN DEFAULT 1,
    min_beziehung_staerke INTEGER DEFAULT 0,
    layout_breite REAL DEFAULT 800.0,
    layout_hoehe REAL DEFAULT 600.0,
    tisch_durchmesser REAL DEFAULT 120.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indizes für Performance
CREATE INDEX IF NOT EXISTS idx_beziehungen_gast1 ON gast_beziehungen(gast_id_1);
CREATE INDEX IF NOT EXISTS idx_beziehungen_gast2 ON gast_beziehungen(gast_id_2);
CREATE INDEX IF NOT EXISTS idx_beziehungen_typ ON gast_beziehungen(beziehungstyp);
CREATE INDEX IF NOT EXISTS idx_zuordnungen_tisch ON tisch_zuordnungen(tisch_id);
CREATE INDEX IF NOT EXISTS idx_zuordnungen_gast ON tisch_zuordnungen(gast_id);
CREATE INDEX IF NOT EXISTS idx_tische_aktiv ON tische(aktiv);

-- Trigger für automatische updated_at Felder
CREATE TRIGGER IF NOT EXISTS update_tische_timestamp 
    AFTER UPDATE ON tische
    FOR EACH ROW
    BEGIN
        UPDATE tische SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_beziehungen_timestamp 
    AFTER UPDATE ON gast_beziehungen
    FOR EACH ROW
    BEGIN
        UPDATE gast_beziehungen SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_zuordnungen_timestamp 
    AFTER UPDATE ON tisch_zuordnungen
    FOR EACH ROW
    BEGIN
        UPDATE tisch_zuordnungen SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_config_timestamp 
    AFTER UPDATE ON tischplanung_config
    FOR EACH ROW
    BEGIN
        UPDATE tischplanung_config SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Standard-Konfiguration einfügen
INSERT OR IGNORE INTO tischplanung_config (id, standard_tisch_groesse) VALUES (1, 8);

-- Beispiel-Tische (können gelöscht/angepasst werden)
INSERT OR IGNORE INTO tische (name, beschreibung, max_personen, x_position, y_position) VALUES
    ('Tisch 1', 'Brautpaar-Tisch', 8, 400, 100),
    ('Tisch 2', 'Familie Braut', 8, 200, 250),
    ('Tisch 3', 'Familie Bräutigam', 8, 600, 250),
    ('Tisch 4', 'Freunde', 8, 100, 400),
    ('Tisch 5', 'Kollegen', 8, 500, 400),
    ('Tisch 6', 'Weitere Gäste', 8, 300, 500);

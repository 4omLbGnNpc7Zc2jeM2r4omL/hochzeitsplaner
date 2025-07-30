#!/usr/bin/env python3
"""
Migration Script für Zeitplan-Datenmodell
Fügt "public" Feld zu bestehenden Zeitplan-Einträgen hinzu
"""

import json
import os
from datetime import datetime

def migrate_zeitplan():
    """Migriert Zeitplan-Daten um public-Feld"""
    zeitplan_file = "data/zeitplan.json"
    
    if not os.path.exists(zeitplan_file):
        print("Keine Zeitplan-Datei gefunden - Migration übersprungen")
        return
    
    try:
        # Backup erstellen
        backup_file = f"data/zeitplan_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(zeitplan_file, 'r', encoding='utf-8') as f:
            backup_data = f.read()
        
        with open(backup_file, 'w', encoding='utf-8') as f:
            f.write(backup_data)
        
        print(f"Backup erstellt: {backup_file}")
        
        # Zeitplan laden
        with open(zeitplan_file, 'r', encoding='utf-8') as f:
            zeitplan = json.load(f)
        
        # Migration durchführen
        migrated = False
        for entry in zeitplan:
            if 'public' not in entry:
                # Standard: Trauung, Empfang etc. sind öffentlich, Getting Ready private
                public_keywords = ['trauung', 'empfang', 'essen', 'feier', 'party', 'tanz']
                private_keywords = ['getting ready', 'vorbereitung', 'abholen', 'aufbau']
                
                programmpunkt_lower = entry.get('Programmpunkt', '').lower()
                
                if any(keyword in programmpunkt_lower for keyword in public_keywords):
                    entry['public'] = True
                elif any(keyword in programmpunkt_lower for keyword in private_keywords):
                    entry['public'] = False
                else:
                    # Default: öffentlich
                    entry['public'] = True
                
                migrated = True
        
        if migrated:
            # Migrierte Daten speichern
            with open(zeitplan_file, 'w', encoding='utf-8') as f:
                json.dump(zeitplan, f, indent=2, ensure_ascii=False)
            
            print(f"Migration abgeschlossen: {len(zeitplan)} Einträge aktualisiert")
        else:
            print("Keine Migration erforderlich - alle Einträge haben bereits 'public'-Feld")
            
    except Exception as e:
        print(f"Fehler bei Migration: {e}")

if __name__ == "__main__":
    migrate_zeitplan()

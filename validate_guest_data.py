#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Validiert und korrigiert Gästelisten-Daten auf Inkonsistenzen
"""

import json
import pandas as pd

def validate_and_fix_guest_data(gaesteliste_path='data/gaesteliste.json'):
    """
    Validiert und korrigiert die Gästeliste auf Inkonsistenzen
    
    Prüft ob Anzahl_Personen konsistent mit den Event-Teilnahmen ist.
    """
    
    # Lade Gästeliste
    with open(gaesteliste_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    corrections = []
    
    for i, guest in enumerate(data):
        name = f"{guest.get('Vorname', '')} {guest.get('Nachname', '')}".strip()
        current_anzahl = guest.get('Anzahl_Personen', 1)
        
        # Ermittle maximale Event-Teilnahme
        event_teilnahmen = [
            guest.get('Weisser_Saal', 0),
            guest.get('Anzahl_Essen', 0),
            guest.get('Anzahl_Party', 0)
        ]
        
        # Konvertiere zu numerischen Werten
        event_teilnahmen_num = []
        for teilnahme in event_teilnahmen:
            try:
                if teilnahme == '' or teilnahme is None:
                    event_teilnahmen_num.append(0)
                else:
                    event_teilnahmen_num.append(float(teilnahme))
            except (ValueError, TypeError):
                event_teilnahmen_num.append(0)
        
        max_event_teilnahme = max(event_teilnahmen_num) if event_teilnahmen_num else 1
        
        # Prüfe auf Inkonsistenz
        if current_anzahl != max_event_teilnahme and max_event_teilnahme > 0:
            corrections.append({
                'name': name,
                'index': i,
                'old_anzahl': current_anzahl,
                'new_anzahl': int(max_event_teilnahme),
                'weisser_saal': guest.get('Weisser_Saal'),
                'anzahl_essen': guest.get('Anzahl_Essen'),
                'anzahl_party': guest.get('Anzahl_Party')
            })
            
            # Korrigiere die Anzahl_Personen
            guest['Anzahl_Personen'] = int(max_event_teilnahme)
    
    # Speichere korrigierte Daten
    if corrections:
        with open(gaesteliste_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"✅ {len(corrections)} Gäste korrigiert:")
        for correction in corrections:
            print(f"  - {correction['name']}: {correction['old_anzahl']} → {correction['new_anzahl']} Personen")
            print(f"    Events: Weißer Saal={correction['weisser_saal']}, Essen={correction['anzahl_essen']}, Party={correction['anzahl_party']}")
    else:
        print("✅ Alle Gästelisten-Daten sind konsistent.")
    
    return len(corrections)

if __name__ == "__main__":
    corrections_count = validate_and_fix_guest_data()
    print(f"\nValidierung abgeschlossen. {corrections_count} Korrekturen vorgenommen.")

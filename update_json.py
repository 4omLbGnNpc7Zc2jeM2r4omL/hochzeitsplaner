#!/usr/bin/env python3
import json

# Lade die Gästeliste
with open('data/gaesteliste.json', 'r', encoding='utf-8') as f:
    gaeste = json.load(f)

# Aktualisiere alle Gäste-Einträge
for gast in gaeste:
    # Ersetze Zum_Standesamt durch Zum_Weisser_Saal
    if 'Zum_Standesamt' in gast:
        gast['Zum_Weisser_Saal'] = gast['Zum_Standesamt']
        del gast['Zum_Standesamt']
    
    # Ersetze Anzahl_Standesamt durch Weisser_Saal (falls noch nicht vorhanden)
    if 'Anzahl_Standesamt' in gast and 'Weisser_Saal' not in gast:
        gast['Weisser_Saal'] = gast['Anzahl_Standesamt']
    
    # Entferne Anzahl_Standesamt
    if 'Anzahl_Standesamt' in gast:
        del gast['Anzahl_Standesamt']

# Speichere die aktualisierte Gästeliste
with open('data/gaesteliste.json', 'w', encoding='utf-8') as f:
    json.dump(gaeste, f, ensure_ascii=False, indent=2)

print("Gästeliste erfolgreich aktualisiert!")

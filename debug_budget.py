#!/usr/bin/env python3
# Debug-Script für Budget-Generation

from datenmanager import HochzeitsDatenManager
import os

# DataManager initialisieren
data_dir = os.path.join(os.path.dirname(__file__), "data")
dm = HochzeitsDatenManager(data_dir)

print("=== Debug Budget Generation ===")

# 1. Kostenkonfiguration laden
try:
    kosten_config = dm.load_kosten_config()
    print(f"✅ Kostenkonfiguration geladen: {type(kosten_config)}")
    print(f"   Inhalt: {kosten_config}")
except Exception as e:
    print(f"❌ Fehler beim Laden der Kostenkonfiguration: {e}")
    kosten_config = []

# 2. Gästedaten laden
try:
    dm.load_gaesteliste()
    gaeste_data = dm.gaesteliste_df.to_dict('records') if not dm.gaesteliste_df.empty else []
    print(f"✅ Gästedaten geladen: {len(gaeste_data)} Gäste")
    if len(gaeste_data) > 0:
        print(f"   Beispielgast: {gaeste_data[0]}")
except Exception as e:
    print(f"❌ Fehler beim Laden der Gästedaten: {e}")
    gaeste_data = []

# 3. Statistiken berechnen
try:
    total_standesamt = sum(int(guest.get('Anzahl_Standesamt', 0) or 0) for guest in gaeste_data)
    total_essen = sum(int(guest.get('Anzahl_Essen', 0) or 0) for guest in gaeste_data)
    total_party = sum(int(guest.get('Anzahl_Party', 0) or 0) for guest in gaeste_data)
    total_weisser_saal = sum(int(guest.get('Weisser_Saal', 0) or 0) for guest in gaeste_data)
    total_kinder = sum(int(guest.get('Kind', 0) or 0) for guest in gaeste_data)
    
    print(f"✅ Gästestatistiken berechnet:")
    print(f"   Standesamt: {total_standesamt}")
    print(f"   Essen: {total_essen}")
    print(f"   Party: {total_party}")
    print(f"   Weisser Saal: {total_weisser_saal}")
    print(f"   Kinder: {total_kinder}")
except Exception as e:
    print(f"❌ Fehler bei der Statistik-Berechnung: {e}")

# 4. Budget-Items generieren
try:
    budget_items = []
    
    if isinstance(kosten_config, list):
        for i, item in enumerate(kosten_config):
            print(f"\n--- Verarbeite Item {i+1}: {item} ---")
            
            if not item.get('aktiv', True):
                print("   Übersprungen (inaktiv)")
                continue
                
            kategorie = item.get('kategorie', 'Sonstiges')
            beschreibung = item.get('beschreibung', 'Unbenannt')
            
            print(f"   Kategorie: {kategorie}")
            print(f"   Beschreibung: {beschreibung}")
            print(f"   Typ: {item.get('typ')}")
            print(f"   Preis pro Einheit: {item.get('preis_pro_einheit')} (Type: {type(item.get('preis_pro_einheit'))})")
            
            # Test der Preisberechnung
            try:
                einzelpreis = float(item.get('preis_pro_einheit', 0) or 0)
                print(f"   Einzelpreis als float: {einzelpreis}")
                
                if item.get('typ') == 'pro_person_standesamt':
                    menge = total_standesamt
                    gesamtpreis = menge * einzelpreis
                    details = f"{menge} Personen × {einzelpreis}€"
                elif item.get('typ') == 'pauschal':
                    menge = 1
                    gesamtpreis = einzelpreis
                    details = "Pauschalpreis"
                else:
                    menge = 1
                    gesamtpreis = einzelpreis
                    details = "Einzelpreis"
                
                print(f"   Menge: {menge}")
                print(f"   Gesamtpreis: {gesamtpreis}")
                print(f"   Details: {details}")
                
                budget_items.append({
                    'kategorie': kategorie,
                    'beschreibung': beschreibung,
                    'details': details,
                    'menge': menge,
                    'einzelpreis': einzelpreis,
                    'gesamtpreis': gesamtpreis
                })
                
            except Exception as e:
                print(f"   ❌ Fehler bei der Berechnung: {e}")
                
    print(f"\n✅ Budget-Items generiert: {len(budget_items)}")
    for item in budget_items:
        print(f"   - {item}")
    
    # Gesamtsumme berechnen
    gesamtsumme = sum(float(item.get('gesamtpreis', 0) or 0) for item in budget_items)
    print(f"\n✅ Gesamtsumme: {gesamtsumme}€")
    
except Exception as e:
    print(f"❌ Fehler bei der Budget-Generierung: {e}")

print("\n=== Debug Ende ===")

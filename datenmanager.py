#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Datenmanager für den Hochzeitsplaner
Verwaltet Import, Export und Manipulation der Hochzeitsdaten
"""

import pandas as pd
import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Tuple

class HochzeitsDatenManager:
    """Verwaltet alle Daten für die Hochzeitsplanung"""
    
    # Kostenkonstanten für automatische Berechnung
    KOSTEN_STANDESAMT_GETRAENKE = 35.0  # € pro Gast
    KOSTEN_ESSEN = 55.0                  # € pro Gast  
    KOSTEN_PARTY_GETRAENKE = 25.0        # € pro Gast
    
    def __init__(self, data_dir: str = "data"):
        """
        Initialisiert den Datenmanager
        
        Args:
            data_dir: Verzeichnis für Datenspeicherung
        """
        self.data_dir = data_dir
        self.gaesteliste_file = os.path.join(data_dir, "gaesteliste.json")
        self.budget_file = os.path.join(data_dir, "budget.json")
        self.zeitplan_file = os.path.join(data_dir, "zeitplan.json")
        self.settings_file = os.path.join(data_dir, "settings.json")
        
        # GUI Update Callback für automatische Dashboard-Aktualisierung
        self.gui_update_callback = None
        
        # Verzeichnis erstellen falls nicht vorhanden
        os.makedirs(data_dir, exist_ok=True)
        
        # Datenstrukturen initialisieren
        self.gaesteliste_df = pd.DataFrame()
        self.budget_df = pd.DataFrame()
        self.zeitplan_df = pd.DataFrame()
        self.settings = {}
        
        # Daten laden
        self.load_all_data()
        
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
            # Spezialbehandlung für die Käthe & Pascal Excel-Datei
            if 'Hochzeit.xlsx' in file_path:
                df = self._import_kaethe_pascal_excel(file_path)
            else:
                # Standard Excel-Import
                df = pd.read_excel(file_path, sheet_name=sheet_name)
            
            # Spalten standardisieren
            df = self._standardize_guest_columns(df)
            
            # Validierung
            if self._validate_guest_data(df):
                self.gaesteliste_df = df
                self.save_gaesteliste()
                
                # Automatische Budget-Aktualisierung falls aktiviert
                self._auto_update_guest_budget()
                
                # GUI-Update triggern
                self._trigger_gui_update()
                
                return True
            else:
                print("Validierung der Gästeliste fehlgeschlagen")
                return False
                
        except Exception as e:
            print(f"Fehler beim Excel-Import: {e}")
            return False
    
    def _import_kaethe_pascal_excel(self, file_path: str) -> pd.DataFrame:
        """
        Spezial-Import für die Käthe & Pascal Hochzeits-Excel-Datei
        
        Args:
            file_path: Pfad zur Hochzeit.xlsx Datei
            
        Returns:
            DataFrame mit kombinierter Gästeliste
        """
        # Beide Arbeitsblätter importieren
        gesamt_df = self._import_gesamt_sheet(file_path)
        kaethe_df, pascal_df = self._import_einzelaufstellung_sheet(file_path)
        
        # Entscheiden welche Daten zu verwenden - Einzelaufstellung bevorzugen für bessere Trennung
        if not kaethe_df.empty or not pascal_df.empty:
            print("Verwende Einzelaufstellung-Arbeitsblatt (Käthe + Pascal getrennt)")
            # Käthe und Pascal Listen kombinieren
            combined_df = pd.concat([kaethe_df, pascal_df], ignore_index=True)
            return combined_df
        elif not gesamt_df.empty:
            print("Verwende Gesamt-Arbeitsblatt als Fallback")
            return gesamt_df
        else:
            raise ValueError("Keine gültigen Gästelisten gefunden")
    
    def _import_gesamt_sheet(self, file_path: str) -> pd.DataFrame:
        """Importiert das Gesamt-Arbeitsblatt"""
        try:
            # Gesamt-Arbeitsblatt roh einlesen
            df_raw = pd.read_excel(file_path, sheet_name='Gesamt', header=None)
            
            # Nach der Header-Zeile suchen (enthält "Vorname", "Nachname", etc.)
            header_row = None
            for idx, row in df_raw.iterrows():
                if any('Vorname' in str(cell) for cell in row):
                    header_row = idx
                    break
            
            if header_row is None:
                return pd.DataFrame()
            
            # Header extrahieren
            headers = df_raw.iloc[header_row].tolist()
            
            # Daten ab der nächsten Zeile einlesen
            data_start = header_row + 1
            df_data = df_raw.iloc[data_start:].copy()
            df_data.columns = headers
            
            # Leere Zeilen entfernen
            df_data = df_data.dropna(how='all')
            
            # Relevante Spalten extrahieren
            guest_columns = self._extract_guest_columns(df_data.columns)
            
            if not guest_columns:
                return pd.DataFrame()
            
            # Gästeliste extrahieren
            guest_df = df_data[list(guest_columns.values())].copy()
            guest_df.columns = list(guest_columns.keys())
            
            # Leere Einträge entfernen
            guest_df = guest_df.dropna(subset=['Vorname'])
            guest_df = guest_df[guest_df['Vorname'].astype(str).str.strip() != '']
            
            # Seite-Information hinzufügen
            guest_df['Seite'] = 'Gesamt'
            
            print(f"Gesamt-Arbeitsblatt: {len(guest_df)} Gäste importiert")
            return guest_df
            
        except Exception as e:
            print(f"Fehler beim Import Gesamt-Arbeitsblatt: {e}")
            return pd.DataFrame()
    
    def _import_einzelaufstellung_sheet(self, file_path: str) -> tuple[pd.DataFrame, pd.DataFrame]:
        """Importiert das Einzelaufstellung-Arbeitsblatt (Käthe & Pascal getrennt)"""
        try:
            # Einzelaufstellung-Arbeitsblatt roh einlesen
            df_raw = pd.read_excel(file_path, sheet_name='Einzelaufstellung', header=None)
            
            # Header-Zeile finden
            header_row = None
            for idx, row in df_raw.iterrows():
                if any('Vorname' in str(cell) for cell in row):
                    header_row = idx
                    break
            
            if header_row is None:
                return pd.DataFrame(), pd.DataFrame()
            
            # Käthe-Daten extrahieren (Spalten 1-11)
            kaethe_df = self._extract_guest_list_from_columns(
                df_raw, header_row, start_col=1, end_col=12, name="Käthe"
            )
            
            # Pascal-Daten extrahieren (Spalten 17-27)
            pascal_df = self._extract_guest_list_from_columns(
                df_raw, header_row, start_col=17, end_col=28, name="Pascal"
            )
            
            print(f"Einzelaufstellung: Käthe {len(kaethe_df)} Gäste, Pascal {len(pascal_df)} Gäste")
            return kaethe_df, pascal_df
            
        except Exception as e:
            print(f"Fehler beim Import Einzelaufstellung: {e}")
            return pd.DataFrame(), pd.DataFrame()
    
    def _extract_guest_list_from_columns(self, df_raw: pd.DataFrame, header_row: int, 
                                       start_col: int, end_col: int, name: str) -> pd.DataFrame:
        """Extrahiert Gästeliste aus bestimmten Spalten"""
        try:
            # Header aus den spezifizierten Spalten extrahieren
            headers = df_raw.iloc[header_row, start_col:end_col].tolist()
            
            # Daten extrahieren
            data_start = header_row + 1
            guest_data = df_raw.iloc[data_start:, start_col:end_col].copy()
            guest_data.columns = headers
            
            # Leere Zeilen entfernen
            guest_data = guest_data.dropna(how='all')
            
            # Relevante Spalten identifizieren
            guest_columns = self._extract_guest_columns(guest_data.columns)
            
            if not guest_columns:
                return pd.DataFrame()
            
            # Gästeliste zusammenstellen
            guest_df = guest_data[list(guest_columns.values())].copy()
            guest_df.columns = list(guest_columns.keys())
            
            # Leere Vorname-Einträge entfernen
            guest_df = guest_df.dropna(subset=['Vorname'])
            guest_df = guest_df[guest_df['Vorname'].astype(str).str.strip() != '']
            
            # Seite-Information hinzufügen
            guest_df['Seite'] = name
            
            return guest_df
            
        except Exception as e:
            print(f"Fehler beim Extrahieren {name}-Liste: {e}")
            return pd.DataFrame()
    
    def _extract_guest_columns(self, columns) -> dict:
        """Identifiziert relevante Gäste-Spalten"""
        guest_columns = {}
        
        for col in columns:
            col_str = str(col).strip()
            if col_str == 'Vorname':
                guest_columns['Vorname'] = col
            elif col_str == 'Nachname':
                guest_columns['Nachname'] = col
            elif col_str == 'Begleitung':
                guest_columns['Begleitung'] = col
            elif col_str == 'Kind':
                guest_columns['Kind'] = col
            elif col_str == 'Familie':
                guest_columns['Familie'] = col
            elif col_str == 'Anzahl':
                guest_columns['Anzahl'] = col
            elif col_str == 'Zusage?':
                guest_columns['Zusage'] = col
            elif col_str == 'Optional':
                guest_columns['Optional'] = col
            elif col_str == 'Weißer Saal':
                guest_columns['Weisser_Saal'] = col
            elif col_str == 'Zum Essen':
                guest_columns['Zum_Essen'] = col
            elif col_str == 'STD?':
                guest_columns['STD'] = col
        
        return guest_columns
            
    def _standardize_guest_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Standardisiert Spaltennamen der Gästeliste"""
        # Mapping für verschiedene mögliche Spaltennamen
        column_mapping = {
            'vorname': 'Vorname',
            'name': 'Vorname', 
            'nachname': 'Nachname',
            'familienname': 'Nachname',
            'status': 'Status',
            'zusage': 'Status',
            'zusage?': 'Status',
            'anzahl': 'Anzahl_Personen',
            'anzahl personen': 'Anzahl_Personen',
            'personen': 'Anzahl_Personen',
            'kategorie': 'Kategorie',
            'gruppe': 'Kategorie',
            'familie': 'Kategorie',  # Familie-Spalte als Kategorie verwenden
            'kontakt': 'Kontakt',
            'telefon': 'Kontakt',
            'email': 'Email',
            'adresse': 'Adresse',
            'bemerkung': 'Bemerkungen',
            'begleitung': 'Begleitung',
            'kind': 'Kind',
            'optional': 'Optional',
            'weisser_saal': 'Weisser_Saal',
            'zum_essen': 'Zum_Essen',
            'zur_party': 'Zur_Party',
            'zum_standesamt': 'Zum_Standesamt',
            'standesamt': 'Zum_Standesamt',
            'essen': 'Zum_Essen',
            'party': 'Zur_Party',
            'std': 'STD',
            'seite': 'Seite'
        }
        
        # Spaltennamen normalisieren (kleinbuchstaben, keine Leerzeichen)
        original_columns = df.columns.tolist()
        df.columns = df.columns.str.lower().str.strip().str.replace(' ', '_')
        
        # Spalten umbenennen
        df = df.rename(columns=column_mapping)
        
        # Neue Event-Kategorien hinzufügen falls nicht vorhanden
        event_categories = ['Zum_Standesamt', 'Zum_Essen', 'Zur_Party']
        for event_cat in event_categories:
            if event_cat not in df.columns:
                df[event_cat] = 'Nein'  # Standard: nicht dabei
        
        # Standardspalten sicherstellen
        required_columns = ['Vorname', 'Nachname', 'Status', 'Anzahl_Personen', 'Kategorie']
        for col in required_columns:
            if col not in df.columns:
                if col == 'Status':
                    # Status aus Zusage-Spalte ableiten falls vorhanden
                    if 'Zusage' in df.columns:
                        df['Status'] = df['Zusage'].apply(self._convert_zusage_to_status)
                    else:
                        df['Status'] = 'Offen'
                elif col == 'Anzahl_Personen':
                    # Anzahl aus verschiedenen Quellen ableiten
                    if 'Anzahl' in df.columns:
                        df['Anzahl_Personen'] = df['Anzahl']
                    else:
                        df['Anzahl_Personen'] = 1
                elif col == 'Kategorie':
                    # Kategorie aus verschiedenen Quellen ableiten
                    kategorie_found = False
                    
                    # 1. Prüfe direkte Kategorie-Spalte
                    if 'Kategorie' in df.columns:
                        df['Kategorie'] = df['Kategorie'].fillna('Freunde')
                        kategorie_found = True
                    
                    # 2. Prüfe Familie-Spalte
                    elif 'Familie' in df.columns:
                        def map_familie_to_kategorie(x):
                            x_str = str(x).strip().upper()
                            if x_str == 'X' or x_str == '1':
                                return 'Familie'
                            elif x_str in ['F', 'FREUNDE', 'FRIEND']:
                                return 'Freunde'
                            elif x_str in ['K', 'KOLLEGEN', 'ARBEIT', 'WORK']:
                                return 'Kollegen'
                            elif x_str in ['V', 'VERWANDTE', 'VERWANDTSCHAFT']:
                                return 'Verwandte'
                            else:
                                return 'Freunde'
                        
                        df['Kategorie'] = df['Familie'].apply(map_familie_to_kategorie)
                        kategorie_found = True
                    
                    # 3. Prüfe Position/Rolle Spalte für Kategorien
                    elif 'Position' in df.columns:
                        def map_position_to_kategorie(x):
                            x_str = str(x).strip().lower()
                            if any(word in x_str for word in ['familie', 'family', 'verwandt']):
                                return 'Familie'
                            elif any(word in x_str for word in ['kollege', 'arbeit', 'work', 'job']):
                                return 'Kollegen'
                            elif any(word in x_str for word in ['freund', 'friend']):
                                return 'Freunde'
                            else:
                                return 'Freunde'
                        
                        df['Kategorie'] = df['Position'].apply(map_position_to_kategorie)
                        kategorie_found = True
                    
                    # 4. Fallback: Seite als Kategorie
                    elif 'Seite' in df.columns:
                        df['Kategorie'] = df['Seite']
                        kategorie_found = True
                    
                    # 5. Fallback: Standard-Kategorie
                    if not kategorie_found:
                        df['Kategorie'] = 'Freunde'
                else:
                    df[col] = ''
        
        # Status standardisieren
        if 'Status' in df.columns:
            df['Status'] = df['Status'].astype(str).str.lower()
            
            status_mapping = {
                'x': 'Zugesagt',
                '1': 'Zugesagt', 
                'ja': 'Zugesagt',
                'yes': 'Zugesagt',
                'zusage': 'Zugesagt',
                'zugesagt': 'Zugesagt',
                'nein': 'Abgesagt',
                'no': 'Abgesagt',
                'absage': 'Abgesagt',
                'abgesagt': 'Abgesagt',
                '0': 'Offen',  # In der Käthe & Pascal Excel bedeutet 0 = offen
                '': 'Offen',
                'nan': 'Offen',
                'none': 'Offen'
            }
            
            df['Status'] = df['Status'].replace(status_mapping)
            df['Status'] = df['Status'].fillna('Offen')
        
        # Anzahl_Personen als numerisch sicherstellen
        if 'Anzahl_Personen' in df.columns:
            df['Anzahl_Personen'] = pd.to_numeric(df['Anzahl_Personen'], errors='coerce').fillna(1).astype(int)
            
        return df
    
    def _convert_zusage_to_status(self, zusage_value) -> str:
        """Konvertiert Zusage-Werte zu Status"""
        if pd.isna(zusage_value):
            return 'Offen'
        
        zusage_str = str(zusage_value).strip().lower()
        
        # Spezielle Behandlung für die Käthe & Pascal Excel:
        # "0" bedeutet "noch offen", nicht "Absage"
        if zusage_str in ['x', '1', 'ja', 'yes', 'zusage', 'zugesagt']:
            return 'Zugesagt'
        elif zusage_str in ['nein', 'no', 'absage', 'abgesagt']:
            return 'Abgesagt'
        elif zusage_str in ['0', '', 'nan']:
            return 'Offen'  # 0 ist "offen", nicht "Absage"
        else:
            return 'Offen'
        
    def _validate_guest_data(self, df: pd.DataFrame) -> bool:
        """Validiert Gästeliste-Daten"""
        if df.empty:
            return False
            
        # Mindestens Vorname oder Nachname erforderlich
        has_name = df['Vorname'].notna() | df['Nachname'].notna()
        if not has_name.any():
            return False
            
        return True
        
    def import_excel_budget(self, file_path: str, sheet_name: str = 1) -> bool:
        """Importiert Budget aus Excel-Datei"""
        try:
            print(f"Budget-Import startet für: {file_path}")
            
            # Spezialbehandlung für die Hochzeit.xlsx Datei
            if 'Hochzeit.xlsx' in file_path:
                print("Erkenne Hochzeit.xlsx - verwende Spezial-Import")
                df = self._import_hochzeit_budget(file_path)
            else:
                # Standard Excel-Import
                print(f"Standard Excel-Import für Sheet {sheet_name}")
                df = pd.read_excel(file_path, sheet_name=sheet_name)
                df = self._standardize_budget_columns(df)
            
            print(f"Budget-Daten nach Import: {len(df)} Zeilen, Spalten: {list(df.columns)}")
            
            if self._validate_budget_data(df):
                self.budget_df = df
                self.save_budget()
                print("Budget erfolgreich importiert und gespeichert")
                
                # GUI-Update triggern
                self._trigger_gui_update()
                
                return True
            else:
                print("Budget-Validierung fehlgeschlagen")
                return False
                
        except Exception as e:
            print(f"Fehler beim Budget-Import: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def delete_budget_items(self, indices: list) -> bool:
        """Löscht Budget-Positionen anhand der Indizes"""
        try:
            if self.budget_df.empty:
                return False
            
            # Indizes validieren
            valid_indices = [i for i in indices if 0 <= i < len(self.budget_df)]
            
            if not valid_indices:
                return False
            
            # Zeilen löschen
            self.budget_df = self.budget_df.drop(valid_indices).reset_index(drop=True)
            self.save_budget()
            
            print(f"{len(valid_indices)} Budget-Positionen gelöscht")
            
            # GUI-Update triggern
            self._trigger_gui_update()
            
            return True
            
        except Exception as e:
            print(f"Fehler beim Löschen von Budget-Positionen: {e}")
            return False
    
    def delete_budget_items_by_category(self, kategorien: list) -> bool:
        """Löscht Budget-Positionen anhand der Kategorie-Namen"""
        try:
            if self.budget_df.empty:
                return False
            
            indices_to_delete = []
            
            for kategorie in kategorien:
                # Exakter Match
                matches = self.budget_df[self.budget_df['Kategorie'] == kategorie]
                
                if matches.empty:
                    # Falls kein exakter Match, versuche ohne Emoji/Symbole
                    clean_kategorie = kategorie.replace('✓', '').replace('⏳', '').strip()
                    matches = self.budget_df[self.budget_df['Kategorie'].str.contains(clean_kategorie, na=False, regex=False)]
                
                if not matches.empty:
                    indices_to_delete.extend(matches.index.tolist())
            
            if not indices_to_delete:
                print("Keine passenden Kategorien gefunden")
                return False
            
            # Duplikate entfernen
            indices_to_delete = list(set(indices_to_delete))
            
            # Zeilen löschen
            self.budget_df = self.budget_df.drop(indices_to_delete).reset_index(drop=True)
            self.save_budget()
            
            print(f"{len(indices_to_delete)} Budget-Positionen gelöscht")
            
            # GUI-Update triggern
            self._trigger_gui_update()
            
            return True
            
        except Exception as e:
            print(f"Fehler beim Löschen von Budget-Positionen nach Kategorie: {e}")
            return False
    
    def delete_all_budget_items(self) -> bool:
        """Löscht alle Budget-Positionen"""
        try:
            self.budget_df = pd.DataFrame(columns=['Kategorie', 'Geplant', 'Ausgegeben', 'Beschreibung'])
            self.save_budget()
            print("Alle Budget-Positionen gelöscht")
            
            # GUI-Update triggern
            self._trigger_gui_update()
            
            return True
            
        except Exception as e:
            print(f"Fehler beim Löschen aller Budget-Positionen: {e}")
            return False
    
    def add_budget_item(self, item: dict) -> bool:
        """Fügt neue Budget-Position hinzu"""
        try:
            # Stelle sicher, dass alle erforderlichen Spalten vorhanden sind
            required_columns = ['Hauptkategorie', 'Kategorie', 'Geplant', 'Ausgegeben', 'Beschreibung']
            
            # Falls das DataFrame leer ist, mit den richtigen Spalten initialisieren
            if self.budget_df.empty:
                self.budget_df = pd.DataFrame(columns=required_columns)
            else:
                # Stelle sicher, dass alle Spalten existieren
                for col in required_columns:
                    if col not in self.budget_df.columns:
                        self.budget_df[col] = ''
            
            # Setze Standard-Hauptkategorie falls nicht vorhanden
            if 'Hauptkategorie' not in item:
                item['Hauptkategorie'] = 'Sonstiges'
                
            new_row = pd.DataFrame([item])
            self.budget_df = pd.concat([self.budget_df, new_row], ignore_index=True)
            self.save_budget()
            print(f"Budget-Position hinzugefügt: {item['Kategorie']}")
            
            # GUI-Update triggern
            self._trigger_gui_update()
            
            return True
            
        except Exception as e:
            print(f"Fehler beim Hinzufügen der Budget-Position: {e}")
            return False
    
    def get_budget_categories(self) -> dict:
        """Gibt die verfügbaren Budget-Hauptkategorien zurück"""
        return {
            'Gäste': ['Essen', 'Getränke', 'Standesamt'],
            'Location': ['Miete', 'DJ', 'Deko', 'Servicepersonal', 'Blumen'],
            'Generelle Kosten': ['Ringe', 'Kleid', 'Anzug', 'Fotograf', 'Einladungen'],
            'Sonstiges': ['Verschiedenes', 'Unvorhergesehenes', 'Extras']
        }
    
    def get_budget_summary_by_category(self) -> dict:
        """Gibt eine Zusammenfassung des Budgets nach Hauptkategorien zurück"""
        try:
            if self.budget_df.empty:
                return {}
            
            # Stelle sicher, dass Hauptkategorie-Spalte existiert
            if 'Hauptkategorie' not in self.budget_df.columns:
                self.budget_df['Hauptkategorie'] = 'Sonstiges'
            
            summary = {}
            for hauptkategorie in self.budget_df['Hauptkategorie'].unique():
                kategorie_df = self.budget_df[self.budget_df['Hauptkategorie'] == hauptkategorie]
                summary[hauptkategorie] = {
                    'geplant': kategorie_df['Geplant'].sum(),
                    'ausgegeben': kategorie_df['Ausgegeben'].sum(),
                    'items': len(kategorie_df)
                }
                summary[hauptkategorie]['differenz'] = summary[hauptkategorie]['geplant'] - summary[hauptkategorie]['ausgegeben']
            
            return summary
            
        except Exception as e:
            print(f"Fehler beim Erstellen der Budget-Zusammenfassung: {e}")
            return {}
    
    def get_budget_item(self, index: int) -> dict:
        """Gibt Budget-Position an Index zurück"""
        try:
            if 0 <= index < len(self.budget_df):
                row = self.budget_df.iloc[index]
                return row.to_dict()
            return {}
            
        except Exception as e:
            print(f"Fehler beim Abrufen der Budget-Position: {e}")
            return {}
    
    def get_budget_item_by_category(self, kategorie: str) -> dict:
        """Gibt Budget-Position anhand des Kategorie-Namens zurück"""
        try:
            if self.budget_df.empty:
                return {}
            
            # Exakter Match der Kategorie
            matches = self.budget_df[self.budget_df['Kategorie'] == kategorie]
            if not matches.empty:
                return matches.iloc[0].to_dict()
            
            # Falls kein exakter Match, versuche ohne Emoji/Symbole
            clean_kategorie = kategorie.replace('✓', '').replace('⏳', '').strip()
            matches = self.budget_df[self.budget_df['Kategorie'].str.contains(clean_kategorie, na=False, regex=False)]
            if not matches.empty:
                return matches.iloc[0].to_dict()
            
            return {}
            
        except Exception as e:
            print(f"Fehler beim Abrufen der Budget-Position nach Kategorie: {e}")
            return {}
    
    def update_budget_item(self, index: int, updated_item: dict) -> bool:
        """Aktualisiert Budget-Position an gegebenem Index"""
        try:
            if 0 <= index < len(self.budget_df):
                # Fehlende Spalten mit Standardwerten ergänzen
                required_columns = ['Kategorie', 'Geplant', 'Ausgegeben', 'Beschreibung']
                for col in required_columns:
                    if col not in updated_item:
                        if col in ['Geplant', 'Ausgegeben']:
                            updated_item[col] = 0.0
                        else:
                            updated_item[col] = ''
                
                # Einzelne Werte aktualisieren
                for column, value in updated_item.items():
                    if column in self.budget_df.columns:
                        self.budget_df.at[index, column] = value
                
                # DataFrame speichern
                self.save_budget()
                
                # GUI-Update auslösen
                if self.gui_update_callback:
                    self.gui_update_callback()
                
                return True
            else:
                print(f"Ungültiger Index: {index}")
                return False
                
        except Exception as e:
            print(f"Fehler beim Aktualisieren der Budget-Position: {e}")
            return False
    
    def update_budget_item_by_category(self, kategorie: str, updated_item: dict) -> bool:
        """Aktualisiert Budget-Position anhand des Kategorie-Namens"""
        try:
            if self.budget_df.empty:
                return False
            
            # Index der Kategorie finden
            matches = self.budget_df[self.budget_df['Kategorie'] == kategorie]
            if matches.empty:
                # Falls kein exakter Match, versuche ohne Emoji/Symbole
                clean_kategorie = kategorie.replace('✓', '').replace('⏳', '').strip()
                matches = self.budget_df[self.budget_df['Kategorie'].str.contains(clean_kategorie, na=False, regex=False)]
                
            if matches.empty:
                print(f"Kategorie '{kategorie}' nicht gefunden")
                return False
            
            # Index des ersten Matches verwenden
            index = matches.index[0]
            
            # Fehlende Spalten mit Standardwerten ergänzen
            required_columns = ['Kategorie', 'Geplant', 'Ausgegeben', 'Beschreibung']
            for col in required_columns:
                if col not in updated_item:
                    if col in ['Geplant', 'Ausgegeben']:
                        updated_item[col] = 0.0
                    else:
                        updated_item[col] = ''
            
            # Einzelne Werte aktualisieren
            for column, value in updated_item.items():
                if column in self.budget_df.columns:
                    self.budget_df.at[index, column] = value
            
            # DataFrame speichern
            self.save_budget()
            
            # GUI-Update auslösen
            if self.gui_update_callback:
                self.gui_update_callback()
            
            return True
                
        except Exception as e:
            print(f"Fehler beim Aktualisieren der Budget-Position nach Kategorie: {e}")
            return False
    
    def delete_budget_items_by_category(self, kategorien: list) -> bool:
        """Löscht Budget-Positionen anhand der Kategorie-Namen"""
        try:
            if self.budget_df.empty or not kategorien:
                return False
            
            deleted_count = 0
            
            for kategorie in kategorien:
                # Index der Kategorie finden
                matches = self.budget_df[self.budget_df['Kategorie'] == kategorie]
                if matches.empty:
                    # Falls kein exakter Match, versuche ohne Emoji/Symbole
                    clean_kategorie = kategorie.replace('✓', '').replace('⏳', '').strip()
                    matches = self.budget_df[self.budget_df['Kategorie'].str.contains(clean_kategorie, na=False, regex=False)]
                
                if not matches.empty:
                    # Alle Matches löschen
                    indices_to_delete = matches.index.tolist()
                    self.budget_df = self.budget_df.drop(indices_to_delete).reset_index(drop=True)
                    deleted_count += len(indices_to_delete)
            
            if deleted_count > 0:
                # DataFrame speichern
                self.save_budget()
                
                # GUI-Update auslösen
                if self.gui_update_callback:
                    self.gui_update_callback()
                
                print(f"{deleted_count} Budget-Position(en) gelöscht")
                return True
            
            return False
                
        except Exception as e:
            print(f"Fehler beim Löschen der Budget-Positionen nach Kategorie: {e}")
            return False
    
    def get_budget_with_costs(self) -> dict:
        """Gibt Budget-Daten mit Kostenaufschlüsselung für Web-API zurück"""
        try:
            if self.budget_df.empty:
                return {
                    'items': [],
                    'categories': {},
                    'total_planned': 0,
                    'total_spent': 0
                }
            
            # Budget-Items als Liste
            items = self.budget_df.to_dict('records')
            
            # Kategorien-Zusammenfassung
            categories = {}
            for _, row in self.budget_df.iterrows():
                hauptkategorie = row.get('Hauptkategorie', 'Sonstiges')
                if hauptkategorie not in categories:
                    categories[hauptkategorie] = {'planned': 0, 'spent': 0}
                
                categories[hauptkategorie]['planned'] += row.get('Geplant', 0)
                categories[hauptkategorie]['spent'] += row.get('Ausgegeben', 0)
            
            # Gesamt-Summen
            total_planned = self.budget_df['Geplant'].sum()
            total_spent = self.budget_df['Ausgegeben'].sum()
            
            return {
                'items': items,
                'categories': categories,
                'total_planned': total_planned,
                'total_spent': total_spent
            }
            
        except Exception as e:
            print(f"Fehler beim Abrufen der Budget-Daten: {e}")
            return {
                'items': [],
                'categories': {},
                'total_planned': 0,
                'total_spent': 0
            }
    
    def get_budget_summary(self) -> dict:
        """Gibt Budget-Zusammenfassung für Dashboard zurück"""
        try:
            if self.budget_df.empty:
                return {
                    'planned': 0,
                    'spent': 0,
                    'remaining': 0,
                    'categories': {}
                }
            
            # Neue Spaltenstruktur: gesamtpreis und ausgegeben
            if 'gesamtpreis' in self.budget_df.columns:
                # Neues Budget-System mit ausgegeben-Spalte
                total_planned = self.budget_df['gesamtpreis'].sum()
                total_spent = self.budget_df['ausgegeben'].sum() if 'ausgegeben' in self.budget_df.columns else 0
                remaining = total_planned - total_spent
                
                # Kategorien für Chart
                categories = {}
                for _, row in self.budget_df.iterrows():
                    kategorie = row.get('kategorie', 'Sonstiges')
                    if kategorie not in categories:
                        categories[kategorie] = {'planned': 0, 'spent': 0}
                    
                    categories[kategorie]['planned'] += row.get('gesamtpreis', 0)
                    categories[kategorie]['spent'] += row.get('ausgegeben', 0)
            
            elif 'Geplant' in self.budget_df.columns:
                # Altes Budget-System (Fallback)
                total_planned = self.budget_df['Geplant'].sum()
                total_spent = self.budget_df['Ausgegeben'].sum() if 'Ausgegeben' in self.budget_df.columns else 0
                remaining = total_planned - total_spent
                
                # Kategorien für Chart
                categories = {}
                for _, row in self.budget_df.iterrows():
                    hauptkategorie = row.get('Hauptkategorie', 'Sonstiges')
                    if hauptkategorie not in categories:
                        categories[hauptkategorie] = {'planned': 0, 'spent': 0}
                    
                    categories[hauptkategorie]['planned'] += row.get('Geplant', 0)
                    categories[hauptkategorie]['spent'] += row.get('Ausgegeben', 0)
            
            else:
                # Fallback falls keine passenden Spalten gefunden werden
                total_planned = total_spent = remaining = 0
                categories = {}
            
            return {
                'planned': total_planned,
                'spent': total_spent,
                'remaining': remaining,
                'categories': categories
            }
            
        except Exception as e:
            print(f"Fehler beim Abrufen der Budget-Zusammenfassung: {e}")
            return {
                'planned': 0,
                'spent': 0,
                'remaining': 0,
                'categories': {}
            }
    
    def get_cost_setting(self, event_type: str, default_value: float) -> float:
        """Gibt Kostenkonstante für ein Event zurück"""
        try:
            config = self.load_config()
            return config.get('cost_settings', {}).get(event_type, default_value)
        except Exception as e:
            print(f"Fehler beim Laden der Kostenkonstante für {event_type}: {e}")
            return default_value

    def get_detailed_cost_breakdown(self, event_type: str) -> Dict[str, float]:
        """Gibt detaillierte Kostenaufschlüsselung für ein Event zurück"""
        try:
            config = self.load_config()
            breakdown = config.get('detailed_costs', {}).get(event_type, {})
            
            # Standard-Werte falls nicht konfiguriert - entsprechend der neuen Logik
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
            print(f"Fehler beim Laden der detaillierten Kosten für {event_type}: {e}")
            return {'Pauschale': self.get_cost_setting(event_type, 0.0)}

    def set_detailed_cost_breakdown(self, event_type: str, breakdown: Dict[str, float]) -> bool:
        """Setzt detaillierte Kostenaufschlüsselung für ein Event"""
        try:
            config = self.load_config()
            if 'detailed_costs' not in config:
                config['detailed_costs'] = {}
            config['detailed_costs'][event_type] = breakdown
            
            # Auch Gesamtsumme als cost_setting aktualisieren
            total_cost = sum(breakdown.values())
            if 'cost_settings' not in config:
                config['cost_settings'] = {}
            config['cost_settings'][event_type] = total_cost
            
            self.save_config(config)
            return True
        except Exception as e:
            print(f"Fehler beim Speichern der detaillierten Kosten für {event_type}: {e}")
            return False

    def get_cost_breakdown_display(self, event_type: str) -> str:
        """Gibt formatierte Kostenaufschlüsselung als String zurück"""
        try:
            breakdown = self.get_detailed_cost_breakdown(event_type)
            total = sum(breakdown.values())
            
            # Formatiere Aufschlüsselung
            parts = []
            for category, cost in breakdown.items():
                parts.append(f"{cost:.0f}€ {category}")
            
            breakdown_str = " + ".join(parts)
            return f"{total:.0f}€ ({breakdown_str})"
            
        except Exception as e:
            print(f"Fehler beim Formatieren der Kostenaufschlüsselung für {event_type}: {e}")
            return f"{self.get_cost_setting(event_type, 0.0):.0f}€"

    def calculate_event_costs_by_logic(self) -> Dict[str, Dict]:
        """
        Berechnet die Kosten nach der korrigierten Hierarchie-Logik:
        - Weißer Saal: Getränke Weißer Saal + Essen + Getränke Essen (aber nichts bei Party)
        - Essen: Essen + Getränke Essen (aber nichts bei Party)  
        - Party: Nur Party-Getränke (nur für Gäste die NICHT beim Essen sind)
        + Berücksichtigt Fixkosten vs. Kosten pro Person
        """
        try:
            event_summary = self.get_guest_event_summary()
            costs = {}
            
            # Kostenkomponenten abrufen
            standesamt_breakdown = self.get_detailed_cost_breakdown('standesamt')
            essen_breakdown = self.get_detailed_cost_breakdown('essen')  
            party_breakdown = self.get_detailed_cost_breakdown('party')
            
            # Fixkosten abrufen (falls konfiguriert)
            fixed_costs = self.get_fixed_costs()
            
            # Gästezahlen abrufen
            standesamt_guests = event_summary.get('standesamt_confirmed', 0) + event_summary.get('standesamt_open', 0)
            essen_guests = event_summary.get('essen_confirmed', 0) + event_summary.get('essen_open', 0)
            party_guests_total = event_summary.get('party_confirmed', 0) + event_summary.get('party_open', 0)
            
            # Weißer Saal/Standesamt-Kosten 
            # Diese Gäste bezahlen: Weißer Saal Getränke + Essen + Essen Getränke
            if standesamt_guests > 0:
                # Standesamt Getränke (z.B. 4€)
                standesamt_cost_per_person = sum(standesamt_breakdown.values())
                # Essen + Getränke (z.B. 55€ + 35€ = 90€)  
                essen_cost_per_person = sum(essen_breakdown.values())
                
                # Gesamtkosten pro Person für Standesamt-Gäste
                total_cost_per_person = standesamt_cost_per_person + essen_cost_per_person
                standesamt_total = standesamt_guests * total_cost_per_person
                
                # Aufschlüsselung anzeigen
                standesamt_detail = " + ".join([f"{cost:.0f}€ {cat}" for cat, cost in standesamt_breakdown.items()])
                essen_detail = " + ".join([f"{cost:.0f}€ {cat}" for cat, cost in essen_breakdown.items()])
                
                costs['standesamt'] = {
                    'guests': standesamt_guests,
                    'cost_per_person': total_cost_per_person,
                    'total_cost': standesamt_total,
                    'breakdown': {**standesamt_breakdown, **essen_breakdown},
                    'display': f"Weißer Saal ({standesamt_guests}P × {total_cost_per_person:.0f}€) = {standesamt_total:.0f}€ (Weißer Saal: {standesamt_detail} + Essen: {essen_detail})"
                }
            
            # Essen-Kosten (nur die, die NICHT beim Weißen Saal sind)
            # Diese bezahlen: Essen + Essen Getränke
            essen_only_guests = max(0, essen_guests - standesamt_guests)
            if essen_only_guests > 0:
                essen_cost_per_person = sum(essen_breakdown.values())
                essen_total = essen_only_guests * essen_cost_per_person
                
                detail_str = " + ".join([f"{cost:.0f}€ {cat}" for cat, cost in essen_breakdown.items()])
                costs['essen'] = {
                    'guests': essen_only_guests,
                    'cost_per_person': essen_cost_per_person,
                    'total_cost': essen_total,
                    'breakdown': essen_breakdown,
                    'display': f"Essen ({essen_only_guests}P × {essen_cost_per_person:.0f}€) = {essen_total:.0f}€ ({detail_str})"
                }
                
            # Party-Kosten (nur Gäste die NICHT beim Essen sind)
            # Diese bezahlen: Nur Party-Getränke
            party_only_guests = max(0, party_guests_total - essen_guests)
            if party_only_guests > 0:
                party_cost_per_person = sum(party_breakdown.values())
                party_total = party_only_guests * party_cost_per_person
                
                detail_str = " + ".join([f"{cost:.0f}€ {cat}" for cat, cost in party_breakdown.items()])
                costs['party'] = {
                    'guests': party_only_guests,
                    'cost_per_person': party_cost_per_person,
                    'total_cost': party_total,
                    'breakdown': party_breakdown,
                    'display': f"Party ({party_only_guests}P × {party_cost_per_person:.0f}€) = {party_total:.0f}€ ({detail_str})"
                }
            
            # Fixkosten hinzufügen
            for category, cost in fixed_costs.items():
                if cost > 0:
                    costs[f"fixed_{category.lower().replace(' ', '_')}"] = {
                        'guests': 1,
                        'cost_per_person': cost,
                        'total_cost': cost,
                        'breakdown': {category: cost},
                        'display': f"{category} (Fixkosten) = {cost:.0f}€"
                    }
                
            return costs
            
        except Exception as e:
            print(f"Fehler bei der Kostenberechnung: {e}")
            return {}

    def get_fixed_costs(self) -> Dict[str, float]:
        """Gibt Fixkosten zurück (unabhängig von Personenzahl)"""
        try:
            config = self.load_config()
            return config.get('fixed_costs', {})
        except Exception as e:
            print(f"Fehler beim Laden der Fixkosten: {e}")
            return {}
    
    def set_fixed_costs(self, fixed_costs: Dict[str, float]) -> bool:
        """Setzt Fixkosten"""
        try:
            config = self.load_config()
            config['fixed_costs'] = fixed_costs
            self.save_config(config)
            return True
        except Exception as e:
            print(f"Fehler beim Speichern der Fixkosten: {e}")
            return False
    
    def set_cost_setting(self, event_type: str, cost: float) -> bool:
        """Setzt Kostenkonstante für ein Event"""
        try:
            config = self.load_config()
            if 'cost_settings' not in config:
                config['cost_settings'] = {}
            config['cost_settings'][event_type] = cost
            self.save_config(config)
            return True
        except Exception as e:
            print(f"Fehler beim Speichern der Kostenkonstante für {event_type}: {e}")
            return False
    
    def get_setting(self, key: str, default_value=None):
        """Gibt allgemeine Einstellung zurück"""
        try:
            config = self.load_config()
            return config.get('settings', {}).get(key, default_value)
        except Exception as e:
            print(f"Fehler beim Laden der Einstellung {key}: {e}")
            return default_value
    
    def set_setting(self, key: str, value) -> bool:
        """Setzt allgemeine Einstellung"""
        try:
            config = self.load_config()
            if 'settings' not in config:
                config['settings'] = {}
            config['settings'][key] = value
            self.save_config(config)
            return True
        except Exception as e:
            print(f"Fehler beim Speichern der Einstellung {key}: {e}")
            return False
    
    def load_config(self) -> dict:
        """Lädt die Konfigurationsdatei"""
        try:
            config_file = os.path.join(self.data_dir, "hochzeit_config.json")
            if os.path.exists(config_file):
                with open(config_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            else:
                # Standard-Konfiguration zurückgeben
                return {
                    'cost_settings': {
                        'standesamt': 35,
                        'essen': 55,
                        'party': 25
                    },
                    'settings': {
                        'auto_budget_update': True
                    }
                }
        except Exception as e:
            print(f"Fehler beim Laden der Konfiguration: {e}")
            return {}
    
    def save_config(self, config: dict) -> bool:
        """Speichert die Konfigurationsdatei"""
        try:
            config_file = os.path.join(self.data_dir, "hochzeit_config.json")
            with open(config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"Fehler beim Speichern der Konfiguration: {e}")
            return False
    
    def calculate_guest_costs(self) -> dict:
        """Berechnet automatische Kosten basierend auf Gäste-Kategorien mit Hierarchie"""
        if self.gaesteliste_df.empty:
            return {
                'standesamt_gaeste': 0,
                'essen_gaeste': 0, 
                'party_gaeste': 0,
                'standesamt_kosten': 0.0,
                'essen_kosten': 0.0,
                'party_kosten': 0.0,
                'getraenke_kosten_gesamt': 0.0,
                'essen_kosten_gesamt': 0.0,
                'kosten_gesamt': 0.0
            }
        
        # Gäste nach Kategorien zählen (bestätigte Gäste + offene Anfragen für Planung)
        # Für Budget-Planung sollten auch "Offen"-Gäste berücksichtigt werden
        relevant_guests = self.gaesteliste_df[
            (self.gaesteliste_df['Status'] == 'Zugesagt') | 
            (self.gaesteliste_df['Status'] == 'Offen')
        ]
        
        standesamt_gaeste = 0
        essen_gaeste = 0
        party_gaeste = 0
        
        for _, guest in relevant_guests.iterrows():
            anzahl = guest.get('Anzahl_Personen', 1)
            
            # Hierarchische Logik: Standesamt → Essen → Party
            # Erweiterte Erkennung für verschiedene Ja-Werte
            standesamt_val = str(guest.get('Zum_Standesamt', 'Nein')).lower().strip()
            essen_val = str(guest.get('Zum_Essen', 'Nein')).lower().strip()
            party_val = str(guest.get('Zur_Party', 'Nein')).lower().strip()
            
            is_standesamt = standesamt_val in ['ja', 'yes', 'x', '1', 'true', '✓']
            is_essen = essen_val in ['ja', 'yes', 'x', '1', 'true', '✓']
            is_party = party_val in ['ja', 'yes', 'x', '1', 'true', '✓']
            
            # Wenn jemand zum Standesamt kommt, ist er automatisch auch beim Essen
            if is_standesamt:
                standesamt_gaeste += anzahl
                essen_gaeste += anzahl  # Automatisch auch beim Essen
                party_gaeste += anzahl  # Automatisch auch bei der Party
            # Wenn jemand zum Essen kommt (aber nicht Standesamt), ist er automatisch auch bei der Party  
            elif is_essen:
                essen_gaeste += anzahl
                party_gaeste += anzahl  # Automatisch auch bei der Party
            # Nur Party
            elif is_party:
                party_gaeste += anzahl
        
        # Kosten berechnen (ohne Doppelzählung)
        # Standesamt-Gäste zahlen nur Standesamt-Getränke (35€)
        standesamt_kosten = standesamt_gaeste * self.KOSTEN_STANDESAMT_GETRAENKE
        
        # Essen-Gäste (ohne Standesamt) zahlen Essen-Getränke (35€) + Essen (55€)
        nur_essen_gaeste = essen_gaeste - standesamt_gaeste
        essen_kosten_getraenke = nur_essen_gaeste * self.KOSTEN_STANDESAMT_GETRAENKE
        essen_kosten_essen = essen_gaeste * self.KOSTEN_ESSEN  # Alle Essen-Gäste zahlen Essen
        
        # Party-Gäste (ohne Standesamt und Essen) zahlen nur Party-Getränke (25€)
        nur_party_gaeste = party_gaeste - essen_gaeste
        party_kosten = nur_party_gaeste * self.KOSTEN_PARTY_GETRAENKE
        
        # Gesamtkosten
        getraenke_kosten_gesamt = standesamt_kosten + essen_kosten_getraenke + party_kosten
        essen_kosten_gesamt = essen_kosten_essen
        kosten_gesamt = getraenke_kosten_gesamt + essen_kosten_gesamt
        
        return {
            'standesamt_gaeste': standesamt_gaeste,
            'essen_gaeste': essen_gaeste,
            'party_gaeste': party_gaeste,
            'nur_essen_gaeste': nur_essen_gaeste,
            'nur_party_gaeste': nur_party_gaeste,
            'standesamt_kosten': standesamt_kosten,
            'essen_kosten_getraenke': essen_kosten_getraenke,
            'essen_kosten_essen': essen_kosten_essen,
            'party_kosten': party_kosten,
            'getraenke_kosten_gesamt': getraenke_kosten_gesamt,
            'essen_kosten_gesamt': essen_kosten_gesamt,
            'kosten_gesamt': kosten_gesamt
        }
    
    def apply_event_hierarchy(self, guest_data: dict) -> dict:
        """Wendet Event-Hierarchie an: Standesamt → Essen → Party"""
        # Kopie erstellen um Original nicht zu verändern
        data = guest_data.copy()
        
        is_standesamt = str(data.get('Zum_Standesamt', 'Nein')).lower() in ['ja', 'yes', 'x', '1', 'true']
        is_essen = str(data.get('Zum_Essen', 'Nein')).lower() in ['ja', 'yes', 'x', '1', 'true']
        is_party = str(data.get('Zur_Party', 'Nein')).lower() in ['ja', 'yes', 'x', '1', 'true']
        
        # Hierarchie anwenden
        if is_standesamt:
            data['Zum_Essen'] = 'Ja'     # Automatisch auch beim Essen
            data['Zur_Party'] = 'Ja'     # Automatisch auch bei der Party
        elif is_essen:
            data['Zur_Party'] = 'Ja'     # Automatisch auch bei der Party
        
        return data
    
    def update_guest_budget_automatically(self) -> bool:
        """Aktualisiert Budget automatisch basierend auf Event-Kosten mit verbesserter Logik"""
        try:
            # Sicherstellen, dass Budget-DataFrame korrekt initialisiert ist
            if self.budget_df.empty or 'Kategorie' not in self.budget_df.columns:
                print("⚠️ Budget-DataFrame wird initialisiert...")
                self.budget_df = pd.DataFrame(columns=['Kategorie', 'Geplant', 'Ausgegeben', 'Beschreibung', 'Hauptkategorie'])
            
            # Stelle sicher, dass Hauptkategorie-Spalte existiert
            if 'Hauptkategorie' not in self.budget_df.columns:
                self.budget_df['Hauptkategorie'] = 'Sonstiges'
            
            # Verwende neue Event-Kostenlogik
            event_costs = self.calculate_event_costs_by_logic()
            
            if not event_costs:
                print("⚠️ Keine Event-Kosten berechnet - überspringe Budget-Update")
                return False
            
            # Entferne alte automatische Einträge mit Event-Namen
            patterns_to_remove = [
                r'.*Standesamt.*\([0-9]+ Kommt.*\)',
                r'.*Essen.*\([0-9]+ Kommt.*\)',
                r'.*Party.*\([0-9]+ Kommt.*\)',
                r'Gäste Standesamt.*',
                r'Gäste Essen.*',
                r'Gäste Party.*'
            ]
            
            if not self.budget_df.empty:
                for pattern in patterns_to_remove:
                    self.budget_df = self.budget_df[~self.budget_df['Kategorie'].str.contains(pattern, regex=True, na=False)]
            
            # Neue Event-basierte Einträge erstellen
            new_entries = []
            
            for event_type, event_data in event_costs.items():
                if event_type.startswith('fixed_'):
                    continue  # Fixkosten werden separat behandelt
                
                guests = event_data.get('guests', 0)
                total_cost = event_data.get('total_cost', 0)
                
                if guests > 0 and total_cost > 0:
                    # Event-Name formatieren
                    event_name = event_type.title()
                    
                    # Gäste-Aufschlüsselung für Party (nur zusätzliche Gäste anzeigen)
                    if event_type == 'party':
                        additional_guests = event_data.get('additional_guests', 0)
                        
                        # Nur zusätzliche Gäste anzeigen (ohne Referenz auf Essen)
                        guest_info = f"({additional_guests}P)"
                    else:
                        confirmed = len(self.gaesteliste_df[
                            (self.gaesteliste_df['Status'] == 'Kommt') & 
                            (self.gaesteliste_df[f'Teilnahme_{event_type.title()}'] == 'Ja')
                        ])
                        open_guests = len(self.gaesteliste_df[
                            (self.gaesteliste_df['Status'] == 'Offen') & 
                            (self.gaesteliste_df[f'Teilnahme_{event_type.title()}'] == 'Ja')
                        ])
                        guest_info = f"({confirmed} Kommt + {open_guests} Offen)"
                    
                    # Kostenaufschlüsselung aus breakdown
                    breakdown_items = []
                    for item_name, cost_per_person in event_data.get('breakdown', {}).items():
                        total_item_cost = guests * cost_per_person
                        breakdown_items.append(f"{item_name} {total_item_cost:.0f}€")
                    
                    breakdown_str = " + ".join(breakdown_items) if breakdown_items else ""
                    
                    new_entries.append({
                        'Kategorie': f'{event_name} {guest_info}',
                        'Geplant': total_cost,
                        'Ausgegeben': 0.0,
                        'Beschreibung': f'{guests} Personen: {breakdown_str}',
                        'Hauptkategorie': 'Gäste'
                    })
            
            # Neue Einträge zum Budget hinzufügen
            if new_entries:
                new_df = pd.DataFrame(new_entries)
                self.budget_df = pd.concat([self.budget_df, new_df], ignore_index=True)
                print(f"📊 {len(new_entries)} Event-Budget-Einträge hinzugefügt")
            else:
                print("⚠️ Keine neuen Budget-Einträge erstellt")
            
            # Budget speichern
            self.save_budget()
            print("✅ Budget automatisch aktualisiert")
            return True
            
        except Exception as e:
            print(f"❌ Fehler beim automatischen Budget-Update: {e}")
            import traceback
            traceback.print_exc()
            return False
            
        except Exception as e:
            print(f"❌ Fehler beim automatischen Budget-Update: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def _import_hochzeit_budget(self, file_path: str) -> pd.DataFrame:
        """
        Spezial-Import für Budget aus der Hochzeit.xlsx Datei
        Speziell für das Arbeitsblatt "Berechnung Kosten" oder "Einzelaufstellung"
        """
        try:
            # Alle Arbeitsblätter der Datei abrufen
            excel_file = pd.ExcelFile(file_path)
            budget_df = pd.DataFrame()
            
            print(f"Verfügbare Arbeitsblätter: {excel_file.sheet_names}")
            
            # Speziell nach "Berechnung Kosten" oder Budget-relevanten Sheets suchen
            target_sheet = None
            
            # Priorität 1: "Berechnung Kosten"
            for sheet in excel_file.sheet_names:
                if "Berechnung Kosten" in sheet:
                    target_sheet = sheet
                    break
                elif "berechnung" in sheet.lower() and "kosten" in sheet.lower():
                    target_sheet = sheet
                    break
            
            # Priorität 2: "Einzelaufstellung" (für Budget-Daten)
            if not target_sheet:
                for sheet in excel_file.sheet_names:
                    if "Einzelaufstellung" in sheet:
                        print(f"Versuche Budget-Import aus Einzelaufstellung")
                        target_sheet = sheet
                        break
                    elif "budget" in sheet.lower() or "kosten" in sheet.lower():
                        target_sheet = sheet
                        break
            
            # Priorität 3: Jedes Sheet außer "Gesamt" (da das Gäste sind)
            if not target_sheet:
                for sheet in excel_file.sheet_names:
                    if sheet.lower() != "gesamt":
                        print(f"Versuche Budget-Import aus '{sheet}' (kein Gesamt-Sheet)")
                        target_sheet = sheet
                        break
                        
            if target_sheet:
                print(f"Verwende Arbeitsblatt für Budget: '{target_sheet}'")
                budget_df = self._load_budget_from_sheet(file_path, target_sheet)
            else:
                print("Kein geeignetes Budget-Arbeitsblatt gefunden")
            
            if budget_df.empty:
                raise ValueError("Keine Budget-Daten in der Hochzeit.xlsx gefunden")
            
            return budget_df
            
        except Exception as e:
            print(f"Fehler beim Import der Hochzeit.xlsx Budget-Daten: {e}")
            raise e
    
    def _load_budget_from_sheet(self, file_path: str, sheet_name: str) -> pd.DataFrame:
        """Lädt Budget-Daten aus einem spezifischen Arbeitsblatt"""
        try:
            # Verschiedene Lese-Strategien versuchen
            budget_df = pd.DataFrame()
            
            # Strategie 1: Normale Einlesung
            df = pd.read_excel(file_path, sheet_name=sheet_name)
            print(f"Spalten in '{sheet_name}': {list(df.columns)}")
            print(f"Shape: {df.shape}")
            
            # Wenn alle Spalten "Unnamed" sind, versuche andere Strategien
            if all(str(col).startswith('Unnamed') for col in df.columns):
                print("Alle Spalten sind 'Unnamed' - versuche andere Lese-Strategien")
                
                # Strategie 2: Mit Header in verschiedenen Zeilen
                for header_row in [0, 1, 2, 3, 4, 5]:
                    try:
                        df_alt = pd.read_excel(file_path, sheet_name=sheet_name, header=header_row)
                        print(f"Header-Zeile {header_row}: {list(df_alt.columns)}")
                        
                        # Prüfe ob diese Spalten sinnvoller sind
                        if not all(str(col).startswith('Unnamed') for col in df_alt.columns):
                            df = df_alt
                            print(f"Verwende Header-Zeile {header_row}")
                            break
                    except:
                        continue
                
                # Strategie 3: Ohne Header, dann manuell analysieren
                if all(str(col).startswith('Unnamed') for col in df.columns):
                    print("Analysiere Daten ohne Header...")
                    df_no_header = pd.read_excel(file_path, sheet_name=sheet_name, header=None)
                    
                    # Zeige die ersten Zeilen zur Analyse
                    print(f"Erste 10 Zeilen der Daten:")
                    for i in range(min(10, len(df_no_header))):
                        row_values = df_no_header.iloc[i].tolist()
                        print(f"Zeile {i}: {row_values}")
                    
                    # Suche nach Zeilen mit Budget-ähnlichen Daten
                    budget_df = self._extract_budget_from_raw_data(df_no_header)
                    
                    if not budget_df.empty:
                        return budget_df
            
            # Leere Zeilen entfernen
            df = df.dropna(how='all')
            
            # Nach Budget-relevanten Spalten suchen und umbenennen
            for col in df.columns:
                col_str = str(col).strip()
                col_lower = col_str.lower()
                
                # Kategorie/Position
                if any(word in col_lower for word in ['kategorie', 'position', 'artikel', 'beschreibung', 'bereich']):
                    budget_df['Kategorie'] = df[col].astype(str)
                    print(f"Kategorie-Spalte gefunden: {col_str}")
                
                # Kosten/Betrag
                elif any(word in col_lower for word in ['kosten', 'betrag', 'preis', 'euro', '€', 'geplant']):
                    # Numerische Werte extrahieren
                    budget_df['Geplant'] = pd.to_numeric(df[col], errors='coerce')
                    print(f"Kosten-Spalte gefunden: {col_str}")
                
                # Beschreibung (falls separate Spalte)
                elif any(word in col_lower for word in ['beschreibung', 'details', 'bemerkung', 'notiz']):
                    budget_df['Beschreibung'] = df[col].astype(str)
                    print(f"Beschreibung-Spalte gefunden: {col_str}")
            
            # Falls keine spezifischen Spalten gefunden, versuche erste 2-3 Spalten
            if budget_df.empty and len(df.columns) >= 2:
                print("Keine spezifischen Budget-Spalten gefunden - analysiere Dateninhalt")
                budget_df = self._analyze_data_content(df)
            
            # Standard-Spalten hinzufügen falls fehlen
            if 'Ausgegeben' not in budget_df.columns:
                budget_df['Ausgegeben'] = 0.0
            if 'Beschreibung' not in budget_df.columns:
                budget_df['Beschreibung'] = budget_df['Kategorie'] if 'Kategorie' in budget_df.columns else ''
            
            # Leere oder ungültige Zeilen entfernen
            if not budget_df.empty:
                budget_df = budget_df.dropna(subset=['Kategorie'])
                budget_df = budget_df[budget_df['Kategorie'].str.strip() != '']
                budget_df = budget_df[budget_df['Kategorie'] != 'nan']
            
            print(f"Budget-DataFrame erstellt: {len(budget_df)} Zeilen")
            print(f"Spalten: {list(budget_df.columns)}")
            
            return budget_df
            
        except Exception as e:
            print(f"Fehler beim Laden aus '{sheet_name}': {e}")
            return pd.DataFrame()
    
    def _extract_budget_from_raw_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Extrahiert Budget-Daten aus rohen Excel-Daten ohne Header"""
        budget_data = []
        
        for index, row in df.iterrows():
            row_values = row.dropna().tolist()
            
            # Suche nach Zeilen mit Text + Zahl Kombination
            if len(row_values) >= 2:
                text_part = str(row_values[0]).strip()
                
                # Prüfe ob zweiter Wert eine Zahl sein könnte
                for i in range(1, len(row_values)):
                    try:
                        number_part = float(str(row_values[i]).replace('€', '').replace(',', '.').strip())
                        
                        # Wenn Text nicht leer und Zahl positiv
                        if text_part and text_part.lower() not in ['nan', '0', ''] and number_part > 0:
                            budget_data.append({
                                'Kategorie': text_part,
                                'Geplant': number_part,
                                'Ausgegeben': 0.0,
                                'Beschreibung': text_part
                            })
                            print(f"Budget-Eintrag gefunden: {text_part} = {number_part}€")
                            break
                    except (ValueError, TypeError):
                        continue
        
        if budget_data:
            return pd.DataFrame(budget_data)
        return pd.DataFrame()
    
    def _analyze_data_content(self, df: pd.DataFrame) -> pd.DataFrame:
        """Analysiert Dateninhalt um Budget-Einträge zu identifizieren"""
        budget_data = []
        
        print("Analysiere Dateninhalt...")
        for index, row in df.iterrows():
            if index > 20:  # Nur erste 20 Zeilen analysieren
                break
                
            row_values = row.tolist()
            
            # Suche nach sinnvollen Text-Zahl Kombinationen
            text_candidates = []
            number_candidates = []
            
            for val in row_values:
                val_str = str(val).strip()
                if val_str and val_str != 'nan':
                    # Versuche als Zahl zu interpretieren
                    try:
                        # Entferne Währungszeichen und ersetze Komma durch Punkt
                        clean_val = val_str.replace('€', '').replace(',', '.').strip()
                        number = float(clean_val)
                        if number > 0:
                            number_candidates.append(number)
                    except (ValueError, TypeError):
                        # Kein numerischer Wert - könnte Text sein
                        if len(val_str) > 2 and not val_str.isdigit():
                            text_candidates.append(val_str)
            
            # Wenn wir sowohl Text als auch Zahlen haben
            if text_candidates and number_candidates:
                kategorie = text_candidates[0]
                geplant = number_candidates[0]
                
                budget_data.append({
                    'Kategorie': kategorie,
                    'Geplant': geplant,
                    'Ausgegeben': 0.0,
                    'Beschreibung': kategorie
                })
                print(f"Daten-Analyse: {kategorie} = {geplant}€")
        
        if budget_data:
            return pd.DataFrame(budget_data)
        return pd.DataFrame()
    
    def _try_direct_budget_import(self, file_path: str, sheet_name: str) -> pd.DataFrame:
        """Versucht direkten Budget-Import aus einem Arbeitsblatt"""
        try:
            # Standard-Import versuchen
            df = pd.read_excel(file_path, sheet_name=sheet_name)
            print(f"Direkt geladene Spalten: {list(df.columns)}")
            
            # Nach Budget-relevanten Spalten suchen
            budget_columns = []
            for col in df.columns:
                col_lower = str(col).lower()
                if any(keyword in col_lower for keyword in [
                    'kategorie', 'position', 'artikel', 'beschreibung',
                    'kosten', 'berechnung', 'ausgabe', 'budget', 'geplant', 'preis'
                ]):
                    budget_columns.append(col)
            
            if len(budget_columns) >= 2:  # Mindestens 2 Budget-relevante Spalten
                print(f"Budget-relevante Spalten gefunden: {budget_columns}")
                
                # Nur relevante Spalten behalten
                df_budget = df[budget_columns].copy()
                
                # Leere Zeilen entfernen
                df_budget = df_budget.dropna(how='all')
                
                # Zeilen mit mindestens einer Kategorie und einem numerischen Wert
                valid_rows = []
                for idx, row in df_budget.iterrows():
                    has_category = False
                    has_numeric = False
                    
                    for col, value in row.items():
                        if pd.notna(value) and str(value).strip():
                            # Kategorie-Check
                            col_lower = str(col).lower()
                            if any(keyword in col_lower for keyword in ['kategorie', 'position', 'artikel', 'beschreibung']):
                                has_category = True
                            
                            # Numerik-Check
                            if any(keyword in col_lower for keyword in ['kosten', 'berechnung', 'ausgabe', 'budget', 'geplant', 'preis']):
                                try:
                                    clean_value = str(value).replace('€', '').replace(',', '.').strip()
                                    if clean_value and float(clean_value) != 0:
                                        has_numeric = True
                                except:
                                    pass
                    
                    if has_category and has_numeric:
                        valid_rows.append(idx)
                
                if valid_rows:
                    df_budget = df_budget.loc[valid_rows].copy()
                    df_budget = self._standardize_hochzeit_budget_columns(df_budget)
                    print(f"Gültige Budget-Zeilen: {len(df_budget)}")
                    return df_budget
            
            return pd.DataFrame()
            
        except Exception as e:
            print(f"Direkter Import fehlgeschlagen: {e}")
            return pd.DataFrame()
    
    def _extended_budget_search(self, file_path: str, sheet_names: list) -> pd.DataFrame:
        """Erweiterte Suche nach Budget-Daten in allen Arbeitsblättern"""
        try:
            budget_df = pd.DataFrame()
            
            for sheet_name in sheet_names:
                try:
                    # Arbeitsblatt roh einlesen ohne Header
                    df_raw = pd.read_excel(file_path, sheet_name=sheet_name, header=None)
                    
                    # Nach Zeilen mit "Berechnung", "Kosten", "Budget" etc. suchen
                    for idx, row in df_raw.iterrows():
                        row_str = ' '.join([str(cell).lower() for cell in row if pd.notna(cell)])
                        
                        if any(keyword in row_str for keyword in [
                            'berechnung kosten', 'budget', 'kosten', 'ausgaben', 'preis'
                        ]):
                            print(f"Potenzielle Budget-Zeile {idx} in '{sheet_name}': {row_str[:100]}...")
                            
                            # Versuche ab dieser Zeile zu parsen
                            try:
                                df_from_here = pd.read_excel(file_path, sheet_name=sheet_name, 
                                                           skiprows=idx, nrows=50)
                                
                                if len(df_from_here.columns) >= 2 and len(df_from_here) > 0:
                                    df_from_here = self._standardize_hochzeit_budget_columns(df_from_here)
                                    if not df_from_here.empty:
                                        budget_df = pd.concat([budget_df, df_from_here], ignore_index=True)
                                        print(f"Budget-Daten gefunden ab Zeile {idx}")
                                        break
                            except:
                                continue
                    
                    if not budget_df.empty:
                        break
                        
                except Exception as e:
                    continue
            
            return budget_df
            
        except Exception as e:
            print(f"Erweiterte Suche fehlgeschlagen: {e}")
            return pd.DataFrame()
    
    def _extract_budget_from_sheet(self, df_raw: pd.DataFrame, sheet_name: str) -> pd.DataFrame:
        """Extrahiert Budget-Daten aus einem Arbeitsblatt"""
        try:
            # Nach Header-Zeile mit 'Berechnung Kosten' oder Budget-relevanten Spalten suchen
            header_row = None
            berechnung_kosten_col = None
            
            for idx, row in df_raw.iterrows():
                row_values = [str(cell).strip().lower() for cell in row if pd.notna(cell)]
                
                # Suche nach 'Berechnung Kosten' oder ähnlichen Budget-Spalten
                for col_idx, cell_value in enumerate(row):
                    if pd.notna(cell_value):
                        cell_str = str(cell_value).strip().lower()
                        if 'berechnung' in cell_str and 'kosten' in cell_str:
                            header_row = idx
                            berechnung_kosten_col = col_idx
                            print(f"'Berechnung Kosten' Spalte in Zeile {idx}, Spalte {col_idx} gefunden")
                            break
                
                if header_row is not None:
                    break
            
            # Wenn keine 'Berechnung Kosten' gefunden, nach anderen Budget-Spalten suchen
            if header_row is None:
                for idx, row in df_raw.iterrows():
                    row_values = [str(cell).strip().lower() for cell in row if pd.notna(cell)]
                    budget_keywords = ['kategorie', 'position', 'geplant', 'budget', 'kosten', 'ausgabe']
                    
                    if any(keyword in ' '.join(row_values) for keyword in budget_keywords):
                        if len([val for val in row_values if val]) >= 2:  # Mindestens 2 Spalten mit Inhalt
                            header_row = idx
                            print(f"Budget-relevante Zeile in Zeile {idx} gefunden")
                            break
            
            if header_row is None:
                return pd.DataFrame()
            
            # Header extrahieren
            headers = df_raw.iloc[header_row].tolist()
            
            # Daten ab der nächsten Zeile extrahieren
            data_start = header_row + 1
            df_data = df_raw.iloc[data_start:].copy()
            df_data.columns = headers
            
            # Leere Zeilen entfernen
            df_data = df_data.dropna(how='all')
            
            # Nur Zeilen mit relevanten Budget-Daten behalten
            # Mindestens eine Kategorie/Position und ein numerischer Wert
            mask = pd.Series([False] * len(df_data))
            
            for idx, row in df_data.iterrows():
                has_category = False
                has_numeric = False
                
                for col, value in row.items():
                    if pd.notna(value) and str(value).strip():
                        # Prüfe auf Kategorie-Spalte
                        if any(keyword in str(col).lower() for keyword in ['kategorie', 'position', 'artikel', 'item']):
                            has_category = True
                        
                        # Prüfe auf numerische Werte (Kosten/Budget)
                        try:
                            # Entferne Eurozeichen und Kommas für Prüfung
                            clean_value = str(value).replace('€', '').replace(',', '.').strip()
                            if clean_value and float(clean_value) > 0:
                                has_numeric = True
                        except:
                            pass
                
                if has_category and has_numeric:
                    mask[idx] = True
            
            df_filtered = df_data[mask].copy()
            
            if df_filtered.empty:
                return pd.DataFrame()
            
            print(f"Extrahierte Budget-Daten aus '{sheet_name}': {len(df_filtered)} Einträge")
            return df_filtered
            
        except Exception as e:
            print(f"Fehler beim Extrahieren der Budget-Daten aus '{sheet_name}': {e}")
            return pd.DataFrame()
    
    def _standardize_hochzeit_budget_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Standardisiert Budget-Spalten speziell für Hochzeit.xlsx"""
        # Erweiterte Spalten-Zuordnung für Hochzeit.xlsx
        column_mapping = {
            'kategorie': 'Kategorie',
            'position': 'Kategorie', 
            'artikel': 'Kategorie',
            'item': 'Kategorie',
            'beschreibung': 'Kategorie',
            'geplant': 'Geplant',
            'budget': 'Geplant',
            'plan': 'Geplant',
            'kosten geplant': 'Geplant',
            'ausgegeben': 'Ausgegeben',
            'kosten': 'Ausgegeben',
            'ist': 'Ausgegeben',
            'berechnung kosten': 'Ausgegeben',
            'berechnung_kosten': 'Ausgegeben',
            'actual': 'Ausgegeben',
            'tatsächlich': 'Ausgegeben',
            'differenz': 'Differenz',
            'diff': 'Differenz',
            'abweichung': 'Differenz'
        }
        
        # Spalten normalisieren
        df.columns = df.columns.astype(str).str.lower().str.strip()
        df = df.rename(columns=column_mapping)
        
        # Sicherstellen, dass Kategorie-Spalte existiert
        if 'Kategorie' not in df.columns:
            # Erste nicht-numerische Spalte als Kategorie verwenden
            for col in df.columns:
                if not df[col].dtype.kind in 'biufc':  # nicht numerisch
                    df['Kategorie'] = df[col]
                    break
            
            # Fallback: Index als Kategorie
            if 'Kategorie' not in df.columns:
                df['Kategorie'] = 'Position ' + (df.index + 1).astype(str)
        
        # Numerische Spalten konvertieren und bereinigen
        numeric_columns = ['Geplant', 'Ausgegeben']
        for col in numeric_columns:
            if col in df.columns:
                # Verschiedene Formate bereinigen
                df[col] = df[col].astype(str)
                df[col] = df[col].str.replace('€', '', regex=False)
                df[col] = df[col].str.replace('EUR', '', regex=False)
                df[col] = df[col].str.replace(',', '.', regex=False)
                df[col] = df[col].str.replace(' ', '', regex=False)
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
        
        # Geplant-Spalte aus anderen Quellen ableiten falls nicht vorhanden
        if 'Geplant' not in df.columns:
            # Suche nach anderen Budget-Spalten
            for col in df.columns:
                col_lower = col.lower()
                if any(keyword in col_lower for keyword in ['budget', 'plan', 'geplant', 'vorgesehen']):
                    df['Geplant'] = pd.to_numeric(df[col], errors='coerce').fillna(0)
                    break
            
            # Fallback: Ausgegeben als Geplant verwenden
            if 'Geplant' not in df.columns and 'Ausgegeben' in df.columns:
                df['Geplant'] = df['Ausgegeben']
        
        # Ausgegeben-Spalte sicherstellen
        if 'Ausgegeben' not in df.columns:
            df['Ausgegeben'] = 0
        
        # Differenz berechnen
        if 'Geplant' in df.columns and 'Ausgegeben' in df.columns:
            df['Differenz'] = df['Geplant'] - df['Ausgegeben']
        
        # Leere Kategorien entfernen
        df = df[df['Kategorie'].notna()]
        df = df[df['Kategorie'].astype(str).str.strip() != '']
        
        print(f"Standardisierte Budget-Daten: {len(df)} Einträge mit Spalten: {list(df.columns)}")
        
        return df
            
    def _standardize_budget_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Standardisiert Budget-Spalten"""
        column_mapping = {
            'kategorie': 'Kategorie',
            'position': 'Kategorie',
            'geplant': 'Geplant',
            'budget': 'Geplant',
            'plan': 'Geplant',
            'ausgegeben': 'Ausgegeben',
            'kosten': 'Ausgegeben',
            'ist': 'Ausgegeben',
            'berechnung kosten': 'Ausgegeben',  # Neue Spalte hinzugefügt
            'berechnung_kosten': 'Ausgegeben',
            'differenz': 'Differenz',
            'diff': 'Differenz'
        }
        
        df.columns = df.columns.str.lower().str.strip()
        df = df.rename(columns=column_mapping)
        
        # Numerische Spalten konvertieren
        numeric_columns = ['Geplant', 'Ausgegeben']
        for col in numeric_columns:
            if col in df.columns:
                # Eurozeichen und Kommas entfernen
                df[col] = df[col].astype(str).str.replace('€', '').str.replace(',', '.')
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
        
        # Differenz berechnen
        if 'Geplant' in df.columns and 'Ausgegeben' in df.columns:
            df['Differenz'] = df['Geplant'] - df['Ausgegeben']
            
        return df
        
    def _validate_budget_data(self, df: pd.DataFrame) -> bool:
        """Validiert Budget-Daten"""
        return not df.empty and 'Kategorie' in df.columns
        
    def add_guest(self, guest_data: Dict) -> bool:
        """Fügt neuen Gast hinzu"""
        try:
            # Neuen Gast als DataFrame erstellen
            new_guest = pd.DataFrame([guest_data])
            
            # Zur Gästeliste hinzufügen
            self.gaesteliste_df = pd.concat([self.gaesteliste_df, new_guest], ignore_index=True)
            
            # Speichern
            self.save_gaesteliste()
            
            # Automatische Budget-Aktualisierung falls aktiviert
            self._auto_update_guest_budget()
            
            # GUI-Update triggern
            self._trigger_gui_update()
            
            return True
            
        except Exception as e:
            print(f"Fehler beim Hinzufügen des Gastes: {e}")
            return False
            
    def update_guest(self, index: int, guest_data: Dict) -> bool:
        """Aktualisiert Gast-Daten"""
        try:
            if 0 <= index < len(self.gaesteliste_df):
                for key, value in guest_data.items():
                    # Datentyp-kompatible Zuweisung
                    if key in self.gaesteliste_df.columns:
                        # Prüfe aktuellen Datentyp der Spalte
                        current_dtype = self.gaesteliste_df[key].dtype
                        
                        # Konvertiere Wert entsprechend
                        if current_dtype == 'float64' and isinstance(value, str):
                            # Versuche String zu float zu konvertieren, falls möglich
                            try:
                                if value.lower() in ['ja', 'yes', 'x', '1', 'true']:
                                    converted_value = 1.0
                                elif value.lower() in ['nein', 'no', '0', 'false']:
                                    converted_value = 0.0
                                else:
                                    converted_value = float(value)
                                self.gaesteliste_df.at[index, key] = converted_value
                            except (ValueError, TypeError):
                                # Falls Konvertierung fehlschlägt, Spalte zu object konvertieren
                                self.gaesteliste_df[key] = self.gaesteliste_df[key].astype('object')
                                self.gaesteliste_df.at[index, key] = value
                        else:
                            self.gaesteliste_df.at[index, key] = value
                    else:
                        # Neue Spalte - einfach zuweisen
                        self.gaesteliste_df.at[index, key] = value
                
                self.save_gaesteliste()
                
                # Automatische Budget-Aktualisierung falls aktiviert
                self._auto_update_guest_budget()
                
                # GUI-Update triggern
                self._trigger_gui_update()
                
                return True
            return False
            
        except Exception as e:
            print(f"Fehler beim Aktualisieren des Gastes: {e}")
            return False
            
    def delete_guest(self, index: int) -> bool:
        """Löscht Gast"""
        try:
            if 0 <= index < len(self.gaesteliste_df):
                self.gaesteliste_df = self.gaesteliste_df.drop(index).reset_index(drop=True)
                self.save_gaesteliste()
                
                # Automatische Budget-Aktualisierung falls aktiviert
                self._auto_update_guest_budget()
                
                # GUI-Update triggern
                self._trigger_gui_update()
                
                return True
            return False
            
        except Exception as e:
            print(f"Fehler beim Löschen des Gastes: {e}")
            return False
            
    def get_guest_statistics(self) -> Dict:
        """Berechnet erweiterte Gäste-Statistiken"""
        if self.gaesteliste_df.empty:
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
            
        stats = {
            'gesamt': len(self.gaesteliste_df),
            'zusagen': len(self.gaesteliste_df[self.gaesteliste_df['Status'] == 'Zugesagt']),
            'absagen': len(self.gaesteliste_df[self.gaesteliste_df['Status'] == 'Abgesagt']),
            'offen': len(self.gaesteliste_df[self.gaesteliste_df['Status'] == 'Offen'])
        }
        
        # Gesamtpersonenzahl berechnen
        if 'Anzahl_Personen' in self.gaesteliste_df.columns:
            anzahl_personen = pd.to_numeric(self.gaesteliste_df['Anzahl_Personen'], errors='coerce').fillna(1)
            stats['personen_gesamt'] = int(anzahl_personen.sum())
            
            # Personen mit Zusage
            zusagen_df = self.gaesteliste_df[self.gaesteliste_df['Status'] == 'Zugesagt']
            if not zusagen_df.empty:
                zusagen_personen = pd.to_numeric(zusagen_df['Anzahl_Personen'], errors='coerce').fillna(1)
                stats['personen_zusagen'] = int(zusagen_personen.sum())
            else:
                stats['personen_zusagen'] = 0
            
            # Personen mit Absage
            absagen_df = self.gaesteliste_df[self.gaesteliste_df['Status'] == 'Abgesagt']
            if not absagen_df.empty:
                absagen_personen = pd.to_numeric(absagen_df['Anzahl_Personen'], errors='coerce').fillna(1)
                stats['personen_absagen'] = int(absagen_personen.sum())
            else:
                stats['personen_absagen'] = 0
            
            # Personen mit offenem Status
            offen_df = self.gaesteliste_df[self.gaesteliste_df['Status'] == 'Offen']
            if not offen_df.empty:
                offen_personen = pd.to_numeric(offen_df['Anzahl_Personen'], errors='coerce').fillna(1)
                stats['personen_offen'] = int(offen_personen.sum())
            else:
                stats['personen_offen'] = 0
        else:
            stats['personen_gesamt'] = stats['gesamt']
            stats['personen_zusagen'] = stats['zusagen']
            stats['personen_absagen'] = stats['absagen']
            stats['personen_offen'] = stats['offen']
        
        # Seiten-Verteilung
        if 'Seite' in self.gaesteliste_df.columns:
            stats['kathe_seite'] = len(self.gaesteliste_df[self.gaesteliste_df['Seite'].str.contains('Käthe', case=False, na=False)])
            stats['pascal_seite'] = len(self.gaesteliste_df[self.gaesteliste_df['Seite'].str.contains('Pascal', case=False, na=False)])
            stats['gemeinsam'] = len(self.gaesteliste_df[self.gaesteliste_df['Seite'].str.contains('Gemeinsam', case=False, na=False)])
        else:
            stats['kathe_seite'] = stats['pascal_seite'] = stats['gemeinsam'] = 0
        
        # Antwortrate (Zusagen + Absagen / Gesamt)
        antworten = stats['zusagen'] + stats['absagen']
        stats['antwort_rate'] = (antworten / stats['gesamt'] * 100) if stats['gesamt'] > 0 else 0
        
        # Zusagerate (Zusagen / Antworten)
        stats['zusage_rate'] = (stats['zusagen'] / antworten * 100) if antworten > 0 else 0
        
        # Event-spezifische Statistiken hinzufügen
        def safe_int(value):
            """Konvertiert einen Wert sicher zu int"""
            try:
                if value is None or value == '':
                    return 0
                return int(float(str(value)))
            except (ValueError, TypeError):
                return 0
        
        # Zähle Teilnehmer für verschiedene Events
        weisser_saal_count = 0
        essen_count = 0
        party_count = 0
        kinder_count = 0
        
        for _, guest in self.gaesteliste_df.iterrows():
            # Nur Gäste mit Zusage zählen
            if guest.get('Status') == 'Zugesagt':
                weisser_saal_count += safe_int(guest.get('Weisser_Saal', 0))
                essen_count += safe_int(guest.get('Anzahl_Essen', 0))
                party_count += safe_int(guest.get('Anzahl_Party', 0))
                kinder_count += safe_int(guest.get('Kind', 0))
        
        # Hierarchische Logik anwenden: Weißer Saal → Essen → Party
        final_essen = max(essen_count, weisser_saal_count)
        final_party = max(party_count, final_essen)
        
        stats.update({
            'weisser_saal': weisser_saal_count,
            'essen': final_essen,
            'party': final_party,
            'kinder': kinder_count
        })
            
        return stats
        
    def get_budget_statistics(self) -> Dict:
        """Berechnet erweiterte Budget-Statistiken"""
        if self.budget_df.empty:
            return {
                'geplant_gesamt': 0,
                'ausgegeben_gesamt': 0,
                'verbleibendes_budget': 0,
                'ausgaben_prozent': 0,
                'teuerste_kategorie': 'Keine Daten',
                'anzahl_kategorien': 0,
                'durchschnitt_pro_kategorie': 0
            }
            
        geplant = self.budget_df['Geplant'].sum() if 'Geplant' in self.budget_df.columns else 0
        ausgegeben = self.budget_df['Ausgegeben'].sum() if 'Ausgegeben' in self.budget_df.columns else 0
        
        stats = {
            'geplant_gesamt': geplant,
            'ausgegeben_gesamt': ausgegeben,
            'verbleibendes_budget': geplant - ausgegeben,
            'ausgaben_prozent': (ausgegeben / geplant * 100) if geplant > 0 else 0
        }
        
        # Erweiterte Statistiken
        if not self.budget_df.empty:
            stats['anzahl_kategorien'] = len(self.budget_df)
            stats['durchschnitt_pro_kategorie'] = ausgegeben / len(self.budget_df) if len(self.budget_df) > 0 else 0
            
            # Teuerste Kategorie (nach Ausgaben)
            if 'Ausgegeben' in self.budget_df.columns and 'Kategorie' in self.budget_df.columns:
                teuerste_idx = self.budget_df['Ausgegeben'].idxmax()
                if pd.notna(teuerste_idx):
                    stats['teuerste_kategorie'] = str(self.budget_df.loc[teuerste_idx, 'Kategorie'])
                else:
                    stats['teuerste_kategorie'] = 'Keine Daten'
            else:
                stats['teuerste_kategorie'] = 'Keine Daten'
        else:
            stats['teuerste_kategorie'] = 'Keine Daten'
            stats['anzahl_kategorien'] = 0
            stats['durchschnitt_pro_kategorie'] = 0
        
        return stats
        
    def search_guests(self, search_term: str) -> pd.DataFrame:
        """Sucht in der Gästeliste"""
        if self.gaesteliste_df.empty or not search_term:
            return self.gaesteliste_df
            
        # In allen Textspalten suchen
        text_columns = ['Vorname', 'Nachname', 'Kategorie', 'Kontakt']
        mask = pd.Series([False] * len(self.gaesteliste_df))
        
        for col in text_columns:
            if col in self.gaesteliste_df.columns:
                mask |= self.gaesteliste_df[col].astype(str).str.contains(
                    search_term, case=False, na=False
                )
                
        return self.gaesteliste_df[mask]
    
    def search_guests_in_df(self, df: pd.DataFrame, search_term: str) -> pd.DataFrame:
        """Sucht in einem gegebenen DataFrame"""
        if df.empty or not search_term:
            return df
            
        # In allen Textspalten suchen
        text_columns = ['Vorname', 'Nachname', 'Kategorie', 'Kontakt', 'Seite']
        mask = pd.Series([False] * len(df))
        
        for col in text_columns:
            if col in df.columns:
                mask |= df[col].astype(str).str.contains(
                    search_term, case=False, na=False
                )
                
        return df[mask]
    
    def get_available_categories(self) -> List[str]:
        """Gibt eine Liste aller verfügbaren Kategorien zurück"""
        if self.gaesteliste_df.empty or 'Kategorie' not in self.gaesteliste_df.columns:
            return ['Familie', 'Freunde', 'Kollegen', 'Verwandte']
        
        # Nur String-Werte und keine NaN-Werte berücksichtigen
        categories = self.gaesteliste_df['Kategorie'].dropna().astype(str).unique().tolist()
        # Nur nicht-leere Kategorien behalten
        categories = [cat for cat in categories if cat.strip() and cat.lower() not in ['nan', 'none', '']]
        
        # Standard-Kategorien hinzufügen falls nicht vorhanden
        default_categories = ['Familie', 'Freunde', 'Kollegen', 'Verwandte']
        for cat in default_categories:
            if cat not in categories:
                categories.append(cat)
        
        # Sortieren, aber nur Strings
        try:
            return sorted(categories)
        except TypeError:
            # Fallback: Nur die Strings behalten
            string_categories = [str(cat) for cat in categories if isinstance(cat, str)]
            return sorted(string_categories)
        
    def export_to_excel(self, file_path: str) -> bool:
        """Exportiert alle Daten in Excel-Datei"""
        try:
            with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
                if not self.gaesteliste_df.empty:
                    self.gaesteliste_df.to_excel(writer, sheet_name='Gästeliste', index=False)
                
                if not self.budget_df.empty:
                    self.budget_df.to_excel(writer, sheet_name='Budget', index=False)
                    
                if not self.zeitplan_df.empty:
                    self.zeitplan_df.to_excel(writer, sheet_name='Zeitplan', index=False)
                    
            return True
            
        except Exception as e:
            print(f"Fehler beim Excel-Export: {e}")
            return False
            
    def save_gaesteliste(self):
        """Speichert Gästeliste als JSON"""
        try:
            if not self.gaesteliste_df.empty:
                self.gaesteliste_df.to_json(self.gaesteliste_file, orient='records', indent=2)
                return True
            else:
                print("Warnung: Leere Gästeliste nicht gespeichert")
                return False
        except Exception as e:
            print(f"Fehler beim Speichern der Gästeliste: {e}")
            return False
            
    def save_budget(self):
        """Speichert Budget als JSON"""
        try:
            if not self.budget_df.empty:
                self.budget_df.to_json(self.budget_file, orient='records', indent=2)
        except Exception as e:
            print(f"Fehler beim Speichern des Budgets: {e}")
            
    def save_zeitplan(self):
        """Speichert Zeitplan als JSON"""
        try:
            if not self.zeitplan_df.empty:
                self.zeitplan_df.to_json(self.zeitplan_file, orient='records', indent=2)
        except Exception as e:
            print(f"Fehler beim Speichern des Zeitplans: {e}")
            
    def load_all_data(self):
        """Lädt alle gespeicherten Daten"""
        self.load_gaesteliste()
        self.load_budget()
        self.load_zeitplan()
        self.load_settings()
        
    def load_gaesteliste(self):
        """Lädt Gästeliste aus JSON"""
        try:
            if os.path.exists(self.gaesteliste_file):
                self.gaesteliste_df = pd.read_json(self.gaesteliste_file, orient='records')
        except Exception as e:
            print(f"Fehler beim Laden der Gästeliste: {e}")
            self.gaesteliste_df = pd.DataFrame()
            
    def load_budget(self):
        """Lädt Budget aus JSON"""
        try:
            if os.path.exists(self.budget_file):
                self.budget_df = pd.read_json(self.budget_file, orient='records')
        except Exception as e:
            print(f"Fehler beim Laden des Budgets: {e}")
            self.budget_df = pd.DataFrame()
            
    def load_zeitplan(self):
        """Lädt Zeitplan aus JSON"""
        try:
            if os.path.exists(self.zeitplan_file):
                self.zeitplan_df = pd.read_json(self.zeitplan_file, orient='records')
                # Nach Uhrzeit sortieren beim Laden
                if not self.zeitplan_df.empty:
                    self.zeitplan_df = self.zeitplan_df.sort_values('Uhrzeit').reset_index(drop=True)
        except Exception as e:
            print(f"Fehler beim Laden des Zeitplans: {e}")
            self.zeitplan_df = pd.DataFrame()
    
    def load_settings(self):
        """Lädt Einstellungen aus JSON"""
        try:
            if os.path.exists(self.settings_file):
                with open(self.settings_file, 'r', encoding='utf-8') as f:
                    self.settings = json.load(f)
            else:
                # Standard-Einstellungen
                self.settings = {
                    'hochzeitsdatum': '2025-09-01',  # Standard-Datum
                    'hochzeitszeit': '15:00',
                    'brautpaar_namen': 'Käthe & Pascal',
                    'hochzeitsort': {
                        'name': 'Beispiel Hochzeitslocation',
                        'adresse': 'Musterstraße 123, 12345 Musterstadt',
                        'beschreibung': 'Wunderschöne Location für unsere Traumhochzeit'
                    }
                }
                self.save_settings()
        except Exception as e:
            print(f"Fehler beim Laden der Einstellungen: {e}")
            self.settings = {
                'hochzeitsdatum': '2025-09-01',
                'hochzeitszeit': '15:00', 
                'brautpaar_namen': 'Käthe & Pascal',
                'hochzeitsort': {
                    'name': 'Beispiel Hochzeitslocation',
                    'adresse': 'Musterstraße 123, 12345 Musterstadt',
                    'beschreibung': 'Wunderschöne Location für unsere Traumhochzeit'
                }
            }
    
    def save_settings(self):
        """Speichert Einstellungen in JSON"""
        try:
            with open(self.settings_file, 'w', encoding='utf-8') as f:
                json.dump(self.settings, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Fehler beim Speichern der Einstellungen: {e}")
    
    def get_settings(self) -> dict:
        """Gibt alle Einstellungen zurück"""
        return self.settings.copy()
    
    def set_wedding_date(self, date_str: str, time_str: str = "15:00") -> bool:
        """Setzt das Hochzeitsdatum"""
        try:
            # Datum validieren
            datetime.strptime(date_str, '%Y-%m-%d')
            datetime.strptime(time_str, '%H:%M')
            
            self.settings['hochzeitsdatum'] = date_str
            self.settings['hochzeitszeit'] = time_str
            self.save_settings()
            
            # GUI-Update triggern
            self._trigger_gui_update()
            
            return True
        except ValueError as e:
            print(f"Ungültiges Datum/Zeit-Format: {e}")
            return False
    
    def set_wedding_location(self, name: str, adresse: str, beschreibung: str = "") -> bool:
        """Setzt die Hochzeitslocation"""
        try:
            self.settings['hochzeitsort'] = {
                'name': name,
                'adresse': adresse,
                'beschreibung': beschreibung
            }
            self.save_settings()
            
            # GUI-Update triggern
            self._trigger_gui_update()
            
            return True
        except Exception as e:
            print(f"Fehler beim Setzen der Location: {e}")
            return False
    
    def get_wedding_location(self) -> dict:
        """Gibt die Hochzeitslocation zurück"""
        return self.settings.get('hochzeitsort', {
            'name': 'Hochzeitslocation',
            'adresse': '',
            'beschreibung': ''
        })

    def generate_guest_login_code(self, guest_index: int = None, vorname: str = "", nachname: str = "") -> str:
        """
        Generiert einen eindeutigen Login-Code für einen Gast
        Format: VORNAME + NACHNAME + 4-stellige Nummer (ohne Sonderzeichen)
        """
        import string
        import random
        
        # Namen bereinigen (nur Buchstaben, keine Umlaute/Sonderzeichen)
        def clean_name(name):
            # Sicherstellen, dass name ein String ist
            if pd.isna(name) or name is None:
                return ""
            name = str(name)
            
            # Umlaute ersetzen
            replacements = {
                'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss',
                'Ä': 'Ae', 'Ö': 'Oe', 'Ü': 'Ue'
            }
            for old, new in replacements.items():
                name = name.replace(old, new)
            # Nur Buchstaben und Zahlen behalten
            return ''.join(c for c in name if c.isalnum())
        
        # Namen aus Gästeliste oder Parameter verwenden
        if guest_index is not None and not self.gaesteliste_df.empty:
            guest = self.gaesteliste_df.iloc[guest_index]
            vorname = clean_name(str(guest.get('Vorname', '')))
            nachname = clean_name(str(guest.get('Nachname', '')))
        else:
            vorname = clean_name(vorname)
            nachname = clean_name(nachname)
        
        # 4-stellige Zufallszahl
        random_num = f"{random.randint(1000, 9999)}"
        
        # Login-Code zusammensetzen (max 15 Zeichen für bessere Handhabung)
        login_code = f"{vorname[:6]}{nachname[:5]}{random_num}"
        
        # Prüfen ob Code bereits existiert
        existing_codes = []
        if not self.gaesteliste_df.empty and 'guest_code' in self.gaesteliste_df.columns:
            existing_codes = self.gaesteliste_df['guest_code'].dropna().tolist()
        
        # Falls Code bereits existiert, neue Nummer generieren
        counter = 0
        original_code = login_code
        while login_code in existing_codes and counter < 100:
            counter += 1
            new_num = f"{random.randint(1000, 9999)}"
            login_code = f"{vorname[:6]}{nachname[:5]}{new_num}"
        
        return login_code.upper()
    
    def generate_guest_password(self, guest_index: int = None, nachname: str = "") -> str:
        """
        Generiert ein sicheres Passwort für einen Gast
        Format: Nachname + 4-stellige Zahl (ohne Sonderzeichen)
        """
        import random
        
        def clean_name(name):
            # Sicherstellen, dass name ein String ist
            if pd.isna(name) or name is None:
                return ""
            name = str(name)
            
            # Umlaute ersetzen
            replacements = {
                'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss',
                'Ä': 'Ae', 'Ö': 'Oe', 'Ü': 'Ue'
            }
            for old, new in replacements.items():
                name = name.replace(old, new)
            # Nur Buchstaben und Zahlen behalten
            return ''.join(c for c in name if c.isalnum())
        
        # Nachname aus Gästeliste oder Parameter verwenden
        if guest_index is not None and not self.gaesteliste_df.empty:
            guest = self.gaesteliste_df.iloc[guest_index]
            nachname = clean_name(str(guest.get('Nachname', '')))
        else:
            nachname = clean_name(nachname)
        
        # 4-stellige Zufallszahl
        random_num = f"{random.randint(1000, 9999)}"
        
        # Passwort zusammensetzen
        password = f"{nachname[:8]}{random_num}"
        
        return password.lower()
    
    def generate_all_guest_credentials(self) -> bool:
        """
        Generiert Login-Codes und Passwörter für alle Gäste ohne credentials
        """
        try:
            if self.gaesteliste_df.empty:
                print("Keine Gäste in der Liste")
                return False
            
            # Spalten für Login-Daten hinzufügen falls nicht vorhanden
            if 'guest_code' not in self.gaesteliste_df.columns:
                self.gaesteliste_df['guest_code'] = ''
            if 'guest_password' not in self.gaesteliste_df.columns:
                self.gaesteliste_df['guest_password'] = ''
            
            updated_count = 0
            
            for index, guest in self.gaesteliste_df.iterrows():
                # Nur für Gäste ohne Login-Code
                if pd.isna(guest.get('guest_code')) or guest.get('guest_code') == '':
                    # Login-Code generieren
                    login_code = self.generate_guest_login_code(index)
                    self.gaesteliste_df.loc[index, 'guest_code'] = login_code
                    
                    # Passwort generieren
                    password = self.generate_guest_password(index)
                    self.gaesteliste_df.loc[index, 'guest_password'] = password
                    
                    updated_count += 1
                    print(f"Credentials generiert für: {guest.get('Vorname')} {guest.get('Nachname')} - Code: {login_code}, Passwort: {password}")
            
            if updated_count > 0:
                self.save_gaesteliste()
                print(f"✅ Login-Credentials für {updated_count} Gäste generiert")
                return True
            else:
                print("Alle Gäste haben bereits Login-Credentials")
                return True
                
        except Exception as e:
            print(f"Fehler beim Generieren der Gast-Credentials: {e}")
            return False
    
    def get_guest_credentials_list(self) -> list:
        """
        Gibt eine Liste aller Gast-Credentials zurück für Übersicht/Export
        """
        try:
            if self.gaesteliste_df.empty:
                return []
            
            credentials_list = []
            
            for index, guest in self.gaesteliste_df.iterrows():
                credentials_list.append({
                    'vorname': guest.get('Vorname', ''),
                    'nachname': guest.get('Nachname', ''),
                    'login_code': guest.get('guest_code', ''),
                    'password': guest.get('guest_password', ''),
                    'email': guest.get('Email', ''),
                    'status': guest.get('Status', 'Offen')
                })
            
            return credentials_list
            
        except Exception as e:
            print(f"Fehler beim Abrufen der Credentials-Liste: {e}")
            return []

    def get_wedding_date(self) -> tuple:
        """Gibt Hochzeitsdatum und -zeit zurück"""
        date_str = self.settings.get('hochzeitsdatum', '2025-09-01')
        time_str = self.settings.get('hochzeitszeit', '15:00')
        return date_str, time_str
    
    def get_days_until_wedding(self) -> int:
        """Berechnet Tage bis zur Hochzeit"""
        try:
            date_str, time_str = self.get_wedding_date()
            wedding_datetime = datetime.strptime(f"{date_str} {time_str}", '%Y-%m-%d %H:%M')
            now = datetime.now()
            delta = wedding_datetime - now
            return delta.days
        except:
            return 0
            
    def create_backup(self, backup_dir: str = "backup") -> bool:
        """Erstellt Backup aller Daten"""
        try:
            os.makedirs(backup_dir, exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            
            backup_file = os.path.join(backup_dir, f"hochzeit_backup_{timestamp}.xlsx")
            return self.export_to_excel(backup_file)
            
        except Exception as e:
            print(f"Fehler beim Erstellen des Backups: {e}")
            return False

    def update_guest_event_counts(self, guest_index: int, standesamt_count: int = None, 
                                 essen_count: int = None, party_count: int = None) -> bool:
        """
        Aktualisiert individuelle Personenzahlen für Events eines Gastes
        
        Args:
            guest_index: Index des Gastes in der Liste
            standesamt_count: Anzahl Personen für Standesamt
            essen_count: Anzahl Personen für Essen  
            party_count: Anzahl Personen für Party
            
        Returns:
            True bei Erfolg, False bei Fehler
        """
        try:
            if guest_index < 0 or guest_index >= len(self.gaesteliste_df):
                return False
            
            # Neue Spalten für individuelle Zählungen hinzufügen falls nicht vorhanden
            if 'Anzahl_Standesamt' not in self.gaesteliste_df.columns:
                self.gaesteliste_df['Anzahl_Standesamt'] = self.gaesteliste_df['Anzahl_Personen']
            if 'Anzahl_Essen' not in self.gaesteliste_df.columns:
                self.gaesteliste_df['Anzahl_Essen'] = self.gaesteliste_df['Anzahl_Personen']
            if 'Anzahl_Party' not in self.gaesteliste_df.columns:
                self.gaesteliste_df['Anzahl_Party'] = self.gaesteliste_df['Anzahl_Personen']
            
            # Werte aktualisieren
            if standesamt_count is not None:
                self.gaesteliste_df.iloc[guest_index, self.gaesteliste_df.columns.get_loc('Anzahl_Standesamt')] = standesamt_count
            if essen_count is not None:
                self.gaesteliste_df.iloc[guest_index, self.gaesteliste_df.columns.get_loc('Anzahl_Essen')] = essen_count
            if party_count is not None:
                self.gaesteliste_df.iloc[guest_index, self.gaesteliste_df.columns.get_loc('Anzahl_Party')] = party_count
            
            self.save_gaesteliste()
            
            # Automatische Budget-Aktualisierung falls aktiviert
            self._auto_update_guest_budget()
            
            # GUI-Update triggern
            self._trigger_gui_update()
            
            return True
            
        except Exception as e:
            print(f"Fehler beim Aktualisieren der Event-Anzahlen: {e}")
            return False
    
    def get_guest(self, guest_index: int) -> dict:
        """
        Holt Gast-Daten anhand des Index
        
        Args:
            guest_index: Index des Gastes in der Liste
            
        Returns:
            Dictionary mit Gast-Daten
        """
        try:
            if guest_index < 0 or guest_index >= len(self.gaesteliste_df):
                return {}
            
            guest = self.gaesteliste_df.iloc[guest_index]
            return guest.to_dict()
            
        except Exception as e:
            print(f"Fehler beim Abrufen der Gast-Daten: {e}")
            return {}
    
    def get_guest_event_counts(self, guest_index: int) -> dict:
        """
        Holt individuelle Personenzahlen für Events eines Gastes
        
        Args:
            guest_index: Index des Gastes in der Liste
            
        Returns:
            Dictionary mit Anzahlen für jedes Event
        """
        try:
            if guest_index < 0 or guest_index >= len(self.gaesteliste_df):
                return {}
            
            guest = self.gaesteliste_df.iloc[guest_index]
            base_count = guest.get('Anzahl_Personen', 1)
            
            return {
                'gesamt': base_count,
                'standesamt': guest.get('Anzahl_Standesamt', base_count),
                'essen': guest.get('Anzahl_Essen', base_count),
                'party': guest.get('Anzahl_Party', base_count)
            }
            
        except Exception as e:
            print(f"Fehler beim Abrufen der Event-Anzahlen: {e}")
            return {}
    
    def get_guest_event_summary(self) -> dict:
        """
        Erstellt Zusammenfassung der Gäste pro Event mit HIERARCHIE-LOGIK
        - Weißer Saal Gäste sind automatisch auch beim Essen UND Party
        - Essen Gäste sind automatisch auch bei der Party
        - Für Kostenberechnung werden GETRENNTE Zahlen benötigt:
          * standesamt_confirmed = NUR Weißer Saal Gäste
          * essen_confirmed = ALLE Essen-Gäste (Weißer Saal + reine Essen-Gäste)
          * party_confirmed = ALLE Party-Gäste (Weißer Saal + Essen + reine Party-Gäste)
        
        Returns:
            Dictionary mit Event-Statistiken nach Hierarchie-Logik
        """
        try:
            if self.gaesteliste_df.empty:
                return {
                    'standesamt_confirmed': 0,
                    'standesamt_open': 0,
                    'essen_confirmed': 0,
                    'essen_open': 0,
                    'party_confirmed': 0,
                    'party_open': 0,
                    'zusagen_gesamt': 0,
                    'offen_gesamt': 0,
                    'absagen_gesamt': 0,
                    # Legacy-Keys für Rückwärtskompatibilität
                    'standesamt_gaeste': 0,
                    'standesamt_gaeste_offen': 0,
                    'essen_gaeste': 0,
                    'essen_gaeste_offen': 0,
                    'party_gaeste': 0,
                    'party_gaeste_offen': 0
                }
            
            # Bestätigte Gäste und offene Anfragen getrennt
            confirmed_guests = self.gaesteliste_df[self.gaesteliste_df['Status'] == 'Zugesagt']
            open_guests = self.gaesteliste_df[self.gaesteliste_df['Status'] == 'Offen']
            
            # BESTÄTIGTE GÄSTE mit Hierarchie-Logik
            standesamt_confirmed = 0
            essen_confirmed = 0
            party_confirmed = 0
            
            for _, guest in confirmed_guests.iterrows():
                base_count = guest.get('Anzahl_Personen', 1)
                
                # Event-Teilnahme prüfen
                is_standesamt = str(guest.get('Zum_Standesamt', 'Nein')).lower() in ['ja', 'yes', 'x', '1', 'true']
                is_essen = str(guest.get('Zum_Essen', 'Nein')).lower() in ['ja', 'yes', 'x', '1', 'true']
                is_party = str(guest.get('Zur_Party', 'Nein')).lower() in ['ja', 'yes', 'x', '1', 'true']
                
                # HIERARCHIE-LOGIK anwenden
                if is_standesamt:
                    # Weißer Saal Gäste: zu allen Events
                    standesamt_confirmed += guest.get('Anzahl_Standesamt', base_count)
                    essen_confirmed += guest.get('Anzahl_Essen', base_count)
                    party_confirmed += guest.get('Anzahl_Party', base_count)
                elif is_essen:
                    # Nur-Essen Gäste: zu Essen und Party
                    essen_confirmed += guest.get('Anzahl_Essen', base_count)
                    party_confirmed += guest.get('Anzahl_Party', base_count)
                elif is_party:
                    # Nur-Party Gäste: nur zur Party
                    party_confirmed += guest.get('Anzahl_Party', base_count)
            
            # OFFENE ANFRAGEN mit Hierarchie-Logik
            standesamt_open = 0
            essen_open = 0
            party_open = 0
            
            for _, guest in open_guests.iterrows():
                base_count = guest.get('Anzahl_Personen', 1)
                
                # Event-Teilnahme prüfen
                is_standesamt = str(guest.get('Zum_Standesamt', 'Nein')).lower() in ['ja', 'yes', 'x', '1', 'true']
                is_essen = str(guest.get('Zum_Essen', 'Nein')).lower() in ['ja', 'yes', 'x', '1', 'true']
                is_party = str(guest.get('Zur_Party', 'Nein')).lower() in ['ja', 'yes', 'x', '1', 'true']
                
                # HIERARCHIE-LOGIK anwenden
                if is_standesamt:
                    # Weißer Saal Gäste: zu allen Events
                    standesamt_open += guest.get('Anzahl_Standesamt', base_count)
                    essen_open += guest.get('Anzahl_Essen', base_count)
                    party_open += guest.get('Anzahl_Party', base_count)
                elif is_essen:
                    # Nur-Essen Gäste: zu Essen und Party
                    essen_open += guest.get('Anzahl_Essen', base_count)
                    party_open += guest.get('Anzahl_Party', base_count)
                elif is_party:
                    # Nur-Party Gäste: nur zur Party
                    party_open += guest.get('Anzahl_Party', base_count)
            
            # Gesamtstatistiken
            gesamt_status = self.gaesteliste_df['Status'].value_counts()
            
            return {
                'standesamt_confirmed': standesamt_confirmed,
                'standesamt_open': standesamt_open,
                'essen_confirmed': essen_confirmed,
                'essen_open': essen_open,
                'party_confirmed': party_confirmed,
                'party_open': party_open,
                'zusagen_gesamt': gesamt_status.get('Zusage', 0),
                'offen_gesamt': gesamt_status.get('Offen', 0),
                'absagen_gesamt': gesamt_status.get('Absage', 0),
                # Legacy-Keys für Rückwärtskompatibilität
                'standesamt_gaeste': standesamt_confirmed,
                'standesamt_gaeste_offen': standesamt_open,
                'essen_gaeste': essen_confirmed,
                'essen_gaeste_offen': essen_open,
                'party_gaeste': party_confirmed,
                'party_gaeste_offen': party_open
            }
            
        except Exception as e:
            print(f"Fehler beim Erstellen der Event-Zusammenfassung: {e}")
            return {}

    def calculate_guest_costs_with_individual_counts(self) -> dict:
        """Berechnet Kosten basierend auf individuellen Event-Anzahlen"""
        try:
            summary = self.get_guest_event_summary()
            
            # Kosten berechnen
            standesamt_kosten = summary['standesamt_gaeste'] * self.KOSTEN_STANDESAMT_GETRAENKE
            
            # Essen-Kosten: Getränke für alle + Essen für alle Essen-Gäste
            essen_getraenke_kosten = (summary['essen_gaeste'] - summary['standesamt_gaeste']) * self.KOSTEN_STANDESAMT_GETRAENKE
            essen_kosten = summary['essen_gaeste'] * self.KOSTEN_ESSEN
            
            # Party-Kosten: nur für reine Party-Gäste
            party_kosten = (summary['party_gaeste'] - summary['essen_gaeste']) * self.KOSTEN_PARTY_GETRAENKE
            
            total_kosten = standesamt_kosten + essen_getraenke_kosten + essen_kosten + party_kosten
            
            return {
                'standesamt_gaeste': summary['standesamt_gaeste'],
                'essen_gaeste': summary['essen_gaeste'],
                'party_gaeste': summary['party_gaeste'],
                'standesamt_kosten': standesamt_kosten,
                'essen_getraenke_kosten': essen_getraenke_kosten,
                'essen_kosten': essen_kosten,
                'party_kosten': party_kosten,
                'total_kosten': total_kosten
            }
        
        except Exception as e:
            print(f"Fehler bei Kostenberechnung mit individuellen Zählungen: {e}")
            return {}
    
    def _auto_update_guest_budget(self) -> bool:
        """
        Automatische Budget-Aktualisierung bei Gäste-Änderungen
        Wird nur ausgeführt wenn automatische Aktualisierung aktiviert ist
        
        Returns:
            True bei Erfolg, False wenn deaktiviert oder Fehler
        """
        try:
            # Prüfen ob automatische Aktualisierung aktiviert ist
            auto_update = self.settings.get('auto_update_budget', True)  # Standard: aktiviert
            
            if auto_update and not self.gaesteliste_df.empty:
                success = self.update_guest_budget_automatically()
                
                # GUI-Update triggern falls erfolgreich
                if success:
                    self._trigger_gui_update()
                
                return success
                
            return False  # Deaktiviert oder keine Gäste
            
        except Exception as e:
            print(f"Fehler bei automatischer Budget-Aktualisierung: {e}")
            return False
    
    def set_auto_budget_update(self, enabled: bool) -> bool:
        """
        Aktiviert/Deaktiviert automatische Budget-Aktualisierung
        
        Args:
            enabled: True für automatische Aktualisierung, False zum Deaktivieren
            
        Returns:
            True bei Erfolg
        """
        try:
            self.settings['auto_update_budget'] = enabled
            self.save_settings()
            return True
            
        except Exception as e:
            print(f"Fehler beim Setzen der Auto-Update-Einstellung: {e}")
            return False
    
    def is_auto_budget_update_enabled(self) -> bool:
        """
        Prüft ob automatische Budget-Aktualisierung aktiviert ist
        
        Returns:
            True wenn aktiviert, False wenn deaktiviert
        """
        return self.settings.get('auto_update_budget', True)  # Standard: aktiviert
    
    def set_gui_update_callback(self, callback):
        """
        Setzt den Callback für GUI-Updates
        
        Args:
            callback: Funktion die bei Datenänderungen aufgerufen wird
        """
        self.gui_update_callback = callback
    
    def _trigger_gui_update(self):
        """
        Triggert GUI-Update falls Callback gesetzt ist
        """
        if self.gui_update_callback:
            try:
                print("🔄 GUI-Update wird getriggert...")
                self.gui_update_callback()
                print("✅ GUI-Update erfolgreich ausgeführt")
            except Exception as e:
                print(f"❌ Fehler beim GUI-Update: {e}")
                import traceback
                traceback.print_exc()
        else:
            print("⚠️ Kein GUI-Update-Callback gesetzt")
    


    # Zusätzliche Methoden für Web API
    def lade_budget(self):
        """Lädt Budget und gibt DataFrame zurück"""
        self.load_budget()
        return self.budget_df
    
    def speichere_budget(self, budget_df):
        """Speichert Budget DataFrame"""
        try:
            if budget_df is not None and not budget_df.empty:
                self.budget_df = budget_df
                self.save_budget()
                return True
            else:
                print("Warnung: Leeres Budget-DataFrame übergeben")
                return False
        except Exception as e:
            print(f"Fehler beim Speichern des Budgets: {e}")
            return False
    
    def budget_automatisch_erstellen(self):
        """Erstellt automatisch Budget-Positionen basierend auf Gästeliste"""
        try:
            self.load_gaesteliste()
            
            if self.gaesteliste_df.empty:
                return False
            
            # Anzahl Gäste für verschiedene Events berechnen
            standesamt_count = len(self.gaesteliste_df[self.gaesteliste_df.get('Standesamt', 'Nein') == 'Ja'])
            essen_count = len(self.gaesteliste_df[self.gaesteliste_df.get('Essen', 'Nein') == 'Ja'])
            party_count = len(self.gaesteliste_df[self.gaesteliste_df.get('Party', 'Nein') == 'Ja'])
            
            # Standard Budget-Positionen
            standard_budget = [
                # Standesamt
                {'Kategorie': 'Standesamt', 'Position': 'Getränke', 
                 'Geplante_Kosten': standesamt_count * self.KOSTEN_STANDESAMT_GETRAENKE, 'Tatsaechliche_Kosten': 0},
                {'Kategorie': 'Standesamt', 'Position': 'Trauung Gebühren', 
                 'Geplante_Kosten': 200, 'Tatsaechliche_Kosten': 0},
                
                # Essen
                {'Kategorie': 'Essen', 'Position': 'Catering', 
                 'Geplante_Kosten': essen_count * self.KOSTEN_ESSEN, 'Tatsaechliche_Kosten': 0},
                {'Kategorie': 'Essen', 'Position': 'Location Miete', 
                 'Geplante_Kosten': 500, 'Tatsaechliche_Kosten': 0},
                
                # Party
                {'Kategorie': 'Party', 'Position': 'Getränke', 
                 'Geplante_Kosten': party_count * self.KOSTEN_PARTY_GETRAENKE, 'Tatsaechliche_Kosten': 0},
                {'Kategorie': 'Party', 'Position': 'DJ/Musik', 
                 'Geplante_Kosten': 800, 'Tatsaechliche_Kosten': 0},
                
                # Sonstige
                {'Kategorie': 'Sonstige', 'Position': 'Dekoration', 
                 'Geplante_Kosten': 300, 'Tatsaechliche_Kosten': 0},
                {'Kategorie': 'Sonstige', 'Position': 'Fotograf', 
                 'Geplante_Kosten': 1200, 'Tatsaechliche_Kosten': 0},
                {'Kategorie': 'Sonstige', 'Position': 'Hochzeitskleid', 
                 'Geplante_Kosten': 800, 'Tatsaechliche_Kosten': 0},
                {'Kategorie': 'Sonstige', 'Position': 'Anzug', 
                 'Geplante_Kosten': 400, 'Tatsaechliche_Kosten': 0},
            ]
            
            # Neue Positionen nur hinzufügen, wenn sie noch nicht existieren
            for item in standard_budget:
                existiert = False
                if not self.budget_df.empty:
                    existiert = ((self.budget_df['Kategorie'] == item['Kategorie']) & 
                               (self.budget_df['Position'] == item['Position'])).any()
                
                if not existiert:
                    self.budget_position_hinzufuegen(
                        item['Kategorie'], 
                        item['Position'], 
                        item['Geplante_Kosten'], 
                        item['Tatsaechliche_Kosten']
                    )
            
            return True
            
        except Exception as e:
            print(f"Fehler beim automatischen Erstellen des Budgets: {e}")
            return False
    
    def budget_position_hinzufuegen(self, kategorie, position, geplante_kosten=0, tatsaechliche_kosten=0):
        """Fügt Budget-Position hinzu"""
        try:
            new_item = pd.DataFrame([{
                'Kategorie': kategorie,
                'Position': position,
                'Geplante_Kosten': float(geplante_kosten),
                'Tatsaechliche_Kosten': float(tatsaechliche_kosten)
            }])
            
            if self.budget_df.empty:
                self.budget_df = new_item
            else:
                self.budget_df = pd.concat([self.budget_df, new_item], ignore_index=True)
            
            self.save_budget()
            return True
            
        except Exception as e:
            print(f"Fehler beim Hinzufügen der Budget-Position: {e}")
            return False
    
    def budget_position_aktualisieren(self, index, kategorie, position, geplante_kosten, tatsaechliche_kosten):
        """Aktualisiert Budget-Position"""
        try:
            if 0 <= index < len(self.budget_df):
                self.budget_df.iloc[index] = {
                    'Kategorie': kategorie,
                    'Position': position,
                    'Geplante_Kosten': float(geplante_kosten),
                    'Tatsaechliche_Kosten': float(tatsaechliche_kosten)
                }
                self.save_budget()
                return True
            return False
            
        except Exception as e:
            print(f"Fehler beim Aktualisieren der Budget-Position: {e}")
            return False
    
    def budget_position_loeschen(self, index):
        """Löscht Budget-Position"""
        try:
            if 0 <= index < len(self.budget_df):
                self.budget_df = self.budget_df.drop(index).reset_index(drop=True)
                self.save_budget()
                return True
            return False
            
        except Exception as e:
            print(f"Fehler beim Löschen der Budget-Position: {e}")
            return False

    def load_kosten_config(self):
        """Lädt die Kostenkonfiguration"""
        try:
            config_file = os.path.join(self.data_dir, "kosten_config.json")
            
            # Standardkonfiguration
            default_config = {
                "detailed_costs": {
                    "standesamt": {
                        "Getränke": 4.00,
                        "Snacks": 0.00
                    },
                    "essen": {
                        "Hauptgang": 55.00,
                        "Getränke": 35.00
                    },
                    "party": {
                        "Getränke": 25.00,
                        "Mitternachtssnack": 0.00
                    }
                },
                "fixed_costs": {}
            }
            
            if os.path.exists(config_file):
                with open(config_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            else:
                # Erstelle Standardkonfiguration
                self.save_kosten_config(default_config)
                return default_config
                
        except Exception as e:
            print(f"Fehler beim Laden der Kostenkonfiguration: {e}")
            return {
                "detailed_costs": {
                    "standesamt": {"Getränke": 4.00, "Snacks": 0.00},
                    "essen": {"Hauptgang": 55.00, "Getränke": 35.00},
                    "party": {"Getränke": 25.00, "Mitternachtssnack": 0.00}
                },
                "fixed_costs": {}
            }

    def save_kosten_config(self, config):
        """Speichert die Kostenkonfiguration"""
        try:
            config_file = os.path.join(self.data_dir, "kosten_config.json")
            
            with open(config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            
            return True
            
        except Exception as e:
            print(f"Fehler beim Speichern der Kostenkonfiguration: {e}")
            return False

    def calculate_event_costs_by_logic(self):
        """
        Berechnet Event-Kosten basierend auf der neuen Kostenkonfiguration
        Verwendet vereinfachte Beschreibungen
        """
        try:
            # Lade aktuelle Kostenkonfiguration
            config = self.load_kosten_config()
            detailed_costs = config.get("detailed_costs", {})
            
            # Gäste-Statistiken abrufen
            event_summary = self.get_guest_event_summary()
            
            event_costs = {}
            
            # Standesamt - Gäste die zugesagt haben oder offen sind
            standesamt_gaeste = event_summary.get('standesamt_confirmed', 0) + event_summary.get('standesamt_open', 0)
            if standesamt_gaeste > 0:
                standesamt_config = detailed_costs.get("standesamt", {"Getränke": 4.00, "Snacks": 0.00})
                kosten_pro_person = standesamt_config.get("Getränke", 4.00) + standesamt_config.get("Snacks", 0.00)
                
                event_costs['standesamt'] = {
                    'guest_count': standesamt_gaeste,
                    'cost_per_person': kosten_pro_person,
                    'total_cost': standesamt_gaeste * kosten_pro_person,
                    'display': f"Standesamt - {standesamt_gaeste} Gäste"
                }
            
            # Essen - Gäste die zugesagt haben oder offen sind
            essen_gaeste = event_summary.get('essen_confirmed', 0) + event_summary.get('essen_open', 0)
            if essen_gaeste > 0:
                essen_config = detailed_costs.get("essen", {"Hauptgang": 55.00, "Getränke": 35.00})
                kosten_pro_person = essen_config.get("Hauptgang", 55.00) + essen_config.get("Getränke", 35.00)
                
                event_costs['essen'] = {
                    'guest_count': essen_gaeste,
                    'cost_per_person': kosten_pro_person,
                    'total_cost': essen_gaeste * kosten_pro_person,
                    'display': f"Essen - {essen_gaeste} Gäste"
                }
            
            # Party - Gäste die zugesagt haben oder offen sind
            party_gaeste = event_summary.get('party_confirmed', 0) + event_summary.get('party_open', 0)
            if party_gaeste > 0:
                party_config = detailed_costs.get("party", {"Getränke": 25.00, "Mitternachtssnack": 0.00})
                kosten_pro_person = party_config.get("Getränke", 25.00) + party_config.get("Mitternachtssnack", 0.00)
                
                event_costs['party'] = {
                    'guest_count': party_gaeste,
                    'cost_per_person': kosten_pro_person,
                    'total_cost': party_gaeste * kosten_pro_person,
                    'display': f"Party - {party_gaeste} Gäste"
                }
            
            return event_costs
            
        except Exception as e:
            print(f"Fehler bei der Event-Kostenberechnung: {e}")
            return {}


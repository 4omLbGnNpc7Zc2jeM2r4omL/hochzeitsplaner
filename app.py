#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Hochzeitsplaner Web-Anwendung - Standalone Version
"""

import sys
import os
import socket
import logging
import json
import tempfile
import zipfile
from flask import Flask, render_template, request, jsonify, send_file, session, redirect, url_for, flash
from flask_cors import CORS
from datetime import datetime, timedelta
import pandas as pd
import shutil
from datetime import datetime, timedelta
import pandas as pd
from functools import wraps

# E-Mail Manager importieren
try:
    from email_manager import EmailManager
    EMAIL_AVAILABLE = True
except ImportError:
    EMAIL_AVAILABLE = False
    print("E-Mail Manager nicht verfügbar")

# DynDNS Manager importieren
try:
    from dyndns_manager import init_dyndns, start_dyndns, stop_dyndns, get_dyndns_status
    DYNDNS_AVAILABLE = True
except ImportError:
    DYNDNS_AVAILABLE = False
    print("DynDNS Manager nicht verfügbar")

# Logger einrichten
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Datenverzeichnis konfigurieren
def get_data_directory():
    """Ermittelt das Datenverzeichnis aus Umgebungsvariablen oder Standard"""
    data_path = os.environ.get('DATA_PATH')
    if data_path and os.path.exists(data_path):
        return data_path
    
    # Fallback: data-Verzeichnis neben der app.py
    # Korrekte Pfad-Erkennung für PyInstaller auf Windows
    if getattr(sys, 'frozen', False):
        # Wenn als .exe ausgeführt (PyInstaller)
        app_dir = os.path.dirname(sys.executable)
    else:
        # Normal als Python-Script
        app_dir = os.path.dirname(os.path.abspath(__file__))
    
    return os.path.join(app_dir, 'data')

# Datenverzeichnis setzen
DATA_DIR = get_data_directory()

# Authentication Configuration
def load_auth_config():
    """Lädt die Authentication-Konfiguration"""
    try:
        # Korrekte Pfad-Erkennung für PyInstaller auf Windows
        if getattr(sys, 'frozen', False):
            # Wenn als .exe ausgeführt (PyInstaller)
            config_dir = os.path.dirname(sys.executable)
        else:
            # Normal als Python-Script
            config_dir = os.path.dirname(__file__)
        
        config_file = os.path.join(config_dir, 'auth_config.json')
        if os.path.exists(config_file):
            with open(config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        else:
            # Standard-Konfiguration erstellen
            default_config = {
                "auth": {
                    "username": "admin",
                    "password": "hochzeit2025",
                    "session_timeout_hours": 1
                },
                "app": {
                    "secret_key": "your-secret-key-change-this-in-production"
                }
            }
            with open(config_file, 'w', encoding='utf-8') as f:
                json.dump(default_config, f, indent=2, ensure_ascii=False)
            return default_config
    except Exception as e:
        logger.error(f"Fehler beim Laden der Auth-Konfiguration: {e}")
        return {
            "auth": {"username": "admin", "password": "hochzeit2025", "session_timeout_hours": 1},
            "app": {"secret_key": "fallback-secret-key"}
        }

# Auth-Config laden
auth_config = load_auth_config()

def authenticate_user(username, password):
    """Authentifiziert einen Benutzer gegen die Konfiguration"""
    users = auth_config.get('auth', {}).get('users', [])
    
    # Fallback für alte Konfiguration (einzelner Benutzer)
    if not users and 'username' in auth_config.get('auth', {}):
        old_auth = auth_config['auth']
        if username == old_auth.get('username') and password == old_auth.get('password'):
            return {
                'username': username,
                'role': 'admin',
                'display_name': username.title()
            }
        return None
    
    # Neue Konfiguration (mehrere Benutzer)
    for user in users:
        if user.get('username') == username and user.get('password') == password:
            return {
                'username': user.get('username'),
                'role': user.get('role', 'user'),
                'display_name': user.get('display_name', username.title())
            }
    
    # Gäste-Login prüfen
    guest_user = authenticate_guest(username, password)
    if guest_user:
        return guest_user
    
    return None

def authenticate_guest(username, password):
    """Authentifiziert einen Gast gegen die Gästeliste"""
    try:
        if not data_manager:
            return None
            
        # Gästeliste laden
        gaeste_df = data_manager.gaesteliste_df
        
        if gaeste_df.empty:
            return None
        
        # Nach Gast suchen - PRIORITÄT: guest_code > Email > Namen
        guest_row = None
        
        # 1. PRIORITÄT: Nach generiertem Guest-Code suchen (sicherste Methode)
        if 'guest_code' in gaeste_df.columns:
            code_match = gaeste_df[gaeste_df['guest_code'].str.upper() == username.upper()]
            if not code_match.empty:
                guest_row = code_match.iloc[0]
                logger.info(f"Guest login via code: {username}")
        
        # 2. PRIORITÄT: Nach Email suchen (falls vorhanden und kein Code-Match)
        if guest_row is None and 'Email' in gaeste_df.columns:
            email_match = gaeste_df[gaeste_df['Email'].str.lower() == username.lower()]
            if not email_match.empty:
                guest_row = email_match.iloc[0]
                logger.info(f"Guest login via email: {username}")
        
        # 3. PRIORITÄT: Einfache Namenssuche (nur als Fallback)
        if guest_row is None:
            # Versuche nach Namen zu suchen (erster/letzter Name)
            name_matches = gaeste_df[
                gaeste_df['Name'].str.contains(username, case=False, na=False) |
                gaeste_df['Vorname'].str.contains(username, case=False, na=False)
            ]
            if len(name_matches) == 1:  # Nur wenn eindeutig
                guest_row = name_matches.iloc[0]
                logger.info(f"Guest login via name: {username}")
        
        if guest_row is not None:
            # Passwort prüfen - PRIORITÄT: guest_password > Nachname > Name
            expected_passwords = []
            
            # 1. PRIORITÄT: Generiertes Gast-Passwort
            if pd.notna(guest_row.get('guest_password')) and guest_row.get('guest_password') != '':
                expected_passwords.append(str(guest_row.get('guest_password')).lower())
            
            # 2. PRIORITÄT: Nachname (Fallback für alte Gäste)
            if guest_row.get('Nachname'):
                expected_passwords.append(guest_row.get('Nachname', '').lower())
            
            # 3. PRIORITÄT: Name (weiterer Fallback)
            if guest_row.get('Name'):
                expected_passwords.append(guest_row.get('Name', '').lower())
            
            # 4. PRIORITÄT: Username als letzter Fallback
            expected_passwords.append(username.lower())
            
            # Passwort-Prüfung
            if password.lower() in [p for p in expected_passwords if p]:
                # Konvertiere alle pandas-Werte zu nativen Python-Typen für JSON-Serialisierung
                guest_data = {}
                for key, value in guest_row.to_dict().items():
                    if pd.isna(value):
                        guest_data[key] = None
                    elif hasattr(value, 'item'):  # pandas scalars
                        guest_data[key] = value.item()
                    else:
                        guest_data[key] = value
                
                return {
                    'username': username,
                    'role': 'guest',
                    'display_name': f"{guest_row.get('Vorname', '')} {guest_row.get('Name', '')}".strip(),
                    'guest_id': int(guest_row.name),  # DataFrame index als normaler int
                    'guest_data': guest_data
                }
    
    except Exception as e:
        logger.error(f"Fehler bei Gäste-Authentifizierung: {e}")
    
    return None

def require_auth(f):
    """Decorator für Authentication-Schutz"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Login-Route selbst nicht schützen
        if request.endpoint == 'login':
            return f(*args, **kwargs)
            
        # Debug: Session-Info loggen
        logger.info(f"Session check for {request.path}: {dict(session)}")
            
        # Prüfen ob Benutzer eingeloggt ist
        if 'logged_in' not in session or not session['logged_in']:
            logger.warning(f"Authentication failed for {request.path} - not logged in")
            if request.path.startswith('/api/'):
                return jsonify({'error': 'Authentication required'}), 401
            return redirect(url_for('login'))
        
        # Session-Timeout prüfen
        if 'login_time' in session:
            timeout_hours = auth_config['auth']['session_timeout_hours']
            login_time = datetime.fromisoformat(session['login_time'])
            if datetime.now() - login_time > timedelta(hours=timeout_hours):
                session.clear()
                if request.path.startswith('/api/'):
                    return jsonify({'error': 'Session expired'}), 401
                flash('Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.', 'warning')
                return redirect(url_for('login'))
        
        return f(*args, **kwargs)
    return decorated_function

def require_role(allowed_roles):
    """Decorator für rollen-basierte Zugriffskontrolle"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_role = session.get('user_role', 'guest')
            
            if user_role not in allowed_roles:
                if request.path.startswith('/api/'):
                    return jsonify({'error': 'Insufficient permissions'}), 403
                flash('Sie haben keine Berechtigung für diese Seite.', 'danger')
                return redirect(url_for('guest_dashboard' if user_role == 'guest' else 'index'))
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# Aktueller Pfad für Import - korrekte Erkennung für PyInstaller auf Windows
if getattr(sys, 'frozen', False):
    # Wenn als .exe ausgeführt (PyInstaller)
    current_dir = os.path.dirname(sys.executable)
else:
    # Normal als Python-Script
    current_dir = os.path.dirname(os.path.abspath(__file__))

sys.path.append(current_dir)

try:
    from datenmanager import HochzeitsDatenManager
except ImportError as e:
    print(f"❌ Fehler beim Importieren des DataManagers: {e}")
    sys.exit(1)

# Flask App initialisieren
app = Flask(__name__)
app.config['SECRET_KEY'] = auth_config['app']['secret_key']
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=auth_config['auth']['session_timeout_hours'])
CORS(app)

# DataManager initialisieren (WICHTIG: Immer initialisieren, nicht nur bei direktem Start)
def init_data_manager():
    """Initialisiert den DataManager"""
    global data_manager
    try:
        # Verwende das konfigurierbare Datenverzeichnis
        data_manager = HochzeitsDatenManager(DATA_DIR)
        print(f"✅ DataManager initialisiert: {DATA_DIR}")
        
        # Stelle sicher, dass das Verzeichnis existiert
        os.makedirs(DATA_DIR, exist_ok=True)
        
        return True
    except Exception as e:
        print(f"❌ Fehler beim Initialisieren des DataManagers: {e}")
        return False

def init_config_files():
    """Erstellt Config-Dateien im Root-Verzeichnis wenn sie nicht existieren"""
    try:
        # Root-Verzeichnis ermitteln
        if getattr(sys, 'frozen', False):
            # Wenn als .exe ausgeführt (PyInstaller)
            root_dir = os.path.dirname(sys.executable)
        else:
            # Normal als Python-Script
            root_dir = os.path.dirname(os.path.abspath(__file__))
        
        # DynDNS Config erstellen (falls nicht vorhanden)
        dyndns_config_path = os.path.join(root_dir, 'dyndns_config.json')
        if not os.path.exists(dyndns_config_path):
            dyndns_config = {
                "dyndns": {
                    "enabled": False,
                    "update_url": "",
                    "domain": "",
                    "static_ipv6": "",
                    "interval_minutes": 30,
                    "external_port": 8443,
                    "description": "Ionos DynDNS für IPv6-only Zugriff"
                }
            }
            with open(dyndns_config_path, 'w', encoding='utf-8') as f:
                json.dump(dyndns_config, f, indent=2, ensure_ascii=False)
            print(f"✅ DynDNS Config erstellt: {dyndns_config_path}")
        
        return True
    except Exception as e:
        print(f"❌ Fehler beim Erstellen der Config-Dateien: {e}")
        return False

# Globaler DataManager - initialisiere sofort
data_manager = None
email_manager = None

# Config-Dateien initialisieren
init_config_files()

if not init_data_manager():
    print("❌ KRITISCHER FEHLER: DataManager konnte nicht initialisiert werden!")
    print(f"   Datenverzeichnis: {DATA_DIR}")
    print("   Prüfen Sie die Dateiberechtigungen und Verzeichnisstruktur.")
else:
    print(f"✅ DataManager erfolgreich initialisiert: {DATA_DIR}")

# E-Mail Manager initialisieren (NACH DataManager)
if EMAIL_AVAILABLE:
    try:
        email_manager = EmailManager()
        if email_manager.is_enabled():
            print("✅ E-Mail Manager aktiviert")
            # DataManager-Referenz setzen und Auto-Check starten
            email_manager.set_data_manager(data_manager)
            email_manager.start_email_checking()
        else:
            print("⚠️ E-Mail Manager verfügbar, aber deaktiviert")
    except Exception as e:
        logger.error(f"Fehler beim Initialisieren des E-Mail Managers: {e}")
        email_manager = None

# DynDNS Manager initialisieren
def init_dyndns_manager():
    """Initialisiert den DynDNS Manager"""
    if not DYNDNS_AVAILABLE:
        print("⚠️ DynDNS Manager nicht verfügbar")
        return False
    
    try:
        # DynDNS-Konfiguration laden
        dyndns_config_path = os.path.join(os.path.dirname(__file__), 'dyndns_config.json')
        if os.path.exists(dyndns_config_path):
            with open(dyndns_config_path, 'r') as f:
                config = json.load(f)
            
            dyndns_cfg = config.get('dyndns', {})
            if dyndns_cfg.get('enabled', False):
                # DynDNS Manager initialisieren
                manager = init_dyndns(
                    update_url=dyndns_cfg.get('update_url'),
                    domain=dyndns_cfg.get('domain'),
                    interval_minutes=dyndns_cfg.get('interval_minutes', 30),
                    static_ipv6=dyndns_cfg.get('static_ipv6', None)  # Statische IPv6-Adresse übergeben
                )
                
                if manager:
                    # DynDNS Manager starten
                    start_dyndns()
                    static_info = f" (statische IPv6: {dyndns_cfg.get('static_ipv6', 'auto')})" if dyndns_cfg.get('static_ipv6') else " (automatische IPv6-Erkennung)"
                    print(f"✅ DynDNS Manager gestartet: {dyndns_cfg.get('domain')} (alle {dyndns_cfg.get('interval_minutes', 30)} min){static_info}")
                    return True
                else:
                    print("❌ DynDNS Manager konnte nicht initialisiert werden")
            else:
                print("ℹ️ DynDNS ist deaktiviert")
        else:
            print("ℹ️ Keine DynDNS-Konfiguration gefunden")
    except Exception as e:
        print(f"❌ Fehler beim Initialisieren des DynDNS Managers: {e}")
    
    return False

# DynDNS Manager starten - DEAKTIVIERT
# init_dyndns_manager()

def initialize_guest_credentials():
    """Initialisiert Gast-Credentials beim ersten Start falls noch nicht vorhanden"""
    try:
        if data_manager and not data_manager.gaesteliste_df.empty:
            # Prüfen ob bereits Credentials vorhanden sind
            if 'guest_code' not in data_manager.gaesteliste_df.columns or \
               data_manager.gaesteliste_df['guest_code'].isna().all():
                logger.info("Generiere initial Gast-Credentials...")
                success = data_manager.generate_all_guest_credentials()
                if success:
                    logger.info("✅ Initiale Gast-Credentials erfolgreich generiert")
                else:
                    logger.warning("⚠️ Fehler bei initialer Credential-Generierung")
    except Exception as e:
        logger.error(f"Fehler bei initialer Credential-Generierung: {e}")

# Credentials initialisieren (wird automatisch beim Import ausgeführt)
if data_manager:
    initialize_guest_credentials()

# Globaler Template-Context-Processor für Brautpaar-Namen
@app.context_processor
def inject_global_vars():
    """Stellt globale Variablen für alle Templates bereit"""
    try:
        if data_manager:
            settings = data_manager.load_settings()
            if settings:  # Zusätzliche Sicherheitsüberprüfung
                braut_name = settings.get('braut_name', '')
                braeutigam_name = settings.get('braeutigam_name', '')
                
                if braut_name and braeutigam_name:
                    brautpaar_namen = f"{braut_name} & {braeutigam_name}"
                elif braut_name:
                    brautpaar_namen = braut_name
                elif braeutigam_name:
                    brautpaar_namen = braeutigam_name
                else:
                    brautpaar_namen = "Brautpaar"
                    
                return {
                    'brautpaar_namen': brautpaar_namen,
                    'bride_name': braut_name,
                    'groom_name': braeutigam_name
                }
    except Exception as e:
        logger.warning(f"Fehler beim Laden der globalen Template-Variablen: {e}")
    
    return {
        'brautpaar_namen': "Brautpaar",
        'bride_name': "",
        'groom_name': ""
    }

# Globaler Before-Request Handler für API-Schutz
@app.before_request
def protect_api_routes():
    """Schützt alle API-Routen automatisch"""
    # Login-Route und statische Dateien nicht schützen
    if (request.endpoint == 'login' or 
        request.path.startswith('/static/') or
        request.path == '/favicon.ico'):
        return
    
    # Alle API-Routen schützen
    if request.path.startswith('/api/'):
        if 'logged_in' not in session or not session['logged_in']:
            return jsonify({'error': 'Authentication required'}), 401
        
        # Session-Timeout prüfen
        if 'login_time' in session:
            timeout_hours = auth_config['auth']['session_timeout_hours']
            login_time = datetime.fromisoformat(session['login_time'])
            if datetime.now() - login_time > timedelta(hours=timeout_hours):
                session.clear()
                return jsonify({'error': 'Session expired'}), 401

# Test-Route um sicherzustellen, dass Routen funktionieren
@app.route('/api/test')
def test_route():
    return jsonify({'status': 'API funktioniert', 'timestamp': str(datetime.now())})

# =============================================================================
# Budget API Routen
# =============================================================================

@app.route('/api/budget/list')
def api_budget_list():
    """Budget-Liste abrufen"""
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
            
        budget = data_manager.lade_budget()
        budget_data = clean_json_data(budget.to_dict('records'))
        
        return jsonify({
            'success': True,
            'budget': budget_data
        })
    except Exception as e:
        logger.error(f"Fehler beim Laden des Budgets: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/budget/auto-generate', methods=['POST'])
def api_budget_auto_generate():
    """Budget automatisch aus Kosten und Gästedaten generieren"""
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        # Lade Kostenkonfiguration
        kosten_config_raw = data_manager.load_kosten_config()
        logger.info(f"Kostenkonfiguration geladen: {type(kosten_config_raw)}")
        
        # Konvertiere die Kostenkonfiguration in das erwartete Format
        kosten_config = []
        
        if isinstance(kosten_config_raw, dict):
            # Detailed costs verarbeiten
            detailed_costs = kosten_config_raw.get('detailed_costs', {})
            
            # Weißer Saal-Kosten (sowohl 'weisser_saal' als auch 'standesamt' unterstützen)
            weisser_saal_costs = detailed_costs.get('weisser_saal', {})
            if not weisser_saal_costs and 'standesamt' in detailed_costs:
                weisser_saal_costs = detailed_costs['standesamt']  # Fallback zu standesamt
            
            for beschreibung, preis in weisser_saal_costs.items():
                if preis > 0:  # Nur Kosten > 0 berücksichtigen
                    kosten_config.append({
                        'kategorie': 'Weißer Saal',
                        'beschreibung': beschreibung,
                        'typ': 'pro_person_weisser_saal',
                        'preis_pro_einheit': preis,
                        'aktiv': True
                    })
            
            # Essen-Kosten
            if 'essen' in detailed_costs:
                for beschreibung, preis in detailed_costs['essen'].items():
                    if preis > 0:  # Nur Kosten > 0 berücksichtigen
                        kosten_config.append({
                            'kategorie': 'Essen',
                            'beschreibung': beschreibung,
                            'typ': 'pro_person_essen',
                            'preis_pro_einheit': preis,
                            'aktiv': True
                        })
            
            # Party-Kosten
            if 'party' in detailed_costs:
                for beschreibung, preis in detailed_costs['party'].items():
                    if preis > 0:  # Nur Kosten > 0 berücksichtigen
                        kosten_config.append({
                            'kategorie': 'Party',
                            'beschreibung': beschreibung,
                            'typ': 'pro_person_party',
                            'preis_pro_einheit': preis,
                            'aktiv': True
                        })
            
            # Fixed costs verarbeiten
            fixed_costs = kosten_config_raw.get('fixed_costs', {})
            logger.info(f"Fixed costs gefunden: {fixed_costs}")
            for beschreibung, preis in fixed_costs.items():
                logger.info(f"Verarbeite Fixed cost: {beschreibung} = {preis}€")
                if preis > 0:  # Nur Kosten > 0 berücksichtigen
                    kosten_config.append({
                        'kategorie': 'Fixkosten',  # Verwende normale Fixkosten-Kategorie
                        'beschreibung': beschreibung,
                        'typ': 'pauschal',
                        'preis_pro_einheit': preis,
                        'aktiv': True
                    })
        
        logger.info(f"Konvertierte Kostenkonfiguration: {len(kosten_config)} Items")
        
        # Lade Gästedaten
        data_manager.load_gaesteliste()  # Daten in gaesteliste_df laden
        gaeste_data = data_manager.gaesteliste_df.to_dict('records') if not data_manager.gaesteliste_df.empty else []
        logger.info(f"Gästedaten geladen: {len(gaeste_data)} Gäste")
        
        # Berechne Gästestatistiken basierend auf Anzahl-Feldern (nicht Ja/Nein)
        def safe_int(value):
            """Konvertiert einen Wert sicher zu int"""
            try:
                if value is None or value == '':
                    return 0
                return int(float(str(value)))
            except (ValueError, TypeError):
                return 0
        
        total_essen = 0
        total_party = 0
        total_weisser_saal = 0
        total_kinder = 0
        
        for guest in gaeste_data:
            # Zähle basierend auf den Anzahl-Feldern, unabhängig von Ja/Nein
            anzahl_essen = safe_int(guest.get('Anzahl_Essen', 0))
            anzahl_party = safe_int(guest.get('Anzahl_Party', 0))
            weisser_saal = safe_int(guest.get('Weisser_Saal', 0))
            kinder = safe_int(guest.get('Kind', 0))
            
            # Implementiere die hierarchische Logik:
            # Weißer Saal → automatisch auch Essen
            # Essen → automatisch auch Party
            final_weisser_saal = weisser_saal
            final_essen = max(anzahl_essen, weisser_saal)  # Weißer Saal Gäste sind auch beim Essen
            final_party = max(anzahl_party, final_essen)   # Essen-Gäste sind auch bei der Party
            
            total_weisser_saal += final_weisser_saal
            total_essen += final_essen
            total_party += final_party
            total_kinder += kinder
        
        logger.info(f"Gästestatistiken (nach hierarchischer Logik) - Weißer Saal: {total_weisser_saal}, Essen: {total_essen}, Party: {total_party}, Kinder: {total_kinder}")
        
        # Lade bestehendes Budget um Duplikate zu vermeiden
        try:
            existing_budget_df = data_manager.lade_budget()
            existing_budget_items = existing_budget_df.to_dict('records') if not existing_budget_df.empty else []
        except:
            existing_budget_items = []
        
        # Erstelle Set der bereits existierenden Einträge (Kategorie:Beschreibung)
        existing_keys = set()
        for item in existing_budget_items:
            beschreibung = item.get('beschreibung', '')
            kategorie = item.get('kategorie', '')
            key = f"{kategorie}:{beschreibung}"
            existing_keys.add(key)
            # Spezialbehandlung: "Essen" kann auch als "Hauptgang" existieren
            if beschreibung == "Essen":
                existing_keys.add(f"{kategorie}:Hauptgang")
        
        # Beginne mit allen existierenden Einträgen
        budget_items = []
        for item in existing_budget_items:
            budget_items.append({
                'kategorie': item.get('kategorie', ''),
                'beschreibung': item.get('beschreibung', ''),
                'details': item.get('details', ''),
                'menge': float(item.get('menge', 0)),
                'einzelpreis': float(item.get('einzelpreis', 0)),
                'gesamtpreis': float(item.get('gesamtpreis', 0)),
                'ausgegeben': float(item.get('ausgegeben', 0))
            })
        
        logger.info(f"Verarbeite {len(kosten_config)} Kostenelemente")
        
        for i, item in enumerate(kosten_config):
            logger.info(f"Verarbeite Item {i}: {item}")
            
            if not item.get('aktiv', True):
                continue
                
            kategorie = item.get('kategorie', 'Sonstiges')
            beschreibung = item.get('beschreibung', 'Unbenannt')
            
            # Berechne Kosten basierend auf Konfiguration - jeder Eventteil wird nur einmal berechnet
            if item.get('typ') == 'pro_person_weisser_saal':
                # Nur die tatsächlichen Weißer Saal-Gäste (nicht die automatisch hinzugefügten Essen/Party-Gäste)
                menge = total_weisser_saal
                einzelpreis = float(item.get('preis_pro_einheit', 0) or 0)
                gesamtpreis = menge * einzelpreis
                details = f"{menge} Personen × {einzelpreis}€ (Weißer Saal)"
            elif item.get('typ') == 'pro_person_essen':
                # ALLE Essen-Gäste (Weißer Saal + reine Essen-Gäste)
                menge = total_essen  # Gesamte Essen-Menge verwenden
                einzelpreis = float(item.get('preis_pro_einheit', 0) or 0)
                gesamtpreis = menge * einzelpreis
                details = f"{menge} Personen × {einzelpreis}€ (alle Essen-Gäste: {total_weisser_saal} Weißer Saal + {total_essen - total_weisser_saal} nur Essen)"
                
                # "Hauptgang" in "Essen" umbenennen
                if beschreibung == "Hauptgang":
                    beschreibung = "Essen"
            elif item.get('typ') == 'pro_person_party':
                # Nur zusätzliche Party-Gäste (die nicht bereits vom Essen kommen)
                zusaetzliche_party_gaeste = total_party - total_essen
                menge = zusaetzliche_party_gaeste
                einzelpreis = float(item.get('preis_pro_einheit', 0) or 0)
                gesamtpreis = menge * einzelpreis
                details = f"{menge} Personen × {einzelpreis}€ (zusätzlich zur Party)" if menge > 0 else "0 zusätzliche Party-Gäste"
            elif item.get('typ') == 'pro_kind':
                menge = total_kinder
                einzelpreis = float(item.get('preis_pro_einheit', 0) or 0)
                gesamtpreis = menge * einzelpreis
                details = f"{menge} Kinder × {einzelpreis}€"
            elif item.get('typ') == 'pauschal':
                menge = 1
                einzelpreis = float(item.get('preis_pro_einheit', 0) or 0)
                gesamtpreis = einzelpreis
                details = "Pauschalpreis"
            else:
                # Fallback für unbekannte Typen
                menge = 1
                einzelpreis = float(item.get('preis_pro_einheit', 0) or 0)
                gesamtpreis = einzelpreis
                details = "Einzelpreis"
            
            # Prüfe ob dieser Eintrag bereits existiert
            key = f"{kategorie}:{beschreibung}"
            if key in existing_keys:
                logger.info(f"Überspringe bereits existierenden Eintrag: {key}")
                continue
            
            budget_items.append({
                'kategorie': kategorie,
                'beschreibung': beschreibung,
                'details': details,
                'menge': menge,
                'einzelpreis': einzelpreis,
                'gesamtpreis': gesamtpreis,
                'ausgegeben': 0  # Neue Einträge haben standardmäßig 0 ausgegeben
            })
        
        # Berechne Gesamtsumme - stelle sicher, dass alle gesamtpreis-Werte numerisch sind
        gesamtsumme = sum(float(item.get('gesamtpreis', 0) or 0) for item in budget_items)
        
        logger.info(f"Budget generiert: {len(budget_items)} Items, Gesamtsumme: {gesamtsumme}")
        logger.info(f"Bereits vorhandene Budget-Einträge: {len(existing_budget_items)}")
        logger.info(f"Konvertierte Kostenelemente: {len(kosten_config)} - {[item['beschreibung'] for item in kosten_config]}")
        
        # Speichere das generierte Budget automatisch
        try:
            import pandas as pd
            budget_df = pd.DataFrame(budget_items)
            data_manager.speichere_budget(budget_df)
            logger.info("Budget automatisch gespeichert")
        except Exception as e:
            logger.error(f"Fehler beim automatischen Speichern: {str(e)}")
        
        # Für jetzt: nur das Budget zurückgeben, ohne es zu speichern
        # (Das Speichern können wir später über den DataManager implementieren)
        
        return jsonify({
            'success': True,
            'message': 'Budget erfolgreich generiert',
            'budget': budget_items,
            'summary': {
                'gesamtsumme': gesamtsumme,
                'anzahl_positionen': len(budget_items),
                'gaeste_statistiken': {
                    'weisser_saal': total_weisser_saal,
                    'essen': total_essen,
                    'party': total_party,
                    'kinder': total_kinder
                }
            }
        })
    except Exception as e:
        logger.error(f"Fehler beim Generieren des Budgets: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/budget/add', methods=['POST'])
def api_budget_add():
    """Neuen Budget-Eintrag hinzufügen"""
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Keine Daten empfangen'}), 400
        
        # Validiere erforderliche Felder
        required_fields = ['kategorie', 'beschreibung', 'einzelpreis', 'menge']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Feld "{field}" ist erforderlich'}), 400
        
        # Konvertiere numerische Werte
        try:
            einzelpreis = float(data['einzelpreis'])
            menge = float(data['menge'])
            gesamtpreis = einzelpreis * menge
            ausgegeben = float(data.get('ausgegeben', 0))
        except (ValueError, TypeError):
            return jsonify({'error': 'Einzelpreis, Menge und Ausgegeben müssen numerische Werte sein'}), 400
        
        # Lade aktuelles Budget
        budget_df = data_manager.lade_budget()
        
        # Erstelle neuen Eintrag
        neuer_eintrag = {
            'kategorie': data['kategorie'],
            'beschreibung': data['beschreibung'],
            'details': data.get('details', ''),
            'menge': menge,
            'einzelpreis': einzelpreis,
            'gesamtpreis': gesamtpreis,
            'ausgegeben': ausgegeben
        }
        
        # Füge zur DataFrame hinzu
        import pandas as pd
        neuer_eintrag_df = pd.DataFrame([neuer_eintrag])
        budget_df = pd.concat([budget_df, neuer_eintrag_df], ignore_index=True)
        
        # Speichere Budget
        data_manager.speichere_budget(budget_df)
        
        return jsonify({
            'success': True,
            'message': 'Budget-Eintrag erfolgreich hinzugefügt',
            'eintrag': neuer_eintrag
        })
    except Exception as e:
        logger.error(f"Fehler beim Hinzufügen des Budget-Eintrags: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/budget/edit/<int:index>', methods=['PUT'])
def api_budget_edit(index):
    """Budget-Eintrag bearbeiten"""
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Keine Daten empfangen'}), 400
        
        # Lade aktuelles Budget
        budget_df = data_manager.lade_budget()
        
        # Prüfe ob Index existiert
        if index < 0 or index >= len(budget_df):
            return jsonify({'error': 'Ungültiger Index'}), 400
        
        # Validiere und konvertiere numerische Werte falls vorhanden
        if 'einzelpreis' in data:
            try:
                data['einzelpreis'] = float(data['einzelpreis'])
            except (ValueError, TypeError):
                return jsonify({'error': 'Einzelpreis muss ein numerischer Wert sein'}), 400
        
        if 'menge' in data:
            try:
                data['menge'] = float(data['menge'])
            except (ValueError, TypeError):
                return jsonify({'error': 'Menge muss ein numerischer Wert sein'}), 400
        
        if 'ausgegeben' in data:
            try:
                data['ausgegeben'] = float(data['ausgegeben'])
            except (ValueError, TypeError):
                return jsonify({'error': 'Ausgegeben muss ein numerischer Wert sein'}), 400
        
        # Aktualisiere Felder
        for field in ['kategorie', 'beschreibung', 'details', 'menge', 'einzelpreis', 'ausgegeben']:
            if field in data:
                budget_df.loc[index, field] = data[field]
        
        # Berechne Gesamtpreis neu falls Einzelpreis oder Menge geändert wurden
        if 'einzelpreis' in data or 'menge' in data:
            budget_df.loc[index, 'gesamtpreis'] = budget_df.loc[index, 'einzelpreis'] * budget_df.loc[index, 'menge']
        
        # Speichere Budget
        data_manager.speichere_budget(budget_df)
        
        # Gib aktualisierten Eintrag zurück
        aktualisierter_eintrag = budget_df.iloc[index].to_dict()
        
        return jsonify({
            'success': True,
            'message': 'Budget-Eintrag erfolgreich aktualisiert',
            'eintrag': clean_json_data(aktualisierter_eintrag)
        })
    except Exception as e:
        logger.error(f"Fehler beim Bearbeiten des Budget-Eintrags: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/budget/delete/<int:index>', methods=['DELETE'])
def api_budget_delete(index):
    """Budget-Eintrag löschen"""
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        # Lade aktuelles Budget
        budget_df = data_manager.lade_budget()
        
        # Prüfe ob Index existiert
        if index < 0 or index >= len(budget_df):
            return jsonify({'error': 'Ungültiger Index'}), 400
        
        # Speichere gelöschten Eintrag für Rückgabe
        geloeschter_eintrag = budget_df.iloc[index].to_dict()
        
        # Lösche Eintrag
        budget_df = budget_df.drop(budget_df.index[index]).reset_index(drop=True)
        
        # Speichere Budget
        data_manager.speichere_budget(budget_df)
        
        return jsonify({
            'success': True,
            'message': 'Budget-Eintrag erfolgreich gelöscht',
            'geloeschter_eintrag': clean_json_data(geloeschter_eintrag)
        })
    except Exception as e:
        logger.error(f"Fehler beim Löschen des Budget-Eintrags: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/budget/save', methods=['POST'])
def api_budget_save():
    """Komplettes Budget speichern"""
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        data = request.get_json()
        if not data or 'budget' not in data:
            return jsonify({'error': 'Budget-Daten erforderlich'}), 400
        
        # Konvertiere Budget-Daten zu DataFrame
        import pandas as pd
        budget_items = data['budget']
        
        # Validiere und konvertiere numerische Werte
        for item in budget_items:
            try:
                item['einzelpreis'] = float(item.get('einzelpreis', 0))
                item['menge'] = float(item.get('menge', 0))
                item['gesamtpreis'] = item['einzelpreis'] * item['menge']
                item['ausgegeben'] = float(item.get('ausgegeben', 0))
            except (ValueError, TypeError):
                return jsonify({'error': 'Ungültige numerische Werte in Budget-Daten'}), 400
        
        budget_df = pd.DataFrame(budget_items)
        
        # Speichere Budget
        data_manager.speichere_budget(budget_df)
        
        return jsonify({
            'success': True,
            'message': 'Budget erfolgreich gespeichert'
        })
    except Exception as e:
        logger.error(f"Fehler beim Speichern des Budgets: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

# =============================================================================
# Kosten API Routen
# =============================================================================

@app.route('/api/kosten/config')
def api_kosten_config():
    """Kostenkonfiguration laden"""
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        # Lade aktuelle Kostenkonfiguration
        config = data_manager.load_kosten_config()
        
        return jsonify({
            'success': True,
            'config': config
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/kosten/save', methods=['POST'])
def api_kosten_save():
    """Kostenkonfiguration speichern"""
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        # Prüfe Content-Type
        if not request.is_json:
            logger.error(f"Invalid Content-Type: {request.content_type}")
            return jsonify({'error': 'Content-Type muss application/json sein'}), 400
        
        # Lade rohe Daten und parse manuell
        try:
            raw_data = request.get_data(as_text=True)
            logger.info(f"Raw request data: {raw_data[:200]}...")  # Erste 200 Zeichen loggen
            
            if not raw_data.strip():
                logger.error("No data received")
                return jsonify({'error': 'Keine Daten empfangen'}), 400
            
            config_data = json.loads(raw_data)
            
        except json.JSONDecodeError as json_error:
            logger.error(f"JSON decode error: {str(json_error)}")
            logger.error(f"Raw data was: {request.get_data(as_text=True)}")
            return jsonify({'error': f'Ungültige JSON-Daten: {str(json_error)}'}), 400
        except Exception as e:
            logger.error(f"Data parsing error: {str(e)}")
            return jsonify({'error': f'Fehler beim Parsen der Daten: {str(e)}'}), 400
        
        if not config_data:
            logger.error("No JSON data received")
            return jsonify({'error': 'Keine JSON-Daten empfangen'}), 400
        
        # Validiere Struktur
        if not isinstance(config_data, dict):
            return jsonify({'error': 'Kostenkonfiguration muss ein Objekt sein'}), 400
        
        # Optional: Validiere Struktur
        required_keys = ['fixed_costs', 'detailed_costs']
        for key in required_keys:
            if key not in config_data:
                logger.warning(f"Missing key in config: {key}")
        
        logger.info(f"Speichere Kostenkonfiguration: {config_data}")
        
        # Speichere Kostenkonfiguration
        success = data_manager.save_kosten_config(config_data)
        
        if success:
            return jsonify({'success': True, 'message': 'Kostenkonfiguration gespeichert'})
        else:
            return jsonify({'error': 'Fehler beim Speichern der Kostenkonfiguration'}), 500
            
    except Exception as e:
        logger.error(f"Unerwarteter Fehler beim Speichern der Kostenkonfiguration: {str(e)}")
        return jsonify({'error': f'Unerwarteter Fehler: {str(e)}'}), 500

def find_free_port(start_port=8081):
    """Findet einen freien Port ab start_port"""
    port = start_port
    while port < start_port + 100:  # Maximal 100 Ports versuchen
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('localhost', port))
                return port
        except OSError:
            port += 1
    return start_port  # Fallback

def clean_json_data(data):
    """Bereinigt Daten für JSON-Serialisierung"""
    if isinstance(data, dict):
        cleaned = {}
        for key, value in data.items():
            # Spezielle Behandlung für eventteile
            if key == 'eventteile' and isinstance(value, str):
                try:
                    cleaned[key] = json.loads(value)
                except (json.JSONDecodeError, TypeError):
                    cleaned[key] = []
            else:
                cleaned[key] = clean_json_data(value)
        return cleaned
    elif isinstance(data, list):
        return [clean_json_data(item) for item in data]
    elif pd.isna(data) or (isinstance(data, float) and str(data) == 'nan'):
        return ''
    elif isinstance(data, (int, float, str, bool)):
        return data
    else:
        return str(data)

# =============================================================================
# Authentication Routen
# =============================================================================

@app.route('/login', methods=['GET', 'POST'])
def login():
    """Login-Seite und -Verarbeitung"""
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        # Benutzer authentifizieren
        user = authenticate_user(username, password)
        if user:
            logger.info(f"Authentication successful for user: {user}")
            session['logged_in'] = True
            session['username'] = user['username']
            session['user_role'] = user['role']
            session['display_name'] = user['display_name']
            session['login_time'] = datetime.now().isoformat()
            session.permanent = True
            
            logger.info(f"Session after login: {dict(session)}")
            
            # Zusätzliche Daten für Gäste
            if user['role'] == 'guest':
                guest_data = user.get('guest_data', {})
                session['guest_id'] = user.get('guest_id')
                session['guest_code'] = guest_data.get('guest_code')
                session['guest_email'] = guest_data.get('Email') or guest_data.get('email')
            
            # Redirect basierend auf Rolle
            next_page = request.args.get('next')
            if user['role'] == 'guest':
                logger.info(f"Redirecting guest to: {next_page or url_for('guest_dashboard')}")
                return redirect(next_page or url_for('guest_dashboard'))
            else:
                return redirect(next_page or url_for('index'))
        else:
            return render_template('login.html', error='Ungültiger Benutzername oder Passwort')
    
    # Wenn bereits eingeloggt, weiterleiten
    if 'logged_in' in session and session['logged_in']:
        if session.get('user_role') == 'guest':
            return redirect(url_for('guest_dashboard'))
        else:
            return redirect(url_for('index'))
    
    return render_template('login.html')

@app.route('/logout')
def logout():
    """Logout und Session löschen"""
    session.clear()
    flash('Sie wurden erfolgreich abgemeldet.', 'info')
    return redirect(url_for('login'))

# =============================================================================
# Hauptrouten (alle geschützt)
# =============================================================================

# Routen
@app.route('/')
@require_auth
@require_role(['admin', 'user'])
def index():
    return render_template('index.html')

@app.route('/gaesteliste')
@require_auth
@require_role(['admin', 'user'])
def gaesteliste():
    return render_template('gaesteliste.html')

@app.route('/budget')
@require_auth
@require_role(['admin', 'user'])
def budget():
    return render_template('budget.html')

@app.route('/einstellungen')
@require_auth
@require_role(['admin', 'user'])
def einstellungen():
    try:
        # Lade aktuelle Einstellungen
        settings = data_manager.get_settings()
        
        # Hole brautpaar_namen für den Titel
        brautpaar_namen = settings.get('brautpaar_namen', 'Käthe & Pascal')
        
        return render_template('einstellungen.html', brautpaar_namen=brautpaar_namen, settings=settings)
    except Exception as e:
        app.logger.error(f"Fehler in einstellungen(): {e}")
        return render_template('error.html', error_message=f"Fehler beim Laden der Einstellungen: {str(e)}")

@app.route('/api/dyndns/status')
@require_auth
@require_role(['admin'])
def dyndns_status():
    """DynDNS-Status abrufen"""
    try:
        if DYNDNS_AVAILABLE:
            status = get_dyndns_status()
            return jsonify(status)
        else:
            return jsonify({"running": False, "error": "DynDNS nicht verfügbar"})
    except Exception as e:
        return jsonify({"running": False, "error": str(e)})

@app.route('/kosten')
@require_auth
@require_role(['admin', 'user'])
def kosten_page():
    """Kostenkonfiguration Seite"""
    return render_template('kosten.html')

@app.route('/test-maps')
def test_maps():
    """Test-Seite für OpenStreetMap Integration"""
    return '''
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenStreetMap Test</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
        .map-container { height: 300px; width: 100%; margin: 10px 0; }
        .console-output { 
            background: #f8f9fa; 
            padding: 1rem; 
            height: 200px; 
            overflow-y: auto; 
            font-family: monospace; 
            font-size: 12px;
            border: 1px solid #dee2e6;
            border-radius: 0.375rem;
        }
    </style>
</head>
<body>
    <div class="container mt-4">
        <h1>🗺️ OpenStreetMap Integration Test</h1>
        
        <div class="row">
            <div class="col-md-6">
                <h3>Test-Input</h3>
                <div class="mb-3">
                    <label for="testAddress" class="form-label">Test-Adresse</label>
                    <input type="text" class="form-control" id="testAddress" value="Markt 39, 52062 Aachen">
                </div>
                <button class="btn btn-primary" onclick="createTestMap()">🗺️ Karte erstellen</button>
                <button class="btn btn-secondary" onclick="clearTestMap()">🧹 Karte löschen</button>
                <button class="btn btn-info" onclick="testGeocoding()">📍 Geocoding Test</button>
            </div>
            <div class="col-md-6">
                <h3>Console Logs</h3>
                <div id="consoleOutput" class="console-output"></div>
            </div>
        </div>
        
        <div class="row mt-4">
            <div class="col-lg-6">
                <div class="card">
                    <div class="card-header bg-primary text-white">
                        <h5>🏛️ Standesamt Test</h5>
                    </div>
                    <div class="card-body p-0">
                        <div class="map-container">
                            <div id="standesamtMap" style="height: 100%; width: 100%;"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-lg-6">
                <div class="card">
                    <div class="card-header bg-success text-white">
                        <h5>💒 Hochzeitslocation Test</h5>
                    </div>
                    <div class="card-body p-0">
                        <div class="map-container">
                            <div id="hochzeitslocationMap" style="height: 100%; width: 100%;"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="/static/js/openstreetmap.js"></script>
    
    <script>
        const consoleOutput = document.getElementById('consoleOutput');
        
        function addToConsole(type, message) {
            const now = new Date().toLocaleTimeString();
            const color = type === 'ERROR' ? 'text-danger' : type === 'SUCCESS' ? 'text-success' : 'text-primary';
            consoleOutput.innerHTML += `<div class="${color}"><strong>[${now}] ${type}:</strong> ${message}</div>`;
            consoleOutput.scrollTop = consoleOutput.scrollHeight;
        }
        
        async function createTestMap() {
            const address = document.getElementById('testAddress').value.trim();
            if (!address) {
                addToConsole('ERROR', 'Keine Adresse eingegeben');
                return;
            }
            
            addToConsole('LOG', '🗺️ Erstelle Test-Karte für: ' + address);
            
            if (typeof window.openStreetMap === 'undefined') {
                addToConsole('ERROR', '❌ OpenStreetMap Integration nicht verfügbar');
                return;
            }
            
            try {
                await window.openStreetMap.createSimpleLocationMap('standesamtMap', address, 'Standesamt Test');
                addToConsole('SUCCESS', '✅ Standesamt-Karte erstellt');
                
                await window.openStreetMap.createSimpleLocationMap('hochzeitslocationMap', address, 'Hochzeitslocation Test');
                addToConsole('SUCCESS', '✅ Hochzeitslocation-Karte erstellt');
                
            } catch (error) {
                addToConsole('ERROR', '❌ Fehler beim Erstellen der Test-Karten: ' + error.message);
            }
        }
        
        function clearTestMap() {
            try {
                if (window.openStreetMap) {
                    window.openStreetMap.removeMap('standesamtMap');
                    window.openStreetMap.removeMap('hochzeitslocationMap');
                    addToConsole('SUCCESS', '🧹 Test-Karten entfernt');
                }
            } catch (error) {
                addToConsole('ERROR', '❌ Fehler beim Entfernen der Karten: ' + error.message);
            }
        }
        
        async function testGeocoding() {
            const address = document.getElementById('testAddress').value.trim();
            if (!address) {
                addToConsole('ERROR', 'Keine Adresse eingegeben');
                return;
            }
            
            addToConsole('LOG', '📍 Teste Geocoding für: ' + address);
            
            if (typeof window.openStreetMap === 'undefined') {
                addToConsole('ERROR', '❌ OpenStreetMap Integration nicht verfügbar');
                return;
            }
            
            try {
                const result = await window.openStreetMap.geocodeAddress(address);
                if (result) {
                    addToConsole('SUCCESS', `✅ Geocoding erfolgreich: ${result.lat}, ${result.lon} (${result.display_name})`);
                } else {
                    addToConsole('ERROR', '❌ Geocoding fehlgeschlagen: Keine Ergebnisse');
                }
            } catch (error) {
                addToConsole('ERROR', '❌ Geocoding Fehler: ' + error.message);
            }
        }
        
        document.addEventListener('DOMContentLoaded', function() {
            addToConsole('LOG', '🚀 Test-Seite geladen');
            addToConsole('LOG', '🔍 OpenStreetMap verfügbar: ' + (typeof window.openStreetMap !== 'undefined'));
            addToConsole('LOG', '🔍 Leaflet verfügbar: ' + (typeof L !== 'undefined'));
            
            if (typeof window.openStreetMap !== 'undefined') {
                addToConsole('LOG', '📊 OpenStreetMap Objekt geladen');
            }
        });
    </script>
</body>
</html>
    '''

@app.route('/simple-test')
def simple_test():
    """Einfacher JavaScript Test"""
    return render_template('simple_test.html')

@app.route('/syntax-test')
def syntax_test():
    """JavaScript Syntax Test-Seite"""
    return render_template('syntax_test.html')

@app.route('/js-test')
def js_test():
    """JavaScript Test-Seite"""
    return render_template('js_test.html')

@app.route('/debug-maps')
def debug_maps():
    """Debug-Seite für Karten"""
    return render_template('debug_maps.html')

@app.route('/guest-credentials')
@require_auth
@require_role(['admin'])
def guest_credentials_page():
    """Gast-Login-Credentials Verwaltung (nur für Admins)"""
    return render_template('guest_credentials.html')

# =============================================================================
@app.route('/zeitplan')
@require_auth
@require_role(['admin', 'user'])
def zeitplan():
    """Zeitplan Seite"""
    try:
        # Lade Einstellungen
        config = data_manager.load_config()
        settings = config.get('settings', {})
        
        # Erstelle Kontext mit Namen
        context = {
            'bride_name': settings.get('bride_name', 'Braut'),
            'groom_name': settings.get('groom_name', 'Bräutigam')
        }
        
        return render_template('zeitplan.html', **context)
    except Exception as e:
        logger.error(f"Fehler beim Laden der Zeitplan-Seite: {str(e)}")
        # Fallback mit Standardwerten
        return render_template('zeitplan.html', bride_name='Braut', groom_name='Bräutigam')

# =============================================================================
# Gäste-spezifische Routen
# =============================================================================

@app.route('/guest')
@require_auth
@require_role(['guest'])
def guest_dashboard():
    """Gäste-Dashboard"""
    # Brautpaar-Namen aus Einstellungen laden
    brautpaar_namen = "Hochzeit"  # Fallback
    try:
        if data_manager and data_manager.settings:
            brautpaar_namen = data_manager.settings.get('brautpaar_namen', 'Hochzeit')
    except Exception as e:
        logger.error(f"Fehler beim Laden der Brautpaar-Namen: {e}")
    
    return render_template('guest_dashboard.html', brautpaar_namen=brautpaar_namen)

@app.route('/guest/zeitplan')
@require_auth
@require_role(['guest'])
def guest_zeitplan():
    """Öffentlicher Zeitplan für Gäste"""
    # Brautpaar-Namen aus Einstellungen laden
    brautpaar_namen = "Hochzeit"  # Fallback
    try:
        if data_manager and data_manager.settings:
            brautpaar_namen = data_manager.settings.get('brautpaar_namen', 'Hochzeit')
    except Exception as e:
        logger.error(f"Fehler beim Laden der Brautpaar-Namen: {e}")
    
    return render_template('guest_zeitplan.html', brautpaar_namen=brautpaar_namen)

# Guest API-Endpunkte
@app.route('/api/guest/data')
@require_auth
@require_role(['guest'])
def get_guest_data():
    try:
        guest_id = session.get('guest_id')
        guest_code = session.get('guest_code')
        guest_email = session.get('guest_email')
        
        if not guest_id and not guest_code and not guest_email:
            return jsonify({'success': False, 'message': 'Gast-Session ungültig'})
        
        # Direkter Zugriff über guest_id (DataFrame-Index)
        if guest_id is not None:
            try:
                guest_row = data_manager.gaesteliste_df.iloc[guest_id]
                guest_dict = guest_row.to_dict()
                
                # Pandas-Werte zu Python-Typen konvertieren
                guest = {}
                for key, value in guest_dict.items():
                    if pd.isna(value):
                        guest[key] = None
                    elif hasattr(value, 'item'):  # pandas scalars
                        guest[key] = value.item()
                    else:
                        guest[key] = value
                
                return jsonify({
                    'success': True,
                    'guest': {
                        'name': f"{guest.get('Vorname', '')} {guest.get('Name', '')}".strip(),
                        'vorname': guest.get('Vorname', ''),
                        'nachname': guest.get('Name', ''),
                        'status': guest.get('Status', 'Offen'),
                        'personen': guest.get('Anzahl_Personen', 1),
                        'max_personen': guest.get('Anzahl_Personen', 1),  # Nutze Gesamt als Maximum
                        'notiz': guest.get('Bemerkungen', ''),
                        'email': guest.get('Email', ''),
                        'guest_code': guest.get('guest_code', ''),
                        # Event-spezifische Felder für personalisierte Begrüßung
                        'Anzahl_Personen': guest.get('Anzahl_Personen', 1),
                        'Weisser_Saal': guest.get('Weisser_Saal', 0),
                        'Anzahl_Essen': guest.get('Anzahl_Essen', 0),
                        'Anzahl_Party': guest.get('Anzahl_Party', 0)
                    }
                })
            except IndexError:
                pass
        
        # Fallback: Suche über Code oder Email
        gaesteliste_df = data_manager.gaesteliste_df
        guest_row = None
        
        if guest_code and 'guest_code' in gaesteliste_df.columns:
            code_matches = gaesteliste_df[gaesteliste_df['guest_code'] == guest_code]
            if not code_matches.empty:
                guest_row = code_matches.iloc[0]
        
        if guest_row is None and guest_email and 'Email' in gaesteliste_df.columns:
            email_matches = gaesteliste_df[gaesteliste_df['Email'].str.lower() == guest_email.lower()]
            if not email_matches.empty:
                guest_row = email_matches.iloc[0]
        
        if guest_row is not None:
            guest_dict = guest_row.to_dict()
            
            # Pandas-Werte zu Python-Typen konvertieren
            guest = {}
            for key, value in guest_dict.items():
                if pd.isna(value):
                    guest[key] = None
                elif hasattr(value, 'item'):  # pandas scalars
                    guest[key] = value.item()
                else:
                    guest[key] = value
            
            return jsonify({
                'success': True,
                'guest': {
                    'name': f"{guest.get('Vorname', '')} {guest.get('Name', '')}".strip(),
                    'vorname': guest.get('Vorname', ''),
                    'nachname': guest.get('Name', ''),
                    'status': guest.get('Status', 'Offen'),
                    'personen': guest.get('Anzahl_Personen', 1),
                    'max_personen': guest.get('Anzahl_Personen', 1),  # Nutze Gesamt als Maximum
                    'notiz': guest.get('Bemerkungen', ''),
                    'email': guest.get('Email', ''),
                    'guest_code': guest.get('guest_code', ''),
                    # Event-spezifische Felder für personalisierte Begrüßung
                    'Anzahl_Personen': guest.get('Anzahl_Personen', 1),
                    'Weisser_Saal': guest.get('Weisser_Saal', 0),
                    'Anzahl_Essen': guest.get('Anzahl_Essen', 0),
                    'Anzahl_Party': guest.get('Anzahl_Party', 0)
                }
            })
        
        return jsonify({'success': False, 'message': 'Gast nicht gefunden'})
        
    except Exception as e:
        logger.error(f"Fehler beim Laden der Gästdaten: {e}")
        return jsonify({'success': False, 'message': 'Serverfehler'})

@app.route('/api/guest/rsvp', methods=['POST'])
@require_auth
@require_role(['guest'])
def update_guest_rsvp():
    try:
        data = request.get_json()
        guest_id = session.get('guest_id')
        guest_code = session.get('guest_code')
        guest_email = session.get('guest_email')
        
        if not guest_id and not guest_code and not guest_email:
            return jsonify({'success': False, 'message': 'Gast-Session ungültig'})
        
        # Eingaben validieren
        status = data.get('status', 'Offen')
        if status not in ['Offen', 'Zugesagt', 'Abgesagt']:
            return jsonify({'success': False, 'message': 'Ungültiger Status'})
        
        personen = int(data.get('personen', 1))
        notiz = data.get('notiz', '').strip()
        
        # Gast finden und aktualisieren
        gaesteliste_df = data_manager.gaesteliste_df
        guest_index = None
        
        # Zuerst über guest_id (DataFrame-Index) suchen
        if guest_id is not None:
            try:
                if guest_id < len(gaesteliste_df):
                    guest_index = guest_id
            except (IndexError, TypeError):
                pass
        
        # Fallback: Über Code oder Email suchen
        if guest_index is None:
            if guest_code and 'guest_code' in gaesteliste_df.columns:
                code_matches = gaesteliste_df[gaesteliste_df['guest_code'] == guest_code]
                if not code_matches.empty:
                    guest_index = code_matches.index[0]
            
            if guest_index is None and guest_email and 'Email' in gaesteliste_df.columns:
                email_matches = gaesteliste_df[gaesteliste_df['Email'].str.lower() == guest_email.lower()]
                if not email_matches.empty:
                    guest_index = email_matches.index[0]
        
        if guest_index is None:
            return jsonify({'success': False, 'message': 'Gast nicht gefunden'})
        
        # Validierung: Personenanzahl nicht über Maximum
        max_personen = gaesteliste_df.loc[guest_index, 'Anzahl_Personen']
        if pd.isna(max_personen):
            max_personen = 1
        else:
            max_personen = int(max_personen)
            
        if personen > max_personen:
            return jsonify({
                'success': False, 
                'message': f'Maximale Personenanzahl ({max_personen}) überschritten'
            })
        
        # Daten aktualisieren
        data_manager.gaesteliste_df.loc[guest_index, 'Status'] = status
        data_manager.gaesteliste_df.loc[guest_index, 'Bemerkungen'] = notiz
        
        # Personenanzahl nur bei Zusage setzen
        if status == 'Zugesagt':
            data_manager.gaesteliste_df.loc[guest_index, 'Anzahl_Personen'] = personen
        elif status == 'Abgesagt':
            data_manager.gaesteliste_df.loc[guest_index, 'Anzahl_Personen'] = 0
        
        # Speichern
        data_manager.save_gaesteliste()
        
        return jsonify({'success': True, 'message': 'Teilnahme gespeichert'})
        
    except Exception as e:
        logger.error(f"Fehler beim Speichern der RSVP: {e}")
        return jsonify({'success': False, 'message': f'Serverfehler: {str(e)}'})

@app.route('/api/guest/zeitplan_preview')
@require_auth
@require_role(['guest'])
def get_guest_zeitplan_preview():
    try:
        if data_manager.zeitplan_df.empty:
            return jsonify({
                'success': True,
                'events': []
            })

        # Gast-Daten laden
        guest_id = session.get('guest_id')
        guest_info = None
        if guest_id is not None:
            try:
                # guest_id ist der DataFrame-Index (0-basiert), nicht 1-basiert!
                guest_index = int(guest_id)
                if guest_index >= 0 and guest_index < len(data_manager.gaesteliste_df):
                    guest_row = data_manager.gaesteliste_df.iloc[guest_index]
                    guest_info = guest_row.to_dict()
                    
                    # Pandas-Werte zu Python-Typen konvertieren
                    guest_data = {}
                    for key, value in guest_info.items():
                        if pd.isna(value):
                            guest_data[key] = None
                        elif hasattr(value, 'item'):  # pandas scalars
                            guest_data[key] = value.item()
                        else:
                            guest_data[key] = value
                    guest_info = guest_data
                    
                    # Debug-Log für alle Gäste
                    logger.info(f"Guest {guest_index} ({guest_info.get('Nachname', 'Unknown')}) - Weisser_Saal: {guest_info.get('Weisser_Saal')}, Anzahl_Essen: {guest_info.get('Anzahl_Essen')}, Anzahl_Party: {guest_info.get('Anzahl_Party')}")
            except (IndexError, ValueError):
                pass
        
        # DataFrame zu Liste von Dictionaries konvertieren
        zeitplan_events = []
        for index, row in data_manager.zeitplan_df.iterrows():
            event_dict = {}
            for key, value in row.to_dict().items():
                if pd.isna(value):
                    event_dict[key] = None
                elif hasattr(value, 'item'):  # pandas scalars
                    event_dict[key] = value.item()
                else:
                    event_dict[key] = value
            zeitplan_events.append(event_dict)
        
        # Nur öffentliche Events filtern mit Eventteile-Berücksichtigung
        public_events = []
        for event in zeitplan_events:
            if not event.get('public', False):
                continue
                
            # Eventteile-Filter anwenden
            eventteile = event.get('eventteile', [])
            
            # Eventteile normalisieren (Array oder JSON-String zu Array)
            if isinstance(eventteile, str):
                try:
                    eventteile = json.loads(eventteile)
                except (json.JSONDecodeError, TypeError):
                    eventteile = []
            elif not isinstance(eventteile, list):
                eventteile = []
                
            if not eventteile:  # Wenn keine Eventteile definiert, für alle sichtbar
                public_events.append(event)
                continue
                
            # Prüfen, ob Gast an einem der Eventteile teilnimmt (numerische Felder prüfen)
            guest_participates = False
            if guest_info:
                # Sichere Konvertierung zu int
                weisser_saal = int(guest_info.get('Weisser_Saal', 0) or 0)
                anzahl_essen = int(guest_info.get('Anzahl_Essen', 0) or 0)
                anzahl_party = int(guest_info.get('Anzahl_Party', 0) or 0)
                
                # Debug-Log für Bartmann
                if 'Bartmann' in guest_info.get('Nachname', ''):
                    logger.info(f"Bartmann Preview Debug - Event: {event.get('Programmpunkt')}, eventteile: {eventteile}, weisser_saal: {weisser_saal}, anzahl_essen: {anzahl_essen}, anzahl_party: {anzahl_party}")
                
                if 'weisser_saal' in eventteile and weisser_saal > 0:
                    guest_participates = True
                if 'essen' in eventteile and anzahl_essen > 0:
                    guest_participates = True
                if 'party' in eventteile and anzahl_party > 0:
                    guest_participates = True
            
            # Event NUR hinzufügen wenn Gast teilnimmt (Fallback entfernt!)
            if guest_participates:
                public_events.append(event)
        
        # Nach Startzeit sortieren
        public_events.sort(key=lambda x: x.get('Uhrzeit', ''))
        
        # Erste 5 Events für Preview
        preview_events = public_events[:5]
        
        return jsonify({
            'success': True,
            'events': preview_events
        })
        
    except Exception as e:
        logger.error(f"Fehler beim Laden der Zeitplan-Vorschau: {e}")
        return jsonify({'success': False, 'message': f'Serverfehler: {str(e)}'})

@app.route('/api/guest/location')
@require_auth
@require_role(['guest'])
def get_guest_location():
    """API-Endpunkt für Location-Informationen für Gäste"""
    try:
        if not data_manager:
            return jsonify({'success': False, 'message': 'DataManager nicht verfügbar'})
        
        # Gast-Daten laden für Berechtigungsprüfung
        guest_id = session.get('guest_id')
        guest_info = None
        guest_participates_weisser_saal = False
        
        if guest_id is not None:
            try:
                guest_index = int(guest_id)
                
                if guest_index >= 0 and guest_index < len(data_manager.gaesteliste_df):
                    guest_row = data_manager.gaesteliste_df.iloc[guest_index]
                    guest_info = guest_row.to_dict()
                    
                    # Pandas-Werte zu Python-Typen konvertieren
                    guest_data = {}
                    for key, value in guest_info.items():
                        if pd.isna(value):
                            guest_data[key] = None
                        elif hasattr(value, 'item'):
                            guest_data[key] = value.item()
                        else:
                            guest_data[key] = value
                    guest_info = guest_data
                    
                    # Prüfen ob Gast am Weißen Saal teilnimmt
                    weisser_saal = int(guest_info.get('Weisser_Saal', 0) or 0)
                    guest_participates_weisser_saal = weisser_saal > 0
                    
            except (IndexError, ValueError) as e:
                logger.error(f"DEBUG: Fehler beim Laden der Gastdaten: {e}")
                pass
        
        # Zuerst aus hochzeit_config.json laden
        config = data_manager.load_config()
        logger.info(f"Geladene Config für Location: {config}")
        
        locations = {}
        
        # 1. Neue Struktur: locations.standesamt und locations.hochzeitslocation
        if config and 'locations' in config:
            # Standesamt nur anzeigen wenn Gast berechtigt ist
            if 'standesamt' in config['locations'] and guest_participates_weisser_saal:
                locations['standesamt'] = config['locations']['standesamt']
                logger.info(f"Standesamt aus config gefunden (Gast berechtigt): {locations['standesamt']}")
            elif 'standesamt' in config['locations']:
                logger.info(f"Standesamt aus config gefunden, aber Gast nicht berechtigt (Weisser_Saal: {guest_info.get('Weisser_Saal', 0) if guest_info else 0})")
            
            # Hochzeitslocation immer anzeigen (alle Gäste dürfen die Location sehen)
            if 'hochzeitslocation' in config['locations']:
                locations['hochzeitslocation'] = config['locations']['hochzeitslocation']
                logger.info(f"Hochzeitslocation aus config gefunden: {locations['hochzeitslocation']}")
        
        # 2. Fallback: Alte Struktur unter 'hochzeitsort'
        if not locations and config and 'hochzeitsort' in config:
            # Verwende alte Struktur als Hochzeitslocation
            locations['hochzeitslocation'] = config['hochzeitsort']
            logger.info(f"Fallback: Hochzeitslocation aus alter Struktur: {locations['hochzeitslocation']}")
        
        # 3. Fallback: Settings aus hochzeit_config.json
        elif not locations and config and 'settings' in config and config['settings'] and 'hochzeitsort' in config['settings']:
            ort_string = config['settings']['hochzeitsort']
            if ort_string:
                # Wenn es ein String ist, konvertiere zu Objekt
                if isinstance(ort_string, str):
                    locations['hochzeitslocation'] = {
                        'name': ort_string,
                        'adresse': ort_string,
                        'beschreibung': ''
                    }
                else:
                    locations['hochzeitslocation'] = ort_string
                logger.info(f"Fallback: Location aus config settings: {locations['hochzeitslocation']}")
        
        # 4. Fallback: Settings aus settings.json prüfen
        if not locations:
            settings = data_manager.load_settings()
            logger.info(f"Fallback: Geladene Settings für Location: {settings}")
            
            if settings and 'hochzeitsort' in settings:
                locations['hochzeitslocation'] = settings['hochzeitsort']
                logger.info(f"Fallback: Location aus settings.json: {locations['hochzeitslocation']}")
        
        if not locations or not any(locations.values()):
            logger.warning("Keine Location-Informationen gefunden")
            return jsonify({
                'success': False,
                'message': 'Keine Location-Informationen verfügbar'
            })
        
        # Sicherstellen, dass alle Locations korrekte Objekte sind
        for location_type, location_info in locations.items():
            if not isinstance(location_info, dict):
                locations[location_type] = {'name': str(location_info), 'adresse': '', 'beschreibung': ''}
        
        return jsonify({
            'success': True,
            'locations': locations
        })
        
    except Exception as e:
        logger.error(f"Fehler beim Laden der Location-Daten: {e}")
        return jsonify({'success': False, 'message': 'Serverfehler'})

@app.route('/api/guest/informationen')
@require_auth
@require_role(['guest'])
def get_guest_informationen():
    """API-Endpunkt für konfigurierbare Gäste-Informationen"""
    try:
        if not data_manager:
            return jsonify({'success': False, 'message': 'DataManager nicht verfügbar'})
        
        # Settings laden
        settings = data_manager.load_settings()
        logger.info(f"Geladene Settings für Informationen: {settings}")
        
        # Fallback-Werte falls settings None ist
        if settings is None:
            settings = {}
        
        gaeste_info = settings.get('gaeste_informationen', {})
        
        # Fallback-Werte falls nicht konfiguriert
        default_info = {
            'kontakt': {
                'einzelperson': 'Bei Fragen kannst du dich gerne an uns wenden.',
                'mehrere': 'Bei Fragen könnt ihr euch gerne an uns wenden.'
            },
            'geschenke': {
                'einzelperson': 'Über dein Kommen freuen wir uns am meisten!',
                'mehrere': 'Über euer Kommen freuen wir uns am meisten!'
            },
            'dresscode': {
                'einzelperson': 'Festliche Kleidung erwünscht.',
                'mehrere': 'Festliche Kleidung erwünscht.'
            }
        }
        
        # Merge mit Fallback-Werten
        for kategorie in default_info:
            if kategorie not in gaeste_info:
                gaeste_info[kategorie] = default_info[kategorie]
            else:
                # Merge einzelne Felder, behalte zusätzliche Felder wie whatsapp_nummer
                for typ in default_info[kategorie]:
                    if typ not in gaeste_info[kategorie]:
                        gaeste_info[kategorie][typ] = default_info[kategorie][typ]
        
        # Debug: Log die finale gaeste_info
        logger.info(f"Final gaeste_info being sent: {gaeste_info}")
        
        return jsonify({
            'success': True,
            'informationen': gaeste_info
        })
        
    except Exception as e:
        logger.error(f"Fehler beim Laden der Gäste-Informationen: {e}")
        return jsonify({'success': False, 'message': 'Serverfehler'})

@app.route('/api/guest/location-coordinates')
@require_auth
@require_role(['guest'])
def get_guest_location_coordinates():
    """API-Endpunkt für Geocodierung der Location-Adressen für Gäste"""
    try:
        if not data_manager:
            return jsonify({'success': False, 'message': 'DataManager nicht verfügbar'})
        
        import requests
        import time
        
        # Gast-Daten laden für Berechtigungsprüfung
        guest_id = session.get('guest_id')
        guest_info = None
        guest_participates_weisser_saal = False
        
        if guest_id is not None:
            try:
                guest_index = int(guest_id)
                if guest_index >= 0 and guest_index < len(data_manager.gaesteliste_df):
                    guest_row = data_manager.gaesteliste_df.iloc[guest_index]
                    guest_info = guest_row.to_dict()
                    
                    # Pandas-Werte zu Python-Typen konvertieren
                    guest_data = {}
                    for key, value in guest_info.items():
                        if pd.isna(value):
                            guest_data[key] = None
                        elif hasattr(value, 'item'):
                            guest_data[key] = value.item()
                        else:
                            guest_data[key] = value
                    guest_info = guest_data
                    
                    # Prüfen ob Gast am Weißen Saal teilnimmt
                    weisser_saal = int(guest_info.get('Weisser_Saal', 0) or 0)
                    guest_participates_weisser_saal = weisser_saal > 0
                    
            except (IndexError, ValueError):
                pass
        
        # Location-Daten aus Config laden
        config = data_manager.load_config()
        
        if not config or 'locations' not in config:
            return jsonify({'success': False, 'message': 'Keine Location-Daten verfügbar'})
        
        coordinates = {}
        
        # Bekannte Aachen-Adressen für bessere Performance
        aachen_special_cases = {
            'rathaus, markt 39, 52062 aachen': {'lat': 50.7753, 'lng': 6.0839},
            'markt 39, 52062 aachen': {'lat': 50.7753, 'lng': 6.0839},
            'rathaus aachen': {'lat': 50.7753, 'lng': 6.0839},
            'kruppstraße 28, 52072 aachen': {'lat': 50.7698, 'lng': 6.0892},
            'kruppstrasse 28, 52072 aachen': {'lat': 50.7698, 'lng': 6.0892},
            'hotel kastanienhof aachen': {'lat': 50.7698, 'lng': 6.0892},
            'komericher weg 42/44, 52078 aachen-brand': {'lat': 50.7435, 'lng': 6.1242},
            'komericher mühle': {'lat': 50.7435, 'lng': 6.1242}
        }
        
        for location_type, location_info in config['locations'].items():
            # Standesamt nur für berechtigte Gäste
            if location_type == 'standesamt' and not guest_participates_weisser_saal:
                logger.info(f"Standesamt-Koordinaten für Gast {guest_id} nicht verfügbar (Weisser_Saal: {guest_info.get('Weisser_Saal', 0) if guest_info else 0})")
                continue
                
            if isinstance(location_info, dict) and 'adresse' in location_info:
                address = location_info['adresse'].lower().strip()
                
                # Erst in bekannten Adressen suchen
                if address in aachen_special_cases:
                    coordinates[location_type] = aachen_special_cases[address]
                    logger.info(f"Verwendung bekannter Koordinaten für {address}: {coordinates[location_type]}")
                    continue
                
                # Geocoding mit Nominatim versuchen
                try:
                    params = {
                        'q': location_info['adresse'],
                        'format': 'json',
                        'addressdetails': 1,
                        'limit': 1,
                        'countrycodes': 'de',
                        'bounded': 1,
                        'viewbox': '5.8,50.6,6.3,50.9'  # Bounding box für NRW/Aachen
                    }
                    
                    response = requests.get('https://nominatim.openstreetmap.org/search', 
                                          params=params, 
                                          headers={'User-Agent': 'Hochzeitsplaner/1.0'},
                                          timeout=5)
                    
                    if response.status_code == 200:
                        data = response.json()
                        if data:
                            coordinates[location_type] = {
                                'lat': float(data[0]['lat']),
                                'lng': float(data[0]['lon'])
                            }
                            logger.info(f"Geocoding erfolgreich für {location_info['adresse']}: {coordinates[location_type]}")
                        else:
                            logger.warning(f"Keine Geocoding-Ergebnisse für {location_info['adresse']}")
                            # Fallback auf Aachen Zentrum
                            coordinates[location_type] = {'lat': 50.7753, 'lng': 6.0839}
                    else:
                        logger.warning(f"Geocoding-Request fehlgeschlagen für {location_info['adresse']}: {response.status_code}")
                        coordinates[location_type] = {'lat': 50.7753, 'lng': 6.0839}
                    
                    # Rate limiting
                    time.sleep(1)
                    
                except Exception as geo_error:
                    logger.error(f"Geocoding-Fehler für {location_info['adresse']}: {geo_error}")
                    # Fallback auf Aachen Zentrum
                    coordinates[location_type] = {'lat': 50.7753, 'lng': 6.0839}
        
        return jsonify({
            'success': True,
            'coordinates': coordinates
        })
        
    except Exception as e:
        logger.error(f"Fehler beim Geocoding der Location-Koordinaten: {e}")
        return jsonify({'success': False, 'message': 'Serverfehler'})

# ADMIN-ONLY: Gast-Credentials verwalten
@app.route('/api/admin/generate-guest-credentials', methods=['POST'])
@require_auth
@require_role(['admin'])
def generate_guest_credentials():
    """API-Endpunkt zum Generieren von Gast-Login-Credentials (nur für Admins)"""
    try:
        if not data_manager:
            return jsonify({'success': False, 'message': 'DataManager nicht verfügbar'})
        
        success = data_manager.generate_all_guest_credentials()
        
        if success:
            credentials_list = data_manager.get_guest_credentials_list()
            return jsonify({
                'success': True,
                'message': 'Login-Credentials erfolgreich generiert',
                'credentials': credentials_list
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Fehler beim Generieren der Credentials'
            })
        
    except Exception as e:
        logger.error(f"Fehler beim Generieren der Gast-Credentials: {e}")
        return jsonify({'success': False, 'message': 'Serverfehler'})

@app.route('/api/admin/guest-credentials', methods=['GET'])
@require_auth
@require_role(['admin'])
def get_guest_credentials():
    """API-Endpunkt zum Abrufen aller Gast-Credentials (nur für Admins)"""
    try:
        if not data_manager:
            return jsonify({'success': False, 'message': 'DataManager nicht verfügbar'})
        
        credentials_list = data_manager.get_guest_credentials_list()
        
        return jsonify({
            'success': True,
            'credentials': credentials_list
        })
        
    except Exception as e:
        logger.error(f"Fehler beim Abrufen der Gast-Credentials: {e}")
        return jsonify({'success': False, 'message': 'Serverfehler'})

@app.route('/api/guest/zeitplan')
@require_auth
@require_role(['guest'])
def get_guest_zeitplan():
    try:
        if data_manager.zeitplan_df.empty:
            return jsonify({
                'success': True,
                'events': []
            })

        # Gast-Daten laden
        guest_id = session.get('guest_id')
        if not guest_id:
            return jsonify({'success': False, 'message': 'Gast nicht authentifiziert'})
        
        # Gast-Details abrufen
        guest_info = None
        try:
            # guest_id ist der DataFrame-Index (0-basiert), nicht 1-basiert!
            guest_index = int(guest_id)
            if guest_index >= 0 and guest_index < len(data_manager.gaesteliste_df):
                guest_row = data_manager.gaesteliste_df.iloc[guest_index]
                guest_info = guest_row.to_dict()
                
                # Pandas-Werte zu Python-Typen konvertieren
                guest_data = {}
                for key, value in guest_info.items():
                    if pd.isna(value):
                        guest_data[key] = None
                    elif hasattr(value, 'item'):  # pandas scalars
                        guest_data[key] = value.item()
                    else:
                        guest_data[key] = value
                guest_info = guest_data
                
                # Debug-Log für alle Gäste
                logger.info(f"Guest {guest_index} ({guest_info.get('Nachname', 'Unknown')}) - Weisser_Saal: {guest_info.get('Weisser_Saal')}, Anzahl_Essen: {guest_info.get('Anzahl_Essen')}, Anzahl_Party: {guest_info.get('Anzahl_Party')}")
        except (IndexError, ValueError):
            pass
        
        # DataFrame zu Liste von Dictionaries konvertieren
        zeitplan_events = []
        for index, row in data_manager.zeitplan_df.iterrows():
            event_dict = {}
            for key, value in row.to_dict().items():
                if pd.isna(value):
                    event_dict[key] = None
                elif hasattr(value, 'item'):  # pandas scalars
                    event_dict[key] = value.item()
                else:
                    event_dict[key] = value
            zeitplan_events.append(event_dict)
        
        # Nur öffentliche Events filtern
        public_events = []
        for event in zeitplan_events:
            if not event.get('public', False):
                continue
                
            # Eventteile-Filter anwenden
            eventteile = event.get('eventteile', [])
            
            # Eventteile normalisieren (Array oder JSON-String zu Array)
            if isinstance(eventteile, str):
                try:
                    eventteile = json.loads(eventteile)
                except (json.JSONDecodeError, TypeError):
                    eventteile = []
            elif not isinstance(eventteile, list):
                eventteile = []
                
            if not eventteile:  # Wenn keine Eventteile definiert, für alle sichtbar
                public_events.append(event)
                continue
                
            # Prüfen, ob Gast an einem der Eventteile teilnimmt (numerische Felder prüfen)
            guest_participates = False
            if guest_info:
                # Sichere Konvertierung zu int
                weisser_saal = int(guest_info.get('Weisser_Saal', 0) or 0)
                anzahl_essen = int(guest_info.get('Anzahl_Essen', 0) or 0)
                anzahl_party = int(guest_info.get('Anzahl_Party', 0) or 0)
                
                # Debug-Log für Bartmann
                if 'Bartmann' in guest_info.get('Nachname', ''):
                    logger.info(f"Bartmann Zeitplan Debug - Event: {event.get('Programmpunkt')}, eventteile: {eventteile}, weisser_saal: {weisser_saal}, anzahl_essen: {anzahl_essen}, anzahl_party: {anzahl_party}")
                
                if 'weisser_saal' in eventteile and weisser_saal > 0:
                    guest_participates = True
                if 'essen' in eventteile and anzahl_essen > 0:
                    guest_participates = True
                if 'party' in eventteile and anzahl_party > 0:
                    guest_participates = True
            
            # Event NUR hinzufügen wenn Gast teilnimmt (Fallback entfernt!)
            if guest_participates:
                public_events.append(event)
        
        # Nach Startzeit sortieren
        public_events.sort(key=lambda x: x.get('Uhrzeit', ''))
        
        return jsonify({
            'success': True,
            'events': public_events
        })
        
    except Exception as e:
        logger.error(f"Fehler beim Laden des Zeitplans: {e}")
        return jsonify({'success': False, 'message': f'Serverfehler: {str(e)}'})

# API Endpunkte
@app.route('/api/dashboard/stats')
def api_dashboard_stats():
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        gaeste_stats = data_manager.get_guest_statistics()
        budget_stats = data_manager.get_budget_summary()
        settings = data_manager.load_settings()
        
        # Daten bereinigen
        response_data = {
            'success': True,
            'gaeste': clean_json_data(gaeste_stats),
            'budget': clean_json_data(budget_stats),
            'settings': clean_json_data(settings)
        }
        
        return jsonify(response_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/gaeste/list')
def api_gaeste_list():
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        # DataFrame zu Records konvertieren und NaN-Werte behandeln
        gaeste_df = data_manager.gaesteliste_df.fillna('')
        gaeste_list = gaeste_df.to_dict('records')
        
        # Daten für JSON bereinigen
        cleaned_gaeste = clean_json_data(gaeste_list)
        
        return jsonify({
            'success': True,
            'gaeste': cleaned_gaeste,
            'count': len(cleaned_gaeste)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/gaeste/sync-teilnahme', methods=['POST'])
def api_gaeste_sync_teilnahme():
    """Synchronisiert die Zum_* Felder basierend auf den Anzahl-Feldern"""
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        # Gästeliste laden
        data_manager.load_gaesteliste()
        
        def safe_int(value):
            try:
                if value is None or value == '':
                    return 0
                return int(float(str(value)))
            except (ValueError, TypeError):
                return 0
        
        updates_count = 0
        
        # Für jeden Gast die Zum_* Felder basierend auf Anzahl-Feldern setzen
        for index, row in data_manager.gaesteliste_df.iterrows():
            weisser_saal = safe_int(row.get('Weisser_Saal', 0))
            anzahl_essen = safe_int(row.get('Anzahl_Essen', 0))
            anzahl_party = safe_int(row.get('Anzahl_Party', 0))
            
            # Implementiere hierarchische Logik und synchronisiere Anzahl-Felder
            # Weißer Saal → automatisch auch Essen
            # Essen → automatisch auch Party
            final_essen = max(anzahl_essen, weisser_saal)
            final_party = max(anzahl_party, final_essen)
            
            # Aktualisiere die Anzahl-Felder wenn nötig
            if final_essen != anzahl_essen:
                data_manager.gaesteliste_df.loc[index, 'Anzahl_Essen'] = final_essen
                anzahl_essen = final_essen
                updates_count += 1
                
            if final_party != anzahl_party:
                data_manager.gaesteliste_df.loc[index, 'Anzahl_Party'] = final_party
                anzahl_party = final_party
                updates_count += 1
            
            # Setze Zum_* basierend auf finalen Anzahlen
            new_zum_weisser_saal = 'Ja' if weisser_saal > 0 else 'Nein'
            new_zum_essen = 'Ja' if anzahl_essen > 0 else 'Nein'
            new_zur_party = 'Ja' if anzahl_party > 0 else 'Nein'
            
            # Prüfe ob Updates nötig sind
            if (row.get('Zum_Weisser_Saal') != new_zum_weisser_saal or 
                row.get('Zum_Essen') != new_zum_essen or 
                row.get('Zur_Party') != new_zur_party):
                
                data_manager.gaesteliste_df.loc[index, 'Zum_Weisser_Saal'] = new_zum_weisser_saal
                data_manager.gaesteliste_df.loc[index, 'Zum_Essen'] = new_zum_essen
                data_manager.gaesteliste_df.loc[index, 'Zur_Party'] = new_zur_party
                updates_count += 1
        
        # Speichern
        data_manager.save_gaesteliste()
        
        return jsonify({
            'success': True, 
            'message': f'{updates_count} Gäste synchronisiert',
            'updates_count': updates_count
        })
            
    except Exception as e:
        logger.error(f"Fehler bei der Synchronisation: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/gaeste/add', methods=['POST'])
def api_gaeste_add():
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        gast_data = request.json
        required_fields = ['Nachname', 'Vorname', 'Kategorie', 'Status']
        
        for field in required_fields:
            if field not in gast_data or not str(gast_data[field]).strip():
                return jsonify({'error': f'Feld "{field}" ist erforderlich'}), 400
        
        # Standardwerte für alle möglichen Felder setzen
        defaults = {
            'Begleitung': '',
            'Kind': 0,
            'Anzahl_Personen': 1,
            'Optional': 0,
            'Weisser_Saal': 0,
            'Seite': '',
            'Kontakt': '',
            'Anzahl_Essen': 0,
            'Anzahl_Party': 0,
            'Email': '',
            'Adresse': '',
            'Bemerkungen': '',
            'Zum_Weisser_Saal': 'Nein',
            'Zum_Essen': 'Nein',
            'Zur_Party': 'Nein'
        }
        
        for key, default in defaults.items():
            if key not in gast_data:
                gast_data[key] = default
        
        # Numerische Felder sicherstellen
        numeric_fields = ['Kind', 'Anzahl_Personen', 'Optional', 'Weisser_Saal', 'Anzahl_Essen', 'Anzahl_Party']
        for field in numeric_fields:
            try:
                gast_data[field] = int(gast_data.get(field, 0))
            except (ValueError, TypeError):
                gast_data[field] = 0
        
        success = data_manager.add_guest(gast_data)
        
        if success:
            return jsonify({'success': True, 'message': 'Gast erfolgreich hinzugefügt'})
        else:
            return jsonify({'error': 'Fehler beim Hinzufügen'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/gaeste/update/<int:index>', methods=['PUT'])
def api_gaeste_update(index):
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        gast_data = request.json
        
        # Prüfe ob Index gültig ist
        if index >= len(data_manager.gaesteliste_df):
            return jsonify({'error': 'Ungültiger Gast-Index'}), 400
        
        # Aktualisiere die Daten im DataFrame
        for key, value in gast_data.items():
            if key in data_manager.gaesteliste_df.columns:
                data_manager.gaesteliste_df.loc[index, key] = value
        
        # Speichere die Änderungen
        success = data_manager.save_gaesteliste()
        
        if success:
            return jsonify({'success': True, 'message': 'Gast aktualisiert'})
        else:
            return jsonify({'error': 'Fehler beim Speichern'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/gaeste/delete/<int:index>', methods=['DELETE'])
def api_gaeste_delete(index):
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        # Prüfe ob Index gültig ist
        if index >= len(data_manager.gaesteliste_df):
            return jsonify({'error': 'Ungültiger Gast-Index'}), 400
        
        # Lösche den Gast
        data_manager.gaesteliste_df = data_manager.gaesteliste_df.drop(index).reset_index(drop=True)
        
        # Speichere die Änderungen
        success = data_manager.save_gaesteliste()
        
        if success:
            return jsonify({'success': True, 'message': 'Gast gelöscht'})
        else:
            return jsonify({'error': 'Fehler beim Speichern'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route("/api/settings/get")
def api_settings_get():
    try:
        if not data_manager:
            return jsonify({"error": "DataManager nicht initialisiert"}), 500
        
        # Lade aus config statt settings
        config = data_manager.load_config()
        settings = config.get('settings', {})
        
        # Füge Locations aus der config hinzu
        if 'locations' in config:
            settings['locations'] = config['locations']
        
        # Legacy-Support: Hochzeitsort aus config übernehmen
        if 'hochzeitsort' in config:
            settings['hochzeitsort'] = config['hochzeitsort']
        
        cleaned_settings = clean_json_data(settings)
        
        return jsonify({"success": True, "settings": cleaned_settings})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/zeitplan/list')
def api_zeitplan_list():
    """Zeitplan-Liste abrufen"""
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
            
        data_manager.load_zeitplan()
        zeitplan = data_manager.zeitplan_df
        
        if zeitplan.empty:
            return jsonify({
                'success': True,
                'zeitplan': []
            })
        
        zeitplan_data = clean_json_data(zeitplan.to_dict('records'))
        
        return jsonify({
            'success': True,
            'zeitplan': zeitplan_data
        })
    except Exception as e:
        logger.error(f"Fehler beim Laden des Zeitplans: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/zeitplan/add', methods=['POST'])
def api_zeitplan_add():
    """Neuen Zeitplan-Eintrag hinzufügen"""
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        event_data = request.json
        
        # Validierung
        if not event_data.get('Uhrzeit') or not event_data.get('Programmpunkt'):
            return jsonify({'error': 'Uhrzeit und Programmpunkt sind erforderlich'}), 400
        
        # Zeitplan laden
        data_manager.load_zeitplan()
        
        # Neuen Eintrag erstellen
        eventteile = event_data.get('eventteile', [])
        eventteile_json = json.dumps(eventteile) if isinstance(eventteile, list) else json.dumps([])
        
        new_event = {
            'Uhrzeit': event_data.get('Uhrzeit'),
            'Programmpunkt': event_data.get('Programmpunkt'),
            'Dauer': event_data.get('Dauer', ''),
            'EndZeit': event_data.get('EndZeit', ''),
            'Verantwortlich': event_data.get('Verantwortlich', ''),
            'Status': event_data.get('Status', 'Geplant'),
            'public': event_data.get('public', False),
            'eventteile': eventteile_json
        }
        
        # Zu DataFrame hinzufügen
        new_df = pd.DataFrame([new_event])
        data_manager.zeitplan_df = pd.concat([data_manager.zeitplan_df, new_df], ignore_index=True)
        
        # Speichern
        data_manager.save_zeitplan()
        
        return jsonify({
            'success': True,
            'message': 'Programmpunkt erfolgreich hinzugefügt'
        })
    except Exception as e:
        logger.error(f"Fehler beim Hinzufügen des Programmpunkts: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/zeitplan/update', methods=['POST'])
def api_zeitplan_update():
    """Zeitplan-Eintrag bearbeiten"""
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        update_data = request.json
        index = update_data.get('index')
        event_data = update_data.get('data')
        
        # Validierung
        if index is None or not event_data:
            return jsonify({'error': 'Index und Daten sind erforderlich'}), 400
        
        if not event_data.get('Uhrzeit') or not event_data.get('Programmpunkt'):
            return jsonify({'error': 'Uhrzeit und Programmpunkt sind erforderlich'}), 400
        
        # Zeitplan laden
        data_manager.load_zeitplan()
        
        # Index prüfen
        if index < 0 or index >= len(data_manager.zeitplan_df):
            return jsonify({'error': 'Ungültiger Index'}), 400
        
        # Eintrag aktualisieren
        data_manager.zeitplan_df.loc[index, 'Uhrzeit'] = event_data.get('Uhrzeit')
        data_manager.zeitplan_df.loc[index, 'Programmpunkt'] = event_data.get('Programmpunkt')
        data_manager.zeitplan_df.loc[index, 'Dauer'] = event_data.get('Dauer', '')
        data_manager.zeitplan_df.loc[index, 'EndZeit'] = event_data.get('EndZeit', '')
        data_manager.zeitplan_df.loc[index, 'Verantwortlich'] = event_data.get('Verantwortlich', '')
        data_manager.zeitplan_df.loc[index, 'Status'] = event_data.get('Status', 'Geplant')
        data_manager.zeitplan_df.loc[index, 'public'] = event_data.get('public', False)
        
        # Eventteile als JSON-String speichern
        eventteile = event_data.get('eventteile', [])
        if isinstance(eventteile, list):
            data_manager.zeitplan_df.loc[index, 'eventteile'] = json.dumps(eventteile)
        else:
            data_manager.zeitplan_df.loc[index, 'eventteile'] = json.dumps([])
        
        # Speichern
        data_manager.save_zeitplan()
        
        return jsonify({
            'success': True,
            'message': 'Programmpunkt erfolgreich aktualisiert'
        })
    except Exception as e:
        logger.error(f"Fehler beim Aktualisieren des Programmpunkts: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/zeitplan/delete', methods=['POST'])
def api_zeitplan_delete():
    """Zeitplan-Eintrag löschen"""
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        delete_data = request.json
        index = delete_data.get('index')
        
        # Validierung
        if index is None:
            return jsonify({'error': 'Index ist erforderlich'}), 400
        
        # Zeitplan laden
        data_manager.load_zeitplan()
        
        # Index prüfen
        if index < 0 or index >= len(data_manager.zeitplan_df):
            return jsonify({'error': 'Ungültiger Index'}), 400
        
        # Eintrag löschen
        data_manager.zeitplan_df = data_manager.zeitplan_df.drop(index).reset_index(drop=True)
        
        # Speichern
        data_manager.save_zeitplan()
        
        return jsonify({
            'success': True,
            'message': 'Programmpunkt erfolgreich gelöscht'
        })
    except Exception as e:
        logger.error(f"Fehler beim Löschen des Programmpunkts: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/settings/save', methods=['POST'])
def api_settings_save():
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        settings_data = request.json
        
        # Aktuelle Config laden
        current_config = data_manager.load_config()
        
        # Speichere jede Einstellung 
        for key, value in settings_data.items():
            if value is not None and value != '':  # Nur nicht-leere Werte speichern
                if key == 'locations':
                    # Locations direkt in die Config speichern
                    current_config['locations'] = value
                elif key == 'hochzeitsort':
                    # Legacy hochzeitsort in Config speichern
                    current_config['hochzeitsort'] = value
                else:
                    # Normale Settings über set_setting
                    data_manager.set_setting(key, value)
        
        # Config speichern wenn Locations oder Legacy-Daten geändert wurden
        if 'locations' in settings_data or 'hochzeitsort' in settings_data:
            success = data_manager.save_config(current_config)
            if not success:
                return jsonify({'error': 'Fehler beim Speichern der Location-Daten'}), 500
        
        return jsonify({'success': True, 'message': 'Einstellungen gespeichert'})
    except Exception as e:
        logger.error(f"Fehler beim Speichern der Einstellungen: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/export/excel')
def api_export_excel():
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as temp_file:
            temp_path = temp_file.name
        
        success = data_manager.export_to_excel(temp_path)
        
        if success and os.path.exists(temp_path):
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            return send_file(
                temp_path,
                as_attachment=True,
                download_name=f'Hochzeitsplaner_{timestamp}.xlsx',
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
        else:
            return jsonify({'error': 'Excel-Export fehlgeschlagen'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/backup/create', methods=['POST'])
def api_backup_create():
    """Erstellt ein ZIP-Backup aller Hochzeitsdaten"""
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        # Temporäres Verzeichnis für das Backup erstellen
        with tempfile.TemporaryDirectory() as temp_dir:
            backup_dir = os.path.join(temp_dir, 'hochzeit-backup')
            os.makedirs(backup_dir, exist_ok=True)
            
            # Data-Verzeichnis kopieren
            data_source = os.path.join(os.path.dirname(__file__), 'data')
            data_backup = os.path.join(backup_dir, 'data')
            if os.path.exists(data_source):
                shutil.copytree(data_source, data_backup)
            
            # Konfigurationsdateien kopieren
            config_files = [
                'auth_config.json'  # Auth bleibt im Root
            ]
            
            for config_file in config_files:
                source_path = os.path.join(os.path.dirname(__file__), config_file)
                if os.path.exists(source_path):
                    dest_path = os.path.join(backup_dir, config_file)
                    shutil.copy2(source_path, dest_path)
            
            # hochzeit_config.json aus data/ Verzeichnis kopieren
            source_hochzeit_config = os.path.join(os.path.dirname(__file__), 'data', 'hochzeit_config.json')
            if os.path.exists(source_hochzeit_config):
                dest_hochzeit_config = os.path.join(backup_dir, 'hochzeit_config.json')
                shutil.copy2(source_hochzeit_config, dest_hochzeit_config)
            
            # README.md für das Backup erstellen
            readme_content = f"""# Hochzeitsplaner Backup
            
Backup erstellt am: {datetime.now().strftime('%d.%m.%Y um %H:%M:%S')}

## Inhalt:
- data/ - Alle Daten (Gästeliste, Budget, Zeitplan, etc.)
- auth_config.json - Benutzer-Konfiguration
- hochzeit_config.json - Allgemeine Einstellungen

## Wiederherstellung:
1. Stoppen Sie die Hochzeitsplaner-Anwendung
2. Kopieren Sie den Inhalt dieses Backups in Ihr Anwendungsverzeichnis
3. Starten Sie die Anwendung neu

## Version: 2.0.0
"""
            
            readme_path = os.path.join(backup_dir, 'README.md')
            with open(readme_path, 'w', encoding='utf-8') as f:
                f.write(readme_content)
            
            # ZIP-Datei erstellen
            zip_path = os.path.join(temp_dir, 'backup.zip')
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for root, dirs, files in os.walk(backup_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        # Relativer Pfad im ZIP
                        arcname = os.path.relpath(file_path, backup_dir)
                        zipf.write(file_path, arcname)
            
            # ZIP-Datei senden
            return send_file(
                zip_path,
                as_attachment=True,
                download_name=f'hochzeit-backup-{datetime.now().strftime("%Y%m%d-%H%M%S")}.zip',
                mimetype='application/zip'
            )
            
    except Exception as e:
        logger.error(f"Fehler beim Erstellen des Backups: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Masseneditierung für Gäste (kompatibel mit alter Datenstruktur)
@app.route('/api/gaeste/mass-update', methods=['PUT'])
def api_gaeste_mass_update():
    """Mehrere Gäste gleichzeitig bearbeiten"""
    try:
        request_data = request.get_json()
        indices = request_data.get('indices', [])
        updates = request_data.get('updates', {})
        
        if not indices or not updates:
            return jsonify({'success': False, 'error': 'Indices und Updates sind erforderlich'}), 400
        
        # Gästeliste laden
        data_manager.load_gaesteliste()
        
        # Updates anwenden
        for index in indices:
            if 0 <= index < len(data_manager.gaesteliste_df):
                for key, value in updates.items():
                    if key in data_manager.gaesteliste_df.columns:
                        data_manager.gaesteliste_df.iloc[index, data_manager.gaesteliste_df.columns.get_loc(key)] = value
        
        # Speichern
        data_manager.save_gaesteliste()
        
        return jsonify({'success': True, 'message': f'{len(indices)} Gäste aktualisiert'})
    except Exception as e:
        logger.error(f"Fehler bei der Masseneditierung: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    # Direkter Start der app.py (nicht über Launcher)
    # DataManager ist bereits initialisiert
    if not data_manager:
        print("❌ KRITISCHER FEHLER: DataManager nicht verfügbar")
        sys.exit(1)
    
    port = 8080  # Fester Port 8080
    
    print("🎉 Hochzeitsplaner Web-Anwendung (Direkter Start)")
    print("=" * 50)
    print(f"✅ DataManager bereits initialisiert: {data_manager.data_dir}")
    print(f"🌐 URL: http://localhost:{port}")
    
    # Debug: Zeige alle registrierten Routen
    print("\n📋 Registrierte Routen:")
    for rule in app.url_map.iter_rules():
        print(f"  - {rule.rule} ({rule.methods})")
    
    print("⚠️  Zum Beenden: Strg+C")
    print("=" * 50)
    
# =============================================================================
# Aufgabenplaner API Routen
# =============================================================================

@app.route('/aufgabenplaner')
@require_auth
@require_role(['admin', 'user'])
def aufgabenplaner():
    """Aufgabenplaner Seite"""
    try:
        # Lade Einstellungen für Braut/Bräutigam-Namen
        config = data_manager.load_config()
        settings = config.get('settings', {})
        
        # Erstelle Kontext mit Namen
        context = {
            'bride_name': settings.get('bride_name', 'Braut'),
            'groom_name': settings.get('groom_name', 'Bräutigam')
        }
        
        return render_template('aufgabenplaner.html', **context)
    except Exception as e:
        logger.error(f"Fehler beim Laden der Aufgabenplaner-Seite: {str(e)}")
        # Fallback mit Standardwerten
        return render_template('aufgabenplaner.html', bride_name='Braut', groom_name='Bräutigam')

@app.route('/api/aufgaben/list')
@require_auth
@require_role(['admin', 'user'])
def api_aufgaben_list():
    """Aufgabenliste abrufen"""
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        aufgaben = data_manager.load_aufgaben()
        
        return jsonify({
            'success': True,
            'aufgaben': clean_json_data(aufgaben)
        })
    except Exception as e:
        logger.error(f"Fehler beim Laden der Aufgaben: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/aufgaben/get/<int:aufgabe_id>')
@require_auth
@require_role(['admin', 'user'])
def api_aufgaben_get(aufgabe_id):
    """Einzelne Aufgabe abrufen"""
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        aufgaben = data_manager.load_aufgaben()
        aufgabe = next((a for a in aufgaben if a.get('id') == aufgabe_id), None)
        
        if not aufgabe:
            return jsonify({'success': False, 'error': 'Aufgabe nicht gefunden'}), 404
        
        return jsonify({
            'success': True,
            'aufgabe': clean_json_data(aufgabe)
        })
    except Exception as e:
        logger.error(f"Fehler beim Laden der Aufgabe: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/aufgaben/add', methods=['POST'])
@require_auth
@require_role(['admin', 'user'])
def api_aufgaben_add():
    """Neue Aufgabe hinzufügen"""
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'Keine Daten empfangen'}), 400
        
        # Validiere erforderliche Felder
        if not data.get('titel'):
            return jsonify({'success': False, 'error': 'Titel ist erforderlich'}), 400
        
        # Setze Standardwerte
        aufgabe_data = {
            'titel': data.get('titel', '').strip(),
            'beschreibung': data.get('beschreibung', '').strip(),
            'zustaendig': data.get('zustaendig', 'Braut'),
            'status': data.get('status', 'Offen'),
            'prioritaet': data.get('prioritaet', 'Mittel'),
            'faelligkeitsdatum': data.get('faelligkeitsdatum', ''),
            'kategorie': data.get('kategorie', '').strip(),
            'notizen': data.get('notizen', '').strip()
        }
        
        # Aufgabe hinzufügen
        aufgabe_id = data_manager.add_aufgabe(aufgabe_data)
        
        if aufgabe_id > 0:
            return jsonify({
                'success': True,
                'message': 'Aufgabe erfolgreich hinzugefügt',
                'aufgabe_id': aufgabe_id
            })
        else:
            return jsonify({'success': False, 'error': 'Fehler beim Hinzufügen der Aufgabe'}), 500
            
    except Exception as e:
        logger.error(f"Fehler beim Hinzufügen der Aufgabe: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/aufgaben/update/<int:aufgabe_id>', methods=['PUT'])
@require_auth
@require_role(['admin', 'user'])
def api_aufgaben_update(aufgabe_id):
    """Aufgabe aktualisieren"""
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'Keine Daten empfangen'}), 400
        
        # Validiere erforderliche Felder
        if not data.get('titel'):
            return jsonify({'success': False, 'error': 'Titel ist erforderlich'}), 400
        
        # Setze Daten
        aufgabe_data = {
            'titel': data.get('titel', '').strip(),
            'beschreibung': data.get('beschreibung', '').strip(),
            'zustaendig': data.get('zustaendig', 'Braut'),
            'status': data.get('status', 'Offen'),
            'prioritaet': data.get('prioritaet', 'Mittel'),
            'faelligkeitsdatum': data.get('faelligkeitsdatum', ''),
            'kategorie': data.get('kategorie', '').strip(),
            'notizen': data.get('notizen', '').strip()
        }
        
        # Aufgabe aktualisieren
        success = data_manager.update_aufgabe(aufgabe_id, aufgabe_data)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Aufgabe erfolgreich aktualisiert'
            })
        else:
            return jsonify({'success': False, 'error': 'Aufgabe nicht gefunden oder Fehler beim Aktualisieren'}), 404
            
    except Exception as e:
        logger.error(f"Fehler beim Aktualisieren der Aufgabe: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/aufgaben/delete/<int:aufgabe_id>', methods=['DELETE'])
@require_auth
@require_role(['admin', 'user'])
def api_aufgaben_delete(aufgabe_id):
    """Aufgabe löschen"""
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        # Aufgabe löschen
        success = data_manager.delete_aufgabe(aufgabe_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Aufgabe erfolgreich gelöscht'
            })
        else:
            return jsonify({'success': False, 'error': 'Aufgabe nicht gefunden oder Fehler beim Löschen'}), 404
            
    except Exception as e:
        logger.error(f"Fehler beim Löschen der Aufgabe: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/aufgaben/statistics')
@require_auth
@require_role(['admin', 'user'])
def api_aufgaben_statistics():
    """Aufgaben-Statistiken abrufen"""
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        statistics = data_manager.get_aufgaben_statistics()
        
        return jsonify({
            'success': True,
            'statistics': clean_json_data(statistics)
        })
    except Exception as e:
        logger.error(f"Fehler beim Laden der Aufgaben-Statistiken: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

# =============================================================================
# Hauptprogramm
# =============================================================================

# ===================================================================
# E-MAIL ROUTES
# ===================================================================

@app.route('/api/email/status')
@require_auth
def email_status():
    """Gibt den E-Mail-Status zurück"""
    if not EMAIL_AVAILABLE or not email_manager:
        return jsonify({
            'enabled': False,
            'available': False,
            'message': 'E-Mail Manager nicht verfügbar'
        })
    
    is_enabled = email_manager.is_enabled()
    result = {'enabled': is_enabled, 'available': True}
    
    if is_enabled:
        test_result = email_manager.test_connection()
        result.update(test_result)
    else:
        result['message'] = 'E-Mail-Funktionalität ist deaktiviert'
    
    return jsonify(result)

@app.route('/api/email/test')
@require_auth
def test_email():
    """Testet die E-Mail-Konfiguration"""
    if not EMAIL_AVAILABLE or not email_manager:
        return jsonify({
            'success': False,
            'message': 'E-Mail Manager nicht verfügbar'
        }), 400
    
    if not email_manager.is_enabled():
        return jsonify({
            'success': False,
            'message': 'E-Mail-Funktionalität ist deaktiviert'
        }), 400
    
    result = email_manager.test_connection()
    status_code = 200 if result['success'] else 400
    return jsonify(result), status_code

@app.route('/api/email/send', methods=['POST'])
@require_auth
def send_email():
    """Sendet eine E-Mail"""
    if not EMAIL_AVAILABLE or not email_manager:
        return jsonify({
            'success': False,
            'message': 'E-Mail Manager nicht verfügbar'
        }), 400
    
    if not email_manager.is_enabled():
        return jsonify({
            'success': False,
            'message': 'E-Mail-Funktionalität ist deaktiviert'
        }), 400
    
    try:
        data = request.get_json()
        
        # Pflichtfelder prüfen
        required_fields = ['to_emails', 'subject', 'body']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return jsonify({
                'success': False,
                'message': f'Fehlende Felder: {", ".join(missing_fields)}'
            }), 400
        
        # E-Mail senden
        result = email_manager.send_email(
            to_emails=data['to_emails'],
            subject=data['subject'],
            body=data['body'],
            html_body=data.get('html_body'),
            cc_emails=data.get('cc_emails'),
            bcc_emails=data.get('bcc_emails')
        )
        
        status_code = 200 if result['success'] else 400
        return jsonify(result), status_code
        
    except Exception as e:
        logger.error(f"Fehler beim E-Mail-Versand: {e}")
        return jsonify({
            'success': False,
            'message': f'Fehler beim E-Mail-Versand: {str(e)}'
        }), 500

@app.route('/api/email/invitation', methods=['POST'])
@require_auth
def send_invitation():
    """Sendet Hochzeitseinladungen per E-Mail"""
    if not EMAIL_AVAILABLE or not email_manager:
        return jsonify({
            'success': False,
            'message': 'E-Mail Manager nicht verfügbar'
        }), 400
    
    if not email_manager.is_enabled():
        return jsonify({
            'success': False,
            'message': 'E-Mail-Funktionalität ist deaktiviert'
        }), 400
    
    try:
        data = request.get_json()
        
        # Pflichtfelder prüfen
        required_fields = ['guest_email', 'guest_name', 'event_date', 'event_location']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return jsonify({
                'success': False,
                'message': f'Fehlende Felder: {", ".join(missing_fields)}'
            }), 400
        
        # Einladung senden
        result = email_manager.send_guest_invitation(
            guest_email=data['guest_email'],
            guest_name=data['guest_name'],
            event_date=data['event_date'],
            event_location=data['event_location'],
            rsvp_link=data.get('rsvp_link')
        )
        
        status_code = 200 if result['success'] else 400
        return jsonify(result), status_code
        
    except Exception as e:
        logger.error(f"Fehler beim Einladungsversand: {e}")
        return jsonify({
            'success': False,
            'message': f'Fehler beim Einladungsversand: {str(e)}'
        }), 500

@app.route('/api/email/reminder', methods=['POST'])
@require_auth
def send_reminder():
    """Sendet Erinnerungs-E-Mails"""
    if not EMAIL_AVAILABLE or not email_manager:
        return jsonify({
            'success': False,
            'message': 'E-Mail Manager nicht verfügbar'
        }), 400
    
    if not email_manager.is_enabled():
        return jsonify({
            'success': False,
            'message': 'E-Mail-Funktionalität ist deaktiviert'
        }), 400
    
    try:
        data = request.get_json()
        
        # Pflichtfelder prüfen
        required_fields = ['guest_email', 'guest_name', 'reminder_text']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return jsonify({
                'success': False,
                'message': f'Fehlende Felder: {", ".join(missing_fields)}'
            }), 400
        
        # Erinnerung senden
        result = email_manager.send_reminder_email(
            guest_email=data['guest_email'],
            guest_name=data['guest_name'],
            reminder_text=data['reminder_text']
        )
        
        status_code = 200 if result['success'] else 400
        return jsonify(result), status_code
        
    except Exception as e:
        logger.error(f"Fehler beim Erinnerungsversand: {e}")
        return jsonify({
            'success': False,
            'message': f'Fehler beim Erinnerungsversand: {str(e)}'
        }), 500

# =============================================================================
# AUFGABEN-E-MAIL INTEGRATION API ROUTEN
# =============================================================================

@app.route('/api/aufgaben/<int:aufgabe_id>/email/send', methods=['POST'])
@require_auth
@require_role(['admin', 'user'])
def api_aufgaben_email_send(aufgabe_id):
    """Sendet eine E-Mail zu einer bestimmten Aufgabe"""
    if not EMAIL_AVAILABLE or not email_manager:
        return jsonify({
            'success': False,
            'message': 'E-Mail Manager nicht verfügbar'
        }), 400
    
    if not email_manager.is_enabled():
        return jsonify({
            'success': False,
            'message': 'E-Mail-Funktionalität ist deaktiviert'
        }), 400
    
    try:
        # Aufgabe laden
        aufgaben = data_manager.load_aufgaben()
        aufgabe = next((a for a in aufgaben if a.get('id') == aufgabe_id), None)
        
        if not aufgabe:
            return jsonify({
                'success': False,
                'message': 'Aufgabe nicht gefunden'
            }), 404
        
        data = request.get_json()
        
        # Debug: Log der empfangenen Daten
        logger.info(f"E-Mail-Daten empfangen für Aufgabe {aufgabe_id}: {data}")
        
        # Pflichtfelder prüfen
        required_fields = ['to_emails', 'subject', 'body']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            logger.warning(f"Fehlende Felder beim E-Mail-Versand: {missing_fields}")
            return jsonify({
                'success': False,
                'message': f'Fehlende Felder: {", ".join(missing_fields)}'
            }), 400
        
        # Aufgaben-E-Mail senden
        result = email_manager.send_task_email(
            task_id=aufgabe_id,
            task_title=aufgabe['titel'],
            to_emails=data['to_emails'],
            subject=data['subject'],
            body=data['body'],
            html_body=data.get('html_body'),
            cc_emails=data.get('cc_emails')
        )
        
        # Wenn erfolgreich gesendet, E-Mail-Info zur Aufgabe hinzufügen
        if result['success']:
            # E-Mail-Verlauf zur Aufgabe hinzufügen
            if 'emails' not in aufgabe:
                aufgabe['emails'] = []
            
            email_info = {
                'sent_at': result['sent_at'],
                'thread_id': result['thread_id'],
                'message_id': result['message_id'],
                'to': result['sent_to'],
                'cc': result['cc_to'],
                'subject': data['subject'],
                'body': data['body'][:200] + '...' if len(data['body']) > 200 else data['body']  # Kurze Vorschau
            }
            
            aufgabe['emails'].append(email_info)
            
            # Aufgabe speichern
            data_manager.update_aufgabe(aufgabe_id, aufgabe)
        
        status_code = 200 if result['success'] else 400
        return jsonify(result), status_code
        
    except Exception as e:
        logger.error(f"Fehler beim Aufgaben-E-Mail-Versand: {e}")
        return jsonify({
            'success': False,
            'message': f'Fehler beim E-Mail-Versand: {str(e)}'
        }), 500

@app.route('/api/aufgaben/<int:aufgabe_id>/emails')
@require_auth
@require_role(['admin', 'user'])
def api_aufgaben_emails_get(aufgabe_id):
    """Gibt alle E-Mails einer Aufgabe zurück"""
    try:
        # Aufgabe laden
        aufgaben = data_manager.load_aufgaben()
        aufgabe = next((a for a in aufgaben if a.get('id') == aufgabe_id), None)
        
        if not aufgabe:
            return jsonify({
                'success': False,
                'message': 'Aufgabe nicht gefunden'
            }), 404
        
        emails = aufgabe.get('emails', [])
        
        return jsonify({
            'success': True,
            'task_id': aufgabe_id,
            'task_title': aufgabe['titel'],
            'emails': clean_json_data(emails),
            'email_count': len(emails)
        })
        
    except Exception as e:
        logger.error(f"Fehler beim Laden der Aufgaben-E-Mails: {e}")
        return jsonify({
            'success': False,
            'message': f'Fehler beim Laden: {str(e)}'
        }), 500

@app.route('/api/aufgaben/<int:aufgabe_id>/email/add-reply', methods=['POST'])
@require_auth
@require_role(['admin', 'user'])
def api_aufgaben_email_reply(aufgabe_id):
    """Fügt eine eingehende E-Mail-Antwort zu einer Aufgabe hinzu"""
    try:
        # Aufgabe laden
        aufgaben = data_manager.load_aufgaben()
        aufgabe = next((a for a in aufgaben if a.get('id') == aufgabe_id), None)
        
        if not aufgabe:
            return jsonify({
                'success': False,
                'message': 'Aufgabe nicht gefunden'
            }), 404
        
        data = request.get_json()
        
        # Pflichtfelder prüfen
        required_fields = ['from_email', 'subject', 'body', 'received_at']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return jsonify({
                'success': False,
                'message': f'Fehlende Felder: {", ".join(missing_fields)}'
            }), 400
        
        # E-Mail-Antwort hinzufügen
        if 'email_replies' not in aufgabe:
            aufgabe['email_replies'] = []
        
        reply_info = {
            'received_at': data['received_at'],
            'from_email': data['from_email'],
            'subject': data['subject'],
            'body': data['body'],
            'thread_id': data.get('thread_id', ''),
            'message_id': data.get('message_id', '')
        }
        
        aufgabe['email_replies'].append(reply_info)
        
        # Aufgabe speichern
        success = data_manager.update_aufgabe(aufgabe_id, aufgabe)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'E-Mail-Antwort erfolgreich hinzugefügt',
                'reply_count': len(aufgabe['email_replies'])
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Fehler beim Speichern der E-Mail-Antwort'
            }), 500
        
    except Exception as e:
        logger.error(f"Fehler beim Hinzufügen der E-Mail-Antwort: {e}")
        return jsonify({
            'success': False,
            'message': f'Fehler beim Speichern: {str(e)}'
        }), 500

# =============================================================================
# E-MAIL-ZUORDNUNG API ROUTEN
# =============================================================================

@app.route('/api/email/unassigned', methods=['GET'])
@require_auth
@require_role(['admin', 'user'])
def api_email_unassigned():
    """Ruft alle noch nicht zugeordneten E-Mails ab"""
    if not EMAIL_AVAILABLE or not email_manager:
        return jsonify({
            'success': False,
            'message': 'E-Mail Manager nicht verfügbar'
        }), 400
    
    if not email_manager.is_enabled():
        return jsonify({
            'success': False,
            'message': 'E-Mail-Funktionalität ist deaktiviert'
        }), 400
    
    try:
        # Alle E-Mails abrufen (nicht nur ungelesene)
        all_emails = email_manager.get_all_emails()
        
        # Bereits zugeordnete E-Mail-IDs sammeln
        aufgaben = data_manager.load_aufgaben()
        assigned_email_ids = set()
        
        for aufgabe in aufgaben:
            # E-Mail-Antworten durchgehen
            email_replies = aufgabe.get('email_replies', [])
            for reply in email_replies:
                email_id = reply.get('email_id')
                if email_id:
                    assigned_email_ids.add(email_id)
        
        # Nur nicht zugeordnete E-Mails zurückgeben
        unassigned_emails = [
            email for email in all_emails 
            if email.get('email_id') not in assigned_email_ids  # HIER WAR DER FEHLER: 'id' → 'email_id'
        ]
        
        logger.info(f"✅ {len(all_emails)} E-Mails abgerufen, {len(assigned_email_ids)} bereits zugeordnet, {len(unassigned_emails)} verfügbar")
        
        return jsonify({
            'success': True,
            'emails': clean_json_data(unassigned_emails),
            'count': len(unassigned_emails),
            'total_emails': len(all_emails),
            'assigned_count': len(assigned_email_ids)
        })
        
    except Exception as e:
        logger.error(f"Fehler beim Abrufen der E-Mails: {e}")
        return jsonify({
            'success': False,
            'message': f'Fehler beim Abrufen: {str(e)}'
        }), 500

@app.route('/api/email/assign', methods=['POST'])
@require_auth
@require_role(['admin', 'user'])
def api_email_assign():
    """Ordnet eine E-Mail einer Aufgabe zu"""
    if not EMAIL_AVAILABLE or not email_manager:
        return jsonify({
            'success': False,
            'message': 'E-Mail Manager nicht verfügbar'
        }), 400
    
    try:
        data = request.get_json()
        
        # Pflichtfelder prüfen
        required_fields = ['email_id', 'task_id']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return jsonify({
                'success': False,
                'message': f'Fehlende Felder: {", ".join(missing_fields)}'
            }), 400
        
        email_id = data['email_id']
        task_id = data['task_id']
        
        # Aufgabe laden
        aufgaben = data_manager.load_aufgaben()
        aufgabe = next((a for a in aufgaben if a.get('id') == task_id), None)
        
        if not aufgabe:
            return jsonify({
                'success': False,
                'message': 'Aufgabe nicht gefunden'
            }), 404
        
        # E-Mail-Details abrufen
        email_details = email_manager.get_email_by_id(email_id)
        
        if not email_details:
            return jsonify({
                'success': False,
                'message': 'E-Mail nicht gefunden'
            }), 404
        
        # E-Mail zur Aufgabe hinzufügen
        if 'email_replies' not in aufgabe:
            aufgabe['email_replies'] = []
        
        # Prüfen ob bereits zugeordnet
        existing_reply = next((r for r in aufgabe['email_replies'] if r.get('email_id') == email_id), None)
        if existing_reply:
            return jsonify({
                'success': False,
                'message': 'E-Mail bereits dieser Aufgabe zugeordnet'
            }), 400
        
        reply_info = {
            'email_id': email_id,
            'received_at': email_details.get('received_at', datetime.now().isoformat()),
            'from_email': email_details.get('from_email', ''),
            'subject': email_details.get('subject', ''),
            'body': email_details.get('body', ''),
            'assigned_at': datetime.now().isoformat(),
            'assigned_by': session.get('username', 'System')
        }
        
        aufgabe['email_replies'].append(reply_info)
        
        # Aufgabe aktualisieren (nicht alle Aufgaben speichern)
        success = data_manager.update_aufgabe(task_id, aufgabe)
        
        if success:
            # E-Mail als gelesen markieren
            try:
                email_manager.mark_email_as_read(email_id)
            except Exception as e:
                logger.warning(f"Fehler beim Markieren der E-Mail als gelesen: {e}")
            
            logger.info(f"✅ E-Mail {email_id} erfolgreich Aufgabe {task_id} zugeordnet")
            
            return jsonify({
                'success': True,
                'message': f'E-Mail erfolgreich Aufgabe "{aufgabe["titel"]}" zugeordnet',
                'task_id': task_id,
                'task_title': aufgabe['titel']
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Fehler beim Speichern der Aufgabe'
            }), 500
        
    except Exception as e:
        logger.error(f"Fehler beim Zuordnen der E-Mail: {e}")
        return jsonify({
            'success': False,
            'message': f'Fehler beim Zuordnen: {str(e)}'
        }), 500

@app.route('/api/aufgaben/<int:aufgabe_id>/email/reply', methods=['POST'])
@require_auth
@require_role(['admin', 'user'])
def api_aufgaben_email_reply_send(aufgabe_id):
    """Sendet eine Antwort-E-Mail zu einer bestimmten Aufgabe"""
    if not EMAIL_AVAILABLE or not email_manager:
        return jsonify({
            'success': False,
            'message': 'E-Mail Manager nicht verfügbar'
        }), 400
    
    if not email_manager.is_enabled():
        return jsonify({
            'success': False,
            'message': 'E-Mail-Funktionalität ist deaktiviert'
        }), 400
    
    try:
        # Aufgabe laden
        aufgaben = data_manager.load_aufgaben()
        aufgabe = next((a for a in aufgaben if a.get('id') == aufgabe_id), None)
        
        if not aufgabe:
            return jsonify({
                'success': False,
                'message': 'Aufgabe nicht gefunden'
            }), 404
        
        data = request.get_json()
        
        # Debug: Log der empfangenen Daten
        logger.info(f"E-Mail-Antwort-Daten empfangen für Aufgabe {aufgabe_id}: {data}")
        
        # Pflichtfelder prüfen
        required_fields = ['to_emails', 'subject', 'body']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            logger.warning(f"Fehlende Felder beim E-Mail-Antwort-Versand: {missing_fields}")
            return jsonify({
                'success': False,
                'message': f'Fehlende Felder: {", ".join(missing_fields)}'
            }), 400
        
        # Antwort-E-Mail senden
        result = email_manager.send_task_email(
            task_id=aufgabe_id,
            task_title=aufgabe['titel'],
            to_emails=data['to_emails'],
            subject=data['subject'],
            body=data['body'],
            html_body=data.get('html_body'),
            cc_emails=data.get('cc_emails'),
            in_reply_to=data.get('in_reply_to'),  # Für Threading
            references=data.get('references')     # Für Threading
        )
        
        # Wenn erfolgreich gesendet, E-Mail-Info zur Aufgabe hinzufügen
        if result['success']:
            # E-Mail-Verlauf zur Aufgabe hinzufügen
            if 'emails' not in aufgabe:
                aufgabe['emails'] = []
            
            email_info = {
                'sent_at': result['sent_at'],
                'thread_id': result['thread_id'],
                'message_id': result['message_id'],
                'to': result['sent_to'],
                'cc': result['cc_to'],
                'subject': data['subject'],
                'body': data['body'][:200] + '...' if len(data['body']) > 200 else data['body'],
                'is_reply': True,  # Markierung als Antwort
                'reply_to': data.get('in_reply_to')
            }
            
            aufgabe['emails'].append(email_info)
            
            # Aufgabe speichern
            data_manager.update_aufgabe(aufgabe_id, aufgabe)
        
        status_code = 200 if result['success'] else 400
        return jsonify(result), status_code
        
    except Exception as e:
        logger.error(f"Fehler beim Antwort-E-Mail-Versand: {e}")
        return jsonify({
            'success': False,
            'message': f'Fehler beim E-Mail-Versand: {str(e)}'
        }), 500

# ===================================================================
# MAIN APPLICATION
# ===================================================================
# ===================================================================

if __name__ == '__main__':
    print("🎉 Hochzeitsplaner Web-Anwendung (Direkter Start)")
    print("==================================================")
    
    if not data_manager:
        print("❌ KRITISCHER FEHLER: DataManager konnte nicht initialisiert werden!")
        exit(1)
    else:
        print(f"✅ DataManager bereits initialisiert: {DATA_DIR}")
    
    # Fester Port 8080 verwenden
    port = 8080
    print(f"🌐 URL: http://localhost:{port}")
    
    # Debug: Zeige registrierte Routen
    print("\n📋 Registrierte Routen:")
    for rule in app.url_map.iter_rules():
        methods = ','.join(rule.methods)
        print(f"  - {rule.rule} ({methods})")
    
    print("⚠️  Zum Beenden: Strg+C")
    print("==================================================")
    
    try:
        # IPv6 + IPv4 Support für DS-Lite/externe Erreichbarkeit
        app.run(
            host='0.0.0.0',  # Explizit alle IPv4-Interfaces + IPv6 dual-stack
            port=port,
            debug=False,
            threaded=True
        )
    except KeyboardInterrupt:
        print("\n🛑 Server wird beendet...")
    finally:
        # E-Mail-Checking stoppen beim Beenden
        if email_manager and EMAIL_AVAILABLE:
            email_manager.stop_email_checking()
            print("📧 E-Mail-Checking gestoppt")
        print("👋 Auf Wiedersehen!")


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
import time
import requests
from flask import Flask, render_template, request, jsonify, send_file, session, redirect, url_for, flash
from flask_cors import CORS
from datetime import datetime, timedelta
import shutil
from functools import wraps

try:
    import pandas as pd
except ImportError:
    pd = None

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

# Konfigurationsmanager importieren
try:
    from config_manager import get_data_directory
    CONFIG_MANAGER_AVAILABLE = True
except ImportError:
    CONFIG_MANAGER_AVAILABLE = False
    
    # Fallback-Funktion wenn config_manager nicht verfügbar
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
    """Authentifiziert einen Gast gegen die Gästeliste mit SQLite"""
    try:
        if not data_manager:
            return None
            
        # Nach Gast suchen - PRIORITÄT: guest_code > Email > Namen
        guest_data = None
        
        # 1. PRIORITÄT: Nach generiertem Guest-Code suchen (sicherste Methode)
        guest_data = data_manager.find_guest_by(guest_code=username)
        
        # 2. PRIORITÄT: Nach Email suchen (falls vorhanden und kein Code-Match)
        if not guest_data:
            guest_data = data_manager.find_guest_by(email=username)
        
        # 3. PRIORITÄT: Einfache Namenssuche (nur als Fallback)
        if not guest_data:
            # Suche nach Namen in der SQLite-Datenbank
            try:
                with data_manager._get_connection() as conn:
                    cursor = conn.execute("""
                        SELECT * FROM gaeste 
                        WHERE LOWER(nachname) LIKE LOWER(?) 
                           OR LOWER(vorname) LIKE LOWER(?)
                    """, (f"%{username}%", f"%{username}%"))
                    
                    rows = cursor.fetchall()
                    if len(rows) == 1:  # Nur wenn eindeutig
                        columns = [description[0] for description in cursor.description]
                        guest_data = dict(zip(columns, rows[0]))
            except Exception as e:
                logger.error(f"Fehler bei Namenssuche: {e}")
        
        if guest_data:
            # Passwort prüfen - PRIORITÄT: guest_password > nachname > vorname
            expected_passwords = []
            
            # 1. PRIORITÄT: Generiertes Gast-Passwort
            if guest_data.get('guest_password') and guest_data.get('guest_password').strip():
                expected_passwords.append(guest_data.get('guest_password').lower())
            
            # 2. PRIORITÄT: Nachname (Fallback für alte Gäste)
            if guest_data.get('nachname'):
                expected_passwords.append(guest_data.get('nachname').lower())
            
            # 3. PRIORITÄT: Vorname (weiterer Fallback)
            if guest_data.get('vorname'):
                expected_passwords.append(guest_data.get('vorname').lower())
            
            # 4. PRIORITÄT: Username als letzter Fallback
            expected_passwords.append(username.lower())
            
            # Passwort-Prüfung
            if password.lower() in [p for p in expected_passwords if p]:
                # First Login Check
                is_first_login = guest_data.get('first_login', 1) == 1
                
                # First Login vermerken (nur wenn es der erste ist)
                if is_first_login:
                    try:
                        with data_manager._get_connection() as conn:
                            conn.execute("""
                                UPDATE gaeste 
                                SET first_login = 0, first_login_at = CURRENT_TIMESTAMP 
                                WHERE id = ?
                            """, (guest_data['id'],))
                    except Exception as e:
                        logger.error(f"Fehler beim First-Login-Tracking: {e}")
                
                return {
                    'username': username,
                    'role': 'guest',
                    'display_name': f"{guest_data.get('vorname', '')} {guest_data.get('nachname', '')}".strip(),
                    'guest_id': guest_data.get('id'),
                    'guest_code': guest_data.get('guest_code'),
                    'guest_email': guest_data.get('email'),
                    'guest_data': guest_data,
                    'is_first_login': is_first_login
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
            
        # Prüfen ob Benutzer eingeloggt ist
        if 'logged_in' not in session or not session['logged_in']:
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

# SQLite DataManager importieren
from sqlite_datenmanager import SQLiteHochzeitsDatenManager as HochzeitsDatenManager
print("SQLite DataManager wird verwendet")

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
        
        # Stelle sicher, dass das Verzeichnis existiert
        os.makedirs(DATA_DIR, exist_ok=True)
        
        return True
    except Exception as e:
        print(f"Fehler beim Initialisieren des DataManagers: {e}")
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
    print("KRITISCHER FEHLER: DataManager konnte nicht initialisiert werden!")
    print(f"   Datenverzeichnis: {DATA_DIR}")
    print("   Prüfen Sie die Dateiberechtigungen und Verzeichnisstruktur.")
else:
    print(f"DataManager erfolgreich initialisiert: {DATA_DIR}")

# E-Mail Manager initialisieren (NACH DataManager)
if EMAIL_AVAILABLE:
    try:
        email_manager = EmailManager()
        if email_manager.is_enabled():
            print("E-Mail Manager aktiviert")
            # DataManager-Referenz setzen und Auto-Check starten
            email_manager.set_data_manager(data_manager)
            email_manager.start_email_checking()
        else:
            print("E-Mail Manager verfügbar, aber deaktiviert")
    except Exception as e:
        logger.error(f"Fehler beim Initialisieren des E-Mail Managers: {e}")
        email_manager = None

# DynDNS Manager initialisieren
def init_dyndns_manager():
    """Initialisiert den DynDNS Manager"""
    if not DYNDNS_AVAILABLE:
        print("DynDNS Manager nicht verfügbar")
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
        if data_manager:
            # SQLite DataManager verwenden wenn verfügbar
            if hasattr(data_manager, 'get_all_guests'):
                guests = data_manager.get_all_guests()
                if guests and len(guests) > 0:
                    # Prüfen ob bereits Credentials vorhanden sind
                    has_credentials = all(guest.get('guest_code') for guest in guests)
                    if not has_credentials:
                        logger.info("Generiere initial Gast-Credentials...")
                        success = data_manager.generate_all_guest_credentials()
                        if success:
                            logger.info("✅ Initiale Gast-Credentials erfolgreich generiert")
                        else:
                            logger.warning("⚠️ Fehler bei initialer Credential-Generierung")
            # Fallback für pandas DataManager
            elif hasattr(data_manager, 'gaesteliste_df') and not data_manager.gaesteliste_df.empty:
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
                # Versuche neue strukturierte Settings zu laden
                braut_name = ""
                braeutigam_name = ""
                
                # Erst strukturierte Settings versuchen
                if 'hochzeit' in settings and isinstance(settings['hochzeit'], dict):
                    brautpaar = settings['hochzeit'].get('brautpaar', {})
                    if isinstance(brautpaar, dict):
                        braut_name = brautpaar.get('braut', '')
                        braeutigam_name = brautpaar.get('braeutigam', '')
                
                # Fallback: Direkt aus den Einzelwerten laden (das funktioniert aktuell)
                if not braut_name:
                    braut_name = settings.get('braut_name', '')
                if not braeutigam_name:
                    braeutigam_name = settings.get('braeutigam_name', '')
                
                if braut_name and braeutigam_name:
                    brautpaar_namen = f"{braut_name} & {braeutigam_name} heiraten"
                    admin_header = "💕 Hochzeitsplaner 💒"
                elif braut_name:
                    brautpaar_namen = f"{braut_name} heiratet"
                    admin_header = "💕 Hochzeitsplaner 💒"
                elif braeutigam_name:
                    brautpaar_namen = f"{braeutigam_name} heiratet"
                    admin_header = "💕 Hochzeitsplaner 💒"
                else:
                    brautpaar_namen = "Brautpaar heiratet"
                    admin_header = "💕 Hochzeitsplaner 💒"
                    
                return {
                    'brautpaar_namen': brautpaar_namen,
                    'admin_header': admin_header,
                    'bride_name': braut_name,
                    'groom_name': braeutigam_name
                }
    except Exception as e:
        logger.warning(f"Fehler beim Laden der globalen Template-Variablen: {e}")
    
    return {
        'brautpaar_namen': "Brautpaar heiratet",
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
            for beschreibung, preis in fixed_costs.items():
                if preis > 0:  # Nur Kosten > 0 berücksichtigen
                    kosten_config.append({
                        'kategorie': 'Fixkosten',  # Verwende normale Fixkosten-Kategorie
                        'beschreibung': beschreibung,
                        'typ': 'pauschal',
                        'preis_pro_einheit': preis,
                        'aktiv': True
                    })
        
        # Lade Gästedaten
        data_manager.load_gaesteliste()  # Daten in gaesteliste_df laden
        gaeste_data = data_manager.gaesteliste_df.to_dict('records') if not data_manager.gaesteliste_df.empty else []
        
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
            # SQLite verwendet lowercase Spalten-Namen
            anzahl_essen = safe_int(guest.get('anzahl_essen', 0))
            anzahl_party = safe_int(guest.get('anzahl_party', 0))
            weisser_saal = safe_int(guest.get('weisser_saal', 0))
            kinder = safe_int(guest.get('kind', 0))
            
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
        
        # Lade manuelle Gästeanzahlen aus der Kostenkonfiguration
        manual_guest_counts = kosten_config_raw.get('manual_guest_counts', {})
        
        # Lade bestehendes Budget um "ausgegeben"-Werte zu übernehmen
        try:
            existing_budget_df = data_manager.lade_budget()
            existing_budget_items = existing_budget_df.to_dict('records') if not existing_budget_df.empty else []
        except:
            existing_budget_items = []
        
        # Erstelle Dictionary der bereits ausgegebenen Beträge (Kategorie:Beschreibung -> ausgegeben)
        ausgegeben_map = {}
        for item in existing_budget_items:
            beschreibung = item.get('beschreibung', '')
            kategorie = item.get('kategorie', '')
            key = f"{kategorie}:{beschreibung}"
            ausgegeben_map[key] = float(item.get('ausgegeben', 0))
            # Spezialbehandlung: "Essen" kann auch als "Hauptgang" existieren
            if beschreibung == "Essen":
                ausgegeben_map[f"{kategorie}:Hauptgang"] = float(item.get('ausgegeben', 0))
            if beschreibung == "Hauptgang":
                ausgegeben_map[f"{kategorie}:Essen"] = float(item.get('ausgegeben', 0))
        
        # Erstelle komplett neues Budget basierend auf aktueller Kostenkonfiguration
        budget_items = []
        
        for i, item in enumerate(kosten_config):
            
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
                # Spezialbehandlung für Mitternachtssnack mit manueller Gästeanzahl
                if beschreibung.lower() == 'mitternachtssnack' and 'mitternachtssnack' in manual_guest_counts:
                    menge = manual_guest_counts['mitternachtssnack']
                    einzelpreis = float(item.get('preis_pro_einheit', 0) or 0)
                    gesamtpreis = menge * einzelpreis
                    details = f"{menge} Personen × {einzelpreis}€ (manuell festgelegt)"
                else:
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
            
            # Übernehme bereits ausgegebenen Betrag falls vorhanden
            key = f"{kategorie}:{beschreibung}"
            ausgegeben = ausgegeben_map.get(key, 0)
            
            budget_items.append({
                'kategorie': kategorie,
                'beschreibung': beschreibung,
                'details': details,
                'menge': menge,
                'einzelpreis': einzelpreis,
                'gesamtpreis': gesamtpreis,
                'ausgegeben': ausgegeben  # Übernehme bestehenden ausgegebenen Betrag
            })
        
        # Berechne Gesamtsumme - stelle sicher, dass alle gesamtpreis-Werte numerisch sind
        gesamtsumme = sum(float(item.get('gesamtpreis', 0) or 0) for item in budget_items)
        
        # Speichere das generierte Budget automatisch
        try:
            if pd is not None:
                budget_df = pd.DataFrame(budget_items)
                data_manager.speichere_budget(budget_df)
            else:
                logger.warning("Pandas nicht verfügbar - Budget wird nicht gespeichert")
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
        if pd is not None:
            neuer_eintrag_df = pd.DataFrame([neuer_eintrag])
            budget_df = pd.concat([budget_df, neuer_eintrag_df], ignore_index=True)
            
            # Speichere Budget
            data_manager.speichere_budget(budget_df)
        else:
            return jsonify({'error': 'Pandas nicht verfügbar'}), 500
        
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
        if pd is not None:
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
        else:
            return jsonify({'error': 'Pandas nicht verfügbar'}), 500
        
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

def is_na_value(value):
    """Prüft ob ein Wert None/NaN/leer ist - Ersatz für pd.isna()"""
    if value is None:
        return True
    if isinstance(value, str):
        return value.lower() in ['nan', 'nat', 'null', '']
    if isinstance(value, float):
        # Prüfe mathematisches NaN
        return value != value or str(value).lower() in ['nan', 'nat']
    return False

def is_not_na_value(value):
    """Prüft ob ein Wert NICHT None/NaN/leer ist - Ersatz für pd.notna()"""
    return not is_na_value(value)

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
    elif data is None:
        return ''
    elif isinstance(data, str) and data.lower() in ['nan', 'nat', 'null']:
        return ''
    elif isinstance(data, float):
        # Prüfe auf NaN ohne pandas
        if str(data).lower() in ['nan', 'nat']:
            return ''
        # Prüfe mathematisches NaN
        if data != data:  # NaN != NaN ist True
            return ''
        return data
    elif isinstance(data, (int, str, bool)):
        return data
    else:
        # Für pandas-Objekte falls vorhanden
        try:
            if hasattr(data, 'item'):  # pandas scalars
                return data.item()
        except:
            pass
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
            session['logged_in'] = True
            session['username'] = user['username']
            session['user_role'] = user['role']
            session['display_name'] = user['display_name']
            session['login_time'] = datetime.now().isoformat()
            session.permanent = True
            
            # Zusätzliche Daten für Gäste
            if user['role'] == 'guest':
                guest_data = user.get('guest_data', {})
                session['guest_id'] = user.get('guest_id')
                session['guest_code'] = guest_data.get('guest_code')
                session['guest_email'] = guest_data.get('Email') or guest_data.get('email')
                
                # First Login Check
                is_first_login = user.get('is_first_login', False)
            
            # Redirect basierend auf Rolle
            next_page = request.args.get('next')
            if user['role'] == 'guest':
                # Für Gäste: First-Login-Parameter hinzufügen wenn notwendig
                redirect_url = next_page or url_for('guest_dashboard')
                if user.get('is_first_login', False):
                    # First Login Parameter hinzufügen
                    from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
                    parsed = urlparse(redirect_url)
                    query_dict = parse_qs(parsed.query)
                    query_dict['first_login'] = ['1']
                    new_query = urlencode(query_dict, doseq=True)
                    redirect_url = urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, parsed.fragment))
                else:
                    pass  # Keine zusätzlichen Logs
                return redirect(redirect_url)
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

@app.route('/gaeste/import')
@require_auth
@require_role(['admin', 'user'])
def gaeste_import():
    return render_template('import_gaeste.html')

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
    # Die brautpaar_namen Variable wird automatisch durch inject_global_vars() bereitgestellt
    return render_template('guest_dashboard.html')

@app.route('/guest/zeitplan')
@require_auth
@require_role(['guest'])
def guest_zeitplan():
    """Öffentlicher Zeitplan für Gäste"""
    # Die brautpaar_namen Variable wird automatisch durch inject_global_vars() bereitgestellt
    return render_template('guest_zeitplan.html')

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
        
        # Direkter Zugriff über guest_id
        guest_data = None
        if guest_id is not None:
            guest_data = data_manager.find_guest_by(guest_id=guest_id)
        
        # Fallback: Suche über Code oder Email
        if not guest_data and guest_code:
            guest_data = data_manager.find_guest_by(guest_code=guest_code)
        
        if not guest_data and guest_email:
            guest_data = data_manager.find_guest_by(email=guest_email)
        
        if guest_data:
            # Bestimme das echte Maximum
            original_max = guest_data.get('max_personen')
            if not original_max:
                # Fallback: Berechne aus vorhandenen Event-Feldern
                event_anzahlen = []
                for field in ['anzahl_personen', 'anzahl_essen', 'anzahl_party', 'weisser_saal']:
                    val = guest_data.get(field)
                    if val and val > 0:
                        event_anzahlen.append(int(val))
                original_max = max(event_anzahlen) if event_anzahlen else 1
            
            return jsonify({
                'success': True,
                'guest': {
                    'name': f"{guest_data.get('vorname', '')} {guest_data.get('nachname', '')}".strip(),
                    'vorname': guest_data.get('vorname', ''),
                    'nachname': guest_data.get('nachname', ''),
                    'status': guest_data.get('status', 'Offen'),
                    'personen': guest_data.get('anzahl_personen', 1),
                    'max_personen': original_max,  # Verwende das berechnete Maximum
                    'notiz': guest_data.get('bemerkungen', ''),
                    'email': guest_data.get('email', ''),
                    'guest_code': guest_data.get('guest_code', ''),
                    'last_modified': guest_data.get('last_modified'),  # Timestamp für Conflict Detection
                    # Event-spezifische Felder für personalisierte Begrüßung
                    'Anzahl_Personen': guest_data.get('anzahl_personen', 1),
                    'Weisser_Saal': guest_data.get('weisser_saal', 0),
                    'Anzahl_Essen': guest_data.get('anzahl_essen', 0),
                    'Anzahl_Party': guest_data.get('anzahl_party', 0)
                }
            })
        
        return jsonify({'success': False, 'message': 'Gast nicht gefunden'})
        
    except Exception as e:
        logger.error(f"Fehler beim Laden der Gästdaten: {e}")
        return jsonify({'success': False, 'message': 'Serverfehler'})

@app.route('/api/guest/first-login-message')
@require_auth
@require_role(['guest'])
def get_first_login_message():
    """Generiert eine personalisierte First-Login-Nachricht für den Gast"""
    try:
        if not data_manager:
            return jsonify({'success': False, 'message': 'DataManager nicht verfügbar'})
        
        guest_id = session.get('guest_id')
        if not guest_id:
            return jsonify({'success': False, 'message': 'Gast-ID nicht gefunden'})
        
        # Gast-Daten laden
        guest_data = data_manager.get_guest_by_id(guest_id)
        if not guest_data:
            return jsonify({'success': False, 'message': 'Gast nicht gefunden'})
        
        # Settings für Hochzeitsdatum laden
        settings = data_manager.load_settings()
        hochzeitsdatum = settings.get('hochzeitsdatum') or settings.get('hochzeit', {}).get('datum', '25.07.2026')
        
        # Hochzeitsdatum formatieren
        formatted_date = format_wedding_date_for_message(hochzeitsdatum)
        
        # Event-Teilnahme ermitteln
        weisser_saal = guest_data.get('weisser_saal', 0) or guest_data.get('Weisser_Saal', 0)
        anzahl_essen = guest_data.get('anzahl_essen', 0) or guest_data.get('Anzahl_Essen', 0)
        anzahl_party = guest_data.get('anzahl_party', 0) or guest_data.get('Anzahl_Party', 0)
        anzahl_personen = guest_data.get('anzahl_personen', 1) or guest_data.get('Anzahl_Personen', 1)
        
        # Personalisierte Nachricht generieren
        message = generate_personalized_welcome_message(
            anzahl_personen, weisser_saal, anzahl_essen, anzahl_party, formatted_date
        )
        
        return jsonify({
            'success': True,
            'message': message,
            'wedding_date': formatted_date
        })
        
    except Exception as e:
        logger.error(f"Fehler beim Generieren der First-Login-Nachricht: {e}")
        return jsonify({'success': False, 'message': 'Serverfehler'})

def format_wedding_date_for_message(date_string):
    """Formatiert das Hochzeitsdatum für die Nachricht"""
    try:
        from datetime import datetime
        date = datetime.strptime(date_string, '%Y-%m-%d')
        return date.strftime('%d.%m.%Y')
    except:
        return date_string

def generate_personalized_welcome_message(anzahl_personen, weisser_saal, anzahl_essen, anzahl_party, wedding_date):
    """Generiert eine personalisierte Willkommensnachricht basierend auf den Event-Teilnahmen"""
    
    # Herzliche Begrüßung
    if anzahl_personen > 1:
        base_message = f"Hallo ihr Lieben,\n\nihr gehört zu den Menschen, die uns am wichtigsten sind - deshalb laden wir euch zu unserem kompletten Hochzeitstag am {wedding_date} ein:"
    else:
        base_message = f"Hallo du Liebe/r,\n\ndu gehörst zu den Menschen, die uns am wichtigsten sind - deshalb laden wir dich zu unserem kompletten Hochzeitstag am {wedding_date} ein:"
    
    # Event-spezifische Nachrichten mit Emojis
    event_parts = []
    
    if weisser_saal > 0:
        event_parts.append("🤵👰 Seid dabei, wenn wir uns das Ja-Wort geben (Weißer Saal)" if anzahl_personen > 1 else "🤵👰 Sei dabei, wenn wir uns das Ja-Wort geben (Weißer Saal)")
    
    if anzahl_essen > 0:
        event_parts.append("🥂 Genießt mit uns das Hochzeitsessen" if anzahl_personen > 1 else "🥂 Genieße mit uns das Hochzeitsessen")
    
    if anzahl_party > 0:
        event_parts.append("💃🕺 Feiert und tanzt mit uns bis in die frühen Morgenstunden" if anzahl_personen > 1 else "💃🕺 Feiere und tanze mit uns bis in die frühen Morgenstunden")
    
    # Spezielle Hinweise für Weißer Saal
    special_notes = []
    
    if weisser_saal > 0:
        if anzahl_personen > 1:
            special_notes.append("Für die Trauung im Weißen Saal haben wir nur 42 Plätze - einige davon werden reserviert sein, schaut bitte vor Ort ob noch Platz für euch ist. Ansonsten laden wir euch herzlich ein mit der restlichen Gesellschaft vor dem Rathaus auf uns zu warten, auch dort wird es für niemanden langweilig werden.")
        else:
            special_notes.append("Für die Trauung im Weißen Saal haben wir nur 42 Plätze - einige davon werden reserviert sein, schau bitte vor Ort ob noch Platz für dich ist. Ansonsten laden wir dich herzlich ein mit der restlichen Gesellschaft vor dem Rathaus auf uns zu warten, auch dort wird es für niemanden langweilig werden.")
    
    # Nachricht zusammensetzen
    full_message = base_message
    
    if event_parts:
        full_message += "\n\n" + "\n".join(event_parts)
    
    if special_notes:
        full_message += "\n\n" + special_notes[0]
    
    return full_message

@app.route('/api/guest/wedding-photo')
@require_auth
@require_role(['guest'])
def get_guest_wedding_photo():
    """API-Endpunkt für das Hochzeitsfoto in der Einladung"""
    try:
        if not data_manager:
            return jsonify({'success': False, 'message': 'DataManager nicht verfügbar'})
        
        # Lade Einstellungen
        settings = data_manager.load_settings()
        
        # Foto-Daten extrahieren
        photo_data = settings.get('first_login_image_data', '')
        
        return jsonify({
            'success': True,
            'photo_data': photo_data
        })
        
    except Exception as e:
        logger.error(f"Fehler beim Laden des Hochzeitsfotos: {e}")
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
        last_modified = data.get('last_modified')
        
        # Gast finden
        guest_data = None
        if guest_id is not None:
            guest_data = data_manager.find_guest_by(guest_id=guest_id)
        
        if not guest_data and guest_code:
            guest_data = data_manager.find_guest_by(guest_code=guest_code)
        
        if not guest_data and guest_email:
            guest_data = data_manager.find_guest_by(email=guest_email)
        
        if not guest_data:
            return jsonify({'success': False, 'message': 'Gast nicht gefunden'})
        
        # RSVP-Update durchführen
        result = data_manager.update_guest_rsvp(
            guest_id=guest_data['id'],
            status=status,
            anzahl_personen=personen,
            bemerkungen=notiz,
            last_modified_check=last_modified
        )
        
        if result['success']:
            return jsonify(result)
        else:
            # Bei Conflict oder anderen Fehlern
            status_code = 409 if result.get('conflict') else 400
            return jsonify(result), status_code
        
    except Exception as e:
        logger.error(f"Fehler beim RSVP-Update: {e}")
        return jsonify({'success': False, 'message': 'Serverfehler'}), 500

@app.route('/api/guest/location')
@require_auth
@require_role(['guest'])
def get_guest_location():
    """API-Endpunkt für Location-Informationen für Gäste (SQLite-basiert)"""
    try:
        if not data_manager:
            return jsonify({'success': False, 'message': 'DataManager nicht verfügbar'})
        
        # Gast-Daten laden für Berechtigungsprüfung (SQLite)
        guest_id = session.get('guest_id')
        guest_info = None
        guest_participates_weisser_saal = False
        
        if guest_id is not None:
            guest_info = data_manager.find_guest_by(guest_id=guest_id)
            if guest_info:
                # Prüfen ob Gast am Weißen Saal teilnimmt
                weisser_saal = int(guest_info.get('weisser_saal', 0) or 0)
                guest_participates_weisser_saal = weisser_saal > 0
            else:
                logger.error(f"Guest {guest_id} nicht gefunden")
        
        # Location-Daten direkt aus SQLite laden (temporäre Lösung)
        locations = {}
        
        # Direkte SQLite-Abfrage für bessere Kontrolle
        import sqlite3
        db_path = os.path.join(data_manager.data_directory, 'hochzeit.db')
        
        def get_setting_direct(key):
            try:
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                cursor.execute('SELECT wert FROM einstellungen WHERE schluessel = ?', (key,))
                row = cursor.fetchone()
                conn.close()
                return row[0] if row else ''
            except:
                return ''
        
        # Standesamt-Daten aus SQLite laden und nur anzeigen wenn Gast berechtigt ist
        if guest_participates_weisser_saal:
            standesamt_name = get_setting_direct('standesamt_name')
            standesamt_adresse = get_setting_direct('standesamt_adresse')
            standesamt_beschreibung = get_setting_direct('standesamt_beschreibung')
            
            if standesamt_name:  # Nur hinzufügen wenn Name vorhanden ist
                locations['standesamt'] = {
                    'name': standesamt_name,
                    'adresse': standesamt_adresse,
                    'beschreibung': standesamt_beschreibung
                }
            else:
                pass  # Standesamt-Daten nicht in SQLite-Einstellungen gefunden
        else:
            pass  # Standesamt nicht angezeigt - Gast nicht berechtigt
        
        # Hochzeitslocation-Daten aus SQLite laden (immer für alle Gäste sichtbar)
        hochzeitslocation_name = get_setting_direct('hochzeitslocation_name')
        hochzeitslocation_adresse = get_setting_direct('hochzeitslocation_adresse')
        hochzeitslocation_beschreibung = get_setting_direct('hochzeitslocation_beschreibung')
        
        if hochzeitslocation_name:  # Nur hinzufügen wenn Name vorhanden ist
            locations['hochzeitslocation'] = {
                'name': hochzeitslocation_name,
                'adresse': hochzeitslocation_adresse,
                'beschreibung': hochzeitslocation_beschreibung
            }
        else:
            logger.warning("Hochzeitslocation-Daten nicht in SQLite-Einstellungen gefunden")
        
        if not locations:
            logger.warning("Keine Location-Informationen in SQLite-Einstellungen gefunden")
            return jsonify({
                'success': False,
                'message': 'Keine Location-Informationen verfügbar'
            })
        
        return jsonify({
            'success': True,
            'locations': locations
        })
        
    except Exception as e:
        logger.error(f"Fehler beim Laden der Location-Daten aus SQLite: {e}")
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
        
        # Debug: Log die finale gaeste_info (entfernt)
        
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
                        if is_na_value(value):
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
        
        # Daten für JSON bereinigen
        cleaned_credentials = clean_json_data(credentials_list)
        
        return jsonify({
            'success': True,
            'credentials': cleaned_credentials
        })
        
    except Exception as e:
        logger.error(f"Fehler beim Abrufen der Gast-Credentials: {e}")
        return jsonify({'success': False, 'message': 'Serverfehler'})

@app.route('/api/admin/reset-first-login', methods=['POST'])
@require_auth
@require_role(['admin'])
def reset_first_login_for_all_guests():
    """API-Endpunkt zum Zurücksetzen des First-Login-Status für alle Gäste (nur für Admins)"""
    try:
        if not data_manager:
            return jsonify({'success': False, 'message': 'DataManager nicht verfügbar'})
        
        # Anzahl der aktualisierten Gäste zählen
        updated_count = data_manager.reset_first_login_for_all_guests()
        
        return jsonify({
            'success': True, 
            'message': f'First-Login-Status für {updated_count} Gäste zurückgesetzt',
            'count': updated_count
        })
        
    except Exception as e:
        logger.error(f"Fehler beim Zurücksetzen des First-Login-Status: {e}")
        return jsonify({'success': False, 'message': 'Serverfehler'})

@app.route('/api/guest/zeitplan')
@require_auth
@require_role(['guest'])
def get_guest_zeitplan():
    try:
        # Gast-Daten laden
        guest_id = session.get('guest_id')
        
        if guest_id is None:
            return jsonify({'success': False, 'message': 'Gast nicht authentifiziert'})
        
        # Gast-Details abrufen (SQLite)
        guest_info = data_manager.find_guest_by(guest_id=guest_id)
        
        if not guest_info:
            return jsonify({'success': False, 'message': 'Gast nicht gefunden'})
        
        # Zeitplan aus SQLite laden
        zeitplan_events = data_manager.get_zeitplan(nur_oeffentlich=False)
        
        # Events nach Gast-Berechtigung filtern
        filtered_events = []
        for event in zeitplan_events:
            # Prüfen ob Event für Gast sichtbar ist
            should_show = True
            
            # Wenn nur_brautpaar = 1, dann nur für Brautpaar sichtbar
            if event.get('nur_brautpaar', 0) == 1:
                should_show = False
            
            # Event-spezifische Berechtigung prüfen basierend auf Eventteilnahme
            eventteile = event.get('eventteile', [])
            
            if eventteile and isinstance(eventteile, list) and len(eventteile) > 0:
                # Wenn Event spezifische Teile hat, prüfen ob Gast teilnimmt
                guest_participates = False
                
                for teil in eventteile:
                    teil_name = teil.lower()
                    
                    if 'standesamt' in teil_name or 'weisser_saal' in teil_name:
                        # Prüfen ob Gast am Weißen Saal teilnimmt
                        weisser_saal = guest_info.get('weisser_saal', 0)
                        if weisser_saal and int(weisser_saal) > 0:
                            guest_participates = True
                            break
                    elif 'party' in teil_name or 'feier' in teil_name:
                        # Prüfen ob Gast an Party teilnimmt
                        anzahl_party = guest_info.get('anzahl_party', 0)
                        logger.debug(f"      Party Check: Guest={anzahl_party}, Required={teil_name}")
                        if anzahl_party and int(anzahl_party) > 0:
                            guest_participates = True
                            logger.debug(f"      ✅ Guest nimmt an Party teil")
                            break
                    elif 'essen' in teil_name:
                        # Prüfen ob Gast am Essen teilnimmt
                        anzahl_essen = guest_info.get('anzahl_essen', 0)
                        logger.debug(f"      Essen Check: Guest={anzahl_essen}, Required={teil_name}")
                        if anzahl_essen and int(anzahl_essen) > 0:
                            guest_participates = True
                            logger.debug(f"      ✅ Guest nimmt an Essen teil")
                            break
                    else:
                        # Für unbekannte Event-Teile: allen Gästen zeigen
                        logger.debug(f"      ⚠️ Unbekannter Eventteil '{teil_name}' - zeige allen Gästen")
                        guest_participates = True
                        break
                
                if not guest_participates:
                    should_show = False
                    logger.debug(f"❌ Event '{event.get('titel')}' - Gast nimmt nicht an erforderlichen Teilen teil")
                else:
                    logger.debug(f"✅ Event '{event.get('titel')}' - Gast nimmt an mindestens einem erforderlichen Teil teil")
            else:
                # Event ohne spezifische Eventteile - allen Gästen zeigen
                logger.debug(f"📋 Event '{event.get('titel')}' - keine Eventteile definiert, zeige allen Gästen")
            
            if should_show:
                # Legacy-Kompatibilität für Frontend
                event_dict = {
                    'id': event.get('id'),
                    'Programmpunkt': event.get('titel', ''),
                    'Verantwortlich': event.get('beschreibung', ''),
                    'Status': event.get('kategorie', ''),
                    'Uhrzeit': event.get('Uhrzeit', ''),
                    'start_zeit': event.get('start_zeit'),
                    'ende_zeit': event.get('ende_zeit'),
                    'ort': event.get('ort', ''),
                    'eventteile': event.get('eventteile', []),
                    'public': not bool(event.get('nur_brautpaar', 0))
                }
                filtered_events.append(event_dict)
        
        # Nach Startzeit sortieren
        filtered_events.sort(key=lambda x: x.get('Uhrzeit', ''))
        
        return jsonify({
            'success': True,
            'events': filtered_events
        })
        
    except Exception as e:
        logger.error(f"Fehler beim Laden des Gast-Zeitplans: {str(e)}")
        return jsonify({'success': False, 'message': f'Serverfehler: {str(e)}'})


@app.route('/api/guest/zeitplan_preview')
@require_auth
@require_role(['guest'])
def get_guest_zeitplan_preview():
    """Vereinfachte Zeitplan-Vorschau für Gäste mit Gast-spezifischer Filterung"""
    try:
        # Gast-Daten laden für Filterung
        guest_id = session.get('guest_id')
        
        if guest_id is None:
            return jsonify({'success': False, 'message': 'Gast nicht authentifiziert'})
        
        # Gast-Details abrufen (SQLite)
        guest_info = data_manager.find_guest_by(guest_id=guest_id)
        
        if not guest_info:
            return jsonify({'success': False, 'message': 'Gast nicht gefunden'})
        
        # Zeitplan aus SQLite laden (alle Events, nicht nur öffentliche)
        zeitplan_events = data_manager.get_zeitplan(nur_oeffentlich=False)
        
        # Events nach Gast-Berechtigung filtern (gleiche Logik wie get_guest_zeitplan)
        preview_events = []  # Initialize preview_events list
        for event in zeitplan_events:
            # Prüfen ob Event für Gast sichtbar ist
            should_show = True
            
            # Wenn nur_brautpaar = 1, dann nur für Brautpaar sichtbar
            if event.get('nur_brautpaar', 0) == 1:
                should_show = False
                logger.debug(f"Event '{event.get('titel')}' ist nur für Brautpaar sichtbar")
            
            # Event-spezifische Berechtigung prüfen basierend auf Eventteilnahme
            eventteile = event.get('eventteile', [])
            
            if eventteile and isinstance(eventteile, list) and len(eventteile) > 0:
                # Wenn Event spezifische Teile hat, prüfen ob Gast teilnimmt
                guest_participates = False
                
                for teil in eventteile:
                    teil_name = teil.lower()
                    logger.debug(f"    Prüfe Eventteil: '{teil_name}'")
                    
                    if 'standesamt' in teil_name or 'weisser_saal' in teil_name:
                        # Prüfen ob Gast am Weißen Saal teilnimmt
                        weisser_saal = guest_info.get('weisser_saal', 0)
                        logger.debug(f"      Weisser_Saal Check: Guest={weisser_saal}, Required={teil_name}")
                        if weisser_saal and int(weisser_saal) > 0:
                            guest_participates = True
                            break
                    elif 'party' in teil_name or 'feier' in teil_name:
                        # Prüfen ob Gast an Party teilnimmt
                        anzahl_party = guest_info.get('anzahl_party', 0)
                        if anzahl_party and int(anzahl_party) > 0:
                            guest_participates = True
                            break
                    elif 'essen' in teil_name:
                        # Prüfen ob Gast am Essen teilnimmt
                        anzahl_essen = guest_info.get('anzahl_essen', 0)
                        if anzahl_essen and int(anzahl_essen) > 0:
                            guest_participates = True
                            break
                    else:
                        # Für unbekannte Event-Teile: allen Gästen zeigen
                        guest_participates = True
                        break
                
                if not guest_participates:
                    should_show = False
            else:
                # Event ohne spezifische Eventteile - allen Gästen zeigen
                pass
            
            if should_show:
                # Vereinfachte Event-Info für Preview
                preview_events.append({
                    'titel': event.get('titel', ''),
                    'uhrzeit': event.get('Uhrzeit', ''),
                    'ort': event.get('ort', '')
                })
        
        # Nach Startzeit sortieren
        preview_events.sort(key=lambda x: x.get('uhrzeit', ''))
        
        return jsonify({
            'success': True,
            'events': preview_events
        })
        
    except Exception as e:
        logger.error(f"Fehler beim Laden der Zeitplan-Vorschau: {str(e)}")
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
        
        # SQLite-basierte Gästeliste laden
        gaeste_list = data_manager.get_gaeste_list()
        
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
            'Bemerkungen': ''
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
        
        # Automatische Generierung der Teilnahme-Felder basierend auf Anzahlen
        weisser_saal_count = gast_data.get('Weisser_Saal', 0)
        essen_count = gast_data.get('Anzahl_Essen', 0)
        party_count = gast_data.get('Anzahl_Party', 0)
        
        gast_data['Zum_Weisser_Saal'] = 'Ja' if weisser_saal_count > 0 else 'Nein'
        gast_data['Zum_Essen'] = 'Ja' if essen_count > 0 else 'Nein'
        gast_data['Zur_Party'] = 'Ja' if party_count > 0 else 'Nein'
        
        success = data_manager.add_guest(gast_data)
        
        if success:
            return jsonify({'success': True, 'message': 'Gast erfolgreich hinzugefügt'})
        else:
            return jsonify({'error': 'Fehler beim Hinzufügen'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/gaeste/update/<int:guest_id>', methods=['PUT'])
def api_gaeste_update(guest_id):
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        gast_data = request.json
        
        # Numerische Felder sicherstellen
        numeric_fields = ['Kind', 'Anzahl_Personen', 'Optional', 'Weisser_Saal', 'Anzahl_Essen', 'Anzahl_Party']
        for field in numeric_fields:
            if field in gast_data:
                try:
                    gast_data[field] = int(gast_data.get(field, 0))
                except (ValueError, TypeError):
                    gast_data[field] = 0
        
        # Automatische Generierung der Teilnahme-Felder basierend auf Anzahlen
        if 'Weisser_Saal' in gast_data or 'Anzahl_Essen' in gast_data or 'Anzahl_Party' in gast_data:
            weisser_saal_count = gast_data.get('Weisser_Saal', 0)
            essen_count = gast_data.get('Anzahl_Essen', 0)
            party_count = gast_data.get('Anzahl_Party', 0)
            
            gast_data['Zum_Weisser_Saal'] = 'Ja' if weisser_saal_count > 0 else 'Nein'
            gast_data['Zum_Essen'] = 'Ja' if essen_count > 0 else 'Nein'
            gast_data['Zur_Party'] = 'Ja' if party_count > 0 else 'Nein'
        
        # Aktualisiere den Gast in SQLite
        success = data_manager.update_guest(guest_id, gast_data)
        
        if success:
            return jsonify({'success': True, 'message': 'Gast aktualisiert'})
        else:
            return jsonify({'error': 'Fehler beim Speichern'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/gaeste/delete/<int:guest_id>', methods=['DELETE'])
def api_gaeste_delete(guest_id):
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        # Lösche den Gast aus SQLite
        success = data_manager.delete_guest(guest_id)
        
        if success:
            return jsonify({'success': True, 'message': 'Gast gelöscht'})
        else:
            return jsonify({'error': 'Fehler beim Löschen'}), 500
            return jsonify({'error': 'Fehler beim Speichern'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route("/api/settings/get")
@require_auth
@require_role(['admin', 'user', 'guest'])
def api_settings_get():
    try:
        if not data_manager:
            return jsonify({"error": "DataManager nicht initialisiert"}), 500
        
        # Verwende die strukturierte load_settings Methode
        settings = data_manager.load_settings()
        
        # Zusätzlich noch die alten Einzelfelder für Kompatibilität laden
        basic_settings = [
            'braut_name', 'braeutigam_name', 'hochzeitsdatum', 'hochzeitszeit', 
            'hochzeitsort', 'budget_gesamt', 'email_enabled', 'guest_login_enabled',
            'first_login_image', 'first_login_image_data', 'first_login_text'
        ]
        
        for setting_key in basic_settings:
            value = data_manager.get_setting(setting_key, '')
            if value and setting_key not in settings:
                settings[setting_key] = value
        
        # Location-Daten aus SQLite-Einstellungen laden und strukturieren
        locations = {}
        
        # Standesamt-Daten laden
        standesamt_name = data_manager.get_setting('standesamt_name', '')
        if standesamt_name:
            locations['standesamt'] = {
                'name': standesamt_name,
                'adresse': data_manager.get_setting('standesamt_adresse', ''),
                'beschreibung': data_manager.get_setting('standesamt_beschreibung', '')
            }
        
        # Hochzeitslocation-Daten laden
        hochzeitslocation_name = data_manager.get_setting('hochzeitslocation_name', '')
        if hochzeitslocation_name:
            locations['hochzeitslocation'] = {
                'name': hochzeitslocation_name,
                'adresse': data_manager.get_setting('hochzeitslocation_adresse', ''),
                'beschreibung': data_manager.get_setting('hochzeitslocation_beschreibung', '')
            }
        
        # Locations zu Settings hinzufügen wenn vorhanden
        if locations:
            settings['locations'] = locations
        
        # Legacy-Support: hochzeitsort für alte Kompatibilität
        if hochzeitslocation_name:
            settings['hochzeitsort'] = locations.get('hochzeitslocation', {})
        
        cleaned_settings = clean_json_data(settings)
        
        return jsonify({"success": True, "settings": cleaned_settings})
    except Exception as e:
        logger.error(f"Fehler beim Laden der Einstellungen aus SQLite: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/zeitplan/list')
def api_zeitplan_list():
    """Zeitplan-Liste abrufen"""
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
            
        # SQLite-DatenManager verwenden
        zeitplan = data_manager.get_zeitplan()
        
        if not zeitplan:
            return jsonify({
                'success': True,
                'zeitplan': []
            })
        
        zeitplan_data = clean_json_data(zeitplan)
        
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
        
        # Eventteile verarbeiten
        eventteile = event_data.get('eventteile', [])
        
        # Zeit-Felder konvertieren
        start_time = f"2025-09-01 {event_data.get('Uhrzeit', '00:00')}:00"
        end_time = None
        if event_data.get('EndZeit'):
            end_time = f"2025-09-01 {event_data.get('EndZeit')}:00"
        
        # Neuen Eintrag für SQLite vorbereiten
        new_event = {
            'titel': event_data.get('Programmpunkt'),
            'beschreibung': event_data.get('Verantwortlich', ''),
            'start_zeit': start_time,
            'end_zeit': end_time,
            'ort': '',
            'kategorie': event_data.get('Status', 'Geplant'),
            'farbe': '#007bff',
            'wichtig': False,
            'nur_brautpaar': not bool(event_data.get('public', False)),
            'eventteile': eventteile
        }
        
        # In Datenbank einfügen
        entry_id = data_manager.add_zeitplan_entry(new_event)
        
        if entry_id:
            return jsonify({
                'success': True,
                'message': 'Programmpunkt erfolgreich hinzugefügt',
                'id': entry_id
            })
        else:
            return jsonify({'success': False, 'error': 'Fehler beim Speichern'}), 500
            
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
        
        entry_id = update_data.get('id')  # SQLite verwendet IDs statt Indizes
        event_data = update_data.get('data')
        
        # Validierung
        if entry_id is None or not event_data:
            return jsonify({'error': 'ID und Daten sind erforderlich'}), 400
        
        if not event_data.get('Uhrzeit') or not event_data.get('Programmpunkt'):
            return jsonify({'error': 'Uhrzeit und Programmpunkt sind erforderlich'}), 400
        
        # Zeit-Felder konvertieren
        start_time = f"2025-09-01 {event_data.get('Uhrzeit', '00:00')}:00"
        end_time = None
        if event_data.get('EndZeit'):
            end_time = f"2025-09-01 {event_data.get('EndZeit')}:00"
        
        # Update-Daten für SQLite vorbereiten
        update_event = {
            'titel': event_data.get('Programmpunkt'),
            'beschreibung': event_data.get('Verantwortlich', ''),
            'start_zeit': start_time,
            'end_zeit': end_time,
            'ort': '',
            'kategorie': event_data.get('Status', 'Geplant'),
            'farbe': '#007bff',
            'wichtig': False,
            'nur_brautpaar': not bool(event_data.get('public', False)),
            'eventteile': event_data.get('eventteile', [])
        }
        
        # In Datenbank aktualisieren
        success = data_manager.update_zeitplan_entry(entry_id, update_event)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Programmpunkt erfolgreich aktualisiert'
            })
        else:
            return jsonify({'success': False, 'error': 'Fehler beim Aktualisieren'}), 500
            
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
        entry_id = delete_data.get('id')  # SQLite verwendet IDs statt Indizes
        
        # Validierung
        if entry_id is None:
            return jsonify({'error': 'ID ist erforderlich'}), 400
        
        # Aus Datenbank löschen
        success = data_manager.delete_zeitplan_entry(entry_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Programmpunkt erfolgreich gelöscht'
            })
        else:
            return jsonify({'success': False, 'error': 'Fehler beim Löschen'}), 500
            
    except Exception as e:
        logger.error(f"Fehler beim Löschen des Programmpunkts: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/settings/save', methods=['POST'])
def api_settings_save():
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        settings_data = request.json
        
        # Konvertiere die Frontend-Settings in die strukturierte Form für save_settings
        structured_settings = {
            'hochzeit': {
                'datum': settings_data.get('hochzeitsdatum', ''),
                'location': settings_data.get('hochzeitsort', ''),
                'brautpaar': {
                    'braut': settings_data.get('braut_name', ''),
                    'braeutigam': settings_data.get('braeutigam_name', '')
                }
            },
            'ui': {},
            'features': {}
        }
        
        # Locations-Daten hinzufügen falls vorhanden
        if 'locations' in settings_data:
            locations = settings_data['locations']
            if isinstance(locations, dict):
                # Standesamt-Daten speichern
                if 'standesamt' in locations and isinstance(locations['standesamt'], dict):
                    standesamt = locations['standesamt']
                    data_manager.set_setting('standesamt_name', standesamt.get('name', ''))
                    data_manager.set_setting('standesamt_adresse', standesamt.get('adresse', ''))
                    data_manager.set_setting('standesamt_beschreibung', standesamt.get('beschreibung', ''))
                
                # Hochzeitslocation-Daten speichern
                if 'hochzeitslocation' in locations and isinstance(locations['hochzeitslocation'], dict):
                    hochzeitslocation = locations['hochzeitslocation']
                    data_manager.set_setting('hochzeitslocation_name', hochzeitslocation.get('name', ''))
                    data_manager.set_setting('hochzeitslocation_adresse', hochzeitslocation.get('adresse', ''))
                    data_manager.set_setting('hochzeitslocation_beschreibung', hochzeitslocation.get('beschreibung', ''))
        
        # First Login Modal Einstellungen
        for key in ['first_login_image', 'first_login_image_data', 'first_login_text']:
            if key in settings_data and settings_data[key]:
                data_manager.set_setting(key, settings_data[key])
        
        # Alle anderen direkten Settings
        for key, value in settings_data.items():
            if key not in ['bride_name', 'groom_name', 'hochzeitsdatum', 'hochzeitsort', 'locations', 'first_login_image', 'first_login_image_data', 'first_login_text']:
                if value is not None and value != '':
                    data_manager.set_setting(key, value)
        
        # Verwende die strukturierte save_settings Funktion für Hauptdaten
        success = data_manager.save_settings(structured_settings)
        
        if success:
            return jsonify({'success': True, 'message': 'Einstellungen gespeichert'})
        else:
            return jsonify({'error': 'Fehler beim Speichern der Einstellungen'}), 500
            
    except Exception as e:
        logger.error(f"Fehler beim Speichern der Einstellungen: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/geocode', methods=['GET'])
@require_auth
def api_geocode():
    """Proxy für Nominatim OpenStreetMap Geocoding API um CORS-Probleme zu umgehen"""
    try:
        query = request.args.get('q', '').strip()
        if not query:
            return jsonify({'error': 'Keine Suchanfrage angegeben'}), 400
        
        # Bekannte Aachen-Adressen für bessere Performance und Fallback
        aachen_coordinates = {
            'rathaus, markt 39, 52062 aachen': {'lat': 50.7753, 'lng': 6.0839, 'display_name': 'Rathaus Aachen, Markt 39, 52062 Aachen'},
            'markt 39, 52062 aachen': {'lat': 50.7753, 'lng': 6.0839, 'display_name': 'Markt 39, 52062 Aachen'},
            'rathaus aachen': {'lat': 50.7753, 'lng': 6.0839, 'display_name': 'Rathaus Aachen'},
            'kruppstraße 28, 52072 aachen': {'lat': 50.7698, 'lng': 6.0892, 'display_name': 'Kruppstraße 28, 52072 Aachen'},
            'kruppstrasse 28, 52072 aachen': {'lat': 50.7698, 'lng': 6.0892, 'display_name': 'Kruppstraße 28, 52072 Aachen'},
            'hotel kastanienhof aachen': {'lat': 50.7698, 'lng': 6.0892, 'display_name': 'Hotel Kastanienhof, Aachen'},
            'komericher weg 42/44, 52078 aachen-brand': {'lat': 50.7435, 'lng': 6.1242, 'display_name': 'Komericher Weg 42/44, 52078 Aachen-Brand'},
            'komericher mühle': {'lat': 50.7435, 'lng': 6.1242, 'display_name': 'Komericher Mühle, Aachen-Brand'}
        }
        
        # Zuerst im lokalen Cache suchen
        query_lower = query.lower().strip()
        for known_address, coords in aachen_coordinates.items():
            if query_lower in known_address or known_address in query_lower:
                # Cache-Hit
                return jsonify({
                    'success': True,
                    'lat': coords['lat'],
                    'lng': coords['lng'],
                    'display_name': coords['display_name'],
                    'source': 'local_cache'
                })
        
        # Falls nicht im Cache, versuche Nominatim API
        nominatim_url = 'https://nominatim.openstreetmap.org/search'
        params = {
            'format': 'json',
            'q': query,
            'limit': 1,
            'addressdetails': 1,
            'countrycodes': 'de'
        }
        
        headers = {
            'User-Agent': 'Hochzeitsplaner/1.0 (contact@example.com)',  # Wichtig für Nominatim
            'Accept': 'application/json',
            'Accept-Language': 'de,en'
        }
        
        try:
            response = requests.get(nominatim_url, params=params, headers=headers, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            if data and len(data) > 0:
                result = data[0]
                coords = {
                    'lat': float(result['lat']),
                    'lng': float(result['lon']),
                    'display_name': result.get('display_name', query)
                }
                # API Erfolg
                return jsonify({
                    'success': True,
                    'lat': coords['lat'],
                    'lng': coords['lng'],
                    'display_name': coords['display_name'],
                    'source': 'nominatim'
                })
            else:
                logger.warning(f"⚠️ Nominatim API keine Ergebnisse für: {query}")
                return jsonify({'success': False, 'error': 'Keine Ergebnisse gefunden'}), 404
                
        except requests.exceptions.RequestException as api_error:
            logger.error(f"❌ Nominatim API Fehler für {query}: {api_error}")
            
            # Fallback: Versuche eine generische Koordinate für Aachen
            if any(city in query_lower for city in ['aachen', 'brand']):
                fallback_coords = {'lat': 50.7753, 'lng': 6.0839, 'display_name': f'{query} (Fallback: Aachen)'}
                logger.info(f"🔄 Fallback für Aachen-Adresse: {query} -> {fallback_coords}")
                return jsonify({
                    'success': True,
                    'lat': fallback_coords['lat'],
                    'lng': fallback_coords['lng'],
                    'display_name': fallback_coords['display_name'],
                    'source': 'fallback'
                })
            
            return jsonify({'success': False, 'error': f'API-Fehler: {str(api_error)}'}), 500
            
    except Exception as e:
        logger.error(f"Unerwarteter Fehler in Geocoding API: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

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

@app.route('/api/import/excel', methods=['POST'])
def api_import_excel():
    """Importiert eine Gästeliste aus einer Excel-Datei"""
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        # Prüfe ob eine Datei hochgeladen wurde
        if 'file' not in request.files:
            return jsonify({'error': 'Keine Datei ausgewählt'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'Keine Datei ausgewählt'}), 400
        
        # Prüfe Dateierweiterung
        if not file.filename.lower().endswith(('.xlsx', '.xls')):
            return jsonify({'error': 'Nur Excel-Dateien (.xlsx, .xls) sind erlaubt'}), 400
        
        # Optionale Parameter
        sheet_name = request.form.get('sheet_name', 0)
        replace_existing = request.form.get('replace_existing', 'false').lower() == 'true'
        
        # Konvertiere sheet_name zu int falls es eine Zahl ist
        try:
            sheet_name = int(sheet_name)
        except (ValueError, TypeError):
            pass  # Bleibt als String
        
        # Backup der aktuellen Gästeliste erstellen (falls vorhanden)
        current_guests_backup = None
        if not replace_existing and hasattr(data_manager, 'gaesteliste_df') and not data_manager.gaesteliste_df.empty:
            current_guests_backup = data_manager.gaesteliste_df.copy()
        
        # Temporäre Datei speichern
        with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as temp_file:
            file.save(temp_file.name)
            temp_path = temp_file.name
        
        try:
            # Excel-Import durchführen
            success = data_manager.import_excel_gaesteliste(temp_path, sheet_name)
            
            if success:
                # Falls nicht ersetzen und Backup vorhanden, kombiniere die Listen
                if not replace_existing and current_guests_backup is not None:
                    # Neue Gäste zu bestehenden hinzufügen
                    combined_df = pd.concat([current_guests_backup, data_manager.gaesteliste_df], ignore_index=True)
                    
                    # Duplikate entfernen (basierend auf Vorname + Nachname)
                    combined_df = combined_df.drop_duplicates(subset=['Vorname', 'Nachname'], keep='last')
                    
                    data_manager.gaesteliste_df = combined_df
                    data_manager.save_gaesteliste()
                
                # Statistiken berechnen
                imported_count = len(data_manager.gaesteliste_df)
                
                return jsonify({
                    'success': True,
                    'message': f'Excel-Import erfolgreich: {imported_count} Gäste importiert',
                    'imported_count': imported_count,
                    'replaced': replace_existing
                })
            else:
                return jsonify({'error': 'Excel-Import fehlgeschlagen. Bitte prüfen Sie das Dateiformat.'}), 400
                
        finally:
            # Temporäre Datei löschen
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    
    except Exception as e:
        logger.error(f"Fehler beim Excel-Import: {e}")
        return jsonify({'error': f'Import-Fehler: {str(e)}'}), 500

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
        guest_ids = request_data.get('guest_ids', [])
        updates = request_data.get('updates', {})
        
        if not guest_ids or not updates:
            return jsonify({'success': False, 'error': 'Guest IDs und Updates sind erforderlich'}), 400
        
        # SQLite DataManager verwenden wenn verfügbar
        if hasattr(data_manager, 'update_guest'):
            updated_count = 0
            for guest_id in guest_ids:
                if data_manager.update_guest(guest_id, updates):
                    updated_count += 1
            
            return jsonify({'success': True, 'message': f'{updated_count} Gäste aktualisiert'})
        else:
            # Fallback zu pandas DataManager
            # Gästeliste laden
            data_manager.load_gaesteliste()
            
            # Guest IDs zu Indizes konvertieren (falls notwendig)
            for guest_id in guest_ids:
                # Gast in DataFrame finden
                guest_mask = data_manager.gaesteliste_df['id'] == guest_id if 'id' in data_manager.gaesteliste_df.columns else False
                if hasattr(guest_mask, 'any') and guest_mask.any():
                    index = data_manager.gaesteliste_df[guest_mask].index[0]
                    for key, value in updates.items():
                        if key in data_manager.gaesteliste_df.columns:
                            data_manager.gaesteliste_df.iloc[index, data_manager.gaesteliste_df.columns.get_loc(key)] = value
            
            # Speichern
            data_manager.save_gaesteliste()
            
            return jsonify({'success': True, 'message': f'{len(guest_ids)} Gäste aktualisiert'})
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
        
        # Verwende get_aufgaben für korrektes Field-Mapping
        aufgaben = data_manager.get_aufgaben()
        
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
        
        # Verwende get_aufgaben für korrektes Field-Mapping
        aufgaben = data_manager.get_aufgaben()
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
            'notizen': data.get('notizen', '').strip(),
            'erstellt_von': session.get('display_name', session.get('username', 'Unbekannt'))
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
        
        # Nur nicht zugeordnete und nicht ignorierte E-Mails zurückgeben
        unassigned_emails = []
        for email in all_emails:
            email_id = email.get('email_id')
            is_ignored = email.get('is_ignored', False)
            
            # Überspringe zugeordnete E-Mails
            if email_id in assigned_email_ids:
                continue
                
            # Überspringe ignorierte E-Mails
            if is_ignored:
                continue
                
            unassigned_emails.append(email)
        
        logger.info(f"✅ {len(all_emails)} E-Mails abgerufen, {len(assigned_email_ids)} bereits zugeordnet, {len(unassigned_emails)} verfügbar (ignorierte ausgeschlossen)")
        
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
            # Zusätzlich in SQLite-Tabelle für E-Mail-Zuordnung speichern
            try:
                with get_db_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute("""
                        INSERT OR IGNORE INTO email_aufgaben_zuordnung 
                        (email_id, aufgabe_id, zugeordnet_von, email_betreff, email_absender) 
                        VALUES (?, ?, ?, ?, ?)
                    """, (
                        email_id, 
                        task_id, 
                        session.get('username', 'System'),
                        email_details.get('subject', '')[:255],  # Begrenze auf 255 Zeichen
                        email_details.get('from_email', '')[:255]
                    ))
                    conn.commit()
                    logger.info(f"✅ E-Mail-Zuordnung in SQLite gespeichert: {email_id} -> Aufgabe {task_id}")
            except Exception as e:
                logger.warning(f"Fehler beim Speichern der E-Mail-Zuordnung in SQLite: {e}")
            
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

@app.route('/api/email/ignore', methods=['POST'])
@require_auth
@require_role(['admin', 'user'])
def api_email_ignore():
    """Markiert eine E-Mail als ignoriert"""
    if not EMAIL_AVAILABLE or not email_manager:
        return jsonify({
            'success': False,
            'message': 'E-Mail Manager nicht verfügbar'
        }), 400
    
    try:
        data = request.get_json()
        
        if not data or 'email_id' not in data:
            return jsonify({
                'success': False,
                'message': 'E-Mail-ID fehlt'
            }), 400
        
        email_id = data['email_id']
        
        # E-Mail als ignoriert markieren
        success = email_manager.mark_email_as_ignored(email_id)
        
        if success:
            logger.info(f"✅ E-Mail {email_id} als ignoriert markiert")
            return jsonify({
                'success': True,
                'message': 'E-Mail erfolgreich als ignoriert markiert'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Fehler beim Markieren der E-Mail als ignoriert'
            }), 500
        
    except Exception as e:
        logger.error(f"Fehler beim Ignorieren der E-Mail: {e}")
        return jsonify({
            'success': False,
            'message': f'Fehler beim Ignorieren: {str(e)}'
        }), 500

@app.route('/api/email/unignore', methods=['POST'])
@require_auth
@require_role(['admin', 'user'])
def api_email_unignore():
    """Entfernt die Ignorierung einer E-Mail"""
    if not EMAIL_AVAILABLE or not email_manager:
        return jsonify({
            'success': False,
            'message': 'E-Mail Manager nicht verfügbar'
        }), 400
    
    try:
        data = request.get_json()
        
        if not data or 'email_id' not in data:
            return jsonify({
                'success': False,
                'message': 'E-Mail-ID fehlt'
            }), 400
        
        email_id = data['email_id']
        
        # E-Mail-Ignorierung entfernen
        success = email_manager.remove_email_from_ignored(email_id)
        
        if success:
            logger.info(f"✅ E-Mail {email_id} nicht mehr ignoriert")
            return jsonify({
                'success': True,
                'message': 'E-Mail-Ignorierung erfolgreich entfernt'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Fehler beim Entfernen der E-Mail-Ignorierung'
            }), 500
        
    except Exception as e:
        logger.error(f"Fehler beim Entfernen der E-Mail-Ignorierung: {e}")
        return jsonify({
            'success': False,
            'message': f'Fehler beim Entfernen der Ignorierung: {str(e)}'
        }), 500

@app.route('/api/email/all', methods=['GET'])
@require_auth
@require_role(['admin', 'user'])
def api_email_all():
    """Ruft alle E-Mails ab (zugeordnet und nicht zugeordnet)"""
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
        # Alle E-Mails abrufen
        all_emails = email_manager.get_all_emails()
        
        # Zuordnungsstatus für jede E-Mail ermitteln
        aufgaben = data_manager.load_aufgaben()
        assigned_email_ids = set()
        
        for aufgabe in aufgaben:
            email_replies = aufgabe.get('email_replies', [])
            for reply in email_replies:
                email_id = reply.get('email_id')
                if email_id:
                    assigned_email_ids.add(email_id)
        
        # E-Mails mit Zuordnungsstatus anreichern
        for email in all_emails:
            email_id = email.get('email_id')
            email['is_assigned'] = email_id in assigned_email_ids
            
            # Aufgaben-Info hinzufügen falls zugeordnet
            if email['is_assigned']:
                for aufgabe in aufgaben:
                    email_replies = aufgabe.get('email_replies', [])
                    for reply in email_replies:
                        if reply.get('email_id') == email_id:
                            email['assigned_task'] = {
                                'id': aufgabe.get('id'),
                                'title': aufgabe.get('titel', 'Unbekannte Aufgabe')
                            }
                            break
                    if 'assigned_task' in email:
                        break
        
        logger.info(f"✅ {len(all_emails)} E-Mails abgerufen (alle)")
        
        return jsonify({
            'success': True,
            'emails': clean_json_data(all_emails),
            'count': len(all_emails),
            'assigned_count': len(assigned_email_ids)
        })
        
    except Exception as e:
        logger.error(f"Fehler beim Abrufen aller E-Mails: {e}")
        return jsonify({
            'success': False,
            'message': f'Fehler beim Abrufen: {str(e)}'
        }), 500

@app.route('/api/email/unassign', methods=['POST'])
@require_auth
@require_role(['admin', 'user'])
def api_email_unassign():
    """Entfernt die Zuordnung einer E-Mail von einer Aufgabe"""
    try:
        data = request.get_json()
        email_id = data.get('email_id')
        
        if not email_id:
            return jsonify({
                'success': False, 
                'message': 'Email ID erforderlich'
            }), 400
        
        # Zuordnung aus der Datenbank entfernen
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Prüfen, ob die E-Mail zugeordnet ist
            cursor.execute("SELECT aufgabe_id FROM email_aufgaben_zuordnung WHERE email_id = ?", (email_id,))
            result = cursor.fetchone()
            
            if result:
                # Zuordnung entfernen
                cursor.execute("DELETE FROM email_aufgaben_zuordnung WHERE email_id = ?", (email_id,))
                conn.commit()
                
                logger.info(f"✅ E-Mail-Zuordnung entfernt für Email-ID: {email_id}")
                return jsonify({
                    'success': True, 
                    'message': 'E-Mail-Zuordnung erfolgreich entfernt'
                })
            else:
                return jsonify({
                    'success': False, 
                    'message': 'E-Mail ist keiner Aufgabe zugeordnet'
                }), 400
                
    except Exception as e:
        logger.error(f"❌ Fehler beim Entfernen der E-Mail-Zuordnung: {e}")
        return jsonify({
            'success': False, 
            'message': f'Fehler beim Entfernen der Zuordnung: {str(e)}'
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

def start_server_with_ssl():
    """Startet den Server mit SSL-Unterstützung"""
    # Lade DynDNS-Konfiguration für Punycode-Domain
    dyndns_config_path = os.path.join(os.path.dirname(__file__), 'dyndns_config.json')
    punycode_domain = None
    external_port = 8443
    
    if os.path.exists(dyndns_config_path):
        try:
            with open(dyndns_config_path, 'r', encoding='utf-8') as f:
                dyndns_config = json.load(f)
                punycode_domain = dyndns_config.get('dyndns', {}).get('domain')
                external_port = dyndns_config.get('dyndns', {}).get('external_port', 8443)
        except Exception as e:
            logger.warning(f"Fehler beim Laden der DynDNS-Konfiguration: {e}")
    
    # SSL-Zertifikat-Pfade
    ssl_cert_path = os.path.join(os.path.dirname(__file__), 'ssl_certificate.crt')
    ssl_key_path = os.path.join(os.path.dirname(__file__), 'ssl_private_key.key')
    
    # Prüfe SSL-Zertifikate
    ssl_context = None
    if os.path.exists(ssl_cert_path) and os.path.exists(ssl_key_path):
        try:
            ssl_context = (ssl_cert_path, ssl_key_path)
            print(f"✅ SSL-Zertifikate gefunden")
        except Exception as e:
            logger.warning(f"SSL-Zertifikate gefunden, aber fehlerhaft: {e}")
            ssl_context = None
    
    # Lokaler Port 8080 (immer verfügbar)
    local_port = 8080
    
    print("🎉 Hochzeitsplaner Web-Anwendung")
    print("=" * 60)
    print(f"✅ DataManager initialisiert: {DATA_DIR}")
    print(f"🌐 Lokale URL: http://localhost:{local_port}")
    
    if punycode_domain and ssl_context:
        print(f"� SSL-URL: https://{punycode_domain}:{external_port}")
        print(f"🌍 Punycode-Domain: {punycode_domain}")
    elif punycode_domain:
        print(f"⚠️  Punycode-Domain konfiguriert, aber SSL-Zertifikate fehlen")
        print(f"   Domain: {punycode_domain}:{external_port}")
    
    print("⚠️  Zum Beenden: Strg+C")
    print("=" * 60)
    
    # Server-Konfiguration
    if ssl_context and punycode_domain:
        # SSL-Server für externe Punycode-Domain auf Port 8443
        import threading
        
        def start_ssl_server():
            try:
                print(f"🔒 Starte SSL-Server auf Port {external_port}...")
                app.run(
                    host='0.0.0.0',
                    port=external_port,
                    debug=False,
                    threaded=True,
                    ssl_context=ssl_context
                )
            except Exception as e:
                logger.error(f"SSL-Server Fehler: {e}")
        
        # SSL-Server in separatem Thread starten
        ssl_thread = threading.Thread(target=start_ssl_server, daemon=True)
        ssl_thread.start()
        
        # Warte kurz, dann starte lokalen HTTP-Server
        import time
        time.sleep(1)
    
    try:
        # Lokaler HTTP-Server auf Port 8080 (immer verfügbar)
        print(f"🌐 Starte lokalen HTTP-Server auf Port {local_port}...")
        app.run(
            host='0.0.0.0',  # IPv4 + IPv6 Support
            port=local_port,
            debug=False,
            threaded=True
        )
    except KeyboardInterrupt:
        print("\n🛑 Server wird beendet...")
    finally:
        # E-Mail-Checking stoppen beim Beenden
        if email_manager and EMAIL_AVAILABLE:
            email_manager.stop_email_checking()
        print("👋 Auf Wiedersehen!")

if __name__ == '__main__':
    if not data_manager:
        print("❌ KRITISCHER FEHLER: DataManager konnte nicht initialisiert werden!")
        exit(1)
    
    start_server_with_ssl()


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
import signal
import atexit
import threading
import requests # type: ignore
import re
from flask import Flask, render_template, request, jsonify, send_file, session, redirect, url_for, flash, send_from_directory, make_response

# PIL import für Thumbnail-Generierung
try:
    from PIL import Image
    PIL_AVAILABLE = True
    logger_msg = "✅ PIL/Pillow successfully imported for thumbnail generation"
except ImportError as e:
    PIL_AVAILABLE = False
    logger_msg = f"⚠️ PIL/Pillow not available: {e}. Thumbnails will fall back to original images"
from flask_cors import CORS
from datetime import datetime, timedelta
import shutil
from functools import wraps

# Pandas als Lazy Import - nur laden wenn wirklich benötigt
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

# PIL-Status loggen
logger.info(logger_msg)

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
        
        logger.info(f"🔐 Auth Check: Route {request.path} von {request.remote_addr}")
        logger.info(f"🔐 Auth Check: Session logged_in: {session.get('logged_in', False)}")
        logger.info(f"🔐 Auth Check: Session user: {session.get('username', 'none')}")
        
        # Prüfen ob Benutzer eingeloggt ist
        if 'logged_in' not in session or not session['logged_in']:
            logger.warning(f"❌ Auth Check: Nicht eingeloggt für Route {request.path}")
            if request.path.startswith('/api/'):
                return jsonify({'error': 'Authentication required'}), 401
            return redirect(url_for('login'))
        
        # Session-Timeout prüfen
        if 'login_time' in session:
            timeout_hours = auth_config['auth']['session_timeout_hours']
            login_time = datetime.fromisoformat(session['login_time'])
            if datetime.now() - login_time > timedelta(hours=timeout_hours):
                logger.warning(f"⏰ Auth Check: Session timeout für {session.get('username')}")
                session.clear()
                if request.path.startswith('/api/'):
                    return jsonify({'error': 'Session expired'}), 401
                flash('Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.', 'warning')
                return redirect(url_for('login'))
        
        logger.info(f"✅ Auth Check: Authentifizierung erfolgreich für {session.get('username')}")
        return f(*args, **kwargs)
    return decorated_function

def require_role(allowed_roles):
    """Decorator für rollen-basierte Zugriffskontrolle"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_role = session.get('user_role', 'guest')
            
            logger.info(f"🔒 Role Check: Route {request.path}")
            logger.info(f"🔒 Role Check: User role: {user_role}")
            logger.info(f"🔒 Role Check: Allowed roles: {allowed_roles}")
            
            if user_role not in allowed_roles:
                logger.warning(f"❌ Role Check: Zugriff verweigert für {user_role} auf {request.path}")
                if request.path.startswith('/api/'):
                    return jsonify({'error': 'Insufficient permissions'}), 403
                flash('Sie haben keine Berechtigung für diese Seite.', 'danger')
                return redirect(url_for('guest_dashboard' if user_role == 'guest' else 'index'))
            
            logger.info(f"✅ Role Check: Zugriff erlaubt für {user_role}")
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def login_required(f):
    """Decorator für Admin-Login-Schutz"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Prüfen ob Admin eingeloggt ist
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

# Flask Logging komplett deaktivieren für saubere Ausgabe
import logging
logging.getLogger('werkzeug').disabled = True
logging.getLogger('werkzeug').setLevel(logging.CRITICAL)
app.logger.disabled = True

CORS(app)

# Favicon Route
@app.route('/favicon.ico')
def favicon():
    """Favicon bereitstellen"""
    return send_file(
        os.path.join(app.root_path, 'static', 'favicon.ico'),
        mimetype='image/vnd.microsoft.icon'
    )

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

# Thread-Management für sauberes Shutdown
ssl_thread = None
server_running = True
shutdown_event = threading.Event()

def signal_handler(signum, frame):
    """Signal-Handler für sauberes Beenden"""
    global server_running, ssl_thread
    print(f"\n🛑 Signal {signum} empfangen - Server wird beendet...")
    server_running = False
    shutdown_event.set()
    
    # E-Mail-Manager stoppen
    if email_manager and EMAIL_AVAILABLE:
        try:
            email_manager.stop_email_checking()
            print("📧 E-Mail-Checking gestoppt")
        except:
            pass
    
    # SSL-Thread beenden (falls vorhanden)
    if ssl_thread and ssl_thread.is_alive():
        print("🔒 SSL-Server wird beendet...")
    
    print("👋 Auf Wiedersehen!")
    os._exit(0)

def cleanup():
    """Cleanup-Funktion für atexit"""
    global server_running
    if server_running:
        server_running = False
        shutdown_event.set()
        if email_manager and EMAIL_AVAILABLE:
            try:
                email_manager.stop_email_checking()
            except:
                pass

# Signal-Handler registrieren
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)
atexit.register(cleanup)

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
            # DataManager-Referenz setzen
            email_manager.set_data_manager(data_manager)
            
            # E-Mail-Check VERZÖGERT starten (nicht sofort beim Server-Start)
            def delayed_email_start():
                """Startet E-Mail-Checking nach 30 Sekunden Verzögerung"""
                import time
                time.sleep(30)  # 30 Sekunden warten
                email_manager.start_email_checking()
                print("✅ Automatischer E-Mail-Abruf gestartet (verzögert)")
            
            # E-Mail-Check in separatem Thread mit Verzögerung starten
            import threading
            email_thread = threading.Thread(target=delayed_email_start, daemon=True)
            email_thread.start()
            print("📧 E-Mail-Check wird in 30 Sekunden gestartet...")
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
    
    # ALLE API-Routen erfordern Authentifizierung
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
        
        # Sichere Behandlung für sowohl DataFrame als auch Liste
        if hasattr(budget, 'to_dict'):
            # Es ist ein DataFrame
            if budget.empty:
                budget_data = []
            else:
                budget_data = clean_json_data(budget.to_dict('records'))
        elif isinstance(budget, list):
            # Es ist bereits eine Liste
            budget_data = clean_json_data(budget)
        else:
            # Fallback für andere Typen
            budget_data = []
        
        # Benutzerfreundliche Nachricht für leere Budgets
        if not budget_data:
            return jsonify({
                'success': True,
                'budget': [],
                'message': 'Noch keine Budget-Einträge vorhanden. Erstellen Sie zunächst ein Budget über die Kostenberechnung.',
                'isEmpty': True
            })
        
        return jsonify({
            'success': True,
            'budget': budget_data,
            'isEmpty': False
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
        try:
            # Versuche moderne SQLite-Methode
            gaeste_data = data_manager.get_gaeste_list()
        except AttributeError:
            # Fallback für alte DataFrame-Methode
            data_manager.load_gaesteliste()  # Daten in gaesteliste_df laden
            if hasattr(data_manager, 'gaesteliste_df') and not data_manager.gaesteliste_df.empty:
                gaeste_data = data_manager.gaesteliste_df.to_dict('records')
            else:
                gaeste_data = []
        
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
            # Sichere Behandlung für sowohl DataFrame als auch Liste
            if hasattr(existing_budget_df, 'to_dict'):
                existing_budget_items = existing_budget_df.to_dict('records') if not existing_budget_df.empty else []
            elif isinstance(existing_budget_df, list):
                existing_budget_items = existing_budget_df
            else:
                existing_budget_items = []
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
                mitternachtssnack_manual = manual_guest_counts.get('mitternachtssnack', 0)
                
                if ('mitternachtssnack' in beschreibung.lower() or 
                    'midnight' in beschreibung.lower() or 
                    beschreibung.lower() == 'snack') and mitternachtssnack_manual > 0:
                    # Verwende manuelle Gästeanzahl für Mitternachtssnack
                    menge = mitternachtssnack_manual
                    einzelpreis = float(item.get('preis_pro_einheit', 0) or 0)
                    gesamtpreis = menge * einzelpreis
                    details = f"{menge} Personen × {einzelpreis}€ (manuell festgelegt)"
                else:
                    # Standardberechnung für alle anderen Party-Kosten
                    # ALLE Party-Gäste (Weißer Saal + Essen + zusätzliche Party-Gäste)
                    menge = total_party  # Gesamte Party-Menge verwenden
                    einzelpreis = float(item.get('preis_pro_einheit', 0) or 0)
                    gesamtpreis = menge * einzelpreis
                    details = f"{menge} Personen × {einzelpreis}€ (alle Party-Gäste: {total_weisser_saal} Weißer Saal + {total_essen - total_weisser_saal} Essen + {total_party - total_essen} nur Party)"
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
        
        # Speichere das generierte Budget automatisch mit SQLite CRUD-Methoden
        try:
            # Lösche alle existierenden Budget-Einträge vor dem Neugenerieren
            # (Das ist sicherer als Update, da sich Kategorien/Beschreibungen ändern können)
            with data_manager._get_connection() as conn:
                conn.execute("DELETE FROM budget")
                conn.commit()
            
            # Füge neue Budget-Items hinzu
            for item in budget_items:
                success = data_manager.add_budget_item(item)
                if not success:
                    logger.warning(f"Fehler beim Hinzufügen von Budget-Item: {item.get('beschreibung', 'Unknown')}")
            
        except Exception as e:
            logger.error(f"Fehler beim automatischen Speichern des Budgets: {str(e)}")
            # Selbst wenn das Speichern fehlschlägt, geben wir das Budget zurück
            # damit der Benutzer es manuell bearbeiten kann
        
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
        
        # Verwende die SQLite CRUD-Methode
        success = data_manager.add_budget_item(neuer_eintrag)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Budget-Eintrag erfolgreich hinzugefügt',
                'eintrag': neuer_eintrag
            })
        else:
            return jsonify({'error': 'Budget-Eintrag konnte nicht hinzugefügt werden'}), 400
    except Exception as e:
        logger.error(f"Fehler beim Hinzufügen des Budget-Eintrags: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/budget/edit/<int:item_id>', methods=['PUT'])
def api_budget_edit(item_id):
    """Budget-Eintrag bearbeiten"""
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Keine Daten empfangen'}), 400
        
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
        
        # Berechne Gesamtpreis neu falls Einzelpreis oder Menge vorhanden sind
        if 'einzelpreis' in data and 'menge' in data:
            data['gesamtpreis'] = data['einzelpreis'] * data['menge']
        elif 'einzelpreis' in data or 'menge' in data:
            # Falls nur einer der Werte geändert wurde, lade den aktuellen Eintrag um den anderen Wert zu erhalten
            budget_data = data_manager.lade_budget()
            if isinstance(budget_data, list):
                current_item = next((item for item in budget_data if item.get('id') == item_id), None)
            else:
                # DataFrame
                current_items = budget_data[budget_data['id'] == item_id]
                current_item = current_items.iloc[0].to_dict() if not current_items.empty else None
            
            if current_item:
                einzelpreis = data.get('einzelpreis', current_item.get('einzelpreis', 0))
                menge = data.get('menge', current_item.get('menge', 0))
                data['gesamtpreis'] = float(einzelpreis) * float(menge)
        
        # Verwende die SQLite CRUD-Methode
        success = data_manager.update_budget_item(item_id, data)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Budget-Eintrag erfolgreich aktualisiert'
            })
        else:
            return jsonify({'error': 'Budget-Eintrag konnte nicht aktualisiert werden'}), 400
    except Exception as e:
        logger.error(f"Fehler beim Bearbeiten des Budget-Eintrags: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/budget/delete/<int:item_id>', methods=['DELETE'])
def api_budget_delete(item_id):
    """Budget-Eintrag löschen"""
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        # Verwende die SQLite CRUD-Methode
        success = data_manager.delete_budget_item(item_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Budget-Eintrag erfolgreich gelöscht'
            })
        else:
            return jsonify({'error': 'Budget-Eintrag konnte nicht gelöscht werden'}), 400
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
        
        # Verwende SQLite CRUD-Methoden statt pandas DataFrame
        try:
            # Lösche alle existierenden Budget-Einträge
            with data_manager._get_connection() as conn:
                conn.execute("DELETE FROM budget")
                conn.commit()
            
            # Füge neue Budget-Items hinzu
            for item in budget_items:
                success = data_manager.add_budget_item(item)
                if not success:
                    logger.warning(f"Fehler beim Hinzufügen von Budget-Item: {item.get('beschreibung', 'Unknown')}")
            
        except Exception as e:
            logger.error(f"Fehler beim Speichern des kompletten Budgets: {str(e)}")
            return jsonify({'error': f'Fehler beim Speichern: {str(e)}'}), 500
        
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
    
    # Debug: Alle Request-Parameter ausgeben
    logger.info(f"LOGIN DEBUG: method={request.method}, args={dict(request.args)}, form={dict(request.form)}")
    
    # Prüfe URL-Parameter für automatische Anmeldung
    if request.method == 'GET':
        guest_code = request.args.get('guest_code')
        password = request.args.get('password')
        
        logger.info(f"LOGIN DEBUG: guest_code='{guest_code}', password='{password}'")
        
        # Auto-Login mit URL-Parametern
        if guest_code and password:
            logger.info(f"LOGIN DEBUG: Versuche Auto-Login für guest_code='{guest_code}'")
            user = authenticate_user(guest_code, password)
            logger.info(f"LOGIN DEBUG: authenticate_user result: {user}")
            
            if user and user['role'] == 'guest':
                logger.info(f"LOGIN DEBUG: Erfolgreiche Authentifizierung für {user['username']}")
                # Erfolgreiche Anmeldung via URL-Parameter
                session['logged_in'] = True
                session['username'] = user['username']
                session['user_role'] = user['role']
                session['display_name'] = user['display_name']
                session['login_time'] = datetime.now().isoformat()
                session.permanent = True
                
                # Zusätzliche Daten für Gäste
                guest_data = user.get('guest_data', {})
                session['guest_id'] = user.get('guest_id')
                session['guest_code'] = guest_data.get('guest_code')
                session['guest_email'] = guest_data.get('Email') or guest_data.get('email')
                
                logger.info(f"LOGIN DEBUG: Session gesetzt: {dict(session)}")
                
                # Redirect zum Gäste-Dashboard
                redirect_url = url_for('guest_dashboard')
                if user.get('is_first_login', False):
                    # First Login Parameter hinzufügen
                    from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
                    parsed = urlparse(redirect_url)
                    query_dict = parse_qs(parsed.query)
                    query_dict['first_login'] = ['1']
                    new_query = urlencode(query_dict, doseq=True)
                    redirect_url = urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, parsed.fragment))
                
                logger.info(f"LOGIN DEBUG: Redirect zu: {redirect_url}")
                logger.info(f"Auto-Login via URL-Parameter erfolgreich für Gast: {guest_code}")
                return redirect(redirect_url)
            else:
                # Fehlgeschlagene Auto-Anmeldung - zeige Login-Seite mit Fehler
                logger.info(f"LOGIN DEBUG: Auto-Login fehlgeschlagen für guest_code='{guest_code}', user={user}")
                return render_template('login.html', error='Ungültige Anmeldedaten in URL-Parametern')
        else:
            logger.info(f"LOGIN DEBUG: Keine Auto-Login Parameter gefunden, zeige normale Login-Seite")
    
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

@app.route('/guest-credentials')
@require_auth
@require_role(['admin'])
def guest_credentials_page():
    """Gast-Login-Credentials Verwaltung (nur für Admins)"""
    return render_template('guest_credentials.html')

@app.route('/database-admin')
@require_auth
@require_role(['admin'])
def database_admin():
    """SQLite Datenbank-Verwaltung (nur für Admins)"""
    try:
        # Lade aktuelle Einstellungen für Brautpaar-Namen
        settings = data_manager.get_settings() if data_manager else {}
        brautpaar_namen = settings.get('brautpaar_namen', 'Käthe & Pascal')
        
        return render_template('database_admin.html', brautpaar_namen=brautpaar_namen)
    except Exception as e:
        app.logger.error(f"Fehler in database_admin(): {e}")
        return render_template('error.html', error_message=f"Fehler beim Laden der Datenbank-Verwaltung: {str(e)}")

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
# Kontakte Routen
# =============================================================================

@app.route('/kontakte')
@require_auth
@require_role(['admin', 'user'])
def kontakte():
    """Kontakte Verwaltung Seite"""
    return render_template('kontakte.html')

@app.route('/api/kontakte/list')
@require_auth
@require_role(['admin', 'user'])
def api_kontakte_list():
    """Kontakte aus CSV-Datei laden"""
    try:
        import csv
        import os
        
        # CSV-Datei Pfad - korrekte Behandlung für PyInstaller
        if getattr(sys, 'frozen', False):
            # Wenn als .exe ausgeführt (PyInstaller) - data-Verzeichnis neben der .exe
            base_dir = os.path.dirname(sys.executable)
        else:
            # Normal als Python-Script - data-Verzeichnis neben der app.py
            base_dir = os.path.dirname(os.path.abspath(__file__))
        
        csv_file_path = os.path.join(base_dir, 'data', 'kontakte.csv')
        
        if not os.path.exists(csv_file_path):
            return jsonify({
                'success': False,
                'error': f'Kontakte CSV-Datei nicht gefunden: {csv_file_path}',
                'kontakte': []
            })
        
        kontakte = []
        
        with open(csv_file_path, 'r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                # Bereinige die Daten und füge ID hinzu
                kontakt = {}
                for key, value in row.items():
                    kontakt[key] = value.strip() if value else ''
                # Füge eindeutige ID für Frontend hinzu
                kontakt['id'] = len(kontakte) + 1
                kontakte.append(kontakt)
        
        return jsonify({
            'success': True,
            'kontakte': kontakte,
            'count': len(kontakte)
        })
        
    except Exception as e:
        logger.error(f"Fehler beim Laden der Kontakte: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Fehler beim Laden der Kontakte: {str(e)}',
            'kontakte': []
        })

@app.route('/api/kontakte/add', methods=['POST'])
@require_auth
@require_role(['admin', 'user'])
def api_kontakte_add():
    """Neuen Kontakt zur CSV-Datei hinzufügen"""
    try:
        import csv
        import os
        
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'Keine Daten empfangen'}), 400
        
        # Pflichtfelder prüfen
        required_fields = ['name', 'kategorie', 'telefon']
        missing_fields = [field for field in required_fields if not data.get(field, '').strip()]
        
        if missing_fields:
            return jsonify({
                'success': False, 
                'error': f'Fehlende Pflichtfelder: {", ".join(missing_fields)}'
            }), 400
        
        # CSV-Datei Pfad - korrekte Behandlung für PyInstaller
        if getattr(sys, 'frozen', False):
            base_dir = os.path.dirname(sys.executable)
        else:
            base_dir = os.path.dirname(os.path.abspath(__file__))
        
        csv_file_path = os.path.join(base_dir, 'data', 'kontakte.csv')
        
        # Neuer Kontakt-Datensatz
        new_kontakt = {
            'name': data.get('name', '').strip(),
            'kategorie': data.get('kategorie', '').strip(),
            'telefon': data.get('telefon', '').strip(),
            'email': data.get('email', '').strip(),
            'adresse': data.get('adresse', '').strip(),
            'website': data.get('website', '').strip(),
            'notizen': data.get('notizen', '').strip(),
            'bewertung': data.get('bewertung', '').strip(),
            'kosten': data.get('kosten', '').strip(),
            'bild_url': data.get('bild_url', '').strip()
        }
        
        # Prüfe ob CSV-Datei existiert und Header lesen
        file_exists = os.path.exists(csv_file_path)
        fieldnames = ['name', 'kategorie', 'telefon', 'email', 'adresse', 'website', 'notizen', 'bewertung', 'kosten', 'bild_url']
        
        if file_exists:
            # Bestehende Header aus der Datei lesen
            try:
                with open(csv_file_path, 'r', encoding='utf-8') as csvfile:
                    reader = csv.DictReader(csvfile)
                    if reader.fieldnames:
                        fieldnames = reader.fieldnames
            except Exception as e:
                logger.warning(f"Fehler beim Lesen der CSV-Header: {e}")
        
        # Daten zur CSV-Datei hinzufügen
        with open(csv_file_path, 'a', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            
            # Header schreiben wenn Datei neu ist
            if not file_exists:
                writer.writeheader()
            
            # Nur Felder schreiben, die in fieldnames enthalten sind
            filtered_kontakt = {key: new_kontakt.get(key, '') for key in fieldnames}
            writer.writerow(filtered_kontakt)
        
        logger.info(f"✅ Neuer Kontakt hinzugefügt: {new_kontakt['name']} ({new_kontakt['kategorie']})")
        
        return jsonify({
            'success': True,
            'message': f'Kontakt "{new_kontakt["name"]}" erfolgreich hinzugefügt',
            'kontakt': new_kontakt
        })
        
    except Exception as e:
        logger.error(f"Fehler beim Hinzufügen des Kontakts: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Fehler beim Hinzufügen des Kontakts: {str(e)}'
        }), 500

@app.route('/api/kontakte/contact', methods=['POST'])
@require_auth
@require_role(['admin', 'user'])
def api_kontakte_contact():
    """Kontaktaufnahme mit einem Anbieter starten"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'Keine Daten empfangen'}), 400
        
        kontakt_name = data.get('kontakt_name')
        kontakt_kategorie = data.get('kontakt_kategorie')
        kontakt_email = data.get('kontakt_email')
        betreff = data.get('betreff', '')
        nachricht = data.get('nachricht', '')
        
        if not all([kontakt_name, kontakt_kategorie, kontakt_email]):
            return jsonify({'success': False, 'error': 'Kontaktdaten unvollständig'}), 400
        
        if not data_manager:
            return jsonify({'success': False, 'error': 'DataManager nicht verfügbar'}), 500
        
        # Erstelle Aufgabe im Aufgabenplaner für beide Partner
        aufgaben_titel = f"Kontakt zu {kontakt_name} ({kontakt_kategorie})"
        aufgaben_beschreibung = f"Kontaktaufnahme mit {kontakt_name} - {kontakt_kategorie}\n"
        aufgaben_beschreibung += f"E-Mail: {kontakt_email}\n"
        if betreff:
            aufgaben_beschreibung += f"Betreff: {betreff}\n"
        if nachricht:
            aufgaben_beschreibung += f"Nachricht: {nachricht}\n"
        
        # Füge Aufgabe für beide Partner hinzu
        neue_aufgabe = {
            'titel': aufgaben_titel,
            'beschreibung': aufgaben_beschreibung,
            'kategorie': kontakt_kategorie,  # Verwende die echte Kontakt-Kategorie
            'prioritaet': 'Mittel',
            'status': 'Offen',
            'faellig_am': '',
            'erstellt_am': datetime.now().strftime('%Y-%m-%d %H:%M'),
            'bearbeitet_am': '',
            'zugewiesen_an': 'Beide'  # Explizit beiden zuweisen
        }
        
        # Speichere Aufgabe
        success = data_manager.add_aufgabe(neue_aufgabe)
        
        if success:
            return jsonify({
                'success': True,
                'message': f'Aufgabe für Kontakt zu {kontakt_name} wurde erstellt',
                'task_created': True,
                'email_data': {
                    'to': kontakt_email,
                    'subject': betreff or f'Anfrage Hochzeit - {kontakt_kategorie}',
                    'body': nachricht
                }
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Fehler beim Erstellen der Aufgabe'
            }), 500
            
    except Exception as e:
        logger.error(f"Fehler bei Kontaktaufnahme: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Fehler bei Kontaktaufnahme: {str(e)}'
        }), 500

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
        
        # Gästename für Template
        guest_name = f"{guest_data.get('vorname', '')} {guest_data.get('nachname', '')}".strip()
        
        # Personalisierte Nachricht generieren
        message = generate_personalized_welcome_message(
            anzahl_personen, weisser_saal, anzahl_essen, anzahl_party, formatted_date, guest_name
        )
        
        # Response mit Cache-Control Headers erstellen
        response_data = {
            'success': True,
            'message': message,
            'wedding_date': formatted_date
        }
        response = make_response(jsonify(response_data))
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        
        return response
        
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

def generate_personalized_welcome_message(anzahl_personen, weisser_saal, anzahl_essen, anzahl_party, wedding_date, guest_name=""):
    """Generiert eine personalisierte Willkommensnachricht basierend auf den Event-Teilnahmen"""
    
    # Lade die konfigurierten Einladungstexte aus den Einstellungen
    settings = data_manager.load_settings() if data_manager else {}
    invitation_texts = settings.get('invitation_texts', {})
    
    # Prüfe ob personalisierte Texte konfiguriert sind
    if invitation_texts and (invitation_texts.get('singular') or invitation_texts.get('plural')):
        return generate_personalized_message_from_settings(
            anzahl_personen, weisser_saal, anzahl_essen, anzahl_party, wedding_date, invitation_texts, guest_name
        )
    
    # Fallback auf die ursprüngliche hart kodierte Logik
    return generate_legacy_welcome_message(anzahl_personen, weisser_saal, anzahl_essen, anzahl_party, wedding_date)

def generate_personalized_message_from_settings(anzahl_personen, weisser_saal, anzahl_essen, anzahl_party, wedding_date, invitation_texts, guest_name=""):
    """Generiert die Nachricht basierend auf den konfigurierten Settings"""
    
    # Bestimme ob Singular oder Plural
    is_plural = anzahl_personen > 1
    
    # Basis-Template auswählen
    base_template = invitation_texts.get('plural' if is_plural else 'singular', '')
    
    if not base_template:
        # Fallback wenn kein Template konfiguriert
        return generate_legacy_welcome_message(anzahl_personen, weisser_saal, anzahl_essen, anzahl_party, wedding_date)
    
    # Event-spezifische Texte
    events = invitation_texts.get('events', {})
    special_notes = invitation_texts.get('special_notes', {})
    
    # Event-Teile sammeln
    event_parts = []
    
    if weisser_saal > 0:
        text_key = 'trauung_plural' if is_plural else 'trauung_singular'
        event_text = events.get(text_key, '')
        if event_text:
            event_parts.append(event_text)
    
    if anzahl_essen > 0:
        text_key = 'essen_plural' if is_plural else 'essen_singular'
        event_text = events.get(text_key, '')
        if event_text:
            event_parts.append(event_text)
    
    if anzahl_party > 0:
        text_key = 'party_plural' if is_plural else 'party_singular'
        event_text = events.get(text_key, '')
        if event_text:
            event_parts.append(event_text)
    
    # Spezielle Hinweise
    special_notes_text = ''
    if weisser_saal > 0:
        notes_key = 'weisser_saal_plural' if is_plural else 'weisser_saal_singular'
        special_notes_text = special_notes.get(notes_key, '')
    
    # Template-Variablen ersetzen
    message = base_template
    message = message.replace('{{guest_name}}', guest_name)
    message = message.replace('{{wedding_date}}', wedding_date)
    message = message.replace('{{event_parts}}', '\n'.join(event_parts))
    message = message.replace('{{special_notes}}', special_notes_text)
    
    # Markdown-Formatierung anwenden
    message = apply_markdown_formatting(message)
    
    return message

def generate_legacy_welcome_message(anzahl_personen, weisser_saal, anzahl_essen, anzahl_party, wedding_date):
    """Original hart kodierte Logik als Fallback"""
    
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
    
    # Markdown-Formatierung anwenden
    full_message = apply_markdown_formatting(full_message)
    
    return full_message

def apply_markdown_formatting(text):
    """Konvertiert einfache Markdown-Formatierung zu HTML"""
    if not text:
        return text
    
    # Fettschrift: **text** -> <strong>text</strong>
    import re
    text = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', text)
    
    # Zeilumbrüche zu <br> für HTML-Anzeige
    text = text.replace('\n', '<br>')
    
    return text

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

@app.route('/api/guest/invitation-headers')
@require_auth
@require_role(['guest'])
def get_guest_invitation_headers():
    """API-Endpunkt für konfigurierbare Einladungsheader"""
    try:
        if not data_manager:
            return jsonify({'success': False, 'message': 'DataManager nicht verfügbar'})
        
        # Lade Einstellungen
        settings = data_manager.load_settings()
        
        # Header-Daten extrahieren OHNE Fallback-Werte (leere Strings wenn nicht gesetzt)
        invitation_header = settings.get('invitation_header', '').strip()
        invitation_rings = settings.get('invitation_rings', '').strip()
        
        return jsonify({
            'success': True,
            'invitation_header': invitation_header,
            'invitation_rings': invitation_rings
        })
        
    except Exception as e:
        logger.error(f"Fehler beim Laden der Einladungsheader: {e}")
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
        
        # Location-Daten direkt aus SQLite laden (verwendet DataManager)
        locations = {}
        
        # Verwende DataManager für korrekte Datenbankverbindung
        def get_setting_direct(key):
            try:
                # Verwende den DataManager anstatt hardcodierte Pfade
                if not data_manager:
                    logger.warning("DataManager nicht verfügbar für Setting-Abfrage")
                    return ''
                
                with data_manager._get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute('SELECT wert FROM einstellungen WHERE schluessel = ?', (key,))
                    row = cursor.fetchone()
                    return row[0] if row else ''
            except Exception as e:
                logger.warning(f"Fehler beim Laden der Einstellung '{key}': {e}")
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
                'mehrere': 'Bei Fragen könnt ihr euch gerne an uns wenden.',
                'whatsapp_nummer': ''
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

# ADMIN-ONLY: Datenbank-Verwaltung
@app.route('/api/admin/database/tables', methods=['GET'])
@require_auth
@require_role(['admin'])
def get_database_tables():
    """API-Endpunkt zum Abrufen aller Tabellen in der SQLite-Datenbank"""
    try:
        if not data_manager:
            return jsonify({'success': False, 'message': 'DataManager nicht verfügbar'})
        
        import sqlite3
        
        tables = []
        with sqlite3.connect(data_manager.db_path) as conn:
            cursor = conn.cursor()
            
            # Hole alle Tabellen
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            table_names = cursor.fetchall()
            
            for (table_name,) in table_names:
                # Hole Spalten-Informationen
                cursor.execute(f"PRAGMA table_info({table_name})")
                columns = cursor.fetchall()
                
                # Hole Anzahl der Zeilen
                cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                row_count = cursor.fetchone()[0]
                
                tables.append({
                    'name': table_name,
                    'columns': [{'name': col[1], 'type': col[2], 'nullable': not col[3], 'primary_key': bool(col[5])} for col in columns],
                    'row_count': row_count
                })
        
        return jsonify({
            'success': True,
            'tables': tables
        })
        
    except Exception as e:
        logger.error(f"Fehler beim Abrufen der Datenbank-Tabellen: {e}")
        return jsonify({'success': False, 'message': f'Serverfehler: {str(e)}'})

@app.route('/api/admin/database/query', methods=['POST'])
@require_auth
@require_role(['admin'])
def execute_database_query():
    """API-Endpunkt zum Ausführen von SQL-Queries"""
    try:
        if not data_manager:
            return jsonify({'success': False, 'message': 'DataManager nicht verfügbar'})
        
        data = request.get_json()
        if not data or 'query' not in data:
            return jsonify({'success': False, 'message': 'Keine SQL-Query übertragen'})
        
        query = data['query'].strip()
        
        # Sicherheitscheck: Nur bestimmte Operationen erlauben
        allowed_statements = ['SELECT', 'PRAGMA', 'EXPLAIN']
        query_upper = query.upper()
        
        is_allowed = any(query_upper.startswith(stmt) for stmt in allowed_statements)
        
        if not is_allowed:
            return jsonify({
                'success': False, 
                'message': 'Nur SELECT, PRAGMA und EXPLAIN Statements sind erlaubt'
            })
        
        import sqlite3
        
        result = {
            'success': True,
            'columns': [],
            'rows': [],
            'row_count': 0,
            'query': query
        }
        
        with sqlite3.connect(data_manager.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(query)
            
            # Hole Spalten-Namen
            if cursor.description:
                result['columns'] = [desc[0] for desc in cursor.description]
                
                # Hole alle Zeilen
                rows = cursor.fetchall()
                result['rows'] = rows
                result['row_count'] = len(rows)
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Fehler beim Ausführen der SQL-Query: {e}")
        return jsonify({'success': False, 'message': f'SQL-Fehler: {str(e)}'})

@app.route('/api/admin/database/table/<table_name>', methods=['GET'])
@require_auth
@require_role(['admin'])
def get_table_data(table_name):
    """API-Endpunkt zum Abrufen der Daten einer spezifischen Tabelle"""
    try:
        if not data_manager:
            return jsonify({'success': False, 'message': 'DataManager nicht verfügbar'})
        
        # Parameter für Paginierung
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        offset = (page - 1) * per_page
        
        import sqlite3
        
        with sqlite3.connect(data_manager.db_path) as conn:
            cursor = conn.cursor()
            
            # Prüfe ob Tabelle existiert
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
            if not cursor.fetchone():
                return jsonify({'success': False, 'message': f'Tabelle {table_name} nicht gefunden'})
            
            # Hole Spalten-Informationen
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns_info = cursor.fetchall()
            columns = [{'name': col[1], 'type': col[2], 'nullable': not col[3], 'primary_key': bool(col[5])} for col in columns_info]
            
            # Hole Gesamtanzahl der Zeilen
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            total_rows = cursor.fetchone()[0]
            
            # Hole Daten mit Paginierung
            cursor.execute(f"SELECT * FROM {table_name} LIMIT ? OFFSET ?", (per_page, offset))
            rows = cursor.fetchall()
            
            return jsonify({
                'success': True,
                'table_name': table_name,
                'columns': columns,
                'rows': rows,
                'pagination': {
                    'page': page,
                    'per_page': per_page,
                    'total_rows': total_rows,
                    'total_pages': (total_rows + per_page - 1) // per_page
                }
            })
        
    except Exception as e:
        logger.error(f"Fehler beim Abrufen der Tabellendaten: {e}")
        return jsonify({'success': False, 'message': f'Serverfehler: {str(e)}'})

@app.route('/api/admin/database/backup', methods=['POST'])
@require_auth
@require_role(['admin'])
def backup_database():
    """API-Endpunkt zum Erstellen eines Datenbank-Backups"""
    try:
        if not data_manager:
            return jsonify({'success': False, 'message': 'DataManager nicht verfügbar'})
        
        import shutil
        from datetime import datetime
        
        # Backup-Dateiname mit Zeitstempel
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_filename = f'hochzeit_backup_{timestamp}.db'
        backup_path = os.path.join(data_manager.data_directory, backup_filename)
        
        # Kopiere Datenbank
        shutil.copy2(data_manager.db_path, backup_path)
        
        return jsonify({
            'success': True,
            'message': f'Backup erfolgreich erstellt: {backup_filename}',
            'backup_file': backup_filename,
            'backup_path': backup_path
        })
        
    except Exception as e:
        logger.error(f"Fehler beim Erstellen des Datenbank-Backups: {e}")
        return jsonify({'success': False, 'message': f'Backup-Fehler: {str(e)}'})

@app.route('/api/admin/database/info', methods=['GET'])
@require_auth
@require_role(['admin'])
def get_database_info():
    """API-Endpunkt für allgemeine Datenbank-Informationen"""
    try:
        if not data_manager:
            return jsonify({'success': False, 'message': 'DataManager nicht verfügbar'})
        
        import sqlite3
        import os
        
        db_info = {
            'database_path': data_manager.db_path,
            'database_size': 0,
            'sqlite_version': '',
            'tables_count': 0,
            'total_rows': 0
        }
        
        # Dateigröße
        if os.path.exists(data_manager.db_path):
            db_info['database_size'] = os.path.getsize(data_manager.db_path)
        
        with sqlite3.connect(data_manager.db_path) as conn:
            cursor = conn.cursor()
            
            # SQLite Version
            cursor.execute("SELECT sqlite_version()")
            db_info['sqlite_version'] = cursor.fetchone()[0]
            
            # Anzahl Tabellen
            cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
            db_info['tables_count'] = cursor.fetchone()[0]
            
            # Gesamtanzahl Zeilen in allen Tabellen
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = cursor.fetchall()
            
            total_rows = 0
            for (table_name,) in tables:
                cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                total_rows += cursor.fetchone()[0]
            
            db_info['total_rows'] = total_rows
        
        return jsonify({
            'success': True,
            'database_info': db_info
        })
        
    except Exception as e:
        logger.error(f"Fehler beim Abrufen der Datenbank-Informationen: {e}")
        return jsonify({'success': False, 'message': f'Serverfehler: {str(e)}'})

@app.route('/api/admin/test-invitation-generation', methods=['POST'])
@require_auth
@require_role(['admin'])
def test_invitation_generation():
    """API-Endpunkt zum Testen der personalisierten Einladungsgenerierung (nur für Admins)"""
    try:
        if not data_manager:
            return jsonify({'success': False, 'message': 'DataManager nicht verfügbar'})
        
        # Test-Daten aus dem Request lesen
        test_data = request.get_json()
        
        if not test_data:
            return jsonify({'success': False, 'message': 'Keine Test-Daten erhalten'})
        
        # Benötigte Parameter extrahieren
        anzahl_personen = test_data.get('anzahl_personen', 1)
        weisser_saal = test_data.get('weisser_saal', 0)
        anzahl_essen = test_data.get('anzahl_essen', 0)
        anzahl_party = test_data.get('anzahl_party', 0)
        guest_name = test_data.get('name', 'Max Mustermann')  # Der Parameter heißt 'name' im Frontend
        
        # Hochzeitsdatum aus Settings laden
        settings = data_manager.load_settings()
        hochzeitsdatum = settings.get('hochzeitsdatum') or settings.get('hochzeit', {}).get('datum', '25.07.2026')
        formatted_date = format_wedding_date_for_message(hochzeitsdatum)
        
        # Personalisierte Nachricht generieren
        message = generate_personalized_welcome_message(
            anzahl_personen, weisser_saal, anzahl_essen, anzahl_party, formatted_date, guest_name
        )
        
        return jsonify({
            'success': True,
            'message': message,
            'test_data': test_data,
            'wedding_date': formatted_date
        })
        
    except Exception as e:
        logger.error(f"Fehler beim Testen der Einladungsgenerierung: {e}")
        return jsonify({'success': False, 'message': 'Serverfehler: ' + str(e)})

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
                # Korrigierte Struktur für Frontend-Kompatibilität
                event_dict = {
                    'id': event.get('id'),
                    'titel': event.get('titel', ''),  # Frontend erwartet 'titel'
                    'beschreibung': event.get('beschreibung', ''),  # Frontend erwartet 'beschreibung'
                    'uhrzeit': event.get('uhrzeit', ''),  # Frontend erwartet 'uhrzeit' (lowercase)
                    'ort': event.get('ort', ''),
                    'dauer': event.get('dauer', ''),  # Frontend erwartet 'dauer'
                    'eventteile': event.get('eventteile', []),
                    'public': not bool(event.get('nur_brautpaar', 0)),
                    # Legacy-Kompatibilität für andere Teile des Systems
                    'Programmpunkt': event.get('titel', ''),
                    'Verantwortlich': event.get('beschreibung', ''),
                    'Status': event.get('kategorie', ''),
                    'Uhrzeit': event.get('uhrzeit', ''),
                    'start_zeit': event.get('start_zeit'),
                    'ende_zeit': event.get('ende_zeit')
                }
                filtered_events.append(event_dict)
        
        # Nach Startzeit sortieren
        filtered_events.sort(key=lambda x: x.get('uhrzeit', ''))
        
        # Hochzeitsdatum laden für Frontend
        settings = data_manager.load_settings() if data_manager else {}
        wedding_date = settings.get('hochzeitsdatum', '')
        
        return jsonify({
            'success': True,
            'events': filtered_events,
            'wedding_date': wedding_date
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
@require_auth
@require_role(['admin', 'user'])
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

@app.route('/api/gaeste/login-url/<int:guest_id>', methods=['GET'])
@require_auth
@require_role(['admin'])
def api_gaeste_get_login_url(guest_id):
    """Generiert eine Login-URL mit URL-Parametern für einen Gast"""
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        # Gast-Daten laden
        guest_data = data_manager.get_guest_by_id(guest_id)
        if not guest_data:
            return jsonify({'error': 'Gast nicht gefunden'}), 404
        
        guest_code = guest_data.get('guest_code')
        guest_password = guest_data.get('guest_password')
        
        if not guest_code or not guest_password:
            return jsonify({'error': 'Gast hat noch keine Anmeldedaten (guest_code oder password fehlt)'}), 400
        
        # Basis-URL der Anwendung ermitteln
        base_url = request.url_root.rstrip('/')
        
        # Login-URL mit Parametern erstellen
        from urllib.parse import urlencode
        params = {
            'guest_code': guest_code,
            'password': guest_password
        }
        query_string = urlencode(params)
        login_url = f"{base_url}/login?{query_string}"
        
        return jsonify({
            'success': True,
            'login_url': login_url,
            'guest_code': guest_code,
            'guest_name': f"{guest_data.get('vorname', '')} {guest_data.get('nachname', '')}".strip()
        })
        
    except Exception as e:
        logger.error(f"Fehler beim Generieren der Login-URL: {e}")
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
            'first_login_image', 'first_login_image_data', 'first_login_text', 
            'invitation_texts', 'gaeste_informationen'
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
        
        # Response mit Cache-Control Headers erstellen
        response_data = {"success": True, "settings": cleaned_settings}
        response = make_response(jsonify(response_data))
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        
        return response
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
        logger.info(f"Speichere Einstellungen: {list(settings_data.keys())}")
        
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
        
        # First Login Modal Einstellungen - immer speichern um Überschreibung zu ermöglichen
        for key in ['first_login_image', 'first_login_image_data', 'first_login_text']:
            if key in settings_data:
                value = settings_data[key]
                # Alle Werte speichern, auch leere, um bestehende Daten zu überschreiben
                success = data_manager.set_setting(key, value if value is not None else '')
                logger.info(f"First-Login-Modal Setting '{key}' saved: {success}")
        
        # Invitation Texts Einstellungen (als JSON speichern) - immer überschreiben
        if 'invitation_texts' in settings_data:
            value = settings_data['invitation_texts']
            success = data_manager.set_setting('invitation_texts', value if value is not None else {})
            logger.info(f"Invitation texts saved: {success}")
        
        # Gäste-Informationen Einstellungen (als JSON speichern) - immer überschreiben
        if 'gaeste_informationen' in settings_data:
            value = settings_data['gaeste_informationen']
            success = data_manager.set_setting('gaeste_informationen', value if value is not None else {})
            logger.info(f"Gäste-Informationen saved: {success}")
        
        # Upload-Einstellungen speichern
        upload_settings = {}
        upload_keys = ['upload_enabled', 'upload_path', 'upload_max_size_mb', 'upload_allowed_extensions']
        
        for key in upload_keys:
            if key in settings_data:
                upload_settings[key] = settings_data[key]
        
        if upload_settings:
            success = data_manager.save_upload_settings(upload_settings)
        
        # E-Mail Adressen für Aufgaben-Benachrichtigungen speichern
        email_keys = ['braut_email', 'braeutigam_email']
        for key in email_keys:
            if key in settings_data:
                value = settings_data[key] if settings_data[key] is not None else ''
                success = data_manager.set_setting(key, value)
                logger.info(f"E-Mail Setting '{key}' saved: {success}")
            logger.info(f"Upload-Einstellungen saved: {success}")
        
        # Grunddaten speichern (Hochzeitsdatum, Brautpaar-Namen)
        if 'hochzeitsdatum' in settings_data:
            success = data_manager.set_setting('hochzeitsdatum', settings_data['hochzeitsdatum'])
            logger.info(f"Hochzeitsdatum saved: {success}")
        
        if 'braut_name' in settings_data:
            success = data_manager.set_setting('braut_name', settings_data['braut_name'])
            logger.info(f"Braut Name saved: {success}")
        
        if 'braeutigam_name' in settings_data:
            success = data_manager.set_setting('braeutigam_name', settings_data['braeutigam_name'])
            logger.info(f"Bräutigam Name saved: {success}")
        
        if 'hochzeitsort' in settings_data:
            success = data_manager.set_setting('hochzeitsort', settings_data['hochzeitsort'])
            logger.info(f"Hochzeitsort saved: {success}")
        
        # Alle anderen direkten Settings (aber nicht die bereits behandelten)
        for key, value in settings_data.items():
            if key not in ['bride_name', 'groom_name', 'hochzeitsdatum', 'hochzeitsort', 'braut_name', 'braeutigam_name', 'locations', 'first_login_image', 'first_login_image_data', 'first_login_text', 'invitation_texts', 'gaeste_informationen']:
                # Auch leere Werte speichern um Überschreibung zu ermöglichen
                success = data_manager.set_setting(key, value if value is not None else '')
                logger.debug(f"Direct setting '{key}' saved: {success}")
        
        logger.info("Alle Einstellungen erfolgreich gespeichert")
        return jsonify({'success': True, 'message': 'Einstellungen gespeichert'})
            
    except Exception as e:
        logger.error(f"Fehler beim Speichern der Einstellungen: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/geocode', methods=['GET'])
@require_auth
@require_role(['admin', 'user', 'guest'])
def api_geocode():
    """Proxy für Nominatim OpenStreetMap Geocoding API um CORS-Probleme zu umgehen"""
    try:
        query = request.args.get('q', '').strip()
        if not query:
            return jsonify({'error': 'Keine Suchanfrage angegeben'}), 400
        
        # Bekannte Aachen-Adressen für bessere Performance und Fallback
        aachen_coordinates = {
            'rathaus, markt 39, 52062 aachen': {'lat': 50.7753, 'lng': 6.0839, 'display_name': 'Rathaus Aachen, Markt 39, 52062 Aachen'},
            'rathaus, markt 39, 52066 aachen': {'lat': 50.7753, 'lng': 6.0839, 'display_name': 'Rathaus Aachen, Markt 39, 52062 Aachen'},  # Alternative PLZ
            'markt 39, 52062 aachen': {'lat': 50.7753, 'lng': 6.0839, 'display_name': 'Markt 39, 52062 Aachen'},
            'markt 39, 52066 aachen': {'lat': 50.7753, 'lng': 6.0839, 'display_name': 'Markt 39, 52062 Aachen'},  # Alternative PLZ
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
            # E-Mail-Benachrichtigung senden, wenn eine Aufgabe zugewiesen wurde
            send_task_assignment_notification(aufgabe_data, aufgabe_id, is_new=True)
            
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
        
        # Hole die alte Aufgabe um Änderungen zu erkennen
        alte_aufgaben = data_manager.get_aufgaben()
        alte_aufgabe = next((a for a in alte_aufgaben if a.get('id') == aufgabe_id), None)
        
        # Aufgabe aktualisieren
        success = data_manager.update_aufgabe(aufgabe_id, aufgabe_data)
        
        if success:
            # E-Mail-Benachrichtigung senden, wenn sich die Zuweisung geändert hat
            if alte_aufgabe and alte_aufgabe.get('zustaendig') != aufgabe_data.get('zustaendig'):
                send_task_assignment_notification(aufgabe_data, aufgabe_id, is_new=False)
            
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
# HILFSFUNKTIONEN FÜR AUFGABEN-BENACHRICHTIGUNGEN
# =============================================================================

def send_task_assignment_notification(aufgabe_data, aufgabe_id, is_new=True):
    """
    Sendet eine E-Mail-Benachrichtigung bei Aufgabenzuweisung
    
    Args:
        aufgabe_data (dict): Die Aufgabendaten
        aufgabe_id (int): Die ID der Aufgabe
        is_new (bool): True für neue Aufgabe, False für Änderung der Zuweisung
    """
    try:
        # Prüfe ob E-Mail-Manager verfügbar und aktiviert ist
        if not EMAIL_AVAILABLE or not email_manager or not email_manager.is_enabled():
            logger.info("E-Mail-Benachrichtigung übersprungen: E-Mail-Manager nicht verfügbar oder deaktiviert")
            return
        
        # Lade Einstellungen für E-Mail-Adressen
        settings = data_manager.get_settings() if data_manager else {}
        
        zustaendig = aufgabe_data.get('zustaendig', '').lower()
        email_address = None
        empfaenger_name = aufgabe_data.get('zustaendig', 'Unbekannt')
        
        # Bestimme E-Mail-Adresse basierend auf Zuständigkeit
        if 'braut' in zustaendig:
            email_address = settings.get('braut_email', '')
            empfaenger_name = settings.get('braut_name', 'Braut')
        elif 'bräutigam' in zustaendig or 'braeutigam' in zustaendig:
            email_address = settings.get('braeutigam_email', '')
            empfaenger_name = settings.get('braeutigam_name', 'Bräutigam')
        
        # Prüfe ob E-Mail-Adresse vorhanden ist
        if not email_address or not email_address.strip():
            logger.info(f"E-Mail-Benachrichtigung übersprungen: Keine E-Mail-Adresse für {empfaenger_name} hinterlegt")
            return
        
        # Erstelle direkten Link zum Hochzeitsplaner
        hochzeitsplaner_url = "https://pascalundkäthe-heiraten.de:8443/aufgabenplaner"
        
        # E-Mail-Betreff
        if is_new:
            betreff = f"Neue Aufgabe zugeteilt: {aufgabe_data.get('titel', 'Unbenannte Aufgabe')}"
        else:
            betreff = f"Aufgabe zugeteilt: {aufgabe_data.get('titel', 'Unbenannte Aufgabe')}"
        
        # E-Mail-Text erstellen
        prioritaet = aufgabe_data.get('prioritaet', 'Mittel')
        faelligkeitsdatum = aufgabe_data.get('faelligkeitsdatum', '')
        beschreibung = aufgabe_data.get('beschreibung', '').strip()
        kategorie = aufgabe_data.get('kategorie', '').strip()
        
        # Formatiere Fälligkeitsdatum
        faelligkeits_text = ""
        if faelligkeitsdatum:
            try:
                from datetime import datetime
                datum = datetime.strptime(faelligkeitsdatum, '%Y-%m-%d')
                faelligkeits_text = f"\n📅 Fälligkeitsdatum: {datum.strftime('%d.%m.%Y')}"
            except:
                faelligkeits_text = f"\n📅 Fälligkeitsdatum: {faelligkeitsdatum}"
        
        email_text = f"""Hallo {empfaenger_name},

eine Aufgabe wurde dir zugeteilt:

📋 Aufgabe: {aufgabe_data.get('titel', 'Unbenannte Aufgabe')}
⚡ Priorität: {prioritaet}{faelligkeits_text}"""

        if kategorie:
            email_text += f"\n🏷️ Kategorie: {kategorie}"
        
        if beschreibung:
            email_text += f"\n\n📝 Beschreibung:\n{beschreibung}"
        
        email_text += f"""

🔗 Direkt zum Hochzeitsplaner:
{hochzeitsplaner_url}

Viel Erfolg bei der Umsetzung! 💪"""
        
        # HTML-Version für bessere Darstellung
        html_text = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #d63384;">Neue Aufgabe zugeteilt</h2>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #495057;">📋 {aufgabe_data.get('titel', 'Unbenannte Aufgabe')}</h3>
                <p><strong>⚡ Priorität:</strong> {prioritaet}</p>
                {f'<p><strong>📅 Fälligkeitsdatum:</strong> {faelligkeitsdatum}</p>' if faelligkeitsdatum else ''}
                {f'<p><strong>🏷️ Kategorie:</strong> {kategorie}</p>' if kategorie else ''}
                {f'<div style="margin-top: 15px;"><strong>📝 Beschreibung:</strong><br>{beschreibung.replace(chr(10), "<br>")}</div>' if beschreibung else ''}
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{hochzeitsplaner_url}" 
                   style="background: #d63384; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                   🔗 Zum Hochzeitsplaner
                </a>
            </div>
            
            <p style="color: #6c757d; font-size: 14px; margin-top: 30px;">
                Viel Erfolg bei der Umsetzung! 💪
            </p>
        </div>
        """
        
        # Verwende send_task_email für bessere Integration
        result = email_manager.send_task_email(
            task_id=aufgabe_id,
            task_title=aufgabe_data.get('titel', 'Unbenannte Aufgabe'),
            to_emails=[email_address],
            subject=betreff,
            body=email_text,
            html_body=html_text
        )
        
        if result.get('success'):
            logger.info(f"E-Mail-Benachrichtigung erfolgreich gesendet an {empfaenger_name} ({email_address}) für Aufgabe: {aufgabe_data.get('titel')}")
        else:
            logger.warning(f"E-Mail-Benachrichtigung fehlgeschlagen an {empfaenger_name} ({email_address}): {result.get('message', 'Unbekannter Fehler')}")
            
    except Exception as e:
        logger.error(f"Fehler beim Senden der Aufgaben-E-Mail-Benachrichtigung: {str(e)}")

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
            # Zusätzlich in SQLite-Tabelle für E-Mail-Zuordnung speichern (verwendet DataManager)
            try:
                with data_manager._get_connection() as conn:
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
        
        # Zuordnung aus der Datenbank entfernen (verwendet DataManager)
        with data_manager._get_connection() as conn:
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

# ============================
# Upload API Routen
# ============================

@app.route('/api/upload-config')
def get_upload_config():
    """Liefert die Upload-Konfiguration für Gäste"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        # Lade Upload-Einstellungen
        settings = data_manager.get_upload_settings()
        
        return jsonify({
            'max_size_mb': settings.get('upload_max_size_mb', 50),
            'allowed_extensions': settings.get('upload_allowed_extensions', 'jpg,jpeg,png,gif,mp4,mov,avi'),
            'upload_enabled': settings.get('upload_enabled', True)
        })
    except Exception as e:
        logger.error(f"Fehler beim Laden der Upload-Konfiguration: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/guest-upload', methods=['POST'])
def guest_upload():
    """Verarbeitet Upload von Gast-Dateien"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        # Prüfe Gast-Session
        if 'guest_id' not in session:
            return jsonify({'error': 'Nicht autorisiert'}), 401
        
        gast_id = session['guest_id']
        
        # Prüfe ob Upload aktiviert ist
        settings = data_manager.get_upload_settings()
        if not settings.get('upload_enabled', True):
            return jsonify({'error': 'Uploads sind derzeit deaktiviert'}), 403
        
        # Prüfe ob Datei vorhanden
        if 'file' not in request.files:
            return jsonify({'error': 'Keine Datei ausgewählt'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'Keine Datei ausgewählt'}), 400
        
        # Validiere Datei
        validation = validate_upload_file(file, settings)
        if not validation['valid']:
            return jsonify({'error': validation['error']}), 400
        
        # Upload verarbeiten
        upload_result = process_upload(file, gast_id, request.form.get('description', ''))
        
        if upload_result['success']:
            return jsonify({
                'message': 'Upload erfolgreich',
                'upload_id': upload_result['upload_id']
            })
        else:
            return jsonify({'error': upload_result['error']}), 500
            
    except Exception as e:
        logger.error(f"Fehler beim Gast-Upload: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/my-uploads')
def get_my_uploads():
    """Liefert alle Uploads des aktuellen Gastes"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        # Prüfe Gast-Session
        if 'guest_id' not in session:
            return jsonify({'error': 'Nicht autorisiert'}), 401
        
        gast_id = session['guest_id']
        uploads = data_manager.get_guest_uploads(gast_id)
        
        return jsonify(uploads)
        
    except Exception as e:
        logger.error(f"Fehler beim Laden der Gast-Uploads: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/download-upload/<int:upload_id>')
def download_upload(upload_id):
    """Ermöglicht Download eines Uploads"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        # Prüfe Berechtigung
        upload = data_manager.get_upload_by_id(upload_id)
        if not upload:
            return jsonify({'error': 'Upload nicht gefunden'}), 404
        
        # Gäste können nur ihre eigenen Uploads herunterladen
        if 'guest_id' in session and upload['gast_id'] != session['guest_id']:
            return jsonify({'error': 'Nicht autorisiert'}), 403
        
        # Admin kann alle Downloads
        elif 'admin' not in session and 'guest_id' not in session:
            return jsonify({'error': 'Nicht autorisiert'}), 401
        
        # Datei senden
        upload_path = get_upload_path()
        file_path = os.path.join(upload_path, upload['filename'])
        
        if not os.path.exists(file_path):
            return jsonify({'error': 'Datei nicht gefunden'}), 404
        
        return send_file(
            file_path,
            as_attachment=True,
            download_name=upload['original_filename']
        )
        
    except Exception as e:
        logger.error(f"Fehler beim Download: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/delete-upload/<int:upload_id>', methods=['DELETE'])
def delete_upload(upload_id):
    """Löscht einen Upload"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        # Prüfe Berechtigung
        upload = data_manager.get_upload_by_id(upload_id)
        if not upload:
            return jsonify({'error': 'Upload nicht gefunden'}), 404
        
        # Gäste können nur ihre eigenen Uploads löschen
        if 'guest_id' in session and upload['gast_id'] != session['guest_id']:
            return jsonify({'error': 'Nicht autorisiert'}), 403
        
        # Admin kann alle löschen
        elif 'admin' not in session and 'guest_id' not in session:
            return jsonify({'error': 'Nicht autorisiert'}), 401
        
        # Upload löschen
        success = data_manager.delete_upload(upload_id)
        
        if success:
            # Datei auch vom Dateisystem löschen
            upload_path = get_upload_path()
            file_path = os.path.join(upload_path, upload['filename'])
            
            if os.path.exists(file_path):
                os.remove(file_path)
            
            return jsonify({'message': 'Upload erfolgreich gelöscht'})
        else:
            return jsonify({'error': 'Fehler beim Löschen'}), 500
            
    except Exception as e:
        logger.error(f"Fehler beim Löschen: {e}")
        return jsonify({'error': str(e)}), 500

# ============================
# Admin Upload API Routen
# ============================

@app.route('/api/admin/upload-statistics')
@require_auth
@require_role(['admin'])
def admin_upload_statistics():
    """Liefert Upload-Statistiken für Admin"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        stats = data_manager.get_upload_statistics()
        return jsonify(stats)
        
    except Exception as e:
        logger.error(f"Fehler beim Laden der Upload-Statistiken: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/all-uploads')
@require_auth
@require_role(['admin'])
def admin_all_uploads():
    """Liefert alle Uploads für Admin"""
    try:
        logger.info("🔍 admin_all_uploads API aufgerufen")
        
        if not data_manager:
            logger.error("❌ DataManager nicht verfügbar")
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        logger.info("📡 Lade alle Uploads...")
        uploads = data_manager.get_all_uploads()
        logger.info(f"✅ {len(uploads)} Uploads geladen")
        
        # Debug-Info in die Logs
        for i, upload in enumerate(uploads):
            logger.info(f"  Upload {i+1}: {upload['original_filename']} ({upload['file_type']})")
        
        return jsonify(uploads)
        
    except Exception as e:
        logger.error(f"❌ Fehler beim Laden aller Uploads: {e}")
        import traceback
        logger.error(f"❌ Traceback: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/guests-with-uploads')
@require_auth
@require_role(['admin'])
def admin_guests_with_uploads():
    """Liefert Gäste mit Upload-Anzahl für Filter"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        guests = data_manager.get_guests_with_uploads()
        return jsonify(guests)
        
    except Exception as e:
        logger.error(f"Fehler beim Laden der Gäste: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/upload-details/<int:upload_id>')
@require_auth
@require_role(['admin'])
def admin_upload_details(upload_id):
    """Liefert Details eines Uploads für Admin"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        upload = data_manager.get_upload_details(upload_id)
        if not upload:
            return jsonify({'error': 'Upload nicht gefunden'}), 404
        
        return jsonify(upload)
        
    except Exception as e:
        logger.error(f"Fehler beim Laden der Upload-Details: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/download-upload/<int:upload_id>')
@require_auth
@require_role(['admin'])
def admin_download_upload(upload_id):
    """Admin-Download eines Uploads"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        upload = data_manager.get_upload_by_id(upload_id)
        if not upload:
            return jsonify({'error': 'Upload nicht gefunden'}), 404
        
        # Datei senden
        upload_path = get_upload_path()
        file_path = os.path.join(upload_path, upload['filename'])
        
        if not os.path.exists(file_path):
            return jsonify({'error': 'Datei nicht gefunden'}), 404
        
        return send_file(
            file_path,
            as_attachment=True,
            download_name=upload['original_filename']
        )
        
    except Exception as e:
        logger.error(f"Fehler beim Admin-Download: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/delete-upload/<int:upload_id>', methods=['DELETE'])
@require_auth
@require_role(['admin'])
def admin_delete_upload(upload_id):
    """Admin-Löschung eines Uploads"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        upload = data_manager.get_upload_by_id(upload_id)
        if not upload:
            return jsonify({'error': 'Upload nicht gefunden'}), 404
        
        # Upload löschen
        success = data_manager.delete_upload(upload_id)
        
        if success:
            # Datei auch vom Dateisystem löschen
            upload_path = get_upload_path()
            file_path = os.path.join(upload_path, upload['filename'])
            
            if os.path.exists(file_path):
                os.remove(file_path)
            
            return jsonify({'message': 'Upload erfolgreich gelöscht'})
        else:
            return jsonify({'error': 'Fehler beim Löschen'}), 500
            
    except Exception as e:
        logger.error(f"Fehler beim Admin-Löschen: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/bulk-delete-uploads', methods=['DELETE'])
@require_auth
@require_role(['admin'])
def admin_bulk_delete_uploads():
    """Bulk-Löschung von Uploads"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        upload_ids = request.json.get('upload_ids', [])
        if not upload_ids:
            return jsonify({'error': 'Keine Upload-IDs angegeben'}), 400
        
        deleted_count = 0
        upload_path = get_upload_path()
        
        for upload_id in upload_ids:
            upload = data_manager.get_upload_by_id(upload_id)
            if upload:
                success = data_manager.delete_upload(upload_id)
                if success:
                    # Datei auch vom Dateisystem löschen
                    file_path = os.path.join(upload_path, upload['filename'])
                    if os.path.exists(file_path):
                        os.remove(file_path)
                    deleted_count += 1
        
        return jsonify({
            'message': f'{deleted_count} Upload(s) erfolgreich gelöscht',
            'deleted_count': deleted_count
        })
        
    except Exception as e:
        logger.error(f"Fehler bei Bulk-Löschung: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/bulk-download-uploads')
@require_auth
@require_role(['admin'])
def admin_bulk_download_uploads():
    """Bulk-Download von Uploads als ZIP"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        upload_ids = request.args.get('ids', '').split(',')
        if not upload_ids or not upload_ids[0]:
            return jsonify({'error': 'Keine Upload-IDs angegeben'}), 400
        
        # Temporäre ZIP-Datei erstellen
        temp_dir = tempfile.mkdtemp()
        zip_path = os.path.join(temp_dir, 'uploads.zip')
        upload_path = get_upload_path()
        
        with zipfile.ZipFile(zip_path, 'w') as zip_file:
            for upload_id in upload_ids:
                try:
                    upload = data_manager.get_upload_by_id(int(upload_id))
                    if upload:
                        file_path = os.path.join(upload_path, upload['filename'])
                        if os.path.exists(file_path):
                            # Füge Datei mit originalem Namen hinzu
                            zip_file.write(file_path, upload['original_filename'])
                except (ValueError, Exception) as e:
                    logger.warning(f"Fehler bei Upload {upload_id}: {e}")
                    continue
        
        # ZIP-Datei senden
        return send_file(
            zip_path,
            as_attachment=True,
            download_name=f'uploads_{datetime.now().strftime("%Y%m%d_%H%M%S")}.zip'
        )
        
    except Exception as e:
        logger.error(f"Fehler beim Bulk-Download: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/browse-directories', methods=['POST'])
@require_auth
@require_role(['admin'])
def browse_directories():
    """API-Endpunkt zum Durchsuchen von Verzeichnissen für Upload-Pfad Auswahl"""
    try:
        data = request.get_json()
        current_path = data.get('path', os.path.expanduser('~'))  # Standard: Home-Verzeichnis
        
        # Sicherheitscheck: Nur erlaubte Pfade
        if not os.path.exists(current_path):
            current_path = os.path.expanduser('~')
        
        # Verzeichnisinhalt abrufen
        directories = []
        files = []
        
        try:
            # Übergeordnetes Verzeichnis hinzufügen (außer bei Root)
            parent_path = os.path.dirname(current_path)
            if parent_path != current_path:  # Nicht bei Root-Verzeichnis
                directories.append({
                    'name': '..',
                    'path': parent_path,
                    'type': 'parent'
                })
            
            # Verzeichnisinhalt durchgehen
            for item in sorted(os.listdir(current_path)):
                item_path = os.path.join(current_path, item)
                
                # Versteckte Dateien/Ordner überspringen
                if item.startswith('.') and item != '..':
                    continue
                
                if os.path.isdir(item_path):
                    directories.append({
                        'name': item,
                        'path': item_path,
                        'type': 'directory'
                    })
                else:
                    # Nur bestimmte Dateitypen anzeigen (optional)
                    files.append({
                        'name': item,
                        'path': item_path,
                        'type': 'file'
                    })
        
        except PermissionError:
            return jsonify({
                'success': False,
                'error': 'Keine Berechtigung für dieses Verzeichnis'
            })
        except Exception as e:
            return jsonify({
                'success': False,
                'error': f'Fehler beim Lesen des Verzeichnisses: {str(e)}'
            })
        
        return jsonify({
            'success': True,
            'current_path': current_path,
            'directories': directories,
            'files': files[:20]  # Begrenzen auf 20 Dateien für Performance
        })
        
    except Exception as e:
        logger.error(f"Fehler beim Durchsuchen der Verzeichnisse: {e}")
        return jsonify({'success': False, 'error': str(e)})

# ============================
# Photo Gallery API Routen
# ============================

@app.route('/api/admin/admin-upload', methods=['POST'])
@require_auth
@require_role(['admin'])
def admin_upload():
    """Admin-Upload von Dateien - werden automatisch genehmigt"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        # Prüfe ob Datei vorhanden
        if 'file' not in request.files:
            return jsonify({'error': 'Keine Datei ausgewählt'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'Keine Datei ausgewählt'}), 400
        
        # Upload-Einstellungen abrufen für Validierung
        settings = data_manager.get_upload_settings()
        
        # Validiere Datei
        validation = validate_upload_file(file, settings)
        if not validation['valid']:
            return jsonify({'error': validation['error']}), 400
        
        # Für Admin-Uploads: Verwende Admin-Info statt Gast-Info
        admin_user = session.get('username', 'Administrator')
        description = request.form.get('description', f'Hochgeladen von {admin_user}')
        
        # Admin-Upload verarbeiten (ohne Gast-ID)
        upload_result = process_admin_upload(file, admin_user, description)
        
        if upload_result['success']:
            return jsonify({
                'message': 'Admin-Upload erfolgreich - automatisch genehmigt',
                'upload_id': upload_result['upload_id']
            })
        else:
            return jsonify({'error': upload_result['error']}), 500
            
    except Exception as e:
        logger.error(f"Fehler beim Admin-Upload: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/approve-upload/<int:upload_id>', methods=['POST'])
@require_auth
@require_role(['admin'])
def approve_upload(upload_id):
    """Genehmigt einen Upload für die Foto-Galerie"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        success = data_manager.approve_upload(upload_id)
        
        if success:
            return jsonify({'message': 'Upload erfolgreich genehmigt'})
        else:
            return jsonify({'error': 'Upload nicht gefunden oder bereits genehmigt'}), 404
            
    except Exception as e:
        logger.error(f"Fehler beim Genehmigen des Uploads: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/reject-upload/<int:upload_id>', methods=['POST'])
@require_auth
@require_role(['admin'])
def reject_upload(upload_id):
    """Lehnt einen Upload für die Foto-Galerie ab"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        success = data_manager.reject_upload(upload_id)
        
        if success:
            return jsonify({'message': 'Upload abgelehnt'})
        else:
            return jsonify({'error': 'Upload nicht gefunden'}), 404
            
    except Exception as e:
        logger.error(f"Fehler beim Ablehnen des Uploads: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/pending-uploads')
@require_auth
@require_role(['admin'])
def get_pending_uploads():
    """Liefert alle noch nicht genehmigten Uploads"""
    try:
        if not data_manager:
            logger.error("❌ DataManager nicht verfügbar")
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        logger.info("🔍 Lade ausstehende Uploads...")
        uploads = data_manager.get_pending_uploads()
        logger.info(f"✅ {len(uploads)} ausstehende Uploads gefunden")
        
        # Debug-Info
        for upload in uploads:
            logger.info(f"  - Upload ID {upload['id']}: {upload['original_filename']} (Genehmigt: {upload['admin_approved']})")
        
        return jsonify(uploads)
        
    except Exception as e:
        logger.error(f"❌ Fehler beim Laden der ausstehenden Uploads: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/approved-gallery')
@require_auth
@require_role(['admin', 'user', 'guest'])
def get_approved_gallery():
    """Liefert alle genehmigten Uploads für die Foto-Galerie (für eingeloggte Benutzer)"""
    try:
        logger.info("🎯 Photo Gallery API: get_approved_gallery called")
        logger.info(f"🔐 Photo Gallery API: User: {session.get('username', 'unknown')}")
        logger.info(f"🔐 Photo Gallery API: Role: {session.get('user_role', 'unknown')}")
        
        if not data_manager:
            logger.error("❌ Photo Gallery API: Datenbank nicht verfügbar")
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        logger.info("📡 Photo Gallery API: Fetching approved uploads from database...")
        uploads = data_manager.get_approved_uploads()
        
        logger.info(f"📦 Photo Gallery API: Found {len(uploads)} approved uploads")
        
        if uploads:
            logger.info(f"📦 Photo Gallery API: Sample upload: {uploads[0]}")
        else:
            logger.warning("📭 Photo Gallery API: No approved uploads found")
        
        logger.info("✅ Photo Gallery API: Returning uploads successfully")
        return jsonify(uploads)
        
    except Exception as e:
        logger.error(f"❌ Photo Gallery API: Fehler beim Laden der Foto-Galerie: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/gallery-image/<int:upload_id>')
@require_auth
@require_role(['admin', 'user', 'guest'])
def serve_gallery_image(upload_id):
    """Stellt genehmigte Bilder für die Galerie bereit (für eingeloggte Benutzer)"""
    try:
        logger.info(f"🖼️ Photo Gallery API: serve_gallery_image called for upload_id: {upload_id}")
        
        if not data_manager:
            logger.error("❌ Photo Gallery API: Datenbank nicht verfügbar")
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        # Prüfe ob Upload genehmigt ist
        logger.info(f"🔍 Photo Gallery API: Checking upload {upload_id} approval status...")
        upload = data_manager.get_upload_by_id(upload_id)
        
        if not upload:
            logger.warning(f"📭 Photo Gallery API: Upload {upload_id} not found")
            return jsonify({'error': 'Upload nicht gefunden'}), 404
        
        logger.info(f"📋 Photo Gallery API: Upload {upload_id} details: {upload}")
        
        if upload.get('admin_approved') != 1:
            logger.warning(f"🚫 Photo Gallery API: Upload {upload_id} not approved (status: {upload.get('admin_approved')})")
            return jsonify({'error': 'Upload nicht genehmigt'}), 403
        
        # Datei bereitstellen
        upload_path = get_upload_path()
        file_path = os.path.join(upload_path, upload['filename'])
        
        logger.info(f"📁 Photo Gallery API: Looking for file at: {file_path}")
        
        if not os.path.exists(file_path):
            logger.error(f"❌ Photo Gallery API: File not found at: {file_path}")
            return jsonify({'error': 'Datei nicht gefunden'}), 404
        
        logger.info(f"✅ Photo Gallery API: Serving file: {file_path} with mime_type: {upload['mime_type']}")
        return send_file(file_path, mimetype=upload['mime_type'])
        
    except Exception as e:
        logger.error(f"❌ Photo Gallery API: Fehler beim Bereitstellen des Galerie-Bildes: {e}")
        return jsonify({'error': str(e)}), 500

def create_video_thumbnail(upload_id, filename):
    """Erstellt ein generisches Thumbnail für Videos"""
    try:
        if not PIL_AVAILABLE:
            # Fallback: Einfache JSON-Antwort
            return jsonify({'error': 'Video-Thumbnail nicht verfügbar'}), 404
        
        from PIL import Image, ImageDraw, ImageFont
        import io
        
        # Cache-Verzeichnis für Video-Thumbnails
        upload_path = get_upload_path()
        thumbnails_dir = os.path.join(upload_path, 'video_thumbnails')
        if not os.path.exists(thumbnails_dir):
            os.makedirs(thumbnails_dir)
        
        # Video-Thumbnail-Dateiname
        video_thumb_filename = f"video_thumb_{upload_id}.jpg"
        video_thumb_path = os.path.join(thumbnails_dir, video_thumb_filename)
        
        # Prüfe ob Video-Thumbnail bereits existiert
        if os.path.exists(video_thumb_path):
            logger.info(f"✅ Video Thumbnail: Using cached video thumbnail: {video_thumb_path}")
            return send_file(video_thumb_path, mimetype='image/jpeg')
        
        logger.info(f"🎬 Video Thumbnail: Creating generic video thumbnail for: {filename}")
        
        # Erstelle ein 300x300 Video-Thumbnail mit Play-Symbol
        img = Image.new('RGB', (300, 300), color='#2c3e50')
        draw = ImageDraw.Draw(img)
        
        # Gradient-Hintergrund simulieren
        for y in range(300):
            color_val = int(44 + (y / 300) * 40)  # Von #2c3e50 zu hellerer Farbe
            draw.line([(0, y), (300, y)], fill=(color_val, color_val + 20, color_val + 30))
        
        # Play-Symbol zeichnen (großer Kreis mit Dreieck)
        center_x, center_y = 150, 150
        circle_radius = 60
        
        # Kreis für Play-Button
        draw.ellipse([center_x - circle_radius, center_y - circle_radius, 
                     center_x + circle_radius, center_y + circle_radius], 
                    fill='#ffffff', outline='#ecf0f1', width=3)
        
        # Play-Dreieck
        triangle_size = 25
        triangle_points = [
            (center_x - triangle_size//2, center_y - triangle_size),
            (center_x - triangle_size//2, center_y + triangle_size),
            (center_x + triangle_size, center_y)
        ]
        draw.polygon(triangle_points, fill='#3498db')
        
        # Video-Icon in der Ecke
        icon_size = 24
        draw.rectangle([10, 10, 10 + icon_size, 10 + icon_size], fill='#e74c3c')
        draw.polygon([(15, 18), (15, 26), (25, 22)], fill='#ffffff')
        
        # "VIDEO" Text
        try:
            # Versuche eine bessere Schrift zu verwenden
            font = ImageFont.truetype("arial.ttf", 16)
        except:
            # Fallback auf Standard-Schrift
            font = ImageFont.load_default()
        
        text = "VIDEO"
        text_bbox = draw.textbbox((0, 0), text, font=font)
        text_width = text_bbox[2] - text_bbox[0]
        text_height = text_bbox[3] - text_bbox[1]
        text_x = (300 - text_width) // 2
        text_y = 240
        
        # Text-Schatten
        draw.text((text_x + 1, text_y + 1), text, fill='#000000', font=font)
        # Haupttext
        draw.text((text_x, text_y), text, fill='#ffffff', font=font)
        
        # Speichere Video-Thumbnail
        img.save(video_thumb_path, 'JPEG', quality=85, optimize=True)
        
        logger.info(f"✅ Video Thumbnail: Created and cached: {video_thumb_path}")
        return send_file(video_thumb_path, mimetype='image/jpeg')
        
    except Exception as e:
        logger.error(f"❌ Video Thumbnail: Error creating video thumbnail: {e}")
        # Fallback: JSON-Fehler
        return jsonify({'error': 'Video-Thumbnail Erstellung fehlgeschlagen'}), 500

@app.route('/api/gallery-thumbnail/<int:upload_id>')
@require_auth
@require_role(['admin', 'user', 'guest'])
def serve_gallery_thumbnail(upload_id):
    """Stellt Thumbnails für die Galerie bereit (optimiert für Performance)"""
    try:
        logger.info(f"🖼️ Thumbnail API: serve_gallery_thumbnail called for upload_id: {upload_id}")
        
        if not data_manager:
            logger.error("❌ Thumbnail API: Datenbank nicht verfügbar")
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        # Prüfe ob Upload genehmigt ist
        upload = data_manager.get_upload_by_id(upload_id)
        
        if not upload:
            logger.warning(f"📭 Thumbnail API: Upload {upload_id} not found")
            return jsonify({'error': 'Upload nicht gefunden'}), 404
        
        if upload.get('admin_approved') != 1:
            logger.warning(f"🚫 Thumbnail API: Upload {upload_id} not approved")
            return jsonify({'error': 'Upload nicht genehmigt'}), 403
        
        # Thumbnail erstellen und bereitstellen
        upload_path = get_upload_path()
        file_path = os.path.join(upload_path, upload['filename'])
        
        if not os.path.exists(file_path):
            logger.error(f"❌ Thumbnail API: File not found at: {file_path}")
            return jsonify({'error': 'Datei nicht gefunden'}), 404
        
        # Prüfe ob es ein Bild ist (nur für Bilder Thumbnails erstellen)
        if not upload['mime_type'].startswith('image/'):
            # Für Videos: Erstelle ein generisches Video-Thumbnail
            return create_video_thumbnail(upload_id, upload['filename'])
        
        # Thumbnail erstellen
        if not PIL_AVAILABLE:
            logger.warning("⚠️ Thumbnail API: PIL not available, serving original image")
            return send_file(file_path, mimetype=upload['mime_type'])
        
        try:
            import io
            
            # Cache-Verzeichnis für Thumbnails
            thumbnails_dir = os.path.join(upload_path, 'thumbnails')
            if not os.path.exists(thumbnails_dir):
                os.makedirs(thumbnails_dir)
            
            # Thumbnail-Dateiname
            thumb_filename = f"thumb_{upload_id}_{upload['filename']}"
            thumb_path = os.path.join(thumbnails_dir, thumb_filename)
            
            # Prüfe ob Thumbnail bereits existiert
            if os.path.exists(thumb_path):
                logger.info(f"✅ Thumbnail API: Using cached thumbnail: {thumb_path}")
                return send_file(thumb_path, mimetype='image/jpeg')
            
            # Thumbnail erstellen
            logger.info(f"🔄 Thumbnail API: Creating thumbnail for: {file_path}")
            
            with Image.open(file_path) as img:
                # EXIF-Orientierung korrigieren
                try:
                    # Einfachere EXIF-Handhabung
                    if hasattr(img, '_getexif') and img._getexif() is not None:
                        exif = img._getexif()
                        orientation = exif.get(0x0112, 1)  # 0x0112 ist EXIF Orientation Tag
                        if orientation == 3:
                            img = img.rotate(180, expand=True)
                        elif orientation == 6:
                            img = img.rotate(270, expand=True)
                        elif orientation == 8:
                            img = img.rotate(90, expand=True)
                except (AttributeError, KeyError, TypeError):
                    pass  # Ignoriere EXIF-Fehler
                
                # Konvertiere zu RGB falls nötig
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')
                
                # Thumbnail erstellen (300x300 max, behält Seitenverhältnis bei)
                img.thumbnail((300, 300), Image.Resampling.LANCZOS)
                
                # Speichere Thumbnail
                img.save(thumb_path, 'JPEG', quality=85, optimize=True)
                
                logger.info(f"✅ Thumbnail API: Thumbnail created and cached: {thumb_path}")
                return send_file(thumb_path, mimetype='image/jpeg')
                
        except Exception as thumb_error:
            logger.error(f"❌ Thumbnail API: Error creating thumbnail: {thumb_error}")
            # Fallback: Original-Datei bereitstellen
            return send_file(file_path, mimetype=upload['mime_type'])
        
    except Exception as e:
        logger.error(f"❌ Thumbnail API: Fehler beim Bereitstellen des Thumbnails: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/preview-upload/<int:upload_id>')
@require_auth
@require_role(['admin'])
def admin_preview_upload(upload_id):
    """Ermöglicht Admins die Vorschau von Uploads (auch pending)"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        # Upload laden (ohne Genehmigungsprüfung für Admins)
        upload = data_manager.get_upload_by_id(upload_id)
        if not upload:
            return jsonify({'error': 'Upload nicht gefunden'}), 404
        
        # Datei bereitstellen
        upload_path = get_upload_path()
        file_path = os.path.join(upload_path, upload['filename'])
        
        if not os.path.exists(file_path):
            return jsonify({'error': 'Datei nicht gefunden'}), 404
        
        return send_file(file_path, mimetype=upload['mime_type'])
        
    except Exception as e:
        logger.error(f"Fehler beim Admin-Preview: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/create-directory', methods=['POST'])
@require_auth
@require_role(['admin'])
def create_directory():
    """API-Endpunkt zum Erstellen eines neuen Verzeichnisses"""
    try:
        data = request.get_json()
        parent_path = data.get('parent_path', '')
        directory_name = data.get('directory_name', '').strip()
        
        if not parent_path or not directory_name:
            return jsonify({'success': False, 'error': 'Pfad und Verzeichnisname erforderlich'})
        
        # Sicherheitscheck: Ungültige Zeichen entfernen
        invalid_chars = '<>:"|?*'
        for char in invalid_chars:
            directory_name = directory_name.replace(char, '')
        
        new_path = os.path.join(parent_path, directory_name)
        
        if os.path.exists(new_path):
            return jsonify({'success': False, 'error': 'Verzeichnis existiert bereits'})
        
        os.makedirs(new_path)
        
        return jsonify({
            'success': True,
            'message': f'Verzeichnis "{directory_name}" erfolgreich erstellt',
            'new_path': new_path
        })
        
    except Exception as e:
        logger.error(f"Fehler beim Erstellen des Verzeichnisses: {e}")
        return jsonify({'success': False, 'error': str(e)})

# ============================
# Upload Helper Functions
# ============================

def validate_upload_file(file, settings):
    """Validiert eine Upload-Datei"""
    try:
        # Prüfe Dateigröße
        max_size = settings.get('upload_max_size_mb', 50) * 1024 * 1024
        
        # Dateigröße ermitteln
        file.seek(0, 2)  # Zum Ende der Datei
        file_size = file.tell()
        file.seek(0)  # Zurück zum Anfang
        
        if file_size > max_size:
            return {
                'valid': False,
                'error': f'Datei zu groß ({file_size / 1024 / 1024:.1f} MB). Maximum: {max_size / 1024 / 1024} MB'
            }
        
        # Prüfe Dateierweiterung
        allowed_extensions = settings.get('upload_allowed_extensions', 'jpg,jpeg,png,gif,mp4,mov,avi')
        allowed_exts = [ext.strip().lower() for ext in allowed_extensions.split(',')]
        
        filename = file.filename.lower()
        file_ext = filename.split('.')[-1] if '.' in filename else ''
        
        if file_ext not in allowed_exts:
            return {
                'valid': False,
                'error': f'Dateierweiterung "{file_ext}" nicht erlaubt. Erlaubt: {", ".join(allowed_exts)}'
            }
        
        return {'valid': True}
        
    except Exception as e:
        return {'valid': False, 'error': f'Validierungsfehler: {str(e)}'}

def process_upload(file, gast_id, description):
    """Verarbeitet den Upload einer Datei"""
    try:
        # Upload-Verzeichnis erstellen
        upload_path = get_upload_path()
        os.makedirs(upload_path, exist_ok=True)
        
        # Eindeutigen Dateinamen generieren
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'bin'
        filename = f'upload_{gast_id}_{timestamp}_{int(time.time())}.{file_ext}'
        
        file_path = os.path.join(upload_path, filename)
        
        # Datei speichern
        file.save(file_path)
        
        # Dateigröße ermitteln
        file_size = os.path.getsize(file_path)
        
        # In Datenbank speichern
        upload_id = data_manager.add_upload(
            gast_id=gast_id,
            original_filename=file.filename,
            filename=filename,
            file_path=file_path,
            file_size=file_size,
            mime_type=file.content_type or 'application/octet-stream',
            beschreibung=description
        )
        
        if upload_id:
            return {'success': True, 'upload_id': upload_id}
        else:
            # Datei löschen wenn DB-Eintrag fehlschlägt
            if os.path.exists(file_path):
                os.remove(file_path)
            return {'success': False, 'error': 'Fehler beim Speichern in der Datenbank'}
        
    except Exception as e:
        logger.error(f"Fehler beim Upload-Processing: {e}")
        return {'success': False, 'error': str(e)}

def process_admin_upload(file, admin_user, description):
    """Verarbeitet den Admin-Upload einer Datei - wird automatisch genehmigt"""
    try:
        # Upload-Verzeichnis erstellen
        upload_path = get_upload_path()
        os.makedirs(upload_path, exist_ok=True)
        
        # Eindeutigen Dateinamen generieren (mit admin prefix)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'bin'
        filename = f'admin_upload_{timestamp}_{int(time.time())}.{file_ext}'
        
        file_path = os.path.join(upload_path, filename)
        
        # Datei speichern
        file.save(file_path)
        
        # Dateigröße ermitteln
        file_size = os.path.getsize(file_path)
        
        # In Datenbank speichern - Admin-Upload ohne Gast-ID aber automatisch genehmigt
        upload_id = data_manager.add_admin_upload(
            admin_user=admin_user,
            original_filename=file.filename,
            filename=filename,
            file_path=file_path,
            file_size=file_size,
            mime_type=file.content_type or 'application/octet-stream',
            beschreibung=description
        )
        
        if upload_id:
            return {'success': True, 'upload_id': upload_id}
        else:
            # Datei löschen wenn DB-Eintrag fehlschlägt
            if os.path.exists(file_path):
                os.remove(file_path)
            return {'success': False, 'error': 'Fehler beim Speichern in der Datenbank'}
        
    except Exception as e:
        logger.error(f"Fehler beim Admin-Upload-Processing: {e}")
        return {'success': False, 'error': str(e)}

def get_upload_path():
    """Ermittelt das Upload-Verzeichnis"""
    settings = data_manager.get_upload_settings() if data_manager else {}
    upload_path = settings.get('upload_path', '')
    
    if not upload_path:
        # Standard: uploads-Verzeichnis im Data-Verzeichnis
        upload_path = os.path.join(DATA_DIR, 'uploads')
    
    return upload_path

# ============================
# Upload Template Route
# ============================

@app.route('/gaeste-uploads')
@require_auth
@require_role(['admin'])
def gaeste_uploads():
    """Admin-Seite für Gäste-Upload-Verwaltung"""
    return render_template('gaeste_uploads.html')

@app.route('/photo-gallery')
@require_auth
@require_role(['admin', 'user', 'guest'])
def photo_gallery():
    """Foto-Galerie mit genehmigten Uploads (für alle eingeloggte Benutzer)"""
    try:
        logger.info("🎯 Photo Gallery Route: /photo-gallery aufgerufen")
        logger.info(f"🔐 Photo Gallery Route: Session user: {session.get('username', 'unknown')}")
        logger.info(f"🔐 Photo Gallery Route: Session role: {session.get('user_role', 'unknown')}")
        logger.info(f"🔐 Photo Gallery Route: Session guest_id: {session.get('guest_id', 'unknown')}")
        
        # Lade zusätzliche Template-Variablen falls verfügbar
        context = {}
        if data_manager:
            try:
                config = data_manager.load_config()
                context['brautpaar_namen'] = config.get('brautpaar_namen', 'Brautpaar')
            except Exception as e:
                logger.warning(f"⚠️ Photo Gallery Route: Konnte Konfiguration nicht laden: {e}")
                context['brautpaar_namen'] = 'Brautpaar'
        
        logger.info("✅ Photo Gallery Route: Rendering template photo_gallery.html")
        return render_template('photo_gallery.html', **context)
        
    except Exception as e:
        logger.error(f"❌ Photo Gallery Route: Fehler beim Laden der Photo Gallery: {e}")
        return render_template('error.html', error=str(e)), 500

# Test-Route für Debug
@app.route('/photo-gallery-test')
def photo_gallery_test():
    """Test-Route ohne Authentifizierung"""
    logger.info("🧪 Photo Gallery Test Route: /photo-gallery-test aufgerufen")
    
    # Überprüfe ob JS-Datei existiert
    js_path = os.path.join('static', 'js', 'photo_gallery.js')
    js_full_path = os.path.join(os.path.dirname(__file__), js_path)
    js_exists = os.path.exists(js_full_path)
    
    logger.info(f"🔍 JS File Check: {js_full_path} exists: {js_exists}")
    
    return f"""
    <h1>Photo Gallery Test Route funktioniert!</h1>
    <p>JS File exists: {js_exists}</p>
    <p>JS File path: {js_full_path}</p>
    <script>
        console.log('Test route loaded');
        console.log('Testing fetch to API...');
        fetch('/api/approved-gallery')
            .then(response => {{
                console.log('API Response:', response.status);
                return response.json();
            }})
            .then(data => {{
                console.log('API Data:', data);
            }})
            .catch(error => {{
                console.error('API Error:', error);
            }});
    </script>
    """

@app.route('/admin/upload-approval')
@require_auth
@require_role(['admin'])
def upload_approval():
    """Admin-Seite für Upload-Genehmigungen"""
    return render_template('upload_approval.html')

# =============================================================================
# TISCHPLANUNG API ROUTEN
# =============================================================================

@app.route('/tischplanung')
@require_auth
@require_role(['admin'])
def tischplanung():
    """Tischplanung Seite - nur für Admins"""
    try:
        # Lade Einstellungen für Braut/Bräutigam-Namen
        config = data_manager.load_config()
        
        # Die Namen sind direkt in der config verfügbar, nicht in einem 'settings' sub-dict
        bride_name = config.get('braut_name', 'Braut')
        groom_name = config.get('braeutigam_name', 'Bräutigam')
        
        context = {
            'bride_name': bride_name,
            'groom_name': groom_name,
            'braut_name': bride_name,
            'braeutigam_name': groom_name
        }
        
        return render_template('tischplanung.html', **context)
    except Exception as e:
        logger.error(f"Fehler beim Laden der Tischplanung-Seite: {str(e)}")
        # Fallback mit Standardwerten
        return render_template('tischplanung.html', bride_name='Braut', groom_name='Bräutigam', braut_name='Braut', braeutigam_name='Bräutigam')

@app.route('/api/tischplanung/tables', methods=['GET'])
@require_auth
@require_role(['admin'])
def api_tischplanung_tables():
    """Lädt alle Tische"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        # Lade alle Tische
        tische = data_manager.get_tische()
        
        # Konvertiere zu erwarteter Struktur
        tables_json = []
        for tisch in tische:
            table_data = {
                'id': tisch.get('id'),
                'name': tisch.get('name', f"Tisch {tisch.get('id')}"),
                'capacity': tisch.get('max_personen', 8),
                'x': tisch.get('x_position', 100),
                'y': tisch.get('y_position', 100),
                'width': 120,
                'height': 120,
                'shape': 'round',
                'farbe': tisch.get('farbe', '#007bff')
            }
            tables_json.append(table_data)
        
        return jsonify(tables_json)
        
    except Exception as e:
        logger.error(f"Fehler beim Laden der Tische: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tischplanung/tables', methods=['POST'])
@require_auth
@require_role(['admin'])
def api_tischplanung_add_table():
    """Fügt einen neuen Tisch hinzu"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        data = request.get_json()
        if not data or not data.get('name'):
            return jsonify({'error': 'Tischname ist erforderlich'}), 400
        
        # Tisch-Daten vorbereiten
        table_data = {
            'name': data.get('name'),
            'max_personen': data.get('capacity', 8),
            'x_position': data.get('x', 100),
            'y_position': data.get('y', 100),
            'farbe': data.get('farbe', '#007bff'),
            'form': data.get('shape', 'round')
        }
        
        tisch_id = data_manager.add_tisch(table_data)
        
        if tisch_id:
            # Neuen Tisch in erwarteter Struktur zurückgeben
            new_table = {
                'id': tisch_id,
                'name': table_data['name'],
                'capacity': table_data['max_personen'],
                'x': table_data['x_position'],
                'y': table_data['y_position'],
                'width': 120,
                'height': 120,
                'shape': table_data['form'],
                'farbe': table_data['farbe']
            }
            return jsonify(new_table)
        else:
            return jsonify({'error': 'Fehler beim Hinzufügen des Tisches'}), 500
            
    except Exception as e:
        logger.error(f"Fehler beim Hinzufügen des Tisches: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tischplanung/tables/<int:table_id>', methods=['PUT'])
@require_auth
@require_role(['admin'])
def api_tischplanung_update_table(table_id):
    """Aktualisiert einen Tisch"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Keine Daten empfangen'}), 400
        
        # Tisch-Daten für Datenbank konvertieren
        update_data = {}
        if 'name' in data:
            update_data['name'] = data['name']
        if 'capacity' in data:
            update_data['max_personen'] = data['capacity']
        if 'x' in data:
            update_data['x_position'] = data['x']
        if 'y' in data:
            update_data['y_position'] = data['y']
        if 'farbe' in data:
            update_data['farbe'] = data['farbe']
        if 'shape' in data:
            update_data['form'] = data['shape']
        
        success = data_manager.update_tisch(table_id, update_data)
        
        if success:
            return jsonify({'message': 'Tisch erfolgreich aktualisiert'})
        else:
            return jsonify({'error': 'Tisch nicht gefunden'}), 404
            
    except Exception as e:
        logger.error(f"Fehler beim Aktualisieren des Tisches: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tischplanung/tables/<int:table_id>', methods=['DELETE'])
@require_auth
@require_role(['admin'])
def api_tischplanung_delete_table(table_id):
    """Löscht einen Tisch"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        success = data_manager.delete_tisch(table_id)
        
        if success:
            return jsonify({'message': 'Tisch erfolgreich gelöscht'})
        else:
            return jsonify({'error': 'Tisch nicht gefunden'}), 404
            
    except Exception as e:
        logger.error(f"Fehler beim Löschen des Tisches: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tischplanung/relationships', methods=['GET'])
@require_auth
@require_role(['admin'])
def api_tischplanung_relationships():
    """Lädt alle Beziehungen zwischen Gästen"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        guest_id = request.args.get('guest_id', type=int)
        beziehungen = data_manager.get_gast_beziehungen(guest_id)
        return jsonify(beziehungen)
        
    except Exception as e:
        logger.error(f"Fehler beim Laden der Beziehungen: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tischplanung/relationships', methods=['POST'])
@require_auth
@require_role(['admin'])
def api_tischplanung_add_relationship():
    """Fügt eine neue Beziehung zwischen Gästen hinzu"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Keine Daten empfangen'}), 400
        
        required_fields = ['gast_id_1', 'gast_id_2', 'beziehungstyp', 'staerke']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Feld {field} ist erforderlich'}), 400
        
        beziehung_id = data_manager.add_gast_beziehung(
            data['gast_id_1'],
            data['gast_id_2'],
            data['beziehungstyp'],
            data['staerke'],
            data.get('notizen', '')
        )
        
        if beziehung_id:
            return jsonify({'success': True, 'id': beziehung_id})
        else:
            return jsonify({'error': 'Fehler beim Speichern der Beziehung'}), 500
            
    except Exception as e:
        logger.error(f"Fehler beim Hinzufügen der Beziehung: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tischplanung/relationships/<int:relationship_id>', methods=['PUT'])
@require_auth
@require_role(['admin'])
def api_tischplanung_update_relationship(relationship_id):
    """Aktualisiert eine bestehende Beziehung"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Keine Daten empfangen'}), 400
        
        # Erst die alte Beziehung löschen
        success = data_manager.delete_gast_beziehung(relationship_id)
        if not success:
            return jsonify({'error': 'Beziehung nicht gefunden'}), 404
        
        # Dann neue Beziehung mit den aktualisierten Daten erstellen
        beziehung_id = data_manager.add_gast_beziehung(
            data['gast_id_1'],
            data['gast_id_2'],
            data['beziehungstyp'],
            data['staerke'],
            data.get('notizen', '')
        )
        
        if beziehung_id:
            return jsonify({'success': True, 'id': beziehung_id})
        else:
            return jsonify({'error': 'Fehler beim Aktualisieren der Beziehung'}), 500
            
    except Exception as e:
        logger.error(f"Fehler beim Aktualisieren der Beziehung: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tischplanung/relationships/<int:relationship_id>', methods=['DELETE'])
@require_auth
@require_role(['admin'])
def api_tischplanung_delete_relationship(relationship_id):
    """Löscht eine Beziehung"""
    try:
        if not data_manager:
            return jsonify({'success': False, 'error': 'Datenbank nicht verfügbar'}), 500
        
        success = data_manager.delete_gast_beziehung(relationship_id)
        
        if success:
            return jsonify({'success': True, 'message': 'Beziehung erfolgreich gelöscht'})
        else:
            return jsonify({'success': False, 'error': 'Beziehung nicht gefunden'}), 404
            
    except Exception as e:
        logger.error(f"Fehler beim Löschen der Beziehung: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tischplanung/assignments', methods=['GET'])
@require_auth
@require_role(['admin'])
def api_tischplanung_assignments():
    """Lädt alle Tischzuordnungen"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        table_id = request.args.get('table_id', type=int)
        zuordnungen = data_manager.get_tisch_zuordnungen(table_id)
        return jsonify(zuordnungen)
        
    except Exception as e:
        logger.error(f"Fehler beim Laden der Zuordnungen: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tischplanung/overview', methods=['GET'])
@require_auth
@require_role(['admin'])
def api_tischplanung_overview():
    """Lädt die komplette Tischzuordnungs-Übersicht"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        # Lade alle Daten
        zuordnungen = data_manager.get_tisch_zuordnungen()
        tische = data_manager.get_tische()
        gaeste = data_manager.get_gaeste_liste()
        
        if not zuordnungen:
            return jsonify({'table_overview': []})
        
        # Erstelle Übersicht nach Tischen
        table_overview = {}
        
        for zuordnung in zuordnungen:
            tisch_id = zuordnung.get('tisch_id')
            gast_id = zuordnung.get('gast_id')
            
            # Finde Tisch und Gast
            tisch = next((t for t in tische if t.get('id') == tisch_id), None)
            gast = next((g for g in gaeste if g.get('id') == gast_id), None)
            
            if not tisch or not gast:
                continue
                
            table_name = tisch.get('name', f'Tisch {tisch_id}')
            
            if table_name not in table_overview:
                table_overview[table_name] = {
                    'table_id': tisch_id,
                    'table_name': table_name,
                    'guests': [],
                    'total_persons': 0
                }
            
            persons_count = gast.get('anzahl_essen', 1) or 1
            
            table_overview[table_name]['guests'].append({
                'guest_id': gast_id,
                'name': f"{gast.get('vorname', '')} {gast.get('nachname', '')}".strip(),
                'category': gast.get('kategorie', 'Unbekannt'),
                'side': gast.get('seite', ''),
                'persons': persons_count,
                'children': gast.get('kind', 0) or 0
            })
            
            table_overview[table_name]['total_persons'] += persons_count
        
        # Füge Brautpaar hinzu falls Brauttisch existiert
        config = data_manager.load_config()
        braut_name = config.get('braut_name', 'Braut')
        braeutigam_name = config.get('braeutigam_name', 'Bräutigam')
        
        if 'Brauttisch' in table_overview:
            # Füge Brautpaar hinzu (falls nicht bereits vorhanden)
            brauttisch = table_overview['Brauttisch']
            brautpaar_vorhanden = any('Brautpaar' in g.get('category', '') for g in brauttisch['guests'])
            
            if not brautpaar_vorhanden:
                brauttisch['guests'].insert(0, {
                    'guest_id': -1,
                    'name': f"{braut_name} & {braeutigam_name}",
                    'category': 'Brautpaar',
                    'side': 'Beide',
                    'persons': 2,
                    'children': 0
                })
                brauttisch['total_persons'] += 2
        
        # Konvertiere zu sortierter Liste
        table_list = list(table_overview.values())
        def sort_key(table):
            name = table['table_name']
            if name == 'Brauttisch':
                return (0, name)
            elif name.startswith('Tisch '):
                try:
                    num = int(name.split(' ')[1])
                    return (1, num)
                except:
                    return (2, name)
            else:
                return (2, name)
        
        table_list.sort(key=sort_key)
        
        return jsonify({'table_overview': table_list})
        
    except Exception as e:
        logger.error(f"Fehler beim Laden der Tischübersicht: {e}")
        return jsonify({'table_overview': [], 'error': str(e)}), 500

@app.route('/api/tischplanung/assign', methods=['POST'])
@require_auth
@require_role(['admin'])
def api_tischplanung_assign_guest():
    """Weist einen Gast einem Tisch zu"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        data = request.get_json()
        if not data or 'guest_id' not in data or 'table_id' not in data:
            return jsonify({'error': 'Gast-ID und Tisch-ID sind erforderlich'}), 400
        
        guest_id = data['guest_id']
        table_id = data['table_id']
        position = data.get('position')
        
        success, message = data_manager.assign_gast_to_tisch(
            guest_id,
            table_id,
            position,
            zugeordnet_von=session.get('username', 'Admin')
        )
        
        if success:
            return jsonify({'message': message or 'Gast erfolgreich zugewiesen'})
        else:
            return jsonify({'error': message or 'Fehler bei der Zuweisung'}), 400
            
    except Exception as e:
        logger.error(f"Fehler beim Zuweisen des Gastes: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tischplanung/unassign/<int:guest_id>', methods=['DELETE'])
@require_auth
@require_role(['admin'])
def api_tischplanung_unassign_guest(guest_id):
    """Entfernt einen Gast von seinem Tisch"""
    try:
        if not data_manager:
            logger.error("DataManager nicht verfügbar")
            return jsonify({'success': False, 'error': 'Datenbank nicht verfügbar'}), 500
        
        logger.info(f"Versuche Gast {guest_id} von Tisch zu entfernen")
        success = data_manager.unassign_gast_from_tisch(guest_id)
        
        if success:
            logger.info(f"Gast {guest_id} erfolgreich von Tisch entfernt")
            return jsonify({'success': True, 'message': 'Gast erfolgreich vom Tisch entfernt'})
        else:
            logger.warning(f"Gast {guest_id} war keinem Tisch zugeordnet")
            return jsonify({'success': False, 'error': 'Gast war keinem Tisch zugeordnet'}), 404
            
    except Exception as e:
        logger.error(f"Exception beim Entfernen des Gastes {guest_id}: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': f'Serverfehler: {str(e)}'}), 500

# Test-Endpoint für Debugging
@app.route('/api/tischplanung/test-unassign/<int:guest_id>', methods=['DELETE'])
@require_auth
@require_role(['admin'])
def api_tischplanung_test_unassign_guest(guest_id):
    """Test-Endpoint für Debugging"""
    return jsonify({'success': True, 'message': f'Test erfolgreich für Gast {guest_id}', 'guest_id': guest_id})

# Debug-Route für Session-Analyse (ohne Auth für Testing)
@app.route('/api/debug/session', methods=['GET'])
def debug_session():
    """Debug-Route um Session-Inhalte zu sehen"""
    session_data = {
        'session_keys': list(session.keys()) if session else [],
        'logged_in': session.get('logged_in', False),
        'username': session.get('username', 'None'),
        'user_role': session.get('user_role', 'None'),
        'session_id': request.cookies.get('session', 'No session cookie'),
        'all_cookies': dict(request.cookies)
    }
    return jsonify(session_data)

@app.route('/api/tischplanung/clear-all', methods=['POST'])
@require_auth
@require_role(['admin'])
def api_tischplanung_clear_all():
    """Entfernt alle Tischzuordnungen"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        deleted_count = data_manager.clear_all_tisch_zuordnungen()
        return jsonify({
            'message': f'{deleted_count} Zuordnungen entfernt',
            'deleted_count': deleted_count
        })
        
    except Exception as e:
        logger.error(f"Fehler beim Entfernen aller Zuordnungen: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tischplanung/clear-all-tables', methods=['DELETE'])
@require_auth
@require_role(['admin'])
def api_tischplanung_clear_all_tables():
    """Löscht alle Tische (inkl. aller Zuordnungen)"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        # Erst alle Zuordnungen entfernen
        assignments_deleted = data_manager.clear_all_tisch_zuordnungen()
        
        # Dann alle Tische löschen
        tische = data_manager.get_tische()
        tables_deleted = 0
        
        for tisch in tische:
            if data_manager.delete_tisch(tisch['id']):
                tables_deleted += 1
        
        logger.info(f"✅ Alle Tische gelöscht: {tables_deleted} Tische, {assignments_deleted} Zuordnungen")
        
        return jsonify({
            'success': True,
            'message': f'{tables_deleted} Tische und {assignments_deleted} Zuordnungen gelöscht',
            'tables_deleted': tables_deleted,
            'assignments_deleted': assignments_deleted
        })
        
    except Exception as e:
        logger.error(f"Fehler beim Löschen aller Tische: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tischplanung/auto-assign', methods=['POST'])
@require_auth
@require_role(['admin'])
def api_tischplanung_auto_assign():
    """Automatische Tischzuweisung basierend auf Beziehungen und Kategorien"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        # Parameter aus Request lesen
        request_data = request.get_json() or {}
        only_confirmed = request_data.get('only_confirmed', False)
        
        # Einfache automatische Zuweisung
        # Lade alle Gäste und Tische
        gaeste = data_manager.get_gaeste_list()
        tische = data_manager.get_tische()
        beziehungen = data_manager.get_gast_beziehungen()
        
        # Erst alle Zuordnungen löschen
        data_manager.clear_all_tisch_zuordnungen()
        
        assigned_count = 0
        assignments = []
        created_tables = []
        
        # Gäste nach Filterkriterien auswählen
        if only_confirmed:
            # Nur Gäste mit Zusage und anzahl_essen > 0 berücksichtigen
            active_gaeste = [g for g in gaeste if g.get('status', '').lower() in ['zugesagt', 'ja'] and (g.get('anzahl_essen', 0) > 0 or g.get('Anzahl_Essen', 0) > 0)]
        else:
            # Alle Gäste mit anzahl_essen > 0 berücksichtigen (unabhängig vom Status)
            active_gaeste = [g for g in gaeste if (g.get('anzahl_essen', 0) > 0 or g.get('Anzahl_Essen', 0) > 0)]
        
        if not active_gaeste:
            return jsonify({
                'success': False,
                'message': 'Keine Gäste für Tischplanung gefunden (keine Gäste mit anzahl_essen > 0)',
                'assigned_count': 0,
                'total_guests': 0,
                'assignments': [],
                'created_tables': []
            })
        
        # Lade Tischplanung-Konfiguration für Standard-Tischgröße
        config = data_manager.get_tischplanung_config()
        standard_tisch_groesse = config.get('standard_tisch_groesse', 8)
        
        # Berechne benötigte Tischkapazität (anzahl_essen!)
        total_persons = sum(gast.get('anzahl_essen', 0) for gast in active_gaeste)
        current_capacity = sum(tisch['max_personen'] for tisch in tische) if tische else 0
        
        logger.info(f"🧮 Kapazitäts-Berechnung: {total_persons} Personen (anzahl_essen) benötigt, {current_capacity} verfügbar")
        logger.info(f"🤝 {len(beziehungen)} Beziehungen geladen für intelligente Zuordnung")
        
        # Erstelle neue Tische wenn nötig
        if current_capacity < total_persons:
            tables_needed = ((total_persons - current_capacity) // standard_tisch_groesse) + 1
            logger.info(f"🆕 Erstelle {tables_needed} neue Tische (Größe: {standard_tisch_groesse})")
            
            for i in range(tables_needed):
                # Prüfe ob bereits ein Brauttisch existiert
                existing_brauttisch = any(t.get('name') == 'Brauttisch' for t in tische)
                
                # Erste Tisch ist "Brauttisch" (falls nicht vorhanden), danach "Tisch 1", "Tisch 2", etc.
                if not existing_brauttisch and i == 0:
                    table_name = 'Brauttisch'
                else:
                    # Berechne nächste Tischnummer
                    existing_numbers = []
                    for t in tische:
                        if t.get('name', '').startswith('Tisch '):
                            try:
                                num = int(t['name'].split(' ')[1])
                                existing_numbers.append(num)
                            except:
                                pass
                    
                    # Wenn schon ein Brauttisch da ist, starte bei 1, sonst bei der nächsten freien Nummer
                    start_num = 1 if existing_brauttisch else (max(existing_numbers) + 1 if existing_numbers else 1)
                    table_number = start_num + (i - (0 if existing_brauttisch else 1))
                    table_name = f'Tisch {table_number}'
                    
                new_table_data = {
                    'name': table_name,
                    'max_personen': standard_tisch_groesse,
                    'x_position': 200 + (i % 4) * 220,  # 4 Tische pro Reihe, kollisionssicherer Abstand
                    'y_position': 200 + (i // 4) * 220,  # Mehr Platz zwischen den Reihen
                    'farbe': '#007bff',
                    'form': 'round'
                }
                
                new_table_id = data_manager.add_tisch(new_table_data)
                if new_table_id:
                    new_table = {
                        'id': new_table_id,
                        'name': new_table_data['name'],
                        'max_personen': new_table_data['max_personen'],
                        'x_position': new_table_data['x_position'],
                        'y_position': new_table_data['y_position'],
                        'farbe': new_table_data['farbe'],
                        'form': new_table_data['form']
                    }
                    tische.append(new_table)
                    created_tables.append(new_table_data['name'])
                    logger.info(f"✅ Neuer Tisch erstellt: {new_table_data['name']}")
        
        # Sortiere Gäste nach Priorität (Brautpaar zuerst, dann andere)
        # ⚠️ WICHTIG: Brautpaar muss immer zusammen an einem Tisch sitzen!
        # HINWEIS: Das Brautpaar existiert nicht als Gäste, sondern nur als Namen in Einstellungen
        # Daher erstellen wir automatisch einen "Brauttisch" und berücksichtigen die Namen aus den Einstellungen
        
        # Brautpaar-Gäste sind NICHT in der normalen Gästeliste!
        # Wir verwenden andere Kategorien wie "Familie", "Trauzeugen", etc.
        brautpaar_gaeste = []  # Keine echten Brautpaar-Gäste in der DB
        trauzeugen_gaeste = [g for g in active_gaeste if g.get('kategorie') in ['Trauzeugen', 'Trauzeuge', 'Ehrengast']]
        andere_gaeste = [g for g in active_gaeste if g.get('kategorie') not in ['Trauzeugen', 'Trauzeuge', 'Ehrengast']]
        
        # Sortiere andere Gäste nach Priorität
        # 🎯 Intelligente Sortierung mit Trauzeuge-Priorität
        # Priorität 1: Trauzeugen/innen (haben Beziehung zum Brautpaar)
        # Priorität 2: Familie → Freunde → Kollegen → Bekannte
        priority_order = {'Familie': 1, 'Freunde': 2, 'Kollegen': 3, 'Bekannte': 4}
        
        def get_guest_priority(guest):
            # Prüfe ob Trauzeuge/in (hat Beziehung zum Brautpaar mit "Trauzeuge/in")
            is_trauzeuge = False
            guest_relationship_score = 0
            
            # 1. Prüfe Kategorie auf Trauzeugen
            if guest.get('kategorie') in ['Trauzeugen', 'Trauzeuge', 'Ehrengast']:
                is_trauzeuge = True
            
            # 2. Prüfe Beziehungstyp "Trauzeuge/in" zum Brautpaar (ID -1)
            for rel in beziehungen:
                if ((rel.get('gast_id_1') == guest['id'] and rel.get('gast_id_2') == -1) or 
                    (rel.get('gast_id_2') == guest['id'] and rel.get('gast_id_1') == -1)):
                    if rel.get('beziehungstyp') == 'Trauzeuge/in':
                        is_trauzeuge = True
                    # Sammle Beziehungsstärke zum Brautpaar
                    guest_relationship_score = max(guest_relationship_score, rel.get('staerke', 0))
            
            if is_trauzeuge:
                # Trauzeugen: Priorität 0 + Beziehungsstärke (höhere Stärke = niedrigere Zahl = höhere Priorität)
                return 0 - (guest_relationship_score / 10.0)  # 0 bis -1 für Trauzeugen
            
            # Normale Kategorien-Priorität mit Beziehungsstärke
            base_priority = priority_order.get(guest.get('kategorie', 'Bekannte'), 5)
            return base_priority - (guest_relationship_score / 10.0)  # Beziehungsstärke als Subpriority
        
        def calculate_table_compatibility(guest, table_guests):
            """
            Berechnet Kompatibilität zwischen einem Gast und bereits zugewiesenen Tischgästen
            Berücksichtigt positive und negative Beziehungen zwischen allen Gästen
            """
            if not table_guests:
                return 100  # Leerer Tisch = perfekte Kompatibilität
            
            total_compatibility = 0
            relationship_count = 0
            
            for table_guest in table_guests:
                if table_guest['guest_id'] == -1:  # Skip Brautpaar-Eintrag
                    continue
                    
                # Suche Beziehung zwischen Gast und Tischgast
                relationship_strength = 0
                for rel in beziehungen:
                    if ((rel.get('gast_id_1') == guest['id'] and rel.get('gast_id_2') == table_guest['guest_id']) or 
                        (rel.get('gast_id_1') == table_guest['guest_id'] and rel.get('gast_id_2') == guest['id'])):
                        relationship_strength = rel.get('staerke', 0)
                        break
                
                # Beziehungsstärke zur Kompatibilität hinzufügen
                if relationship_strength != 0:
                    relationship_count += 1
                    # Positive Beziehungen (1-5) erhöhen Kompatibilität
                    # Negative Beziehungen (-1 bis -5) senken Kompatibilität drastisch
                    if relationship_strength > 0:
                        total_compatibility += relationship_strength * 20  # Positive Beziehungen: +20 bis +100
                    else:
                        total_compatibility += relationship_strength * 50  # Negative Beziehungen: -50 bis -250
            
            # Durchschnittliche Kompatibilität berechnen
            if relationship_count > 0:
                avg_compatibility = total_compatibility / relationship_count
                # Basis-Kompatibilität von 50 + Beziehungsbonus/malus
                return max(0, min(100, 50 + avg_compatibility))
            else:
                # Keine Beziehungen = neutrale Kompatibilität
                return 75
        
        andere_gaeste_sorted = sorted(andere_gaeste, key=get_guest_priority)
        
        logger.info(f"💒 Intelligente Gäste-Sortierung mit Trauzeugen-Priorität")
        for guest in andere_gaeste_sorted[:8]:  # Log erste 8 Gäste für bessere Übersicht
            priority = get_guest_priority(guest)
            is_trauzeuge = priority < 1  # Alle Prioritäten unter 1 sind Trauzeugen
            kategorie = guest.get('kategorie', 'Unbekannt')
            logger.info(f"   {'👰💒' if is_trauzeuge else '👤'} {guest.get('vorname', '')} {guest.get('nachname', '')} - Kategorie: {kategorie} - Priorität: {priority:.2f}")
        
        # 🔄 KORRIGIERTE FINALE REIHENFOLGE: Kombiniere alle Gäste und sortiere nach Priorität
        # Entferne das manuelle Trennen von trauzeugen_gaeste und andere_gaeste
        all_gaeste = active_gaeste.copy()  # Alle aktiven Gäste
        gaeste_sorted = sorted(all_gaeste, key=get_guest_priority)
        
        # 💑 SPEZIELLE BRAUTTISCH-BEHANDLUNG
        # Da das Brautpaar nicht in der Gästeliste existiert, erstellen wir einen Brauttisch
        # und stellen sicher, dass nahestehende Personen (Trauzeugen, Familie) dort sitzen
        current_table_index = 0
        current_table_capacity = 0
        
        # 1. BRAUTTISCH VORBEREITEN (falls nicht vorhanden)
        existing_brauttisch = None
        for tisch in tische:
            if tisch.get('name') == 'Brauttisch':
                existing_brauttisch = tisch
                break
        
        if not existing_brauttisch:
            # Erstelle Brauttisch
            brauttisch_data = {
                'name': 'Brauttisch',
                'max_personen': standard_tisch_groesse,
                'x_position': 300,  # Zentrale Position - mehr Platz vom Rand
                'y_position': 200,  # Höhere Position für bessere Sichtbarkeit
                'farbe': '#dc3545',  # Besondere Farbe für Brauttisch
                'form': 'round'
            }
            
            brauttisch_id = data_manager.add_tisch(brauttisch_data)
            if brauttisch_id:
                existing_brauttisch = {**brauttisch_data, 'id': brauttisch_id}
                tische.insert(0, existing_brauttisch)  # Brauttisch an erste Stelle
                created_tables.append('Brauttisch')
                logger.info(f"💑 Brauttisch erstellt (Brautpaar aus Einstellungen berücksichtigt)")
        
        # ✅ BRAUTPAAR ZUERST ZUM BRAUTTISCH HINZUFÜGEN
        # Das Brautpaar hat höchste Priorität und muss immer am Brauttisch sitzen
        current_table = existing_brauttisch
        current_table_capacity = 2  # Brauttisch: 2 Plätze für Brautpaar FEST reserviert
        logger.info(f"💑 Brauttisch: 2 Plätze für Brautpaar FEST reserviert, {current_table['max_personen'] - 2} Plätze für andere Gäste verfügbar")
        
        # Füge Brautpaar direkt zu assignments hinzu (virtueller Eintrag für korrekte Kapazitätsberechnung)
        config = data_manager.load_config()
        braut_name = config.get('braut_name', 'Braut')
        braeutigam_name = config.get('braeutigam_name', 'Bräutigam')
        
        assignments.append({
            'guest_id': -1,  # Spezielle ID für Brautpaar (nicht in Gästeliste)
            'guest_name': f"{braut_name} & {braeutigam_name}",
            'guest_category': 'Brautpaar',
            'persons_count': 2,
            'table_id': current_table['id'],
            'table_name': current_table['name'],
            'guest_side': 'Beide'
        })
        logger.info(f"💑 Brautpaar ({braut_name} & {braeutigam_name}) fest zum Brauttisch zugewiesen")
        
        # 2. TRAUZEUGEN/EHRENGÄSTE ZUM BRAUTTISCH ZUWEISEN (nur wenn noch Platz)
        trauzeugen_am_brauttisch = []
        logger.info(f"👥 Prüfe Trauzeugen für Brauttisch...")
        
        for gast in gaeste_sorted:
            # Nur Trauzeugen (Priorität < 1) betrachten
            if get_guest_priority(gast) >= 1:
                break  # Alle folgenden haben niedrigere Priorität
                
            persons_needed = gast.get('anzahl_essen', 0) or 1
            
            # Prüfe ob noch Platz am Brauttisch (nach Brautpaar-Reservierung)
            if current_table_capacity + persons_needed <= current_table['max_personen']:
                success, _ = data_manager.assign_gast_to_tisch(
                    gast['id'],
                    current_table['id'],
                    position=None,
                    zugeordnet_von='Auto-Zuweisung (Brauttisch-Trauzeuge)'
                )
                
                if success:
                    assigned_count += 1
                    assignments.append({
                        'guest_id': gast['id'],
                        'guest_name': f"{gast['vorname']} {gast.get('nachname', '')}",
                        'guest_category': gast.get('kategorie', 'Trauzeuge'),
                        'persons_count': persons_needed,
                        'table_id': current_table['id'],
                        'table_name': current_table['name'],
                        'guest_side': gast.get('seite', 'Unbekannt')
                    })
                    current_table_capacity += persons_needed
                    trauzeugen_am_brauttisch.append(gast)
                    logger.info(f"💑 Trauzeuge {gast['vorname']} zu Brauttisch zugewiesen ({current_table_capacity}/{current_table['max_personen']})")
            else:
                # Brauttisch voll - Trauzeuge zu anderem Tisch (aber immer noch höchste Priorität für andere Tische)
                logger.info(f"⚠️ Brauttisch voll ({current_table_capacity}/{current_table['max_personen']}) - {gast['vorname']} wird an anderen Tisch zugewiesen (behält Trauzeuge-Priorität)")
        
        logger.info(f"💑 Brauttisch final belegt: {current_table_capacity}/{current_table['max_personen']} Personen ({len(trauzeugen_am_brauttisch)} Trauzeugen + Brautpaar)")
        
        # Entferne zugewiesene Trauzeugen aus der Hauptliste
        gaeste_sorted = [g for g in gaeste_sorted if g not in trauzeugen_am_brauttisch]
        # Nächster Tisch für andere Gäste vorbereiten
        if current_table_capacity >= current_table['max_personen'] * 0.8:  # 80% Auslastung
            current_table_index = 1  # Nächster Tisch (Index 1, da Brauttisch Index 0 ist)
            current_table_capacity = 0
        
        # 3. ANDERE GÄSTE ZUWEISEN (nach Priorität und Beziehungskompatibilität sortiert)
        for gast in gaeste_sorted:
            # ⚠️ WICHTIG: Prüfe Beziehungskonflikte BEVOR Zuordnung erfolgt
            persons_needed = gast.get('anzahl_essen', 0) or 1
            
            # Finde den BESTEN kompatiblen Tisch (mit Beziehungskompatibilität)
            best_table = None
            best_compatibility = -1
            best_table_index = -1
            
            for table_index in range(len(tische)):
                current_table = tische[table_index]
                
                # ✅ VERBESSERTE KAPAZITÄTSBERECHNUNG: Nutze assignments-Liste
                current_occupancy = sum(assignment['persons_count'] for assignment in assignments if assignment['table_id'] == current_table['id'])
                
                # Prüfe ob Platz vorhanden
                if current_occupancy + persons_needed > current_table['max_personen']:
                    continue
                
                # BEZIEHUNGSKOMPATIBILITÄT PRÜFEN
                table_guests = [assignment for assignment in assignments if assignment['table_id'] == current_table['id']]
                
                # Prüfe auf negative Beziehungen (TABU!)
                has_negative_relationship = False
                for table_assignment in table_guests:
                    if table_assignment['guest_id'] == -1:  # Skip Brautpaar
                        continue
                        
                    existing_guest_id = table_assignment['guest_id']
                    for rel in beziehungen:
                        if ((rel.get('gast_id_1') == gast['id'] and rel.get('gast_id_2') == existing_guest_id) or 
                            (rel.get('gast_id_1') == existing_guest_id and rel.get('gast_id_2') == gast['id'])):
                            # Negative Beziehungen (< -1) sind TABU!
                            if rel.get('staerke', 0) < -1:
                                has_negative_relationship = True
                                logger.warning(f"❌ KONFLIKT: {gast['vorname']} kann nicht zu Tisch {current_table['name']} - negative Beziehung (Stärke: {rel.get('staerke')}) mit {table_assignment['guest_name']}")
                                break
                    
                    if has_negative_relationship:
                        break
                
                if has_negative_relationship:
                    continue  # Dieser Tisch ist nicht kompatibel
                
                # Berechne Kompatibilität basierend auf positiven Beziehungen
                compatibility = calculate_table_compatibility(gast, table_guests)
                
                # Bester Tisch gefunden?
                if compatibility > best_compatibility:
                    best_compatibility = compatibility
                    best_table = current_table
                    best_table_index = table_index
            
            # Gast zu bestem kompatiblen Tisch zuweisen
            if best_table:
                success, _ = data_manager.assign_gast_to_tisch(
                    gast['id'],
                    best_table['id'],
                    position=None,
                    zugeordnet_von='Auto-Zuweisung (Kompatibilitäts-optimiert)'
                )
                
                if success:
                    assigned_count += 1
                    assignments.append({
                        'guest_id': gast['id'],
                        'guest_name': f"{gast['vorname']} {gast.get('nachname', '')}",
                        'guest_category': gast.get('kategorie', 'Unbekannt'),
                        'persons_count': persons_needed,
                        'table_id': best_table['id'],
                        'table_name': best_table['name'],
                        'guest_side': gast.get('seite', 'Unbekannt')
                    })
                    
                    compatibility_emoji = "💚" if best_compatibility >= 80 else "💛" if best_compatibility >= 60 else "🟡"
                    logger.info(f"{compatibility_emoji} {gast['vorname']} zu {best_table['name']} zugewiesen (Kompatibilität: {best_compatibility:.0f}%)")
                    table_assigned = True
                else:
                    logger.error(f"❌ Fehler beim Zuweisen von {gast['vorname']} zu {best_table['name']}")
            else:
                success, _ = data_manager.assign_gast_to_tisch(
                    gast['id'],
                    current_table['id'],
                    position=None,
                    zugeordnet_von='Auto-Zuweisung (Beziehungs-berücksichtigt)'
                )
                
                if success:
                    assigned_count += 1
                    assignments.append({
                        'guest_id': gast['id'],
                        'guest_name': f"{gast['vorname']} {gast.get('nachname', '')}",
                        'guest_category': gast.get('kategorie', 'Unbekannt'),
                        'persons_count': persons_needed,
                        'table_id': current_table['id'],
                        'table_name': current_table['name'],
                        'guest_side': gast.get('seite', 'Unbekannt')
                    })
                    table_assigned = True
                    new_occupancy = current_occupancy + persons_needed
                    logger.info(f"✅ Gast {gast['vorname']} zu Tisch {current_table['name']} zugewiesen ({new_occupancy}/{current_table['max_personen']} Personen)")
                    break
            
            # Falls kein kompatibler Tisch gefunden - neuen Tisch erstellen
            if not table_assigned:
                logger.warning(f"⚠️ Kein kompatibler Tisch für {gast['vorname']} gefunden - erstelle neuen Tisch")
                # Neuen Tisch erstellen (ähnlich wie oben)
                new_table_name = f'Tisch {len(tische) + 1}'
                new_table_data = {
                    'name': new_table_name,
                    'max_personen': standard_tisch_groesse,
                    'x_position': 100 + (len(tische) % 4) * 150,
                    'y_position': 100 + (len(tische) // 4) * 150,
                    'farbe': '#007bff',
                    'form': 'round'
                }
                
                new_table_id = data_manager.add_tisch(new_table_data)
                if new_table_id:
                    new_table = {**new_table_data, 'id': new_table_id}
                    tische.append(new_table)
                    created_tables.append(new_table_name)
                    
                    # Gast zum neuen Tisch zuweisen
                    success, _ = data_manager.assign_gast_to_tisch(
                        gast['id'],
                        new_table_id,
                        position=None,
                        zugeordnet_von='Auto-Zuweisung (Neuer Tisch wegen Konflikten)'
                    )
                    
                    if success:
                        assigned_count += 1
                        assignments.append({
                            'guest_id': gast['id'],
                            'guest_name': f"{gast['vorname']} {gast.get('nachname', '')}",
                            'guest_category': gast.get('kategorie', 'Unbekannt'),
                            'persons_count': persons_needed,
                            'table_id': new_table_id,
                            'table_name': new_table_name,
                            'guest_side': gast.get('seite', 'Unbekannt')
                        })
                    logger.info(f"✅ Gast {gast['vorname']} zu neuem Tisch {new_table_name} zugewiesen ({persons_needed}/{standard_tisch_groesse} Personen)")
        
        # Erstelle detaillierte Übersicht nach Tischen sortiert
        table_overview = {}
        for assignment in assignments:
            table_name = assignment['table_name']
            if table_name not in table_overview:
                table_overview[table_name] = {
                    'table_id': assignment['table_id'],
                    'table_name': table_name,
                    'guests': [],
                    'total_persons': 0,
                    'total_essen': 0  # Separate Zählung für anzahl_essen
                }
            table_overview[table_name]['guests'].append({
                'name': assignment['guest_name'],
                'category': assignment['guest_category'],
                'persons': assignment['persons_count'],  # Das ist bereits anzahl_essen
                'side': assignment.get('guest_side', 'Unbekannt')  # Seite hinzufügen
            })
            table_overview[table_name]['total_persons'] += assignment['persons_count']
            table_overview[table_name]['total_essen'] += assignment['persons_count']  # Gleich wie persons_count
        
        # ✅ BRAUTPAAR IST BEREITS IN DEN ASSIGNMENTS ENTHALTEN
        # Keine separate Hinzufügung mehr nötig - bessere Kapazitätskontrolle
        logger.info(f"💑 Brautpaar ist bereits korrekt in der Tischübersicht enthalten")
        
        # Prüfe ob Brauttisch in der Übersicht vorhanden ist
        brauttisch_found = 'Brauttisch' in table_overview
        
        # Falls ein Brauttisch existiert, aber noch keine Gäste zugeordnet wurden, erstelle Eintrag
        if not brauttisch_found:
            # Brautpaar-Namen aus Konfiguration lesen
            config = data_manager.load_config()
            braut_name = config.get('braut_name', 'Braut')
            braeutigam_name = config.get('braeutigam_name', 'Bräutigam')
            
            # Prüfe ob ein Brauttisch in der Tischliste existiert (könnte leer sein)
            for tisch in tische:
                if tisch.get('name') == 'Brauttisch':
                    # Brauttisch existiert, aber keine Zuordnungen - erstelle leeren Eintrag mit Brautpaar
                    table_overview['Brauttisch'] = {
                        'table_id': tisch['id'],
                        'table_name': 'Brauttisch',
                        'guests': [{
                            'name': f"{braut_name} & {braeutigam_name}",
                            'category': 'Brautpaar',
                            'persons': 2,
                            'side': 'Beide'
                        }],
                        'total_persons': 2,
                        'total_essen': 2
                    }
                    logger.info(f"💑 Brauttisch ohne Zuordnungen gefunden - Brautpaar ({braut_name} & {braeutigam_name}) hinzugefügt")
                    break
        
        # Konvertiere zu Liste und sortiere: Brauttisch zuerst, dann Tisch 1, 2, 3...
        table_list = list(table_overview.values())
        def sort_table_key(table):
            name = table['table_name']
            if name == 'Brauttisch':
                return 0  # Brauttisch immer zuerst
            elif name.startswith('Tisch '):
                try:
                    return int(name.split(' ')[1])  # Tisch 1, 2, 3...
                except:
                    return 999
            else:
                return 999  # Andere Tische am Ende
        
        table_list.sort(key=sort_table_key)
        
        # Prüfen ob alle Gäste zugewiesen werden konnten
        unassigned_count = len(active_gaeste) - assigned_count
        success = unassigned_count == 0
        
        if unassigned_count > 0:
            message = f'⚠️ {assigned_count} von {len(active_gaeste)} Gästen zugewiesen. {unassigned_count} Gäste konnten nicht zugewiesen werden!'
        else:
            message = f'✅ Alle {assigned_count} Gäste erfolgreich zugewiesen!'
        
        if created_tables:
            message += f' (Neue Tische erstellt: {", ".join(created_tables)})'

        logger.info(f"🎯 Auto-Zuordnung abgeschlossen: {assigned_count} Gäste zugewiesen (anzahl_essen berücksichtigt)")

        # ✅ TISCHGRÖSSENS-OPTIMIERUNG: Anpassung der Tischgrößen basierend auf tatsächlicher Belegung
        optimized_tables_count = 0
        for table in table_list:
            table_id = table['table_id']
            current_occupancy = table['total_persons']
            
            # Hole aktuellen Tisch aus DB für max_personen
            current_table = next((t for t in tische if t['id'] == table_id), None)
            if current_table:
                current_max = current_table['max_personen']
                
                # Optimiere Tischgröße: min. 75% Auslastung oder exakte Belegung
                if current_occupancy > 0:
                    # Mindestgröße: aktuelle Belegung + 1 Platz Puffer
                    optimal_size = max(current_occupancy + 1, 4)  # Mindestens 4 Plätze
                    
                    # Wenn aktueller Tisch viel zu groß ist (< 60% Auslastung), verkleinere
                    if current_occupancy / current_max < 0.6 and optimal_size < current_max:
                        data_manager.update_tisch(table_id, {'max_personen': optimal_size})
                        logger.info(f"📏 Tisch {table['table_name']}: Größe optimiert von {current_max} auf {optimal_size} Plätze (Belegung: {current_occupancy})")
                        optimized_tables_count += 1
                        
        if optimized_tables_count > 0:
            message += f' (Tischgrößen optimiert: {optimized_tables_count} Tische)'

        return jsonify({
            'success': success,
            'message': message,
            'assigned_count': assigned_count,
            'total_guests': len(active_gaeste),
            'unassigned_count': unassigned_count,
            'assignments': assignments,
            'table_overview': table_list,
            'created_tables': created_tables,
            'optimized_tables': optimized_tables_count,
            'filter_used': 'Nur zugesagte Gäste' if only_confirmed else 'Alle Gäste mit Essen',
            'relationships_used': len(beziehungen) > 0
        })
        
    except Exception as e:
        logger.error(f"❌ Fehler bei automatischer Zuweisung: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tischplanung/optimize-table-sizes', methods=['POST'])
@require_auth
@require_role(['admin'])
def api_tischplanung_optimize_table_sizes():
    """Optimiert die Tischgrößen basierend auf aktueller Belegung"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        # Lade alle Daten
        tische = data_manager.get_tische()
        zuordnungen = data_manager.get_tisch_zuordnungen()
        
        if not tische:
            return jsonify({'error': 'Keine Tische vorhanden'}), 400
        
        optimized_count = 0
        optimizations = []
        
        for tisch in tische:
            tisch_id = tisch['id']
            
            # Berechne aktuelle Belegung dieses Tisches
            current_occupancy = 0
            for zuordnung in zuordnungen:
                if zuordnung.get('tisch_id') == tisch_id:
                    gast_id = zuordnung.get('gast_id')
                    gast = data_manager.get_gast_by_id(gast_id)
                    if gast:
                        current_occupancy += gast.get('anzahl_essen', 1)
            
            # Berücksichtige Brautpaar am Brauttisch
            if tisch.get('name') == 'Brauttisch':
                current_occupancy += 2  # Brautpaar
            
            current_max = tisch['max_personen']
            
            if current_occupancy > 0:
                # Optimale Größe: aktuelle Belegung + 20% Puffer, mindestens 4 Plätze
                optimal_size = max(int(current_occupancy * 1.2), 4)
                
                # Wenn der Unterschied signifikant ist (mehr als 2 Plätze), optimiere
                if abs(current_max - optimal_size) > 2:
                    data_manager.update_tisch(tisch_id, {'max_personen': optimal_size})
                    
                    optimizations.append({
                        'table_name': tisch.get('name', f'Tisch {tisch_id}'),
                        'old_size': current_max,
                        'new_size': optimal_size,
                        'occupancy': current_occupancy
                    })
                    optimized_count += 1
                    
                    logger.info(f"📏 {tisch.get('name')}: Größe optimiert {current_max} → {optimal_size} (Belegung: {current_occupancy})")
        
        message = f"Tischgrößen optimiert: {optimized_count} Tische angepasst" if optimized_count > 0 else "Alle Tischgrößen bereits optimal"
        
        return jsonify({
            'success': True,
            'message': message,
            'optimized_count': optimized_count,
            'optimizations': optimizations
        })
        
    except Exception as e:
        logger.error(f"❌ Fehler bei Tischgrößen-Optimierung: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tischplanung/save', methods=['POST'])
@require_auth
@require_role(['admin'])
def api_tischplanung_save():
    """Speichert den kompletten Sitzplan"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Keine Daten empfangen'}), 400
        
        # Tischpositionen aktualisieren
        if 'tables' in data:
            for table_data in data['tables']:
                if 'id' in table_data:
                    data_manager.update_tisch(table_data['id'], {
                        'x_position': table_data.get('x_position', 0),
                        'y_position': table_data.get('y_position', 0)
                    })
        
        # Zuordnungen sind bereits über die anderen API-Endpunkte gespeichert
        return jsonify({'message': 'Sitzplan erfolgreich gespeichert'})
        
    except Exception as e:
        logger.error(f"Fehler beim Speichern des Sitzplans: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tischplanung/config', methods=['GET'])
@require_auth
@require_role(['admin'])
def api_tischplanung_config_get():
    """Lädt die Tischplanung-Konfiguration"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        config = data_manager.get_tischplanung_config()
        return jsonify(config)
        
    except Exception as e:
        logger.error(f"Fehler beim Laden der Konfiguration: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tischplanung/config', methods=['POST'])
@require_auth
@require_role(['admin'])
def api_tischplanung_config_save():
    """Speichert die Tischplanung-Konfiguration"""
    try:
        if not data_manager:
            return jsonify({'error': 'Datenbank nicht verfügbar'}), 500
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Keine Daten empfangen'}), 400
        
        success = data_manager.update_tischplanung_config(data)
        
        if success:
            return jsonify({'message': 'Konfiguration erfolgreich gespeichert'})
        else:
            return jsonify({'error': 'Fehler beim Speichern der Konfiguration'}), 500
            
    except Exception as e:
        logger.error(f"Fehler beim Speichern der Konfiguration: {e}")
        return jsonify({'error': str(e)}), 500

def start_server_with_ssl():
    """Startet den Server mit SSL-Unterstützung"""
    global ssl_thread, server_running
    import threading
    import time
    import socket
    import logging
    
    # Flask-Logging komplett deaktivieren - FRÜH machen!
    logging.getLogger('werkzeug').setLevel(logging.CRITICAL)
    logging.getLogger('werkzeug').disabled = True
    
    def get_local_ip():
        """Ermittelt die lokale IP-Adresse des Geräts"""
        try:
            # Verbinde zu einem externen Server (ohne tatsächlich Daten zu senden)
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
                s.connect(("8.8.8.8", 80))
                local_ip = s.getsockname()[0]
                return local_ip
        except Exception:
            # Fallback
            try:
                hostname = socket.gethostname()
                local_ip = socket.gethostbyname(hostname)
                if local_ip.startswith("127."):
                    # Wenn localhost zurückgegeben wird, versuche andere Methode
                    return "localhost"
                return local_ip
            except Exception:
                return "localhost"
    
    print("🚀 Hochzeitsplaner Dual-Server-Start")
    print("=" * 60)
    print(f"📁 Arbeitsverzeichnis: {os.getcwd()}")
    
    # Lade Hochzeitsplaner-Konfiguration für Domain und SSL
    config_path = os.path.join(os.path.dirname(__file__), 'hochzeitsplaner_config.json')
    punycode_domain = "xn--pascalundkthe-heiraten-94b.de"  # Standard Punycode für pascalundkäthe-heiraten.de
    external_port = 8443
    ssl_enabled = False
    original_domain = ""
    
    print("\n📋 Konfiguration laden")
    print("-" * 30)
    
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
                original_domain = config.get('domain', '')
                # Konvertiere Unicode-Domain zu Punycode falls nötig
                if 'ä' in original_domain or 'ö' in original_domain or 'ü' in original_domain:
                    punycode_domain = original_domain.encode('idna').decode('ascii')
                    print(f"🌐 Domain: {original_domain}")
                    print(f"🔤 Punycode: {punycode_domain}")
                else:
                    punycode_domain = original_domain
                    print(f"🌐 Domain: {original_domain}")
                external_port = config.get('port', 8443)
                ssl_enabled = config.get('ssl_enabled', False)
                print(f"🔒 SSL aktiviert: {ssl_enabled}")
                print(f"🚪 Port: {external_port}")
                print(f"🖥️  Host: {config.get('host', '0.0.0.0')}")
        except Exception as e:
            logger.warning(f"Fehler beim Laden der Hochzeitsplaner-Konfiguration: {e}")
            print(f"❌ Fehler beim Laden der Konfiguration: {e}")
    else:
        print(f"⚠️  Keine Konfiguration gefunden: {config_path}")
    
    # SSL-Zertifikat-Pfade - PyInstaller-kompatibel
    def get_ssl_paths():
        """Findet SSL-Zertifikate sowohl für Entwicklung als auch für PyInstaller .exe"""
        possible_base_dirs = []
        
        # 1. Verzeichnis neben der .exe (PyInstaller-Bundle)
        if getattr(sys, 'frozen', False):
            # Wenn als .exe ausgeführt
            exe_dir = os.path.dirname(sys.executable)
            possible_base_dirs.append(exe_dir)
            print(f"🔍 PyInstaller-Modus: Suche SSL-Zertifikate in {exe_dir}")
        
        # 2. Skript-Verzeichnis (Entwicklung)
        script_dir = os.path.dirname(os.path.abspath(__file__))
        possible_base_dirs.append(script_dir)
        
        # 3. Arbeitsverzeichnis
        possible_base_dirs.append(os.getcwd())
        
        for base_dir in possible_base_dirs:
            cert_path = os.path.join(base_dir, 'ssl_certificate.crt')
            key_path = os.path.join(base_dir, 'ssl_private_key.key')
            
            print(f"🔍 Suche in: {base_dir}")
            cert_exists = os.path.exists(cert_path)
            key_exists = os.path.exists(key_path)
            print(f"   📜 Zertifikat: ssl_certificate.crt -> {'✅' if cert_exists else '❌'}")
            print(f"   🔑 Schlüssel: ssl_private_key.key -> {'✅' if key_exists else '❌'}")
            
            if cert_exists and key_exists:
                print(f"✅ SSL-Zertifikate gefunden in: {base_dir}")
                return cert_path, key_path
        
        return None, None
    
    print("\n🔒 SSL-Setup prüfen")
    print("-" * 30)
    
    ssl_cert_path, ssl_key_path = get_ssl_paths()
    
    # Prüfe SSL-Zertifikate
    ssl_context = None
    if ssl_cert_path and ssl_key_path and ssl_enabled:
        try:
            # Teste SSL-Kontext
            import ssl as ssl_module
            ssl_context = ssl_module.create_default_context(ssl_module.Purpose.CLIENT_AUTH)
            ssl_context.load_cert_chain(ssl_cert_path, ssl_key_path)
            print(f"✅ SSL-Kontext erfolgreich erstellt")
            if original_domain and punycode_domain != original_domain:
                print(f"🌐 Domain: {original_domain}")
                print(f"🔤 Punycode: {punycode_domain}")
            print(f"✅ Alle SSL-Tests erfolgreich!")
        except Exception as e:
            logger.warning(f"SSL-Zertifikate gefunden, aber fehlerhaft: {e}")
            ssl_context = None
            print(f"❌ SSL-Kontext-Fehler: {e}")
    elif ssl_cert_path and ssl_key_path and not ssl_enabled:
        print(f"📋 SSL-Zertifikate vorhanden, aber SSL ist deaktiviert")
        print(f"   Zum Aktivieren: ssl_enabled: true in {config_path}")
    elif not ssl_cert_path or not ssl_key_path:
        print(f"❌ SSL-Zertifikate nicht gefunden")
        print(f"   Benötigt: ssl_certificate.crt und ssl_private_key.key")
    else:
        print(f"ℹ️  SSL nicht konfiguriert")
    
    # Lokaler Port 8080 (immer verfügbar)
    local_port = 8080
    local_ip = get_local_ip()
    
    print("\n📊 System-Zusammenfassung")
    print("-" * 30)
    print(f"✅ DataManager initialisiert: {DATA_DIR}")
    if email_manager and EMAIL_AVAILABLE:
        print(f"📧 E-Mail Manager: {'✅ Aktiv' if email_manager.is_enabled() else '⏸️ Inaktiv'}")
    else:
        print(f"📧 E-Mail Manager: ❌ Nicht verfügbar")
    
    print("\n🎯 Server-Ziele")
    print("-" * 30)
    print(f"🌐 Lokal:  http://localhost:{local_port}")
    print(f"🏠 LAN:    http://{local_ip}:{local_port}")
    
    if punycode_domain and ssl_context:
        print(f"🔒 Extern: https://{punycode_domain}:{external_port}")
        if original_domain and punycode_domain != original_domain:
            print(f"   Original: {original_domain}")
    elif punycode_domain and ssl_enabled:
        print(f"⚠️  SSL-Domain konfiguriert, aber Zertifikate fehlen")
        print(f"   Wäre: https://{punycode_domain}:{external_port}")
    else:
        print(f"ℹ️  Nur lokaler Zugriff verfügbar")
    
    if ssl_context and punycode_domain:
        print("\n🎉 BEREIT FÜR DUAL-SERVER-START!")
        print(f"🌐 Lokal:  http://localhost:{local_port}")
        print(f"🏠 LAN:    http://{local_ip}:{local_port}")
        print(f"🔒 Extern: https://{punycode_domain}:{external_port}")
    else:
        print("\n🌐 BEREIT FÜR LOKALEN SERVER-START!")
        print(f"🏠 Lokal:  http://localhost:{local_port}")
        print(f"🏠 LAN:    http://{local_ip}:{local_port}")
    
    print("\n🚀 Server starten")
    print("=" * 60)
    
    print("=" * 60)
    
    # Server-Konfiguration - Optimiert für Dual-Server-Setup
    ssl_server_started = False
    
    if ssl_context and punycode_domain:
        # SSL-Server für externe Punycode-Domain auf Port 8443
        def start_ssl_server():
            nonlocal ssl_server_started
            try:
                print(f"🔒 Starte SSL-Server auf Port {external_port} für {punycode_domain}...")
                ssl_server_started = True
                
                app.run(
                    host='0.0.0.0',  # Alle Interfaces für externe Erreichbarkeit
                    port=external_port,
                    debug=False,
                    threaded=True,
                    ssl_context=ssl_context,
                    use_reloader=False  # Wichtig für Threading
                )
            except Exception as e:
                logger.error(f"SSL-Server Fehler auf Port {external_port}: {e}")
                print(f"❌ SSL-Server konnte nicht gestartet werden: {e}")
                ssl_server_started = False
        
        # SSL-Server in separatem Thread starten
        ssl_thread = threading.Thread(target=start_ssl_server, daemon=False)  # Nicht daemon für sauberes Shutdown
        ssl_thread.start()
        print(f"✅ SSL-Server-Thread gestartet")
        
        # Minimale Wartezeit für SSL-Server (optimiert)
        time.sleep(0.5)  # Reduziert von 2 auf 0.5 Sekunden
        
        print(f"✅ SSL-Server läuft auf https://{punycode_domain}:{external_port}")
    
    try:
        # Lokaler HTTP-Server auf Port 8080 (immer verfügbar)
        print(f"🌐 Starte lokalen HTTP-Server auf Port {local_port}...")
        
        app.run(
            host='0.0.0.0',  # IPv4 + IPv6 Support
            port=local_port,
            debug=False,
            threaded=True,
            use_reloader=False  # Wichtig für Dual-Server
        )
    except KeyboardInterrupt:
        print("\n🛑 Server wird beendet...")
        signal_handler(signal.SIGINT, None)
    except Exception as e:
        logger.error(f"HTTP-Server Fehler auf Port {local_port}: {e}")
        print(f"❌ Lokaler Server konnte nicht gestartet werden: {e}")
    finally:
        # Sauberes Shutdown
        server_running = False
        shutdown_event.set()
        
        # E-Mail-Checking stoppen beim Beenden
        if email_manager and EMAIL_AVAILABLE:
            try:
                email_manager.stop_email_checking()
                print("📧 E-Mail-Checking gestoppt")
            except:
                pass
        
        # SSL-Thread beenden (falls vorhanden)
        if ssl_thread and ssl_thread.is_alive():
            print("🔒 Warte auf SSL-Server-Beendigung...")
            ssl_thread.join(timeout=3)  # Max 3 Sekunden warten
            if ssl_thread.is_alive():
                print("⚠️  SSL-Server-Thread läuft noch...")
        
        print("\n👋 Auf Wiedersehen!")
        print("=" * 60)

if __name__ == '__main__':
    if not data_manager:
        print("❌ KRITISCHER FEHLER: DataManager konnte nicht initialisiert werden!")
        exit(1)
    
    start_server_with_ssl()


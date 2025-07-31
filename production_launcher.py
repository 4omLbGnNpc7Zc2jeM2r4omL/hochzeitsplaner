#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Produktiv-Starter für Hochzeitsplaner
Automatische Gunicorn-Erkennung mit Flask-Fallback
"""

import os
import sys
import subprocess
import json
from pathlib import Path

def load_config():
    """Lädt die Launcher-Konfiguration"""
    config_file = Path("launcher_config.json")
    
    default_config = {
        "production_server": True,
        "port": 8080,
        "host": "0.0.0.0",
        "workers": 4
    }
    
    if config_file.exists():
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
                default_config.update(config)
        except Exception as e:
            print(f"⚠️  Konfigurationsfehler: {e}")
    
    return default_config

def start_production_server():
    """Startet den Produktivserver"""
    config = load_config()
    
    print("🎉 Hochzeitsplaner Produktivserver")
    print("="*50)
    
    # Prüfe ob Gunicorn verfügbar ist
    try:
        import gunicorn
        use_gunicorn = config.get('production_server', True)
        print("✅ Gunicorn verfügbar")
    except ImportError:
        use_gunicorn = False
        print("⚠️  Gunicorn nicht installiert, verwende Flask Development Server")
        print("💡 Für bessere Performance: pip install gunicorn gevent")
    
    port = config.get('port', 8080)
    host = config.get('host', '0.0.0.0')
    workers = config.get('workers', 4)
    
    if use_gunicorn:
        print(f"🚀 Starte Gunicorn Produktivserver auf {host}:{port}")
        print(f"👥 Worker: {workers}")
        print(f"🌐 URL: http://{host}:{port}")
        print("🛑 Zum Beenden: Strg+C")
        print("="*50)
        
        # Gunicorn-Kommando zusammenstellen
        cmd = [
            sys.executable, "-m", "gunicorn",
            "--config", "gunicorn.conf.py",
            "--bind", f"{host}:{port}",
            "--workers", str(workers),
            "app:app"
        ]
        
        try:
            subprocess.run(cmd)
        except KeyboardInterrupt:
            print("\n🛑 Server beendet")
        except Exception as e:
            print(f"❌ Gunicorn-Fehler: {e}")
            print("🔄 Fallback auf Flask Development Server...")
            use_gunicorn = False
    
    if not use_gunicorn:
        print(f"🔧 Starte Flask Development Server auf {host}:{port}")
        print(f"🌐 URL: http://{host}:{port}")
        print("🛑 Zum Beenden: Strg+C")
        print("="*50)
        
        # Flask direkt starten
        from app import app
        app.run(
            host=host,
            port=port,
            debug=False,
            use_reloader=False,
            threaded=True
        )

if __name__ == '__main__':
    start_production_server()

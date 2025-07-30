#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Hochzeitsplaner Web-Anwendung - Standalone Version
"""

import sys
import os
from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
import json
import tempfile
from datetime import datetime

# Aktueller Pfad für Import
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

try:
    from datenmanager import HochzeitsDatenManager
except ImportError as e:
    print(f"❌ Fehler beim Importieren des DataManagers: {e}")
    sys.exit(1)

# Flask App initialisieren
app = Flask(__name__)
app.config['SECRET_KEY'] = 'hochzeitsplaner-standalone-2025'
CORS(app)

# Globaler DataManager
data_manager = None

def init_data_manager():
    """Initialisiert den DataManager"""
    global data_manager
    try:
        data_dir = os.path.join(current_dir, "data")
        data_manager = HochzeitsDatenManager(data_dir)
        print(f"✅ DataManager initialisiert: {data_dir}")
        return True
    except Exception as e:
        print(f"❌ Fehler beim Initialisieren: {e}")
        return False

# Routen
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/gaesteliste')
def gaesteliste():
    return render_template('gaesteliste.html')

@app.route('/budget')
def budget():
    return render_template('budget.html')

@app.route('/einstellungen')
def einstellungen():
    return render_template('einstellungen.html')

# API Endpunkte
@app.route('/api/dashboard/stats')
def api_dashboard_stats():
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        gaeste_stats = data_manager.get_guest_statistics()
        budget_stats = data_manager.get_budget_summary()
        settings = data_manager.load_settings()
        
        return jsonify({
            'success': True,
            'gaeste': gaeste_stats,
            'budget': budget_stats,
            'settings': settings
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/gaeste/list')
def api_gaeste_list():
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        gaeste_list = data_manager.gaesteliste_df.to_dict('records')
        return jsonify({
            'success': True,
            'gaeste': gaeste_list,
            'count': len(gaeste_list)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/gaeste/add', methods=['POST'])
def api_gaeste_add():
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        gast_data = request.json
        required_fields = ['Name', 'Vorname', 'Status']
        
        for field in required_fields:
            if field not in gast_data or not gast_data[field].strip():
                return jsonify({'error': f'Feld "{field}" ist erforderlich'}), 400
        
        # Standardwerte setzen
        defaults = {
            'Email': '', 'Telefon': '', 'Adresse': '',
            'Teilnahme_Standesamt': 'Vielleicht',
            'Teilnahme_Essen': 'Vielleicht',
            'Teilnahme_Party': 'Vielleicht',
            'Bemerkungen': ''
        }
        
        for key, default in defaults.items():
            if key not in gast_data:
                gast_data[key] = default
        
        success = data_manager.add_guest(gast_data)
        
        if success:
            return jsonify({'success': True, 'message': 'Gast erfolgreich hinzugefügt'})
        else:
            return jsonify({'error': 'Fehler beim Hinzufügen'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/budget/auto-generate', methods=['POST'])
def api_budget_auto_generate():
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        success = data_manager.generate_auto_budget()
        
        if success:
            return jsonify({'success': True, 'message': 'Budget automatisch erstellt'})
        else:
            return jsonify({'error': 'Fehler beim Erstellen'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/settings/get')
def api_settings_get():
    try:
        if not data_manager:
            return jsonify({'error': 'DataManager nicht initialisiert'}), 500
        
        settings = data_manager.load_settings()
        return jsonify({'success': True, 'settings': settings})
    except Exception as e:
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

if __name__ == '__main__':
    print("🎉 Hochzeitsplaner Web-Anwendung")
    print("=" * 50)
    
    if not init_data_manager():
        print("❌ DataManager-Initialisierung fehlgeschlagen")
        sys.exit(1)
    
    print("✅ DataManager initialisiert")
    print("🌐 URL: http://localhost:8080")
    print("⚠️  Zum Beenden: Strg+C")
    print("=" * 50)
    
    try:
        app.run(host='0.0.0.0', port=8080, debug=False, threaded=True)
    except KeyboardInterrupt:
        print("\n👋 Web-Anwendung beendet")
    except Exception as e:
        print(f"\n❌ Fehler: {e}")
        sys.exit(1)

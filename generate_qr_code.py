#!/usr/bin/env python3
"""
QR-Code Generator für Hochzeitsplaner
=====================================
Generiert einen QR-Code für die externe URL der Hochzeitsplaner-Anwendung.
"""

import qrcode
import json
import os

def load_dyndns_config():
    """Lädt die DynDNS-Konfiguration aus der JSON-Datei."""
    config_file = "dyndns_config.json"
    try:
        with open(config_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"❌ Konfigurationsdatei {config_file} nicht gefunden!")
        return None
    except json.JSONDecodeError:
        print(f"❌ Fehler beim Lesen der Konfigurationsdatei {config_file}!")
        return None

def generate_qr_code(url, filename="hochzeitsplaner_qr.png"):
    """Generiert einen QR-Code für die gegebene URL."""
    print(f"🎯 Generiere QR-Code für: {url}")
    
    # QR-Code erstellen
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    
    qr.add_data(url)
    qr.make(fit=True)
    
    # QR-Code als Bild erstellen (nur der QR-Code, kein Text)
    qr_img = qr.make_image(fill_color="black", back_color="white")
    
    # QR-Code direkt speichern (ohne zusätzlichen Text)
    qr_img.save(filename)
    print(f"✅ QR-Code gespeichert als: {filename}")
    
    return filename

def main():
    """Hauptfunktion - Generiert QR-Code aus DynDNS-Konfiguration."""
    print("🎨 QR-Code Generator für Hochzeitsplaner")
    print("=" * 40)
    
    # DynDNS-Konfiguration laden
    config = load_dyndns_config()
    if not config:
        return
    
    # URL aus Konfiguration erstellen
    dyndns_config = config.get('dyndns', {})
    domain = dyndns_config.get('domain', '')
    external_port = dyndns_config.get('external_port', 8443)
    
    if not domain:
        print("❌ Keine Domain in der Konfiguration gefunden!")
        return
    
    # Vollständige URL zusammenbauen
    url = f"https://{domain}:{external_port}"
    
    print(f"📡 Domain: {domain}")
    print(f"🔌 Port: {external_port}")
    print(f"🔗 URL: {url}")
    print()
    
    # QR-Code generieren
    filename = generate_qr_code(url)
    
    # Zusätzliche Informationen
    print()
    print("📱 QR-Code Verwendung:")
    print("- Scanne den QR-Code mit deinem Smartphone")
    print("- Funktioniert nur im selben Netzwerk oder über IPv6")
    print("- Bei Problemen: Stelle sicher, dass DynDNS aktiv ist")
    print()
    print(f"📂 QR-Code gespeichert: {os.path.abspath(filename)}")

if __name__ == "__main__":
    main()

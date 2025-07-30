#!/usr/bin/env python3
"""
Einfaches Ionos DynDNS IPv6-Update Script
Für regelmäßige Cronjob-Ausführung
"""

import requests
import socket
from datetime import datetime

# === KONFIGURATION ===
# Ionos DynDNS Update URL (falls DynDNS bereits eingerichtet)
DYNDNS_UPDATE_URL = "https://ipv6.domains.ionos.com/nic/update"
DOMAIN = "xn--pascalundkthe-heiraten-94b.de"

# Für Standard-Update (falls verfügbar)
USERNAME = ""  # Ihr DynDNS-Username
PASSWORD = ""  # Ihr DynDNS-Passwort

def log(msg):
    """Einfache Logging-Funktion"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"{timestamp} - {msg}")

def get_ipv6():
    """IPv6-Adresse ermitteln"""
    try:
        response = requests.get("https://ipv6.icanhazip.com", timeout=10)
        if response.status_code == 200:
            ipv6 = response.text.strip()
            socket.inet_pton(socket.AF_INET6, ipv6)  # Validierung
            return ipv6
    except Exception as e:
        log(f"IPv6-Ermittlung fehlgeschlagen: {e}")
    return None

def update_dyndns_simple():
    """Einfaches DynDNS-Update nur für IPv6"""
    ipv6 = get_ipv6()
    if not ipv6:
        log("FEHLER: Keine IPv6-Adresse verfügbar")
        return False
    
    try:
        # Einfacher DynDNS-Update-Request
        url = f"{DYNDNS_UPDATE_URL}?hostname={DOMAIN}&myipv6={ipv6}"
        
        if USERNAME and PASSWORD:
            response = requests.get(url, auth=(USERNAME, PASSWORD), timeout=10)
        else:
            response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            log(f"SUCCESS: IPv6 aktualisiert auf {ipv6}")
            return True
        else:
            log(f"FEHLER: Status {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        log(f"FEHLER beim DynDNS-Update: {e}")
        return False

if __name__ == "__main__":
    log("=== Ionos DynDNS IPv6-Update ===")
    update_dyndns_simple()

#!/usr/bin/env python3
"""
Ionos DynDNS IPv6-Update - Einfache Version basierend auf Ionos-Dokumentation
"""

import requests
import socket
from datetime import datetime

# === IONOS DYNDNS KONFIGURATION ===
IONOS_UPDATE_URL = "https://ipv4.api.hosting.ionos.com/dns/v1/dyndns?q=NDFjZmM3YmVjYjQzNDRhMTkxMzliZDAwYzA2OGU3NzEuU2FvNlhuR2U4UmtxNGdiQzlMN19TLWpZanM4LWZBdGsxX2Ixa2FFUmRFWUp4Z1pmR3NWOVFpUjZYZGQ5TTZ5QjBIZkxSRFAyN2lzeHhCRWNuNVpSU0E"
DOMAIN = "xn--pascalundkthe-heiraten-94b.de"

def log(msg):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"{timestamp} - {msg}")

def get_public_ipv6():
    try:
        response = requests.get("https://ipv6.icanhazip.com", timeout=10)
        if response.status_code == 200:
            ipv6 = response.text.strip()
            socket.inet_pton(socket.AF_INET6, ipv6)
            return ipv6
    except Exception as e:
        log(f"IPv6-Ermittlung fehlgeschlagen: {e}")
    return None

def update_ionos_dyndns():
    """Ionos DynDNS Update basierend auf offizieller Dokumentation"""
    ipv6 = get_public_ipv6()
    if not ipv6:
        log("FEHLER: Keine IPv6-Adresse verfügbar")
        return False
    
    log(f"IPv6-Adresse: {ipv6}")
    
    # Verschiedene Parameter-Kombinationen testen
    test_configurations = [
        # 1. Standard IPv6-Update ohne TTL
        {
            "url": f"{IONOS_UPDATE_URL}&hostname={DOMAIN}&myipv6={ipv6}",
            "desc": "Standard IPv6-Update"
        },
        # 2. IPv6-Update mit explizit leerem myip (IPv4 entfernen)
        {
            "url": f"{IONOS_UPDATE_URL}&hostname={DOMAIN}&myip=&myipv6={ipv6}",
            "desc": "IPv6-Update mit IPv4-Entfernung"
        },
        # 3. IPv6-Update mit TTL=3600 (1 Stunde - Ionos Maximum)
        {
            "url": f"{IONOS_UPDATE_URL}&hostname={DOMAIN}&myip=&myipv6={ipv6}&ttl=3600",
            "desc": "IPv6-Update mit 1h TTL"
        }
    ]
    
    for i, config in enumerate(test_configurations, 1):
        log(f"\n=== Versuch {i}: {config['desc']} ===")
        
        try:
            response = requests.get(config["url"], timeout=15)
            response_text = response.text.strip()
            
            log(f"HTTP Status: {response.status_code}")
            log(f"Response: '{response_text}' (Länge: {len(response_text)})")
            
            if response.status_code == 200:
                # Erfolgreiche Ionos DynDNS Responses
                if response_text in ["good", "nochg", ""]:
                    log(f"SUCCESS: {config['desc']} erfolgreich!")
                    log(f"Domain: {DOMAIN}")
                    log(f"IPv6: {ipv6}")
                    return True
                elif "good" in response_text or "nochg" in response_text:
                    log(f"SUCCESS: Positive Response: {response_text}")
                    return True
                else:
                    log(f"INFO: Unbekannte Response, probiere nächste Konfiguration...")
            else:
                log(f"ERROR: HTTP {response.status_code}")
                
        except Exception as e:
            log(f"ERROR: {e}")
    
    log("FEHLER: Alle Konfigurationen fehlgeschlagen")
    return False

def verify_dns():
    """Schnelle DNS-Überprüfung"""
    log("\n=== DNS-Überprüfung ===")
    
    try:
        import subprocess
        
        # IPv6 prüfen
        result = subprocess.run(['dig', '+short', 'AAAA', DOMAIN], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0 and result.stdout.strip():
            log(f"DNS AAAA-Record: {result.stdout.strip()}")
        else:
            log("Kein AAAA-Record gefunden")
            
    except Exception as e:
        log(f"DNS-Check fehlgeschlagen: {e}")

def main():
    log("=== Ionos DynDNS IPv6-Update (Vereinfacht) ===")
    
    success = update_ionos_dyndns()
    
    if success:
        log("\n✅ DynDNS-Update erfolgreich!")
        log("Warte 30 Sekunden für DNS-Propagation...")
        import time
        time.sleep(30)
        verify_dns()
        log(f"\n🌐 Externe URL: https://{DOMAIN}:8443")
    else:
        log("\n❌ DynDNS-Update fehlgeschlagen")
    
    return success

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Ionos DynDNS IPv6-Update - Test ohne TTL Parameter
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

def test_different_parameters():
    """Teste verschiedene Parameter-Kombinationen"""
    ipv6 = get_public_ipv6()
    if not ipv6:
        log("FEHLER: Keine IPv6-Adresse")
        return
    
    log(f"IPv6-Adresse: {ipv6}")
    
    # Test 1: Nur IPv6, ohne TTL
    test_urls = [
        # Standard IPv6-only Update
        f"{IONOS_UPDATE_URL}&hostname={DOMAIN}&myipv6={ipv6}",
        
        # Mit explizit leerem myip
        f"{IONOS_UPDATE_URL}&hostname={DOMAIN}&myip=&myipv6={ipv6}",
        
        # Mit TTL
        f"{IONOS_UPDATE_URL}&hostname={DOMAIN}&myip=&myipv6={ipv6}&ttl=21600",
        
        # Nur mit hostname und IPv6
        f"{IONOS_UPDATE_URL}&hostname={DOMAIN}&ipv6={ipv6}",
    ]
    
    for i, test_url in enumerate(test_urls, 1):
        log(f"\n=== Test {i} ===")
        log(f"URL: {test_url}")
        
        try:
            response = requests.get(test_url, timeout=15)
            log(f"Status: {response.status_code}")
            log(f"Response: '{response.text.strip()}' (Length: {len(response.text.strip())})")
            log(f"Headers: {dict(response.headers)}")
            
        except Exception as e:
            log(f"FEHLER: {e}")

if __name__ == "__main__":
    log("=== Ionos DynDNS Parameter-Test ===")
    test_different_parameters()

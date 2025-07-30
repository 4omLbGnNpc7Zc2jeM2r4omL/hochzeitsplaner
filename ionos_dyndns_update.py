#!/usr/bin/env python3
"""
Ionos DynDNS IPv6-Update mit Ihrer persönlichen Update-URL
Verwendet die direkte Ionos DynDNS Update-URL für IPv6-only Updates
"""

import requests
import socket
from datetime import datetime

# === IHRE IONOS DYNDNS KONFIGURATION ===
IONOS_UPDATE_URL = "https://ipv4.api.hosting.ionos.com/dns/v1/dyndns?q=NDFjZmM3YmVjYjQzNDRhMTkxMzliZDAwYzA2OGU3NzEuU2FvNlhuR2U4UmtxNGdiQzlMN19TLWpZanM4LWZBdGsxX2Ixa2FFUmRFWUp4Z1pmR3NWOVFpUjZYZGQ5TTZ5QjBIZkxSRFAyN2lzeHhCRWNuNVpSU0E"
DOMAIN = "xn--pascalundkthe-heiraten-94b.de"

# Logfile
logfile = "ionos_dyndns_ipv6.log"

def log(msg):
    """Logging-Funktion"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"{timestamp} - {msg}")
    with open(logfile, "a", encoding="utf-8") as f:
        f.write(f"{timestamp} - {msg}\n")

def get_public_ipv6():
    """Ermittelt die aktuelle öffentliche IPv6-Adresse"""
    ipv6_services = [
        "https://ipv6.icanhazip.com",
        "https://v6.ident.me", 
        "https://ipv6.wtfismyip.com/text",
        "https://api6.ipify.org"
    ]
    
    for service in ipv6_services:
        try:
            response = requests.get(service, timeout=10)
            if response.status_code == 200:
                ipv6 = response.text.strip()
                # IPv6-Adresse validieren
                socket.inet_pton(socket.AF_INET6, ipv6)
                log(f"IPv6-Adresse ermittelt von {service}: {ipv6}")
                return ipv6
        except Exception as e:
            log(f"Service {service} fehlgeschlagen: {e}")
            continue
    
    log("ERROR: Keine IPv6-Adresse von den Services abrufbar")
    return None

def update_ipv6_only():
    """Aktualisiert DynDNS nur mit IPv6 (entfernt IPv4)"""
    
    # Aktuelle IPv6-Adresse ermitteln
    ipv6 = get_public_ipv6()
    if not ipv6:
        log("ABBRUCH: Keine IPv6-Adresse verfügbar")
        return False
    
    try:
        # DynDNS-Update mit IPv6-only
        # Wichtig: myip= leer lassen, um IPv4 zu entfernen  
        # myipv6= mit aktueller IPv6 setzen
        # ttl=3600 für 1 Stunde (Ionos Maximum für DynDNS)
        update_url = f"{IONOS_UPDATE_URL}&hostname={DOMAIN}&myip=&myipv6={ipv6}&ttl=3600"
        
        log(f"Sende DynDNS-Update für {DOMAIN} -> IPv6: {ipv6} (TTL: 1h)")
        log(f"Update-URL: {update_url}")
        
        response = requests.get(update_url, timeout=15)
        
        if response.status_code == 200:
            response_text = response.text.strip()
            log(f"SUCCESS: DynDNS-Response: '{response_text}' (Length: {len(response_text)})")
            
            # Erfolgreiche Antworten prüfen
            if "good" in response_text or "nochg" in response_text:
                log(f"SUCCESS: Domain {DOMAIN} erfolgreich auf IPv6-only aktualisiert")
                log(f"IPv6-Adresse: {ipv6}")
                log(f"Externe URL: https://{DOMAIN}:8443")
                return True
            elif response_text == "":
                log("INFO: Leere Response - möglicherweise erfolgreich, prüfe DNS...")
                return True  # Leere Response als Erfolg behandeln
            else:
                log(f"WARNING: Unerwartete Antwort: '{response_text}'")
                return False
                
        else:
            log(f"ERROR: HTTP {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        log(f"ERROR bei DynDNS-Update: {e}")
        return False

def verify_dns_update():
    """Überprüft die DNS-Aktualisierung"""
    log("Überprüfe DNS-Updates...")
    
    try:
        import subprocess
        
        # IPv6 (AAAA) Record prüfen
        result_aaaa = subprocess.run(['dig', '+short', 'AAAA', DOMAIN], 
                                   capture_output=True, text=True, timeout=10)
        
        if result_aaaa.returncode == 0 and result_aaaa.stdout.strip():
            log(f"DNS AAAA-Record: {result_aaaa.stdout.strip()}")
        else:
            log("WARNING: Kein AAAA-Record gefunden")
        
        # IPv4 (A) Record prüfen (sollte leer sein)
        result_a = subprocess.run(['dig', '+short', 'A', DOMAIN], 
                                capture_output=True, text=True, timeout=10)
        
        if result_a.returncode == 0:
            if result_a.stdout.strip():
                log(f"WARNING: A-Record noch vorhanden: {result_a.stdout.strip()}")
            else:
                log("SUCCESS: Kein A-Record mehr vorhanden (IPv6-only)")
        
    except Exception as e:
        log(f"DNS-Überprüfung fehlgeschlagen: {e}")

def main():
    """Hauptfunktion"""
    log("=== Ionos DynDNS IPv6-Only Update gestartet ===")
    log(f"Domain: {DOMAIN}")
    
    # DynDNS Update durchführen
    success = update_ipv6_only()
    
    if success:
        log("DynDNS-Update erfolgreich - warte 30 Sekunden für DNS-Propagation...")
        import time
        time.sleep(30)
        
        # DNS-Update verifizieren
        verify_dns_update()
        
        log("=== IPv6-only Konfiguration abgeschlossen ===")
        log(f"Externe Gäste können jetzt zugreifen: https://{DOMAIN}:8443")
    else:
        log("FEHLER: DynDNS-Update fehlgeschlagen")
    
    log("=== Ionos DynDNS IPv6-Only Update beendet ===")
    return success

if __name__ == "__main__":
    main()

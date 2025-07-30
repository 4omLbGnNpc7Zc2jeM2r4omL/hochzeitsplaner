#!/usr/bin/env python3
"""
Ionos DynDNS IPv6-Update - Korrigierte Version für IPv4-Entfernung
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

def remove_ipv4_add_ipv6():
    """Schritt für Schritt: Erst IPv4 entfernen, dann IPv6 hinzufügen"""
    ipv6 = get_public_ipv6()
    if not ipv6:
        log("FEHLER: Keine IPv6-Adresse verfügbar")
        return False
    
    log(f"IPv6-Adresse: {ipv6}")
    
    # Schritt 1: IPv4 entfernen (myip leer lassen)
    log("\n=== Schritt 1: IPv4-Record entfernen ===")
    remove_ipv4_url = f"{IONOS_UPDATE_URL}&hostname={DOMAIN}&myip="
    
    try:
        response = requests.get(remove_ipv4_url, timeout=15)
        log(f"IPv4-Entfernung Status: {response.status_code}")
        log(f"IPv4-Entfernung Response: '{response.text.strip()}'")
        
        if response.status_code == 200:
            log("✅ IPv4-Record-Entfernung erfolgreich")
        else:
            log("⚠️ IPv4-Entfernung möglicherweise fehlgeschlagen")
            
    except Exception as e:
        log(f"ERROR bei IPv4-Entfernung: {e}")
    
    # Kurz warten
    import time
    time.sleep(5)
    
    # Schritt 2: IPv6 hinzufügen
    log("\n=== Schritt 2: IPv6-Record hinzufügen ===")
    add_ipv6_url = f"{IONOS_UPDATE_URL}&hostname={DOMAIN}&myipv6={ipv6}"
    
    try:
        response = requests.get(add_ipv6_url, timeout=15)
        log(f"IPv6-Hinzufügung Status: {response.status_code}")
        log(f"IPv6-Hinzufügung Response: '{response.text.strip()}'")
        
        if response.status_code == 200:
            log("✅ IPv6-Record-Hinzufügung erfolgreich")
            return True
        else:
            log("❌ IPv6-Hinzufügung fehlgeschlagen")
            return False
            
    except Exception as e:
        log(f"ERROR bei IPv6-Hinzufügung: {e}")
        return False

def update_both_simultaneously():
    """Alternative: Beide Parameter gleichzeitig senden"""
    ipv6 = get_public_ipv6()
    if not ipv6:
        return False
    
    log(f"\n=== Alternative: Gleichzeitige Aktualisierung ===")
    log(f"IPv6-Adresse: {ipv6}")
    
    # Beide Parameter in einem Request
    update_url = f"{IONOS_UPDATE_URL}&hostname={DOMAIN}&myip=0.0.0.0&myipv6={ipv6}"
    
    try:
        response = requests.get(update_url, timeout=15)
        log(f"Gleichzeitig-Update Status: {response.status_code}")
        log(f"Gleichzeitig-Update Response: '{response.text.strip()}'")
        
        if response.status_code == 200:
            log("✅ Gleichzeitige Aktualisierung erfolgreich")
            return True
        else:
            log("❌ Gleichzeitige Aktualisierung fehlgeschlagen")
            return False
            
    except Exception as e:
        log(f"ERROR bei gleichzeitiger Aktualisierung: {e}")
        return False

def verify_dns():
    """DNS-Überprüfung"""
    log("\n=== DNS-Überprüfung ===")
    
    try:
        import subprocess
        
        # IPv4 (A) Record prüfen
        result_a = subprocess.run(['dig', '+short', 'A', DOMAIN], 
                                capture_output=True, text=True, timeout=10)
        if result_a.returncode == 0:
            if result_a.stdout.strip():
                log(f"⚠️ A-Record noch vorhanden: {result_a.stdout.strip()}")
            else:
                log("✅ A-Record erfolgreich entfernt")
        
        # IPv6 (AAAA) Record prüfen
        result_aaaa = subprocess.run(['dig', '+short', 'AAAA', DOMAIN], 
                                   capture_output=True, text=True, timeout=10)
        if result_aaaa.returncode == 0:
            if result_aaaa.stdout.strip():
                log(f"✅ AAAA-Record: {result_aaaa.stdout.strip()}")
            else:
                log("❌ Kein AAAA-Record gefunden")
                
    except Exception as e:
        log(f"DNS-Check fehlgeschlagen: {e}")

def main():
    log("=== Ionos DynDNS IPv6-Only Konfiguration ===")
    
    # Methode 1: Schrittweise
    success1 = remove_ipv4_add_ipv6()
    
    # Warten auf DNS-Propagation
    log("\nWarte 60 Sekunden für DNS-Propagation...")
    import time
    time.sleep(60)
    
    # DNS prüfen
    verify_dns()
    
    # Falls Methode 1 nicht funktioniert, Methode 2 probieren
    if not success1:
        log("\n=== Methode 1 nicht erfolgreich, probiere Methode 2 ===")
        success2 = update_both_simultaneously()
        
        if success2:
            log("\nWarte weitere 60 Sekunden...")
            time.sleep(60)
            verify_dns()
    
    log(f"\n🌐 Externe URL: https://{DOMAIN}:8443")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Ionos DynDNS IPv6-Only Update Script für DS-Lite
Aktualisiert nur den AAAA-Record (IPv6) und entfernt A-Record (IPv4)
"""

import requests
import json
import socket
from datetime import datetime

# === KONFIGURATION ===
api_key = "c5b9b64c340245dc8c32916bb3070999.-96rr6ASto_gT7ErUQLgOzkYKk-AphxTgr-qojr-TC4Ef53ZCgVGFibrnlEJbUUBw9gFAcRVVkygu5mrTbTXZA"
domain = "xn--pascalundkthe-heiraten-94b.de"
zone_id = ""  # Wird automatisch ermittelt

# === IONOS API URLs ===
base_url = "https://api.hosting.ionos.com/dns/v1"
logfile = "dyndns-ipv6-update.log"

def log(msg):
    """Logging-Funktion"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"{timestamp} - {msg}")
    with open(logfile, "a", encoding="utf-8") as f:
        f.write(f"{timestamp} - {msg}\n")

def get_public_ipv6():
    """Ermittelt die öffentliche IPv6-Adresse"""
    try:
        # Mehrere IPv6-Services testen
        services = [
            "https://ipv6.icanhazip.com",
            "https://v6.ident.me",
            "https://ipv6.wtfismyip.com/text"
        ]
        
        for service in services:
            try:
                response = requests.get(service, timeout=10)
                if response.status_code == 200:
                    ipv6 = response.text.strip()
                    # Validierung der IPv6-Adresse
                    socket.inet_pton(socket.AF_INET6, ipv6)
                    log(f"IPv6-Adresse ermittelt: {ipv6}")
                    return ipv6
            except Exception as e:
                log(f"Service {service} fehlgeschlagen: {e}")
                continue
        
        log("ERROR: Keine IPv6-Adresse ermittelbar")
        return None
        
    except Exception as e:
        log(f"ERROR bei IPv6-Ermittlung: {e}")
        return None

def get_zone_id():
    """Ermittelt die Zone-ID für die Domain"""
    try:
        headers = {
            "X-API-Key": api_key,
            "accept": "application/json"
        }
        
        response = requests.get(f"{base_url}/zones", headers=headers, timeout=10)
        
        if response.status_code == 200:
            zones = response.json()
            for zone in zones:
                if zone['name'] == domain:
                    zone_id = zone['id']
                    log(f"Zone-ID gefunden: {zone_id}")
                    return zone_id
            
            log(f"ERROR: Domain {domain} nicht in verfügbaren Zones gefunden")
            return None
        else:
            log(f"ERROR: Status {response.status_code} beim Abrufen der Zones")
            return None
            
    except Exception as e:
        log(f"ERROR bei Zone-ID-Ermittlung: {e}")
        return None

def get_dns_records(zone_id):
    """Holt alle DNS-Records für die Zone"""
    try:
        headers = {
            "X-API-Key": api_key,
            "accept": "application/json"
        }
        
        response = requests.get(f"{base_url}/zones/{zone_id}", headers=headers, timeout=10)
        
        if response.status_code == 200:
            zone_data = response.json()
            return zone_data.get('records', [])
        else:
            log(f"ERROR: Status {response.status_code} beim Abrufen der DNS-Records")
            return []
            
    except Exception as e:
        log(f"ERROR bei DNS-Records-Abruf: {e}")
        return []

def update_dns_records(zone_id, ipv6_address):
    """Aktualisiert DNS-Records: Nur IPv6, entfernt IPv4"""
    try:
        # Aktuelle Records abrufen
        current_records = get_dns_records(zone_id)
        
        # Neue Records erstellen (nur IPv6)
        new_records = []
        
        # Alle Records durchgehen und nur gewünschte behalten/aktualisieren
        for record in current_records:
            record_name = record.get('name', '')
            record_type = record.get('type', '')
            
            # A-Records (IPv4) komplett entfernen für @ und www
            if record_type == 'A' and record_name in ['@', 'www']:
                log(f"A-Record entfernt: {record_name}")
                continue
            
            # AAAA-Records (IPv6) aktualisieren für @ und www
            elif record_type == 'AAAA' and record_name in ['@', 'www']:
                record['content'] = ipv6_address
                new_records.append(record)
                log(f"AAAA-Record aktualisiert: {record_name} -> {ipv6_address}")
            
            # Alle anderen Records unverändert übernehmen
            else:
                new_records.append(record)
        
        # Falls keine AAAA-Records vorhanden waren, erstellen
        has_root_aaaa = any(r.get('type') == 'AAAA' and r.get('name') == '@' for r in new_records)
        has_www_aaaa = any(r.get('type') == 'AAAA' and r.get('name') == 'www' for r in new_records)
        
        if not has_root_aaaa:
            # AAAA-Record für @ erstellen
            new_records.append({
                "name": "@",
                "type": "AAAA",
                "content": ipv6_address,
                "ttl": 3600,
                "disabled": False
            })
            log(f"Neuer AAAA-Record erstellt für @ -> {ipv6_address}")
        
        if not has_www_aaaa:
            # AAAA-Record für www erstellen
            new_records.append({
                "name": "www",
                "type": "AAAA", 
                "content": ipv6_address,
                "ttl": 3600,
                "disabled": False
            })
            log(f"Neuer AAAA-Record erstellt für www -> {ipv6_address}")
        
        # DNS-Zone aktualisieren
        headers = {
            "X-API-Key": api_key,
            "accept": "application/json",
            "Content-Type": "application/json"
        }
        
        payload = {
            "records": new_records
        }
        
        response = requests.put(f"{base_url}/zones/{zone_id}", 
                              headers=headers, 
                              json=payload, 
                              timeout=10)
        
        if response.status_code == 200:
            log("SUCCESS: DNS-Records erfolgreich aktualisiert (IPv6-only)")
            return True
        else:
            log(f"ERROR: Status {response.status_code} bei DNS-Update -> {response.text}")
            return False
            
    except Exception as e:
        log(f"ERROR bei DNS-Records-Update: {e}")
        return False

def main():
    """Hauptfunktion"""
    log("=== Ionos DynDNS IPv6-Only Update gestartet ===")
    
    # IPv6-Adresse ermitteln
    ipv6 = get_public_ipv6()
    if not ipv6:
        log("ABBRUCH: Keine IPv6-Adresse verfügbar")
        return False
    
    # Zone-ID ermitteln
    zone_id = get_zone_id()
    if not zone_id:
        log("ABBRUCH: Zone-ID nicht ermittelbar")
        return False
    
    # DNS-Records aktualisieren
    success = update_dns_records(zone_id, ipv6)
    
    if success:
        log(f"SUCCESS: Domain {domain} jetzt IPv6-only erreichbar unter {ipv6}")
        log("Externe URL: https://xn--pascalundkthe-heiraten-94b.de:8443")
    else:
        log("FEHLER: DNS-Update fehlgeschlagen")
    
    log("=== Ionos DynDNS IPv6-Only Update beendet ===")
    return success

if __name__ == "__main__":
    main()

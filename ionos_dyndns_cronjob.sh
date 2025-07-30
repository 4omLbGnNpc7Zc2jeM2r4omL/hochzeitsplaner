#!/bin/bash
"""
Einfacher Cronjob-Script für regelmäßige IPv6-Updates
"""

# === KONFIGURATION ===
UPDATE_URL="https://ipv4.api.hosting.ionos.com/dns/v1/dyndns?q=NDFjZmM3YmVjYjQzNDRhMTkxMzliZDAwYzA2OGU3NzEuU2FvNlhuR2U4UmtxNGdiQzlMN19TLWpZanM4LWZBdGsxX2Ixa2FFUmRFWUp4Z1pmR3NWOVFpUjZYZGQ5TTZ5QjBIZkxSRFAyN2lzeHhCRWNuNVpSU0E"
DOMAIN="xn--pascalundkthe-heiraten-94b.de"
LOGFILE="/var/log/dyndns_ipv6.log"

# Timestamp-Funktion
timestamp() {
    date "+%Y-%m-%d %H:%M:%S"
}

# Logging-Funktion
log() {
    echo "$(timestamp) - $1" | tee -a "$LOGFILE"
}

# IPv6-Adresse ermitteln
get_ipv6() {
    # Mehrere Services testen
    for service in "https://ipv6.icanhazip.com" "https://v6.ident.me" "https://api6.ipify.org"; do
        ipv6=$(curl -s --max-time 10 "$service" 2>/dev/null)
        if [[ $ipv6 =~ ^[0-9a-fA-F:]+$ ]] && [ ${#ipv6} -gt 10 ]; then
            echo "$ipv6"
            return 0
        fi
    done
    return 1
}

# DynDNS Update
update_dyndns() {
    log "=== DynDNS IPv6-Update gestartet ==="
    
    # IPv6-Adresse ermitteln
    ipv6=$(get_ipv6)
    if [ $? -ne 0 ] || [ -z "$ipv6" ]; then
        log "ERROR: Keine IPv6-Adresse ermittelbar"
        return 1
    fi
    
    log "IPv6-Adresse: $ipv6"
    
    # DynDNS-Update (myip= leer für IPv4-Entfernung, TTL=21600 für 6h)
    response=$(curl -s --max-time 15 "${UPDATE_URL}&hostname=${DOMAIN}&myip=&myipv6=${ipv6}&ttl=21600")
    
    if [ $? -eq 0 ]; then
        log "DynDNS Response: $response"
        
        if [[ "$response" == *"good"* ]] || [[ "$response" == *"nochg"* ]]; then
            log "SUCCESS: DynDNS IPv6-Update erfolgreich"
            return 0
        else
            log "WARNING: Unerwartete Response: $response"
            return 1
        fi
    else
        log "ERROR: DynDNS-Update fehlgeschlagen"
        return 1
    fi
}

# Hauptausführung
update_dyndns

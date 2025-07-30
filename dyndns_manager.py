#!/usr/bin/env python3
"""
DynDNS Manager für Hochzeitsplaner
Automatisches IPv6-only Update für Ionos DynDNS
"""

import requests
import socket
import threading
import time
from datetime import datetime
import logging

class DynDNSManager:
    def __init__(self, update_url, domain, interval_minutes=30):
        """
        DynDNS Manager initialisieren
        
        Args:
            update_url: Ionos DynDNS Update-URL
            domain: Domain-Name
            interval_minutes: Update-Intervall in Minuten (default: 30 = 2x pro Stunde)
        """
        self.update_url = update_url
        self.domain = domain
        self.interval_minutes = interval_minutes
        self.running = False
        self.thread = None
        self.last_ipv6 = None
        self.last_update = None
        
        # Logging konfigurieren
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - DynDNS - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger('DynDNS')
    
    def get_public_ipv6(self):
        """Ermittelt die aktuelle öffentliche IPv6-Adresse"""
        ipv6_services = [
            "https://ipv6.icanhazip.com",
            "https://v6.ident.me", 
            "https://api6.ipify.org"
        ]
        
        for service in ipv6_services:
            try:
                response = requests.get(service, timeout=5)
                if response.status_code == 200:
                    ipv6 = response.text.strip()
                    # IPv6-Adresse validieren
                    socket.inet_pton(socket.AF_INET6, ipv6)
                    return ipv6
            except Exception:
                continue
        
        return None
    
    def update_dns(self, force=False):
        """
        DynDNS Update durchführen
        
        Args:
            force: Erzwinge Update auch wenn IPv6 unverändert
        """
        try:
            # Aktuelle IPv6-Adresse ermitteln
            current_ipv6 = self.get_public_ipv6()
            
            if not current_ipv6:
                self.logger.warning("Keine IPv6-Adresse verfügbar")
                return False
            
            # Prüfen ob Update nötig ist
            if not force and current_ipv6 == self.last_ipv6:
                self.logger.debug(f"IPv6 unverändert: {current_ipv6}")
                return True
            
            # DynDNS-Update senden
            update_url = f"{self.update_url}&hostname={self.domain}&myipv6={current_ipv6}"
            
            response = requests.get(update_url, timeout=10)
            
            if response.status_code == 200:
                # Leere Response ist bei Ionos DynDNS normal und bedeutet Erfolg
                self.last_ipv6 = current_ipv6
                self.last_update = datetime.now()
                
                if current_ipv6 != self.last_ipv6 or force:
                    self.logger.info(f"DynDNS aktualisiert: {self.domain} -> {current_ipv6}")
                
                return True
            else:
                self.logger.error(f"DynDNS-Update fehlgeschlagen: HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.logger.error(f"DynDNS-Update Fehler: {e}")
            return False
    
    def _update_loop(self):
        """Background-Thread für regelmäßige Updates"""
        self.logger.info(f"DynDNS-Manager gestartet (Update alle {self.interval_minutes} Minuten)")
        
        # Erstes Update sofort
        self.update_dns(force=True)
        
        while self.running:
            try:
                # Warten bis zum nächsten Update
                for _ in range(self.interval_minutes * 60):  # Sekunden
                    if not self.running:
                        break
                    time.sleep(1)
                
                if self.running:
                    self.update_dns()
                    
            except Exception as e:
                self.logger.error(f"Fehler im Update-Loop: {e}")
                time.sleep(60)  # Bei Fehler 1 Minute warten
    
    def start(self):
        """DynDNS-Manager starten"""
        if self.running:
            self.logger.warning("DynDNS-Manager läuft bereits")
            return
        
        self.running = True
        self.thread = threading.Thread(target=self._update_loop, daemon=True)
        self.thread.start()
        self.logger.info("DynDNS-Manager erfolgreich gestartet")
    
    def stop(self):
        """DynDNS-Manager stoppen"""
        if not self.running:
            return
        
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        self.logger.info("DynDNS-Manager gestoppt")
    
    def get_status(self):
        """Status-Informationen abrufen"""
        return {
            "running": self.running,
            "domain": self.domain,
            "last_ipv6": self.last_ipv6,
            "last_update": self.last_update.isoformat() if self.last_update else None,
            "interval_minutes": self.interval_minutes
        }

# Globale Instanz für den Hochzeitsplaner
dyndns_manager = None

def init_dyndns(update_url, domain, interval_minutes=30):
    """DynDNS-Manager initialisieren"""
    global dyndns_manager
    
    if update_url and domain:
        dyndns_manager = DynDNSManager(update_url, domain, interval_minutes)
        return dyndns_manager
    else:
        logging.getLogger('DynDNS').warning("DynDNS nicht konfiguriert (URL oder Domain fehlt)")
        return None

def start_dyndns():
    """DynDNS-Manager starten"""
    global dyndns_manager
    if dyndns_manager:
        dyndns_manager.start()

def stop_dyndns():
    """DynDNS-Manager stoppen"""
    global dyndns_manager
    if dyndns_manager:
        dyndns_manager.stop()

def get_dyndns_status():
    """DynDNS-Status abrufen"""
    global dyndns_manager
    if dyndns_manager:
        return dyndns_manager.get_status()
    return {"running": False, "error": "DynDNS nicht initialisiert"}

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Lokale Netzwerk-Konfiguration für hochzeitsplaner.de
Ermöglicht Zugriff über echte Domain im lokalen Netzwerk
"""
import os
import sys
import platform
import subprocess
import socket

def get_local_ip():
    """Ermittelt die lokale IP-Adresse"""
    try:
        # Verbinde zu einem externen Server um lokale IP zu ermitteln
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception:
        return "192.168.1.100"  # Fallback

def get_hosts_file_path():
    """Ermittelt den Pfad zur hosts-Datei je nach Betriebssystem"""
    if platform.system() == "Windows":
        return r"C:\Windows\System32\drivers\etc\hosts"
    else:
        return "/etc/hosts"

def check_admin_rights():
    """Prüft ob Admin-Rechte vorhanden sind"""
    if platform.system() == "Windows":
        try:
            import ctypes
            return ctypes.windll.shell32.IsUserAnAdmin()
        except:
            return False
    else:
        return os.geteuid() == 0

def add_hosts_entry():
    """Fügt beide Domains zur hosts-Datei hinzu"""
    local_ip = get_local_ip()
    hosts_file = get_hosts_file_path()
    
    print(f"🌐 Konfiguriere lokale Domains:")
    print(f"   hochzeitsplaner.de → {local_ip}")
    print(f"   pascalundkäthe-heiraten.de → {local_ip}")
    
    # Prüfe Admin-Rechte
    if not check_admin_rights():
        print("❌ Administrator-Rechte erforderlich!")
        print("\n📋 Manuelle Konfiguration:")
        print(f"1. Öffne als Administrator: {hosts_file}")
        print(f"2. Füge hinzu: {local_ip}  hochzeitsplaner.de")
        print(f"3. Füge hinzu: {local_ip}  www.hochzeitsplaner.de")
        print(f"4. Füge hinzu: {local_ip}  pascalundkäthe-heiraten.de") 
        print(f"5. Füge hinzu: {local_ip}  www.pascalundkäthe-heiraten.de")
        print("6. Speichern und Hochzeitsplaner neu starten")
        return False
    
    # Hosts-Datei lesen
    try:
        with open(hosts_file, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        try:
            with open(hosts_file, 'r', encoding='latin-1') as f:
                content = f.read()
        except Exception as e:
            print(f"❌ Fehler beim Lesen der hosts-Datei: {e}")
            return False
    
    # Prüfe ob Einträge bereits existieren
    domains_found = []
    if "hochzeitsplaner.de" in content:
        domains_found.append("hochzeitsplaner.de")
    if "pascalundkäthe-heiraten.de" in content:
        domains_found.append("pascalundkäthe-heiraten.de")
    
    if len(domains_found) == 2:
        print("✅ Beide Domains bereits in hosts-Datei konfiguriert")
        return True
    
    # Neue Einträge hinzufügen
    new_entries = f"""
# Hochzeitsplaner Dual-Domain-Konfiguration
{local_ip}  hochzeitsplaner.de
{local_ip}  www.hochzeitsplaner.de
{local_ip}  pascalundkäthe-heiraten.de
{local_ip}  www.pascalundkäthe-heiraten.de
"""
    
    try:
        with open(hosts_file, 'a', encoding='utf-8') as f:
            f.write(new_entries)
        print("✅ hosts-Datei erfolgreich aktualisiert!")
        print(f"🌐 hochzeitsplaner.de → {local_ip}")
        print(f"🌍 pascalundkäthe-heiraten.de → {local_ip}")
        return True
    except Exception as e:
        print(f"❌ Fehler beim Schreiben der hosts-Datei: {e}")
        return False

def configure_app_for_domain():
    """Konfiguriert die App für Domain-Zugriff"""
    
    # Aktualisiere working_launcher_ssl.py für Domain-Support
    launcher_file = "working_launcher_ssl.py"
    if not os.path.exists(launcher_file):
        print(f"❌ {launcher_file} nicht gefunden")
        return False
    
    print("🔧 Konfiguriere App für Domain-Zugriff...")
    
    # Lese aktuelle Datei
    with open(launcher_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Überprüfe ob bereits konfiguriert
    if "hochzeitsplaner.de" in content:
        print("✅ App bereits für Domain-Zugriff konfiguriert")
        return True
    
    # Füge Domain-Konfiguration hinzu
    domain_config = '''
    # Domain-spezifische Konfiguration
    if use_ssl:
        print("🌍 Domain-Zugriff verfügbar:")
        print("   🏠 Lokal: https://localhost:{}".format(port))
        print("   🌐 Domain: https://hochzeitsplaner.de:{}".format(port))
        print("   📱 Netzwerk: https://{}:{}".format(host, port))
    else:
        print("🌍 Domain-Zugriff verfügbar:")
        print("   🏠 Lokal: http://localhost:{}".format(port))
        print("   🌐 Domain: http://hochzeitsplaner.de:{}".format(port))
        print("   📱 Netzwerk: http://{}:{}".format(host, port))
'''
    
    # Finde die richtige Stelle zum Einfügen
    insert_point = content.find('print("🔒 SSL aktiviert - Sicherer HTTPS-Modus")')
    if insert_point == -1:
        insert_point = content.find('print("⚠️  HTTP-Modus (unverschlüsselt)")')
    
    if insert_point != -1:
        # Ersetze die bestehenden Print-Statements
        lines = content.split('\n')
        new_lines = []
        skip_next = 0
        
        for i, line in enumerate(lines):
            if skip_next > 0:
                skip_next -= 1
                continue
                
            if '🔒 SSL aktiviert - Sicherer HTTPS-Modus' in line:
                new_lines.append(line)
                new_lines.append('        print("   🏠 Intern erreichbar: https://localhost:{}".format(port))')
                new_lines.append('        print("   🌐 Domain-Zugriff: https://hochzeitsplaner.de:{}".format(port))')
                new_lines.append('        print("   📱 Netzwerk: https://{}:{}".format(host, port))')
                skip_next = 2  # Überspringe die nächsten 2 Zeilen
            elif '⚠️  HTTP-Modus (unverschlüsselt)' in line:
                new_lines.append(line)
                new_lines.append('        print("   🏠 Intern erreichbar: http://localhost:{}".format(port))')
                new_lines.append('        print("   🌐 Domain-Zugriff: http://hochzeitsplaner.de:{}".format(port))')
                new_lines.append('        print("   📱 Netzwerk: http://{}:{}".format(host, port))')
            else:
                new_lines.append(line)
        
        # Schreibe aktualisierte Datei
        with open(launcher_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(new_lines))
        
        print("✅ App für Domain-Zugriff konfiguriert!")
        return True
    
    print("⚠️  Konfiguration nicht geändert (Einfügepunkt nicht gefunden)")
    return False

def show_network_info():
    """Zeigt Netzwerk-Informationen an"""
    local_ip = get_local_ip()
    
    print("\n" + "="*60)
    print("🌐 DUAL-DOMAIN NETZWERK-KONFIGURATION")
    print("="*60)
    print(f"📍 Lokale IP-Adresse: {local_ip}")
    print(f"🌐 Lokale Domain: hochzeitsplaner.de")
    print(f"🌍 Internet-Domain: pascalundkäthe-heiraten.de")
    print(f"🔧 Hosts-Datei: {get_hosts_file_path()}")
    
    print("\n📱 LOKALE ZUGRIFF-URLS:")
    print("   • https://hochzeitsplaner.de:8443 (SSL)")
    print("   • http://hochzeitsplaner.de:8080 (HTTP)")
    print(f"   • https://{local_ip}:8443 (direkte IP)")
    
    print("\n🌍 INTERNET ZUGRIFF-URLS (nach Router-Konfiguration):")
    print("   • https://pascalundkäthe-heiraten.de:8443 (SSL)")
    print("   • http://pascalundkäthe-heiraten.de:8080 (HTTP)")
    print("   • https://pascalundkäthe-heiraten.de (Port 443)")
    print("   • http://pascalundkäthe-heiraten.de (Port 80)")
    
    print("\n🔧 ROUTER-KONFIGURATION (für Internet-Zugang):")
    print("   Port-Weiterleitung: 80 → 8080, 443 → 8443")
    print("   DNS: pascalundkäthe-heiraten.de → externe IP")
    print("   DynDNS oder feste IP empfohlen")
    
    print("\n🔥 FIREWALL-EINSTELLUNGEN:")
    print("   Ports freigeben: 8080 (HTTP), 8443 (HTTPS)")
    print("   Für Internet: Router-Portfreigabe aktivieren")
    
    print("="*60)

def main():
    print("🎉" + "="*58 + "🎉")
    print("     HOCHZEITSPLANER NETZWERK-KONFIGURATION")
    print("        Domain: hochzeitsplaner.de")
    print("🎉" + "="*58 + "🎉")
    
    print("\n🔍 Analysiere Netzwerk-Konfiguration...")
    
    # Hosts-Datei konfigurieren
    hosts_success = add_hosts_entry()
    
    # App konfigurieren
    app_success = configure_app_for_domain()
    
    # Netzwerk-Info anzeigen
    show_network_info()
    
    if hosts_success and app_success:
        print("\n✅ KONFIGURATION ABGESCHLOSSEN!")
        print("🚀 Starte jetzt den Hochzeitsplaner und verwende:")
        print("   https://hochzeitsplaner.de:8443")
    else:
        print("\n⚠️  MANUELLE KONFIGURATION ERFORDERLICH")
        print("📋 Folge den obigen Anweisungen")
    
    print("\n" + "="*60)
    input("Drücke Enter zum Beenden...")

if __name__ == '__main__':
    main()

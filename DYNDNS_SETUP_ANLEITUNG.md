# Ionos DynDNS IPv6-Only Setup für DS-Lite

## 🎯 **Ihr Problem:** DS-Lite blockiert IPv4-Zugriff von extern

**Lösung:** DynDNS so konfigurieren, dass nur IPv6 (AAAA-Record) gesetzt wird.

## 📁 **Bereitgestellte Scripts:**

### 1. `ionos_dyndns_ipv6_only.py` - Vollständiges API-Script
- Verwendet Ionos DNS-API direkt
- Entfernt A-Records (IPv4) komplett
- Setzt nur AAAA-Records (IPv6)
- Detailliertes Logging

### 2. `ionos_dyndns_simple.py` - Einfaches Update-Script
- Für regelmäßige Cronjob-Ausführung
- Minimaler Code
- Schnelle IPv6-Updates

## 🔧 **Setup-Anleitung:**

### **Schritt 1: Einmalige Vollkonfiguration**
```bash
# Vollständige IPv6-only DNS-Konfiguration
python3 ionos_dyndns_ipv6_only.py
```

**Was passiert:**
- ❌ A-Records (IPv4) werden **entfernt**
- ✅ AAAA-Records (IPv6) werden aktualisiert
- 🎯 Domain ist nur noch über IPv6 erreichbar

### **Schritt 2: Regelmäßige Updates (Cronjob)**
```bash
# Cronjob einrichten (alle 5 Minuten)
crontab -e

# Folgende Zeile hinzufügen:
*/5 * * * * /usr/bin/python3 /pfad/zu/ionos_dyndns_simple.py >> /var/log/dyndns.log 2>&1
```

## 🧪 **Test nach Konfiguration:**

### **DNS-Prüfung:**
```bash
# Sollte IPv6-Adresse zeigen:
dig AAAA xn--pascalundkthe-heiraten-94b.de

# Sollte leer sein (kein IPv4):
dig A xn--pascalundkthe-heiraten-94b.de
```

### **Zugriff-Test:**
```bash
# IPv6-Zugriff (sollte funktionieren):
curl -6 https://xn--pascalundkthe-heiraten-94b.de:8443

# IPv4-Zugriff (sollte fehlschlagen):
curl -4 https://xn--pascalundkthe-heiraten-94b.de:8443
```

## 🎯 **Ergebnis für Gäste:**

**Funktioniert automatisch:**
```
https://xn--pascalundkthe-heiraten-94b.de:8443
```

**Browser verwenden automatisch IPv6**, da kein IPv4 mehr verfügbar ist!

## ⚡ **Sofortige Ausführung:**

1. **Script ausführbar machen:**
```bash
chmod +x ionos_dyndns_ipv6_only.py
```

2. **Einmalig ausführen:**
```bash
python3 ionos_dyndns_ipv6_only.py
```

3. **Logs prüfen:**
```bash
cat dyndns-ipv6-update.log
```

## 📱 **Browser-Kompatibilität:**

- ✅ **Modern Browser**: Funktionieren automatisch mit IPv6
- ✅ **Chrome/Firefox/Safari**: Volle Unterstützung
- ⚠️ **Alte Browser**: Eventuell IPv6-Probleme
- 🔧 **Fallback**: CloudFlare Tunnel für IPv4-only Clients

## 🚨 **Wichtiger Hinweis:**

**Nach der Ausführung ist die Domain NUR über IPv6 erreichbar!**
- ✅ Moderne Netzwerke: Funktioniert perfekt
- ❌ IPv4-only Netzwerke: Können nicht mehr zugreifen
- 🎯 DS-Lite Netzwerke: Perfekte Lösung

## 📋 **Monitoring:**

```bash
# IPv6-Adresse überwachen:
watch -n 30 'curl -s ipv6.icanhazip.com'

# DNS-Status prüfen:
watch -n 60 'dig AAAA +short xn--pascalundkthe-heiraten-94b.de'
```

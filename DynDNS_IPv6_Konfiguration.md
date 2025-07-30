# DynDNS IPv6-Only Konfiguration für DS-Lite

## Problem: DynDNS-Client setzt sowohl A-Record (IPv4) als auch AAAA-Record (IPv6)

Für DS-Lite benötigen wir nur IPv6 (AAAA-Record), da IPv4 durch Carrier-Grade NAT blockiert wird.

## Häufige DynDNS-Clients und IPv6-Konfiguration:

### 1. Fritz!Box DynDNS (häufigste Lösung)

**Konfiguration:**
1. Fritz!Box Web-Interface öffnen: `http://192.168.178.1`
2. Internet → Freigaben → DynDNS
3. DynDNS-Anbieter auswählen (z.B. Ionos, No-IP, DuckDNS)
4. **Wichtig**: Option "IPv6-Adresse verwenden" aktivieren
5. **Optional**: "IPv4-Adresse verwenden" deaktivieren (falls möglich)

**Domain-Name:** `xn--pascalundkthe-heiraten-94b.de`

### 2. DDclient (Linux/Router)

**Konfiguration in `/etc/ddclient.conf`:**
```bash
# Nur IPv6 aktualisieren
use=webv6, web=ipv6.icanhazip.com
protocol=dyndns2
server=update.ionos.de
login=ihr-username
password=ihr-passwort
xn--pascalundkthe-heiraten-94b.de

# IPv4 deaktivieren (auskommentieren):
# use=web, web=icanhazip.com
```

### 3. Router-basierte DynDNS-Clients

**Typische Optionen:**
- ✅ IPv6 aktivieren: `Ja`
- ❌ IPv4 aktivieren: `Nein` (oder deaktivieren)
- **Service:** Ionos/1&1 DynDNS
- **Hostname:** `xn--pascalundkthe-heiraten-94b.de`

### 4. No-IP DUC (Dynamic Update Client)

**Konfiguration:**
```bash
# Nur IPv6 aktivieren
./duc -u ihr-username -p ihr-passwort -h xn--pascalundkthe-heiraten-94b.de --ipv6-only
```

### 5. Benutzerdefiniertes Script (Universal)

**IPv6-Only Update Script:**
```bash
#!/bin/bash
# IPv6-Adresse ermitteln
IPV6=$(curl -s ipv6.icanhazip.com)

# Nur IPv6 an DynDNS senden
curl -u "username:password" \
     "https://update.ionos.de/nic/update?hostname=xn--pascalundkthe-heiraten-94b.de&myipv6=$IPV6"
```

## Welchen DynDNS-Client verwenden Sie?

**Bitte teilen Sie mit:**
1. **Router-Typ** (Fritz!Box, Speedport, etc.)
2. **DynDNS-Anbieter** (Ionos, No-IP, DuckDNS, etc.)
3. **Client-Software** (falls spezielle Software verwendet wird)

## Test nach Konfiguration:

```bash
# Prüfen ob nur IPv6 gesetzt ist:
dig AAAA xn--pascalundkthe-heiraten-94b.de
dig A xn--pascalundkthe-heiraten-94b.de  # Sollte leer sein

# IPv6-Zugriff testen:
curl -6 https://xn--pascalundkthe-heiraten-94b.de:8443
```

## Sofort-Lösung: Fritz!Box Check

Falls Sie eine Fritz!Box verwenden:
```
http://192.168.178.1
→ Internet
→ Freigaben  
→ DynDNS
→ "IPv6-Adresse verwenden" aktivieren
→ "IPv4-Adresse verwenden" deaktivieren
```

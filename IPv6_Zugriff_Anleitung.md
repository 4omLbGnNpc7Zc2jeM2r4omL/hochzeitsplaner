# IPv6-Zugriff für DS-Lite erzwingen

## Problem: Browser bevorzugen IPv4 über IPv6

Selbst wenn eine Domain sowohl A-Record (IPv4) als auch AAAA-Record (IPv6) hat, bevorzugen Browser normalerweise IPv4.

## Lösung 1: Direkte IPv6-Adresse verwenden (Funktioniert immer)

### URL-Format für IPv6:
```
https://[2a02:908:1022:1f80:80ce:e88c:ab54:6482]:8443
```

### Beispiel-Link für Gäste:
```html
<a href="https://[2a02:908:1022:1f80:80ce:e88c:ab54:6482]:8443">
    Hochzeitsplaner öffnen
</a>
```

### Nachteile:
- Komplizierte URL
- Nicht benutzerfreundlich
- Schwer zu merken

## Lösung 2: IPv6-Only Domain erstellen

### DNS-Konfiguration:
- Nur AAAA-Record setzen (IPv6)
- A-Record entfernen (IPv4)

### Bei Ionos:
1. DNS-Verwaltung öffnen
2. A-Record für `xn--pascalundkthe-heiraten-94b.de` löschen
3. Nur AAAA-Record behalten: `2a02:908:1022:1f80:80ce:e88c:ab54:6482`

### Ergebnis:
```
https://xn--pascalundkthe-heiraten-94b.de:8443
```
Funktioniert dann automatisch über IPv6!

## Lösung 3: Subdomain für IPv6 erstellen

### DNS-Setup:
```
ipv6.xn--pascalundkthe-heiraten-94b.de -> AAAA-Record only
```

### URL für Gäste:
```
https://ipv6.xn--pascalundkthe-heiraten-94b.de:8443
```

## Lösung 4: Browser-spezifische Einstellungen

### Chrome:
```bash
# IPv6 erzwingen (temporär)
chrome --disable-features=IPv4
```

### Firefox:
```
about:config
network.dns.disableIPv6 = false
network.dns.preferIPv6 = true
```

## Lösung 5: Gäste-freundliche HTML-Weiterleitung

### Erstellen Sie eine einfache HTML-Seite:
```html
<!DOCTYPE html>
<html>
<head>
    <title>Hochzeitsplaner - Weiterleitung</title>
    <meta http-equiv="refresh" content="0;url=https://[2a02:908:1022:1f80:80ce:e88c:ab54:6482]:8443">
</head>
<body>
    <h1>Weiterleitung zum Hochzeitsplaner...</h1>
    <p>Falls die automatische Weiterleitung nicht funktioniert:</p>
    <a href="https://[2a02:908:1022:1f80:80ce:e88c:ab54:6482]:8443">
        Hier klicken für IPv6-Zugriff
    </a>
</body>
</html>
```

## Empfohlene Lösung: IPv6-Only Domain

**Beste Option für DS-Lite:**

1. **A-Record entfernen** in Ionos DNS-Verwaltung
2. **Nur AAAA-Record behalten**: `2a02:908:1022:1f80:80ce:e88c:ab54:6482`
3. **URL wird einfach**: `https://xn--pascalundkthe-heiraten-94b.de:8443`

### Vorteile:
- ✅ Browser verwenden automatisch IPv6
- ✅ Einfache URL für Gäste
- ✅ Funktioniert zuverlässig mit DS-Lite
- ✅ Keine komplizierte IPv6-Adresse sichtbar

### Nachteile:
- ❌ Funktioniert nur in IPv6-fähigen Netzwerken
- ❌ Manche alte Netzwerke haben kein IPv6

## Test-Kommandos:

```bash
# Prüfen ob IPv6 funktioniert:
curl -6 https://xn--pascalundkthe-heiraten-94b.de:8443

# IPv4 deaktiviert testen:
curl -4 https://xn--pascalundkthe-heiraten-94b.de:8443  # Sollte fehlschlagen
```

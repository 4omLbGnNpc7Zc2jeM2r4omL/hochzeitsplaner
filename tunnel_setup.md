# DS-Lite Tunnel-Lösungen für externen Zugriff

## Problem: DS-Lite blockiert eingehende IPv4-Verbindungen

Bei DS-Lite (Dual Stack Lite) von Vodafone:
- ❌ Keine öffentliche IPv4-Adresse
- ❌ Eingehende Verbindungen über IPv4 blockiert
- ✅ Nur IPv6 funktioniert direkt

## Lösung 1: ngrok Tunnel (Empfohlen)

### Installation:
```bash
# Download von https://ngrok.com/download
# Account erstellen (kostenlos)
```

### Verwendung:
```bash
# Auf dem Server starten:
ngrok http 8080
# oder für HTTPS:
ngrok http 8443 --scheme=https
```

### Ergebnis:
- Bekommt eine öffentliche URL wie: `https://abc123.ngrok.io`
- Funktioniert von überall
- Kostenlos verfügbar

## Lösung 2: Cloudflare Tunnel

### Installation:
```bash
# Download cloudflared
# Account bei Cloudflare erstellen
```

### Setup:
```bash
cloudflared tunnel create hochzeitsplaner
cloudflared tunnel --config cloudflared.yml run
```

### Vorteile:
- Eigene Domain verwendbar
- Sehr stabil
- DDoS-Schutz

## Lösung 3: LocalTunnel (Einfachste Option)

### Installation:
```bash
npm install -g localtunnel
```

### Verwendung:
```bash
# Auf dem Server:
lt --port 8080 --subdomain hochzeitsplaner
```

### Ergebnis:
- URL: `https://hochzeitsplaner.loca.lt`
- Sofort verfügbar
- Keine Registrierung nötig

## Lösung 4: IPv6-Only (Technische Lösung)

### Für IPv6-fähige Netzwerke:
```
https://[2a02:908:1022:1f80:80ce:e88c:ab54:6482]:8443
```

### Nachteile:
- Nicht alle Netzwerke unterstützen IPv6
- Komplizierte URL für Benutzer

## Empfehlung:

**Für Gäste: ngrok verwenden**
- ✅ Einfache Installation
- ✅ Funktioniert überall
- ✅ HTTPS automatisch
- ✅ Benutzerfreundliche URL

**Für permanente Lösung: Cloudflare Tunnel**
- ✅ Eigene Domain
- ✅ Professionell
- ✅ Sehr stabil

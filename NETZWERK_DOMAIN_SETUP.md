# 🌐 Dual-Domain-Konfiguration: hochzeitsplaner.de + pascalundkäthe-heiraten.de

## 🎯 Ziel
Der Hochzeitsplaner soll sowohl lokal im Netzwerk als auch über das Internet erreichbar sein:
- **🌐 Lokal:** `hochzeitsplaner.de` (für Gäste im lokalen WLAN)
- **🌍 Internet:** `pascalundkäthe-heiraten.de` (für entfernte Gäste)

## 🚀 Automatische Konfiguration

### Option 1: Konfigurations-Script ausführen
```bash
python configure_network.py
```
Das Script konfiguriert beide Domains automatisch.

### Option 2: Manuelle Konfiguration

## 📝 Manuelle Schritte

### 1. Lokale IP-Adresse ermitteln
```bash
# Windows
ipconfig | findstr "IPv4"

# macOS/Linux  
ifconfig | grep "inet "
```
Beispiel-Ergebnis: `192.168.1.100`

### 2. Hosts-Datei bearbeiten

#### Windows:
```
Datei: C:\Windows\System32\drivers\etc\hosts
Als Administrator öffnen und hinzufügen:

192.168.1.100  hochzeitsplaner.de
192.168.1.100  www.hochzeitsplaner.de
192.168.1.100  pascalundkäthe-heiraten.de
192.168.1.100  www.pascalundkäthe-heiraten.de
```

#### macOS/Linux:
```bash
sudo nano /etc/hosts

# Hinzufügen:
192.168.1.100  hochzeitsplaner.de
192.168.1.100  www.hochzeitsplaner.de
192.168.1.100  pascalundkäthe-heiraten.de
192.168.1.100  www.pascalundkäthe-heiraten.de
```

### 3. App-Konfiguration überprüfen
Der Launcher sollte bereits auf `0.0.0.0` (alle Interfaces) konfiguriert sein.

## 🔧 Router-Konfiguration (Optional)

Für Zugriff ohne Port-Angabe:

### Port-Weiterleitung einrichten:
- `80` → `8080` (HTTP)
- `443` → `8443` (HTTPS)

### DNS-Einstellungen (falls Router unterstützt):
- Lokale Domain: `hochzeitsplaner.de` → `192.168.1.100`

## 🔥 Firewall-Konfiguration

### Windows Firewall:
```powershell
# Als Administrator ausführen:
netsh advfirewall firewall add rule name="Hochzeitsplaner HTTP" dir=in action=allow protocol=TCP localport=8080
netsh advfirewall firewall add rule name="Hochzeitsplaner HTTPS" dir=in action=allow protocol=TCP localport=8443
```

### macOS:
```bash
# Firewall-Regeln hinzufügen (falls aktiviert)
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add python3
```

### Linux (iptables):
```bash
sudo iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 8443 -j ACCEPT
```

## 📱 Zugriff-URLs

Nach der Konfiguration erreichbar über:

### Mit Ports (sofort funktionsfähig):
- `https://hochzeitsplaner.de:8443` (SSL)
- `http://hochzeitsplaner.de:8080` (HTTP)

### Ohne Ports (nach Router-Konfiguration):
- `https://hochzeitsplaner.de` (SSL)
- `http://hochzeitsplaner.de` (HTTP)

### Fallback (direkte IP):
- `https://192.168.1.100:8443`
- `http://192.168.1.100:8080`

## 🎉 Gäste-Zugang

### QR-Code generieren:
```
Inhalt: https://hochzeitsplaner.de:8443
```

### Gäste-Anweisungen:
1. Mit lokalem WLAN verbinden
2. Browser öffnen
3. `hochzeitsplaner.de:8443` eingeben
4. Mit Gäste-Code einloggen

## 🔒 SSL-Zertifikat für lokale Domain

### Selbst-signiertes Zertifikat erstellen:
```bash
openssl req -x509 -newkey rsa:4096 -keyout ssl_private_key.key -out ssl_certificate.crt -days 365 -nodes -subj "/CN=hochzeitsplaner.de"
```

### Browser-Warnung:
- Erste Verbindung: "Unsicheres Zertifikat" bestätigen
- Danach: Normale HTTPS-Verbindung

## 🛠️ Troubleshooting

### Problem: Domain nicht erreichbar
```bash
# Teste DNS-Auflösung
ping hochzeitsplaner.de

# Sollte antworten: 192.168.1.100
```

### Problem: Port-Konflikte
```bash
# Prüfe welche Ports belegt sind
netstat -an | grep :8080
netstat -an | grep :8443
```

### Problem: Firewall blockiert
```bash
# Windows: Firewall temporär deaktivieren
# macOS: Systemeinstellungen → Sicherheit → Firewall
# Linux: sudo ufw disable
```

### Problem: App startet nur auf localhost
```
In working_launcher_ssl.py prüfen:
"host": "0.0.0.0"  ← Muss so sein für Netzwerk-Zugriff
```

## 📊 Netzwerk-Test

### Verfügbarkeit testen:
```bash
# Von anderem Gerät im Netzwerk:
curl -k https://hochzeitsplaner.de:8443
curl http://hochzeitsplaner.de:8080
```

### Erwartete Antwort:
- Redirect zur Login-Seite
- Keine Verbindungsfehler

## 🎯 Produktions-Setup

### Für dauerhaften Betrieb:
1. ✅ Feste IP-Adresse vergeben
2. ✅ Router-Port-Weiterleitung
3. ✅ Firewall-Regeln permanent
4. ✅ SSL-Zertifikat installiert
5. ✅ Autostart konfiguriert

### Externe Erreichbarkeit (Optional):
1. DynDNS-Service nutzen
2. Router-Portfreigabe ins Internet
3. Echtes SSL-Zertifikat (Let's Encrypt)

---

**🎊 Jetzt ist der Hochzeitsplaner professionell im Netzwerk erreichbar!**

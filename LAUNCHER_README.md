# 🎉 Hochzeitsplaner - Produktivversion 2.0

## 📁 Optimierte Launcher-Struktur

### ✅ Verwendete Dateien:
- **`launcher.py`** - **HAUPTLAUNCHER** mit automatischer Gunicorn-Erkennung
- **`launcher_config.json`** - Zentrale Konfiguration
- **`gunicorn.conf.py`** - Gunicorn Produktivserver-Konfiguration  
- **`start_hochzeitsplaner.bat`** - Windows-Starter mit Dependency-Check

### 🗑️ Entfernte redundante Launcher:
- ~~`universal_launcher.py`~~ - Entfernt
- ~~`launcher_ipv6_dslite.py`~~ - Entfernt  
- ~~`safe_launcher_ssl.py`~~ - Entfernt
- ~~`smart_launcher_dual.py`~~ - Entfernt
- ~~`local_launcher_http.py`~~ - Entfernt
- ~~`working_launcher_ssl.py`~~ - Entfernt
- ~~`production_launcher.py`~~ - Entfernt (redundant zu launcher.py)

## 🚀 Server-Modi

### 1. Produktivserver (Empfohlen)
```bash
# Mit automatischer Gunicorn-Erkennung:
python launcher.py

# Windows:
start_hochzeitsplaner.bat
```

**Vorteile:**
- ✅ Echte Multi-Worker-Unterstützung
- ✅ Bessere Performance unter Last
- ✅ Automatisches Worker-Management
- ✅ Produktionstaugliche Sicherheit

### 2. Development Server (Fallback)
Falls Gunicorn nicht verfügbar ist, wird automatisch Flask Development Server verwendet.

## ⚙️ Konfiguration

### `launcher_config.json`:
```json
{
  "data_directory": "./data",
  "port": 8443,
  "hosts": ["0.0.0.0", "::"],
  "ssl_enabled": true,
  "auto_open_browser": true,
  "production_server": true,
  "workers": 4,
  "timeout": 120,
  "domain": "pascalundkäthe-heiraten.de"
}
```

**Hinweis**: Diese Datei liegt extern neben der .exe und kann angepasst werden.

### Wichtige Parameter:
- **`production_server: true`** - Aktiviert Gunicorn falls verfügbar
- **`workers: 4`** - Anzahl Worker-Prozesse
- **`host: "0.0.0.0"`** - Lauscht auf allen Interfaces (IPv4+IPv6)
- **`timeout: 120`** - Request-Timeout in Sekunden

## 📦 Dependencies

### Basis (requirements.txt):
- `Flask==3.0.0` - Web-Framework
- `Flask-CORS==4.0.0` - CORS-Support
- `pandas==2.1.4` - Datenverarbeitung
- `openpyxl==3.1.2` - Excel-Export
- `gunicorn==21.2.0` - **Produktivserver**
- `gevent==23.9.1` - **Async Worker**

### Installation:
```bash
pip install -r requirements.txt
```

## 🌐 Netzwerk-Konfiguration

### Dual-Stack Support:
- ✅ **IPv4**: `0.0.0.0:8080` (alle Interfaces)
- ✅ **IPv6**: Automatisch über Dual-Stack-Binding
- ✅ **DS-Lite**: Funktioniert mit aktueller Konfiguration

### Firewall-Regeln (Windows):
```cmd
netsh advfirewall firewall add rule name="Hochzeitsplaner HTTP" dir=in action=allow protocol=TCP localport=8080
netsh advfirewall firewall add rule name="Hochzeitsplaner HTTPS" dir=in action=allow protocol=TCP localport=8443
```

## 🔒 SSL/HTTPS (Optional)

### Aktivierung in `launcher_config.json`:
```json
{
  "ssl_enabled": true,
  "port": 8443
}
```

### Zertifikate:
- `ssl_certificate.crt` - SSL-Zertifikat
- `ssl_private_key.key` - Privater Schlüssel

## 📧 E-Mail Integration

### Konfiguration in `auth_config.json`:
```json
{
  "email": {
    "enabled": true,
    "smtp_server": "smtp.ionos.de",
    "smtp_port": 587,
    "use_tls": true,
    "username": "ihre-email@domain.de",
    "password": "ihr-passwort",
    "from_email": "ihre-email@domain.de",
    "from_name": "Hochzeitsplaner",
    "reply_to": "ihre-email@domain.de",
    "default_subject_prefix": "[Hochzeit] "
  }
}
```

### E-Mail-Funktionen:
- **Einladungen versenden**: Automatische Hochzeitseinladungen
- **Erinnerungen**: RSVP-Erinnerungen und Updates
- **Benachrichtigungen**: Status-Updates für Gäste
- **API-Endpunkte**: `/api/email/*` für Integration

### E-Mail-Tests:
```bash
# E-Mail-Status prüfen:
curl -X GET https://localhost:8443/api/email/status

# SMTP-Verbindung testen:
curl -X GET https://localhost:8443/api/email/test
```

## 🎯 Performance-Optimierung

### Gunicorn-Konfiguration (`gunicorn.conf.py`):
- **Worker**: CPU-Cores × 2 + 1
- **Worker-Klasse**: `gevent` (async)
- **Connections**: 1000 pro Worker
- **Timeout**: 120 Sekunden
- **Keep-Alive**: 5 Sekunden

### Monitoring:
- Access-Logs werden in Console ausgegeben
- Worker-Status wird angezeigt
- Automatisches Worker-Restart bei Fehlern

## 🛠️ Troubleshooting

### Gunicorn nicht verfügbar:
```bash
pip install gunicorn gevent
```

### Port bereits belegt:
Ändern Sie `port` in `launcher_config.json`

### IPv6-Probleme:
Host-Konfiguration ist bereits optimiert für Dual-Stack

## 🧪 Netzwerk-Tests (31.07.2025)

### ✅ Lokale Erreichbarkeit (HTTPS mit SSL):
```bash
# IPv4 im Heimnetz (HTTP):
curl -v http://192.168.178.96:8080
# ✅ Status: HTTP 302 → /login (Fallback funktioniert)

# IPv6 im Heimnetz (HTTP):
curl -v -g "http://[fda0:ed32:2078:0:a542:68:f5ff:9a81]:8080"
# ✅ Status: HTTP 302 → /login (Dual-Stack funktioniert)

# Domain im Heimnetz (HTTPS):
curl -v -k https://xn--pascalundkthe-heiraten-94n.de:8443
# 🔄 Nach Router-Rebind-Konfiguration verfügbar
```

### ❌ Externe Erreichbarkeit (Router-Konfiguration nötig):
```bash
# IPv6 über IONOS AAAA-Record (HTTPS):
curl -v -g "https://[2a02:908:1000:2:0:0:0:126c]:8443"
# ❌ Status: Connection refused (Port 8443 nicht freigegeben)

# Domain extern (HTTPS):
curl -v https://xn--pascalundkthe-heiraten-94n.de
# ❌ Status: NXDOMAIN (DNS noch nicht propagiert)
```

### 🔧 Benötigte Router-Konfiguration:
1. **DNS-Rebind-Schutz**: Für `xn--pascalundkthe-heiraten-94n.de` deaktivieren
2. **IPv6-Portfreigabe**: Port 8443 (HTTPS) → `2a02:908:1000:2::126c`
3. **IPv4-Portfreigabe**: Port 8443 (HTTPS) → `192.168.178.96` (optional)
4. **Firewall**: Port 8443 für HTTPS freigeben
5. **Test-Befehl**: `python3 test_connectivity.py`

### 📋 Status:
- 🟢 **Server**: HTTPS aktiviert (Port 8443)
- 🟢 **SSL-Zertifikat**: Vorhanden und gültig
- 🟢 **IPv4/IPv6**: Dual-Stack lokal funktioniert
- 🔄 **Domain lokal**: Nach Rebind-Deaktivierung verfügbar
- 🔴 **Extern**: Router-Portfreigabe fehlt
- 🔴 **Domain**: DNS-Propagation ausstehend

## 🔄 Migration von alten Launchern

Alle Funktionen der entfernten Launcher sind im neuen `launcher.py` integriert:
- ✅ IPv6/IPv4 Dual-Stack
- ✅ SSL-Support
- ✅ Automatische Port-Erkennung
- ✅ Browser-Auto-Start
- ✅ Produktivserver-Modus

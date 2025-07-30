# Fritz!Box Portweiterleitung für Hochzeitsplaner

## Übersicht der Lösung

Der Hochzeitsplaner läuft jetzt in einem intelligenten **Dual-Mode**:
- **HTTP (Port 8080)**: Für lokales Netzwerk - schnell und ohne SSL-Probleme
- **HTTPS (Port 8443)**: Für externen Zugriff über Fritz!Box mit SSL-Zertifikaten

## 1. Fritz!Box Portweiterleitung einrichten

### Zugriff auf Fritz!Box
1. Öffnen Sie einen Browser
2. Gehen Sie zu: `http://fritz.box` oder `http://192.168.178.1`
3. Melden Sie sich mit Admin-Passwort an

### HTTP-Portweiterleitung (für lokalen Zugriff)
1. **Internet** → **Freigaben** → **Portfreigaben**
2. **Neue Portfreigabe** klicken
3. Konfiguration:
   - **Gerät**: Hochzeitsplaner-PC (192.168.178.96)
   - **Anwendung**: `Hochzeitsplaner-HTTP`
   - **Protokoll**: `TCP`
   - **Port extern**: `80`
   - **Port intern**: `8080`
   - **Computer**: `192.168.178.96`

### HTTPS-Portweiterleitung (für externen Zugriff)
1. **Neue Portfreigabe** klicken
2. Konfiguration:
   - **Gerät**: Hochzeitsplaner-PC (192.168.178.96)
   - **Anwendung**: `Hochzeitsplaner-HTTPS`
   - **Protokoll**: `TCP`
   - **Port extern**: `443`
   - **Port intern**: `8443`
   - **Computer**: `192.168.178.96`

## 2. Domain-Konfiguration

### Ionos Domain-Einstellungen
Ihre Domain `pascalundkäthe-heiraten.de` sollte bereits auf Ihre Fritz!Box-IP zeigen.

### Lokale Domain-Auflösung (Optional)
Für lokalen Zugriff über `hochzeitsplaner.de`:

**Windows (als Administrator):**
```cmd
echo 192.168.178.96  hochzeitsplaner.de >> C:\Windows\System32\drivers\etc\hosts
echo 192.168.178.96  www.hochzeitsplaner.de >> C:\Windows\System32\drivers\etc\hosts
```

**macOS/Linux:**
```bash
sudo sh -c 'echo "192.168.178.96  hochzeitsplaner.de" >> /etc/hosts'
sudo sh -c 'echo "192.168.178.96  www.hochzeitsplaner.de" >> /etc/hosts'
```

## 3. Verwendung der verschiedenen Launcher

### Für tägliche lokale Nutzung (empfohlen)
```cmd
start_lokal.bat
```
- **Nur HTTP** auf Port 8080
- **Keine SSL-Probleme**
- **Schnell und einfach**
- URLs: `http://localhost:8080`, `http://192.168.178.96:8080`

### Für Fritz!Box + lokale Nutzung (komplett)
```cmd
start_dual.bat
```
- **HTTP** auf Port 8080 (lokal)
- **HTTPS** auf Port 8443 (extern)
- **SSL-Zertifikate** erforderlich
- URLs: 
  - Lokal: `http://192.168.178.96:8080`
  - Extern: `https://pascalundkäthe-heiraten.de`

### Für nur HTTPS (falls gewünscht)
```cmd
python working_launcher_ssl.py
```
- **Nur HTTPS** auf Port 8443
- **SSL-Zertifikate** erforderlich

## 4. Zugriff-URLs nach Konfiguration

### Lokal im Netzwerk
- `http://192.168.178.96:8080` (HTTP - empfohlen für lokal)
- `http://hochzeitsplaner.de:8080` (falls hosts konfiguriert)
- `https://192.168.178.96:8443` (HTTPS - falls Dual-Mode)

### Von außen über Internet
- `https://pascalundkäthe-heiraten.de` (Port 443 → 8443)
- `http://pascalundkäthe-heiraten.de` (Port 80 → 8080)

## 5. Fehlerbehebung

### "Verbindung wurde zurückgesetzt" (ERR_CONNECTION_RESET)
- **Problem**: SSL-Zertifikat-Mismatch oder Port-Probleme
- **Lösung**: Verwenden Sie `start_lokal.bat` für lokalen HTTP-Zugriff

### Port bereits belegt
- **Problem**: Andere Anwendung verwendet Port 8080 oder 8443
- **Lösung**: Beenden Sie andere Anwendungen oder verwenden Sie andere Ports

### Fritz!Box Portweiterleitung funktioniert nicht
- **Prüfen**: Fritz!Box-Einstellungen unter **Internet** → **Freigaben**
- **Prüfen**: Firewall-Einstellungen des PCs
- **Test**: Von außen mit Handy-Internet testen

### SSL-Zertifikat-Probleme
- **Lösung**: Verwenden Sie `start_lokal.bat` für HTTP-Modus
- **Oder**: Überprüfen Sie ssl_certificate.crt und ssl_private_key.key

## 6. Wartung

### SSL-Zertifikate aktualisieren
1. Neue Zertifikate von Ionos herunterladen
2. Ersetzen Sie `ssl_certificate.crt` und `ssl_private_key.key`
3. Starten Sie den Server neu

### Fritz!Box-IP geändert
1. Aktualisieren Sie Ionos Domain-Einstellungen
2. Aktualisieren Sie lokale hosts-Datei (falls verwendet)

## 7. Empfohlene Konfiguration

**Für die meiste Zeit**: Verwenden Sie `start_lokal.bat`
- Schnell, einfach, keine SSL-Probleme
- Perfekt für lokale Nutzung im Netzwerk

**Für externen Zugriff**: Verwenden Sie `start_dual.bat`
- Beide Modi gleichzeitig
- HTTP lokal + HTTPS extern
- Optimale Fritz!Box-Integration

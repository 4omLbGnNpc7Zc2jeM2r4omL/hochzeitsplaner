# Hochzeitsplaner - Start-Anleitung

## 🚀 Schnellstart (Empfohlen)

### ⭐ Universeller Launcher (Beste Lösung)
```bash
# Doppelklick auf:
start_universal.bat
```
- ✅ **Automatische Erkennung** - DS-Lite, Fritz!Box, Standard-Netzwerk
- ✅ **HTTP lokal + HTTPS extern** - Beste Kombination
- ✅ **Alle lokalen URLs** - localhost, IP, hochzeitsplaner.de:8080
- ✅ **Externe URLs** - https://pascalundkäthe-heiraten.de:8443
- 🌐 Zugriff: `http://localhost:8080`, `http://hochzeitsplaner.de:8080`

### Für nur lokale Nutzung im Netzwerk
```bash
# Doppelklick auf:
start_lokal.bat
```
- ✅ **HTTP-Modus** - Keine SSL-Probleme
- ✅ **Schnell und einfach**
- ✅ **Port 8080** - Standard HTTP
- 🌐 Zugriff: `http://localhost:8080`

### 🌐 Für Vodafone DS-Lite (Dual Stack Lite)
```bash
# Doppelklick auf:
start_dslite.bat
```
- ✅ **IPv6-optimiert** - Direkte externe Verbindungen
- ✅ **HTTP lokal + HTTPS extern**
- ✅ **Keine Fritz!Box Portweiterleitung nötig**
- 🌐 Extern: `https://[IPv6]:8443`

## 📋 Alle verfügbaren Launcher

### ⭐ 1. Universeller Launcher (EMPFOHLEN)
**Datei**: `universal_launcher.py` oder `start_universal.bat`
- 🎯 **Automatische Erkennung** aller Netzwerk-Szenarien
- 🏠 **HTTP für lokal** (localhost, IP, hochzeitsplaner.de:8080)
- 🌍 **HTTPS für extern** (automatisch DS-Lite oder Fritz!Box)
- ✅ **Funktioniert überall** - .exe wird diese Version verwenden
- 📱 URLs: 
  - Lokal: `http://localhost:8080`, `http://hochzeitsplaner.de:8080`
  - Extern: `https://pascalundkäthe-heiraten.de:8443`

### 2. Lokaler HTTP-Launcher (Nur lokal)
**Datei**: `local_launcher_http.py` oder `start_lokal.bat`
- 🏠 **Nur für lokales Netzwerk**
- ⚡ **Keine SSL-Zertifikate benötigt**
- 🚫 **Keine Verbindungsprobleme**
- 📱 URLs: `http://localhost:8080`, `http://192.168.178.96:8080`

### 3. DS-Lite IPv6-Launcher (Vodafone DS-Lite)
**Datei**: `launcher_ipv6_dslite.py` oder `start_dslite.bat`
- 🌐 **IPv6-optimiert für DS-Lite**
- 🏠 **HTTP für lokal** (Port 8080)
- 🌍 **HTTPS für extern** (Port 8443, direkt über IPv6)
- 🚫 **Keine Fritz!Box Portweiterleitung nötig**
- 📱 URLs: 
  - Lokal: `http://192.168.178.96:8080`
  - Extern: `https://[IPv6-Adresse]:8443`

### 4. Smart Dual-Mode Launcher (Fritz!Box Setup mit IPv4)
**Datei**: `smart_launcher_dual.py` oder `start_dual.bat`
- 🏠 **HTTP für lokal** (Port 8080)
- 🌍 **HTTPS für extern** (Port 8443)
- 🔒 **SSL-Zertifikate für externen Zugriff**
- ⚠️ **Benötigt IPv4 Portweiterleitung** (funktioniert NICHT mit DS-Lite)
- 📱 URLs: 
  - Lokal: `http://192.168.178.96:8080`
  - Extern: `https://pascalundkäthe-heiraten.de`

### 5. Reiner HTTPS-Launcher (Legacy)
**Datei**: `working_launcher_ssl.py`
- 🔒 **Nur HTTPS** (Port 8443)
- ⚠️ **Kann SSL-Probleme im lokalen Netzwerk verursachen**
- 🌍 **Für externen Zugriff optimiert**

### 6. Sicherer SSL-Launcher (Windows .exe)
**Datei**: `safe_launcher_ssl.py`
- 🔒 **HTTPS ohne Threading** (Bluescreen-Fix)
- 🖥️ **Für Windows .exe Builds**
- ⚠️ **Kann lokale Verbindungsprobleme haben**

## ❌ Problem gelöst: "ERR_CONNECTION_RESET"

**Das Problem**: SSL-Zertifikate verursachten Verbindungsprobleme im lokalen Netzwerk.

**Die Lösung**: 
1. **Lokaler HTTP-Modus** für tägliche Nutzung (keine SSL-Probleme)
2. **Dual-Mode** für Fritz!Box Setup (HTTP lokal + HTTPS extern)
3. **Intelligente Port-Trennung** (8080 HTTP, 8443 HTTPS)

## 🔧 Fritz!Box Konfiguration

Für externen Zugriff siehe: **`FRITZ_BOX_ANLEITUNG.md`**

### Portweiterleitung einrichten:
- **HTTP**: Extern 80 → Intern 8080 (192.168.178.96)
- **HTTPS**: Extern 443 → Intern 8443 (192.168.178.96)

## 📁 Dateiübersicht

| Datei | Zweck | SSL | Empfehlung | DS-Lite |
|-------|-------|-----|------------|---------|
| `universal_launcher.py` | Automatisch alles | ✅ | ⭐ BESTE LÖSUNG | ✅ |
| `local_launcher_http.py` | Lokaler HTTP-Server | ❌ | 🏠 Nur lokal | ✅ |
| `launcher_ipv6_dslite.py` | IPv6-optimiert für DS-Lite | ✅ | 🌐 DS-Lite | ✅ |
| `smart_launcher_dual.py` | HTTP + HTTPS parallel | ✅ | 🌍 IPv4 Fritz!Box | ❌ |
| `working_launcher_ssl.py` | Nur HTTPS | ✅ | ⚠️ Legacy | ❌ |
| `safe_launcher_ssl.py` | Bluescreen-sicher | ✅ | 🖥️ Windows .exe | ❌ |
| `start_universal.bat` | Universal-Start-Script | ✅ | ⭐ EMPFOHLEN | ✅ |
| `start_lokal.bat` | HTTP-Start-Script | ❌ | 🏠 Nur lokal | ✅ |
| `start_dslite.bat` | DS-Lite IPv6-Start | ✅ | 🌐 DS-Lite | ✅ |
| `start_dual.bat` | Dual-Mode-Start | ✅ | 🌍 IPv4 Fritz!Box | ❌ |

## 🎯 Empfohlene Nutzung

### ⭐ Für alle Szenarien (EMPFOHLEN):
```bash
start_universal.bat
```
- Automatische Netzwerk-Erkennung
- HTTP lokal + HTTPS extern
- Alle URLs funktionieren
- Perfekt für .exe-Distribution

### Für normale tägliche Nutzung:
```bash
start_lokal.bat
```
- Keine SSL-Probleme
- Schnelle Verbindung
- Einfache Konfiguration

### 🌐 Für Vodafone DS-Lite (Dual Stack Lite):
```bash
start_dslite.bat
```
- IPv6-optimiert für DS-Lite
- HTTP für lokale Nutzung
- HTTPS für externen IPv6-Zugriff
- Keine Fritz!Box Portweiterleitung nötig

### Für Fritz!Box + externen Zugriff (nur mit echter IPv4):
```bash
start_dual.bat
```
- HTTP für lokale Nutzung
- HTTPS für externen Zugriff
- Optimale Netzwerk-Integration
- ⚠️ **Funktioniert NICHT mit DS-Lite**

## 🔐 Login-Daten

**Standard-Login:**
- **Benutzername**: `admin`
- **Passwort**: `hochzeit2025`

## 🆘 Fehlerbehebung

### Problem: "Verbindung wurde zurückgesetzt"
**Lösung**: Verwenden Sie `start_lokal.bat` (HTTP-Modus)

### Problem: Port bereits belegt
**Lösung**: Andere Anwendungen beenden oder Port ändern

### Problem: SSL-Zertifikat-Fehler
**Lösung**: HTTP-Modus verwenden oder Zertifikate prüfen

### Problem: Kann nicht von außen zugreifen
**Lösung**: Fritz!Box Portweiterleitung konfigurieren (siehe `FRITZ_BOX_ANLEITUNG.md`)

## 📝 Logs und Debugging

Alle Launcher zeigen Live-Logs im Terminal an. Bei Problemen:
1. Terminal-Ausgabe prüfen
2. Browser-Entwicklertools öffnen (F12)
3. Netzwerk-Tab auf Fehler prüfen

# Hochzeitsplaner - Start-Anleitung

## 🚀 Schnellstart (Empfohlen)

### Für lokale Nutzung im Netzwerk
```bash
# Doppelklick auf:
start_lokal.bat
```
- ✅ **HTTP-Modus** - Keine SSL-Probleme
- ✅ **Schnell und einfach**
- ✅ **Port 8080** - Standard HTTP
- 🌐 Zugriff: `http://localhost:8080`

## 📋 Alle verfügbaren Launcher

### 1. Lokaler HTTP-Launcher (Täglich empfohlen)
**Datei**: `local_launcher_http.py` oder `start_lokal.bat`
- 🏠 **Nur für lokales Netzwerk**
- ⚡ **Keine SSL-Zertifikate benötigt**
- 🚫 **Keine Verbindungsprobleme**
- 📱 URLs: `http://localhost:8080`, `http://192.168.178.96:8080`

### 2. Smart Dual-Mode Launcher (Fritz!Box Setup)
**Datei**: `smart_launcher_dual.py` oder `start_dual.bat`
- 🏠 **HTTP für lokal** (Port 8080)
- 🌍 **HTTPS für extern** (Port 8443)
- 🔒 **SSL-Zertifikate für externen Zugriff**
- 📱 URLs: 
  - Lokal: `http://192.168.178.96:8080`
  - Extern: `https://pascalundkäthe-heiraten.de`

### 3. Reiner HTTPS-Launcher (Legacy)
**Datei**: `working_launcher_ssl.py`
- 🔒 **Nur HTTPS** (Port 8443)
- ⚠️ **Kann SSL-Probleme im lokalen Netzwerk verursachen**
- 🌍 **Für externen Zugriff optimiert**

### 4. Sicherer SSL-Launcher (Windows .exe)
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

| Datei | Zweck | SSL | Empfehlung |
|-------|-------|-----|------------|
| `local_launcher_http.py` | Lokaler HTTP-Server | ❌ | ⭐ Täglich |
| `smart_launcher_dual.py` | HTTP + HTTPS parallel | ✅ | 🌍 Fritz!Box |
| `working_launcher_ssl.py` | Nur HTTPS | ✅ | ⚠️ Legacy |
| `safe_launcher_ssl.py` | Bluescreen-sicher | ✅ | 🖥️ Windows .exe |
| `start_lokal.bat` | HTTP-Start-Script | ❌ | ⭐ Windows |
| `start_dual.bat` | Dual-Mode-Start | ✅ | 🌍 Fritz!Box |

## 🎯 Empfohlene Nutzung

### Für normale tägliche Nutzung:
```bash
start_lokal.bat
```
- Keine SSL-Probleme
- Schnelle Verbindung
- Einfache Konfiguration

### Für Fritz!Box + externen Zugriff:
```bash
start_dual.bat
```
- HTTP für lokale Nutzung
- HTTPS für externen Zugriff
- Optimale Netzwerk-Integration

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

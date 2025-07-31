# 🔧 Windows Server Anleitung: Hochzeitsplaner über DS-Lite mit IPv6 erreichbar machen

## ✅ Flask-Konfiguration bereits korrekt!

Dein Hochzeitsplaner ist bereits optimal konfiguriert:
```python
app.run(
    host='0.0.0.0',    # ✅ Lauscht auf allen Interfaces (IPv4 + IPv6)
    port=port,         # ✅ Dynamischer Port (Standard: 8081)
    debug=False,
    threaded=True
)
```

---

## 🛠️ Schritt 1: IPv6-Status prüfen

### Windows-Commands:
```cmd
# IPv6-Konfiguration anzeigen
ipconfig /all

# IPv6-Adresse testen (PowerShell)
powershell -Command "Invoke-RestMethod -Uri 'https://api6.ipify.org'"

# IPv6-Konnektivität testen
ping -6 google.com

# Lokale IPv6-Adressen anzeigen
powershell -Command "Get-NetIPAddress -AddressFamily IPv6 | Where-Object {$_.IPAddress -notlike 'fe80*' -and $_.IPAddress -notlike '::1'}"
```

---

## 🔥 Schritt 2: Windows Firewall konfigurieren

### PowerShell als Administrator:
```cmd
# Eingehende Regel für Flask-Port hinzufügen
netsh advfirewall firewall add rule name="Hochzeitsplaner IPv6" dir=in action=allow protocol=TCP localport=8081

# Ausgehende Regel hinzufügen
netsh advfirewall firewall add rule name="Hochzeitsplaner IPv6 Out" dir=out action=allow protocol=TCP localport=8081

# Firewall-Regeln überprüfen
netsh advfirewall firewall show rule name="Hochzeitsplaner IPv6"
```

---

## 🌐 Schritt 3: Router-Konfiguration (FRITZ!Box)

### Im Browser: `http://fritz.box`
1. **Internet → Freigaben → Portfreigaben**
2. **Neue Freigabe erstellen:**
   - **Gerät:** Dein Windows Server auswählen
   - **Anwendung:** Andere Anwendung
   - **Protokoll:** TCP
   - **Port:** 8081 (oder dein Flask-Port)
   - **IPv6:** ✅ **Aktivieren**
3. **Speichern**

---

## 📡 Schritt 4: IONOS DynDNS für IPv6 erweitern

### Option A: Batch-Datei (einfach)
**Datei erstellen:** `ionos_ipv6_update.bat`
```batch
@echo off
REM IPv6-Adresse abrufen (Windows-kompatibel)
for /f "tokens=*" %%i in ('powershell -Command "try { Invoke-RestMethod -Uri https://api6.ipify.org -TimeoutSec 10 } catch { echo 'NONE' }"') do set IPV6=%%i

REM Prüfen ob IPv6 verfügbar
if "%IPV6%"=="NONE" (
    echo Keine IPv6-Adresse verfügbar
    exit /b 1
)

echo Gefundene IPv6-Adresse: %IPV6%

REM IONOS API-Variablen setzen
set ZONE_ID=deine-zone-id
set RECORD_ID=deine-aaaa-record-id
set API_TOKEN=dein-api-token

REM IONOS API-Call für IPv6
curl.exe -X PATCH "https://api.hosting.ionos.com/dns/v1/zones/%ZONE_ID%/records/%RECORD_ID%" ^
  -H "Authorization: Bearer %API_TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"content\": \"%IPV6%\", \"type\": \"AAAA\"}"

echo IPv6 DynDNS Update completed: %IPV6%
pause
```

### Option B: PowerShell-Script (empfohlen)
**Datei erstellen:** `ionos_ipv6_update.ps1`
```powershell
# IPv6-Adresse abrufen
try {
    $IPv6 = Invoke-RestMethod -Uri "https://api6.ipify.org" -TimeoutSec 10
    Write-Host "Gefundene IPv6-Adresse: $IPv6"
} catch {
    Write-Host "Fehler beim Abrufen der IPv6-Adresse: $_"
    exit 1
}

# IONOS API-Konfiguration
$ZONE_ID = "deine-zone-id"
$RECORD_ID = "deine-aaaa-record-id"
$API_TOKEN = "dein-api-token"

# API-Headers
$headers = @{
    "Authorization" = "Bearer $API_TOKEN"
    "Content-Type" = "application/json"
}

# Update-Body
$body = @{
    content = $IPv6
    type = "AAAA"
} | ConvertTo-Json

# IONOS API-Call
try {
    $response = Invoke-RestMethod -Uri "https://api.hosting.ionos.com/dns/v1/zones/$ZONE_ID/records/$RECORD_ID" -Method PATCH -Headers $headers -Body $body
    Write-Host "✅ IPv6 DynDNS Update erfolgreich: $IPv6"
} catch {
    Write-Host "❌ Fehler beim DynDNS Update: $_"
}
```

### Option C: Kombinierte Lösung (IPv4 + IPv6)
**Datei erstellen:** `update_dyndns_complete.bat`
```batch
@echo off
echo 🔄 Aktualisiere DynDNS für IPv4 und IPv6...

REM IPv4-Adresse abrufen
for /f "tokens=*" %%i in ('powershell -Command "Invoke-RestMethod -Uri https://api.ipify.org"') do set IPV4=%%i
echo IPv4: %IPV4%

REM IPv6-Adresse abrufen
for /f "tokens=*" %%i in ('powershell -Command "try { Invoke-RestMethod -Uri https://api6.ipify.org } catch { echo 'NONE' }"') do set IPV6=%%i
echo IPv6: %IPV6%

REM API-Konfiguration
set ZONE_ID=deine-zone-id
set API_TOKEN=dein-api-token
set A_RECORD_ID=deine-a-record-id
set AAAA_RECORD_ID=deine-aaaa-record-id

REM IPv4 Update (A-Record)
if not "%IPV4%"=="" (
    curl.exe -X PATCH "https://api.hosting.ionos.com/dns/v1/zones/%ZONE_ID%/records/%A_RECORD_ID%" ^
      -H "Authorization: Bearer %API_TOKEN%" ^
      -H "Content-Type: application/json" ^
      -d "{\"content\": \"%IPV4%\", \"type\": \"A\"}"
    echo ✅ IPv4 Update abgeschlossen
)

REM IPv6 Update (AAAA-Record)
if not "%IPV6%"=="NONE" if not "%IPV6%"=="" (
    curl.exe -X PATCH "https://api.hosting.ionos.com/dns/v1/zones/%ZONE_ID%/records/%AAAA_RECORD_ID%" ^
      -H "Authorization: Bearer %API_TOKEN%" ^
      -H "Content-Type: application/json" ^
      -d "{\"content\": \"%IPV6%\", \"type\": \"AAAA\"}"
    echo ✅ IPv6 Update abgeschlossen
) else (
    echo ⚠️ Kein IPv6 verfügbar, überspringe AAAA-Record Update
)

echo 🎉 DynDNS Update abgeschlossen
pause
```

---

## 🔧 Schritt 5: Automatischer Start als Windows Service

### Option A: Geplante Aufgabe (einfach)
```cmd
# Als Administrator ausführen:
schtasks /create /tn "Hochzeitsplaner" /tr "C:\Pfad\zu\deiner\App\Hochzeitsplaner.exe" /sc onstart /ru SYSTEM

# DynDNS alle 15 Minuten
schtasks /create /tn "DynDNS Update" /tr "C:\Pfad\zu\update_dyndns_complete.bat" /sc minute /mo 15 /ru SYSTEM
```

### Option B: Python Service
**Datei erstellen:** `hochzeitsplaner_service.py`
```python
import win32serviceutil
import win32service
import win32event
import subprocess
import os

class HochzeitsplanerService(win32serviceutil.ServiceFramework):
    _svc_name_ = "HochzeitsplanerFlask"
    _svc_display_name_ = "Hochzeitsplaner Flask App"
    
    def __init__(self, args):
        win32serviceutil.ServiceFramework.__init__(self, args)
        self.hWaitStop = win32event.CreateEvent(None, 0, 0, None)
        
    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self.hWaitStop)
        
    def SvcDoRun(self):
        os.chdir(r'C:\Pfad\zu\deiner\App')
        subprocess.call(['python', 'app.py'])

if __name__ == '__main__':
    win32serviceutil.HandleCommandLine(HochzeitsplanerService)
```

**Service installieren:**
```cmd
# Service installieren
python hochzeitsplaner_service.py install

# Service starten
python hochzeitsplaner_service.py start
```

### Option C: PowerShell Autostart
```powershell
# Als Administrator in PowerShell:
$Action = New-ScheduledTaskAction -Execute "C:\Pfad\zu\deiner\App\Hochzeitsplaner.exe"
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName "HochzeitsplanerFlask" -Action $Action -Trigger $Trigger -Settings $Settings -User "SYSTEM"
```

---

## 🧪 Schritt 6: Test-Befehle

### Lokale Tests:
```cmd
# Lokaler IPv4-Test
curl http://localhost:8081

# Lokaler IPv6-Test
powershell -Command "Invoke-WebRequest -Uri 'http://[::1]:8081' -UseBasicParsing"

# Port-Test
powershell -Command "Test-NetConnection -ComputerName localhost -Port 8081"
```

### Externe Tests (nach DynDNS-Update):
```cmd
# IPv4-Test
curl http://deine-domain.de:8081

# IPv6-Test
powershell -Command "Invoke-WebRequest -Uri 'http://[deine-ipv6-adresse]:8081' -UseBasicParsing"

# Port-Test extern
powershell -Command "Test-NetConnection -ComputerName deine-domain.de -Port 8081"
```

---

## 🚀 Schritt 7: Backup-Lösungen (falls IPv6 nicht funktioniert)

### LocalTunnel (kostenlos):
```cmd
# Node.js installieren, dann:
npm install -g localtunnel
lt --port 8081 --subdomain meine-hochzeit
```

### Serveo SSH-Tunnel (kostenlos):
```cmd
# Mit OpenSSH für Windows:
ssh -R 80:localhost:8081 serveo.net
```

### ngrok (kostenlos mit Limits):
```cmd
# ngrok herunterladen, dann:
ngrok http 8081
```

---

## 📋 Checkliste: Schritt für Schritt

- [ ] **IPv6-Status prüfen** → Schritt 1
- [ ] **Windows Firewall konfigurieren** → Schritt 2  
- [ ] **FRITZ!Box IPv6-Portweiterleitung** → Schritt 3
- [ ] **IONOS DynDNS für IPv6 einrichten** → Schritt 4
- [ ] **Automatischen Start konfigurieren** → Schritt 5
- [ ] **Tests durchführen** → Schritt 6
- [ ] **Backup-Lösung als Fallback** → Schritt 7

---

## 🎯 Wichtige Hinweise

### ✅ **Was bereits funktioniert:**
- Dein Flask-Server ist perfekt konfiguriert mit `host='0.0.0.0'`
- Unterstützt bereits IPv4 und IPv6
- Port wird automatisch ermittelt (Standard: 8081)

### ⚠️ **Was zu beachten ist:**
- **IONOS API-Daten:** Zone-ID, Record-IDs und API-Token aus deinem IONOS-Account holen
- **Router-Zugang:** FRITZ!Box-Konfiguration erfordert Admin-Zugang
- **Windows-Admin:** Firewall und Service-Installation benötigen Administrator-Rechte

### 🔧 **Troubleshooting:**
- **IPv6 nicht verfügbar:** Backup-Lösung (LocalTunnel/Serveo) verwenden
- **Firewall-Probleme:** Windows Defender und Router-Firewall prüfen
- **Port-Konflikte:** Flask wählt automatisch freien Port (ab 8081)

---

## 📞 Quick-Start Zusammenfassung

1. **Firewall öffnen:** `netsh advfirewall firewall add rule name="Hochzeitsplaner IPv6" dir=in action=allow protocol=TCP localport=8081`
2. **Router konfigurieren:** IPv6-Portweiterleitung für Port 8081
3. **DynDNS erweitern:** IPv6-Adresse in IONOS AAAA-Record
4. **Testen:** `powershell -Command "Test-NetConnection -ComputerName deine-domain.de -Port 8081"`

**🎉 Fertig! Dein Hochzeitsplaner ist jetzt über IPv6 aus dem Internet erreichbar!**

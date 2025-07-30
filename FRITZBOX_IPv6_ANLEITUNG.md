# Fritz!Box IPv6 Portweiterleitung für Hochzeitsplaner

## 🏠 Fritz!Box Konfiguration für externen Zugriff

### ⚠️ **Wichtig:** Nur HTTPS (Port 8443) möglich

Da Sie nur **Port 8443 für IPv6** in der Fritz!Box weiterleiten können, ist externer Zugriff **nur über HTTPS** möglich.

### 📋 **Fritz!Box Einstellungen:**

#### 1. **IPv6-Portfreigabe aktivieren:**
```
Fritz!Box → Internet → Freigaben → Portfreigaben
→ "IPv6-Portfreigaben" aktivieren
→ Neue Portfreigabe hinzufügen
```

#### 2. **Port 8443 für Hochzeitsplaner freigeben:**
```
Protokoll: TCP
Port: 8443
An Computer: [Ihr Computer/Server]
An IPv6-Adresse: [Automatisch oder manuell]
```

#### 3. **DynDNS für IPv6 konfigurieren:**
```
Fritz!Box → Internet → Freigaben → DynDNS
→ DynDNS-Anbieter: Ionos (falls verfügbar)
→ Domain: pascalundkäthe-heiraten.de
→ Benutzername/Update-URL: [Aus Ionos-Konfiguration]
```

### 🌐 **Zugriff-URLs:**

#### **Lokal (HTTP - nur im eigenen Netzwerk):**
- `http://localhost:8080`
- `http://192.168.x.x:8080` (lokale IP)
- `http://hochzeitsplaner.de:8080`

#### **Extern (HTTPS - über Internet):**
- `https://pascalundkäthe-heiraten.de:8443`
- `https://[IPv6-Adresse]:8443` (direkt)

### 🔧 **Automatische Konfiguration:**

Der **Universal Launcher** erkennt automatisch:
- ✅ **HTTP** für lokales Netzwerk (Port 8080)
- ✅ **HTTPS** für externes Netzwerk (Port 8443)
- ✅ **DynDNS** Updates für IPv6-only
- ✅ **Dual-Mode** Server für beide Protokolle

### 📱 **Für Gäste:**

Senden Sie Ihren Gästen diese URL:
```
https://pascalundkäthe-heiraten.de:8443
```

**Hinweis:** Gäste müssen den **Port 8443** in der URL angeben, da Fritz!Box keine automatische Umleitung von Port 443 auf 8443 macht.

### ⚡ **Vorteile:**

1. **Sicher:** Nur HTTPS für externen Zugriff
2. **Automatisch:** DynDNS-Updates alle 30 Minuten
3. **Flexibel:** HTTP lokal, HTTPS extern
4. **Einfach:** Keine komplizierte IPv4-Portweiterleitung nötig

### 🔍 **Troubleshooting:**

#### Problem: "Seite nicht erreichbar"
- Fritz!Box IPv6-Portfreigabe prüfen
- DynDNS-Update kontrollieren
- Firewall-Einstellungen prüfen

#### Problem: "Unsichere Verbindung"
- SSL-Zertifikat bestätigen (selbstsigniert)
- Browser-Warnung akzeptieren

#### Problem: "Port 8443 nicht erreichbar"
- Fritz!Box Portfreigabe-Status prüfen
- IPv6-Konnektivität testen

---

**💡 Die automatische DynDNS-Integration sorgt dafür, dass die Domain immer auf die aktuelle IPv6-Adresse zeigt!**

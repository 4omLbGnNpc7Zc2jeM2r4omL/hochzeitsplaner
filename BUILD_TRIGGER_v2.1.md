# BUILD TRIGGER v2.1.0 - DynDNS Integration

## 🚀 GitHub Actions Build Trigger

**Version:** 2.1.0  
**Release:** DynDNS-Version  
**Datum:** 30. Juli 2025  

### ✨ Neue Features in v2.1.0:

- ✅ **DynDNS Manager Integration** - Automatische IPv6-only DNS-Updates alle 30 Minuten
- ✅ **Ionos API Integration** - Direkte Anbindung an Ionos DynDNS Service
- ✅ **Background Threading** - DynDNS läuft im Hintergrund ohne App-Blockierung
- ✅ **Status API** - `/api/dyndns/status` für Monitoring verfügbar
- ✅ **DS-Lite Optimierung** - Perfekt für Vodafone DS-Lite Netze
- ✅ **IPv6-only Modus** - Entfernt alte IPv4-Records automatisch
- ✅ **Universal Launcher** - Automatische Netzwerk-Erkennung

### 🔧 Technische Verbesserungen:

- DynDNS Manager mit automatischer IPv6-Erkennung
- Konfigurierbare Update-Intervalle (Standard: 30 Minuten)
- Fehlerbehandlung mit Retry-Logik
- Logging und Status-Monitoring
- Integration in Flask-App Startup-Sequenz

### 📦 Build-Informationen:

- **PyInstaller:** Windows .exe mit allen Abhängigkeiten
- **SSL-Zertifikate:** Automatische Erkennung für HTTPS
- **Datenbank:** Lokale JSON-Dateien
- **Netzwerk:** HTTP (8080) + HTTPS (8443) Support
- **DynDNS:** Automatische IPv6-only Updates

---

**🎯 Dieser Trigger startet einen neuen GitHub Actions Build mit DynDNS-Integration!**

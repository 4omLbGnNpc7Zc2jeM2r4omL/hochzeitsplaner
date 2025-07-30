# BUILD TRIGGER v2.1.1 - DynDNS Integration Fix

## 🚀 GitHub Actions Build Trigger

**Version:** 2.1.1  
**Release:** DynDNS-Version (Universal Launcher Fix)  
**Datum:** 30. Juli 2025  

### ✨ Fixes in v2.1.1:

- ✅ **DynDNS Manager im Universal Launcher** - Import-Problem behoben
- ✅ **Dual-Mode Server mit DynDNS** - HTTP (lokal) + HTTPS (extern) + automatische DNS-Updates
- ✅ **PyInstaller Integration** - DynDNS Manager wird korrekt in .exe eingebunden
- ✅ **Konfiguration Validation** - Prüfung auf dyndns_config.json verfügbar
- ✅ **Fehlerbehandlung** - Graceful Fallback wenn DynDNS nicht verfügbar

### 🔧 Technische Verbesserungen:

- Universal Launcher importiert DynDNS Manager korrekt
- Automatische DynDNS-Initialisierung beim Server-Start  
- Dual-Mode: HTTP (8080) für lokal + HTTPS (8443) für extern
- Background DynDNS-Updates alle 30 Minuten für IPv6-only
- Status-Anzeige für DynDNS-Verfügbarkeit

### 📦 Build-Informationen:

- **PyInstaller:** Windows .exe mit DynDNS Manager Integration
- **Universal Launcher:** Automatische Netzwerk-Erkennung + DynDNS
- **SSL-Zertifikate:** Automatische Erkennung für HTTPS
- **DynDNS:** Ionos API Integration für IPv6-only Updates
- **Dual-Mode:** HTTP lokal + HTTPS extern gleichzeitig

---

**🎯 Dieser Fix behebt das "DynDNS Manager nicht verfügbar" Problem im Universal Launcher!**

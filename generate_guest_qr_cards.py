#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
QR-Code Karten Generator für Hochzeitsgäste
===========================================
Generiert für jeden Gast eine personalisierte QR-Code-Karte im First-Login-Modal Style
mit Login-Parametern für die direkte Anmeldung.

HINWEIS: Dieses Script ist nur für die lokale Verwendung gedacht und installiert
automatisch benötigte Bibliotheken.
"""

import os
import sys
import json
import base64
import subprocess
import urllib.request
import urllib.error
from datetime import datetime
from typing import List, Dict, Any, Optional
import io

# Automatische Installation benötigter Bibliotheken
def install_required_packages():
    """Installiert alle benötigten externe Bibliotheken falls nicht vorhanden"""
    required_packages = [
        ('PIL', 'Pillow', 'PIL (Python Imaging Library)'),
        ('qrcode', 'qrcode[pil]', 'QR-Code Generator')
    ]
    
    installed_packages = []
    
    for import_name, package_name, display_name in required_packages:
        try:
            if import_name == 'PIL':
                from PIL import Image, ImageDraw, ImageFont
            elif import_name == 'qrcode':
                import qrcode
            print(f"✅ {display_name} bereits installiert")
        except ImportError:
            print(f"📦 {display_name} nicht gefunden, installiere automatisch...")
            try:
                subprocess.check_call([sys.executable, "-m", "pip", "install", package_name])
                print(f"✅ {display_name} erfolgreich installiert")
                installed_packages.append(display_name)
            except Exception as e:
                print(f"❌ Fehler beim Installieren von {display_name}: {e}")
                print(f"💡 Bitte manuell installieren: pip install {package_name}")
                sys.exit(1)
    
    if installed_packages:
        print(f"🔄 {len(installed_packages)} Pakete neu installiert. Script wird fortgesetzt...")
    
    # Nach Installation die Module importieren
    try:
        from PIL import Image, ImageDraw, ImageFont
        import qrcode
        return qrcode
    except ImportError as e:
        print(f"❌ Fehler beim Importieren nach Installation: {e}")
        sys.exit(1)

# Automatische Installation von qrcode falls nicht vorhanden
def install_qrcode():
    """Installiert qrcode-Bibliothek falls nicht vorhanden"""
    try:
        import qrcode
        return qrcode
    except ImportError:
        print("📦 qrcode-Bibliothek nicht gefunden, installiere automatisch...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "qrcode[pil]"])
            print("✅ qrcode erfolgreich installiert")
            import qrcode
            return qrcode
        except Exception as e:
            print(f"❌ Fehler beim Installieren von qrcode: {e}")
            print("💡 Bitte manuell installieren: pip install qrcode[pil]")
            sys.exit(1)

# Installiere alle benötigten Pakete und lade QR-Code Modul
qrcode = install_required_packages()

# Importiere PIL-Module nach der Installation
from PIL import Image, ImageDraw, ImageFont

def download_emoji_font():
    """Lädt einen Emoji-Font von Google Fonts herunter für bessere Emoji-Darstellung"""
    import re
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    fonts_dir = os.path.join(current_dir, 'fonts')
    
    # Emoji Font-Datei
    emoji_font_path = os.path.join(fonts_dir, 'NotoColorEmoji.ttf')
    
    # Prüfe ob Font bereits vorhanden ist
    if os.path.exists(emoji_font_path):
        print("✅ Emoji Font bereits vorhanden")
        return emoji_font_path
    
    # Fonts-Verzeichnis erstellen
    os.makedirs(fonts_dir, exist_ok=True)
    
    try:
        print("📦 Lade Noto Color Emoji Font herunter...")
        
        # Noto Color Emoji von Google Fonts
        emoji_url = "https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoColorEmoji.ttf"
        
        # Font herunterladen
        print(f"📥 Lade Emoji Font...")
        try:
            req = urllib.request.Request(emoji_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response:
                with open(emoji_font_path, 'wb') as f:
                    f.write(response.read())
            print(f"✅ Emoji Font heruntergeladen")
        except Exception as download_error:
            print(f"⚠️ Fehler beim Herunterladen des Emoji Fonts: {download_error}")
            return None
        
        if os.path.exists(emoji_font_path):
            print("✅ Emoji Font erfolgreich heruntergeladen")
            return emoji_font_path
        else:
            print("⚠️ Emoji Font konnte nicht heruntergeladen werden")
            return None
        
    except Exception as e:
        print(f"⚠️ Fehler beim Herunterladen des Emoji Fonts: {e}")
        print("💡 Verwende Fallback ohne Emoji-Font...")
        return None

def download_dancing_script():
    """Lädt Dancing Script Font von Google Fonts herunter über die offizielle CSS2 API"""
    import re
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    fonts_dir = os.path.join(current_dir, 'fonts')
    
    # Font-Dateien
    dancing_script_regular = os.path.join(fonts_dir, 'DancingScript-Regular.ttf')
    dancing_script_bold = os.path.join(fonts_dir, 'DancingScript-Bold.ttf')
    
    # Prüfe ob Fonts bereits vorhanden sind
    if os.path.exists(dancing_script_regular) and os.path.exists(dancing_script_bold):
        print("✅ Dancing Script Fonts bereits vorhanden")
        return dancing_script_regular, dancing_script_bold
    
    # Fonts-Verzeichnis erstellen
    os.makedirs(fonts_dir, exist_ok=True)
    
    try:
        print("📦 Lade Dancing Script von Google Fonts CSS2 API herunter...")
        
        # Google Fonts CSS2 API verwenden für aktuelle URLs
        css_url = "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap"
        
        # CSS von Google Fonts abrufen
        req = urllib.request.Request(css_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            css_content = response.read().decode('utf-8')
        
        print("📄 CSS-Inhalt von Google Fonts erhalten")
        
        # TTF URLs aus CSS extrahieren
        font_urls = {}
        
        # Regulärer Ausdruck für Font-URLs und Gewichte
        url_pattern = r'src:\s*url\((https://fonts\.gstatic\.com/[^)]+\.ttf)\)'
        weight_pattern = r'font-weight:\s*(\d+);'
        
        # CSS in @font-face Blöcke aufteilen
        font_faces = css_content.split('@font-face')
        
        for font_face in font_faces:
            if 'Dancing Script' in font_face and 'src:' in font_face:
                url_match = re.search(url_pattern, font_face)
                weight_match = re.search(weight_pattern, font_face)
                
                if url_match and weight_match:
                    url = url_match.group(1)
                    weight = weight_match.group(1)
                    
                    if weight == '400':
                        font_urls[dancing_script_regular] = url
                        print(f"📍 Regular Font URL gefunden: {url}")
                    elif weight == '700':
                        font_urls[dancing_script_bold] = url
                        print(f"📍 Bold Font URL gefunden: {url}")
        
        # Fallback URLs falls CSS-Parsing fehlschlägt (aktuelle v28 URLs)
        if not font_urls:
            print("⚠️ CSS-Parsing fehlgeschlagen, verwende bekannte URLs...")
            font_urls = {
                dancing_script_regular: "https://fonts.gstatic.com/s/dancingscript/v28/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7BMSoHTQ.ttf",
                dancing_script_bold: "https://fonts.gstatic.com/s/dancingscript/v28/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7B1i0HTQ.ttf"
            }
        
        # Fonts herunterladen
        for font_path, url in font_urls.items():
            if not os.path.exists(font_path):
                print(f"📥 Lade {os.path.basename(font_path)}...")
                try:
                    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req) as response:
                        with open(font_path, 'wb') as f:
                            f.write(response.read())
                    print(f"✅ {os.path.basename(font_path)} heruntergeladen")
                except Exception as download_error:
                    print(f"⚠️ Fehler beim Herunterladen von {os.path.basename(font_path)}: {download_error}")
        
        if os.path.exists(dancing_script_regular):
            print("✅ Dancing Script erfolgreich heruntergeladen")
        else:
            print("⚠️ Dancing Script konnte nicht heruntergeladen werden")
        
        return dancing_script_regular, dancing_script_bold
        
    except Exception as e:
        print(f"⚠️ Fehler beim Herunterladen von Dancing Script: {e}")
        print("💡 Verwende Fallback-Fonts...")
        return None, None

# Lade Dancing Script und Emoji Font beim Start
dancing_script_regular_path, dancing_script_bold_path = download_dancing_script()
emoji_font_path = download_emoji_font()

print("💃 Verwende Dancing Script Schriftart für elegante Hochzeitskarten")
if emoji_font_path:
    print("💖 Emoji Font geladen für perfekte Herz-Darstellung")
else:
    print("⚠️ Kein Emoji Font - verwende Pixel-Herz als Fallback")

# SQLite3 für direkte Datenbankverbindung
import sqlite3

class StandaloneDatabaseManager:
    """Standalone SQLite Datenbankmanager für QR-Karten-Generator"""
    
    def __init__(self, db_path: str = None):
        """
        Initialisiert den Datenbankmanager
        
        Args:
            db_path: Pfad zur SQLite-Datenbank (optional)
        """
        if db_path is None:
            # Standardpfad zur Datenbank
            script_dir = os.path.dirname(os.path.abspath(__file__))
            db_path = os.path.join(script_dir, 'data', 'hochzeit.db')
        
        self.db_path = db_path
        print(f"🔍 Verwende Datenbank: {self.db_path}")
        print(f"🔍 Datenbank existiert: {os.path.exists(self.db_path)}")
    
    def get_connection(self):
        """Erstellt eine Datenbankverbindung"""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row  # Ermöglicht Dict-ähnlichen Zugriff
            return conn
        except Exception as e:
            print(f"❌ Fehler beim Verbinden zur Datenbank: {e}")
            return None
    
    def get_all_guests(self) -> List[Dict[str, Any]]:
        """
        Lädt alle Gäste aus der Datenbank
        
        Returns:
            List[Dict]: Liste aller Gäste
        """
        try:
            conn = self.get_connection()
            if not conn:
                return []
            
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, vorname, nachname, guest_code, guest_password
                FROM gaeste 
                ORDER BY nachname, vorname
            """)
            
            guests = []
            for row in cursor.fetchall():
                guest_dict = dict(row)
                # Fallback für Passwort falls guest_password leer ist
                if not guest_dict.get('guest_password'):
                    guest_dict['guest_password'] = f'pass{guest_dict["id"]}'
                guests.append(guest_dict)
            
            conn.close()
            print(f"👥 {len(guests)} Gäste aus Datenbank geladen")
            return guests
            
        except Exception as e:
            print(f"❌ Fehler beim Laden der Gäste: {e}")
            return []
    
    def get_setting(self, key: str, default=None):
        """
        Lädt eine Einstellung aus der Datenbank
        
        Args:
            key: Einstellungsschlüssel
            default: Standardwert falls nicht gefunden
            
        Returns:
            Der Einstellungswert oder default
        """
        try:
            conn = self.get_connection()
            if not conn:
                return default
            
            cursor = conn.cursor()
            cursor.execute("SELECT wert FROM einstellungen WHERE schluessel = ?", (key,))
            row = cursor.fetchone()
            
            conn.close()
            
            if row:
                return row['wert']
            return default
            
        except Exception as e:
            print(f"⚠️ Fehler beim Laden der Einstellung '{key}': {e}")
            return default

class QRCardGenerator:
    """Generator für personalisierte QR-Code-Karten im First-Login-Modal Style"""
    
    def __init__(self):
        """Initialisiert den QR-Code-Karten-Generator"""
        # Bestimme den korrekten Datenbankpfad relativ zum Script-Verzeichnis
        self.script_dir = os.path.dirname(os.path.abspath(__file__))
        db_path = os.path.join(self.script_dir, 'data', 'hochzeit.db')
        
        # Debug: Prüfe welche Datenbank verwendet wird
        print(f"🔍 Datenbankpfad: {db_path}")
        print(f"🔍 Datenbank existiert: {os.path.exists(db_path)}")
        
        # Initialisiere DataManager (standalone Version)
        self.db_manager = StandaloneDatabaseManager(db_path)
        
        # Karten-Dimensionen (Hochformat)
        self.card_width = 800
        self.card_height = 1200
        self.dpi = 300
        
        # Farben vom First-Login-Modal
        self.colors = {
            'background': '#ffffff',      # Weiß
            'primary': '#8b7355',         # Braun
            'accent': '#d4af37',          # Gold
            'text': '#5a5a5a',           # Grau
            'white': '#ffffff'
        }
        
        # QR-Code Konfiguration
        self.qr_size = 150
        self.qr_color = self.colors['accent']  # Gold
        self.qr_background = self.colors['white']  # Weiß
        
        # Ausgabe-Verzeichnis
        self.output_dir = os.path.join(self.script_dir, 'qr_cards')
        os.makedirs(self.output_dir, exist_ok=True)
        
        print(f"📂 QR-Karten werden in '{self.output_dir}' gespeichert")
    
    def get_font(self, size: int, bold: bool = False, elegant: bool = True) -> ImageFont.FreeTypeFont:
        """
        Lädt die Dancing Script Schriftart in der gewünschten Größe
        
        Args:
            size: Schriftgröße
            bold: Ob fett verwendet werden soll
            elegant: Ob elegante Schriftart verwendet werden soll (Dancing Script)
        
        Returns:
            ImageFont.FreeTypeFont: Geladene Schriftart
        """
        if elegant and dancing_script_regular_path and os.path.exists(dancing_script_regular_path):
            try:
                if bold and dancing_script_bold_path and os.path.exists(dancing_script_bold_path):
                    return ImageFont.truetype(dancing_script_bold_path, size)
                else:
                    return ImageFont.truetype(dancing_script_regular_path, size)
            except Exception as e:
                print(f"⚠️ Fehler beim Laden von Dancing Script: {e}")
        
        # Fallback zu System-Fonts
        fallback_fonts = [
            'Didot',           # macOS elegant
            'Georgia',         # Cross-platform elegant  
            'Times New Roman', # Windows fallback
            'Liberation Serif' # Linux fallback
        ]
        
        for font_name in fallback_fonts:
            try:
                return ImageFont.truetype(font_name, size)
            except:
                continue
        
        # Letzte Option: Default Font
        return ImageFont.load_default()
    
    def get_wedding_photo_path(self) -> Optional[str]:
        """
        Lädt den Pfad zum Hochzeitsfoto aus der Datenbank (first_login_image_data als Base64 oder First_Login_Modal als Pfad)
        
        Returns:
            str: Pfad zum Hochzeitsfoto oder None falls nicht gefunden
        """
        try:
            # Debug: Zeige verfügbare Einstellungen
            print("🔍 Suche nach Hochzeitsfoto in der Datenbank...")
            
            # Prüfe zuerst auf Base64-Bilddaten in first_login_image_data
            image_data = self.db_manager.get_setting('first_login_image_data', None)
            print(f"🔍 first_login_image_data gefunden: {bool(image_data)}")
            
            if image_data and image_data.strip():
                print(f"🔍 first_login_image_data Länge: {len(image_data)} Zeichen")
                print(f"🔍 Beginnt mit data:image: {image_data.startswith('data:image')}")
                
                if image_data.startswith('data:image'):
                    try:
                        # Extrahiere Base64-Daten
                        import base64
                        from io import BytesIO
                        header, data = image_data.split(',', 1)
                        image_bytes = base64.b64decode(data)
                        
                        # Temporäre Datei erstellen
                        temp_path = os.path.join(self.script_dir, 'temp_wedding_photo.jpg')
                        with open(temp_path, 'wb') as f:
                            f.write(image_bytes)
                        
                        print(f"📸 Hochzeitsfoto aus Datenbank (Base64) geladen: {temp_path}")
                        print(f"📸 Bildgröße: {len(image_bytes)} bytes")
                        return temp_path
                        
                    except Exception as e:
                        print(f"⚠️ Fehler beim Dekodieren des Base64-Fotos: {e}")
                else:
                    print("⚠️ first_login_image_data ist kein Base64-Bild")
            else:
                print("⚠️ first_login_image_data ist leer oder None")
            
            # Versuche Hochzeitsfoto aus First_Login_Modal Einstellung zu laden
            modal_image_path = self.db_manager.get_setting('First_Login_Modal', None)
            print(f"🔍 First_Login_Modal Pfad: {modal_image_path}")
            
            if modal_image_path and os.path.exists(modal_image_path):
                print(f"📸 Hochzeitsfoto aus First_Login_Modal gefunden: {modal_image_path}")
                return modal_image_path
            
            # Fallback: Versuche andere Einstellungen
            photo_path = self.db_manager.get_setting('hochzeitsfoto_pfad', None)
            print(f"� hochzeitsfoto_pfad: {photo_path}")
            
            if photo_path and os.path.exists(photo_path):
                print(f"📸 Hochzeitsfoto aus hochzeitsfoto_pfad gefunden: {photo_path}")
                return photo_path
            
            print("📸 Kein Hochzeitsfoto in der Datenbank gefunden, verwende Platzhalter")
            return None
            
        except Exception as e:
            print(f"⚠️ Fehler beim Laden des Hochzeitsfotos: {e}")
            return None
    
    def get_wedding_date(self) -> str:
        """
        Lädt das Hochzeitsdatum aus der Datenbank
        
        Returns:
            str: Formatiertes Hochzeitsdatum
        """
        try:
            # Versuche Datum aus Einstellungen zu laden
            wedding_date = self.db_manager.get_setting('hochzeitsdatum', None)
            
            if wedding_date:
                # Datum formatieren falls nötig
                try:
                    from datetime import datetime
                    if isinstance(wedding_date, str):
                        # Versuche verschiedene Datumsformate zu parsen
                        for fmt in ['%Y-%m-%d', '%d.%m.%Y', '%d-%m-%Y']:
                            try:
                                date_obj = datetime.strptime(wedding_date, fmt)
                                return date_obj.strftime('%d. %B %Y')
                            except ValueError:
                                continue
                    return str(wedding_date)
                except:
                    return str(wedding_date)
            
            # Fallback auf Default-Datum
            return "25. July 2026"
            
        except Exception as e:
            print(f"⚠️ Fehler beim Laden des Hochzeitsdatums: {e}")
            return "25. July 2026"
    
    def get_couple_names(self) -> tuple:
        """
        Lädt die Namen des Brautpaars aus der Datenbank
        
        Returns:
            tuple: (braut_name, braeutigam_name)
        """
        try:
            braut_name = self.db_manager.get_setting('braut_name', 'Katharina')
            braeutigam_name = self.db_manager.get_setting('braeutigam_name', 'Pascal')
            
            return braut_name, braeutigam_name
            
        except Exception as e:
            print(f"⚠️ Fehler beim Laden der Brautpaar-Namen: {e}")
            return "Katharina", "Pascal"
    
    def _draw_photo_placeholder(self, draw: ImageDraw.Draw, x: int, y: int, width: int, height: int):
        """
        Zeichnet einen Foto-Platzhalter
        
        Args:
            draw: ImageDraw-Objekt
            x, y: Position des Platzhalters
            width, height: Dimensionen des Platzhalters
        """
        # Foto-Rahmen zeichnen
        draw.rectangle([
            x - 3, y - 3,
            x + width + 3, y + height + 3
        ], outline=self.colors['primary'], width=2)
        
        # Foto-Platzhalter (grau)
        draw.rectangle([
            x, y,
            x + width, y + height
        ], fill='#f0f0f0', outline=self.colors['text'])
        
        # "BRAUTPAAR" Text im Platzhalter
        photo_text = "BRAUTPAAR"
        photo_text_font = self.get_font(16, elegant=True)
        photo_bbox = draw.textbbox((0, 0), photo_text, font=photo_text_font)
        photo_text_width = photo_bbox[2] - photo_bbox[0]
        photo_text_x = x + (width - photo_text_width) // 2
        photo_text_y = y + height // 2 - 10
        
        draw.text((photo_text_x, photo_text_y), photo_text, 
                 fill=self.colors['text'], font=photo_text_font)

    def draw_gradient_line(self, draw: ImageDraw.Draw, x: int, y: int, width: int, max_height: int, color: str):
        """
        Zeichnet eine elegante Punktelinie - dicke Punkte in der Mitte, dünne nach außen
        
        Args:
            draw: ImageDraw-Objekt
            x, y: Startposition (Mittelachse der Linie)
            width: Breite der Linie
            max_height: Maximale Höhe in der Mitte
            color: Farbe der Linie
        """
        from PIL import ImageColor
        
        # Konvertiere Farbe zu RGB
        rgb_color = ImageColor.getrgb(color)
        
        # Zentrum der Linie
        center_x = x + width // 2
        center_y = y
        
        # Anzahl der Punkte - je nach Breite
        num_points = min(width // 20, 9)  # Maximum 9 Punkte für bessere Sichtbarkeit
        
        # Berechne Punktpositionen
        if num_points <= 1:
            # Nur ein Punkt in der Mitte
            point_radius = max(3, max_height // 2)
            draw.ellipse([
                center_x - point_radius, center_y - point_radius,
                center_x + point_radius, center_y + point_radius
            ], fill=rgb_color)
        else:
            # Mehrere Punkte mit Verlauf - dickste in der Mitte, dünnste außen
            point_spacing = width / (num_points - 1)
            
            for i in range(num_points):
                # Position des Punktes
                point_x = x + i * point_spacing
                
                # Abstand vom Zentrum (0.0 = Mitte, 1.0 = Rand)
                distance_from_center = abs(i - (num_points - 1) / 2) / ((num_points - 1) / 2)
                
                # Radius nimmt nach außen stark ab - dickste Punkte in der Mitte
                max_radius = max(4, max_height)  # Dickster Punkt
                min_radius = 1  # Dünnster Punkt
                
                # Exponentieller Verlauf für deutlicheren Unterschied
                size_factor = 1.0 - (distance_from_center ** 1.5)
                point_radius = min_radius + (max_radius - min_radius) * size_factor
                point_radius = max(min_radius, int(point_radius))
                
                # Zeichne den Punkt
                draw.ellipse([
                    point_x - point_radius, center_y - point_radius,
                    point_x + point_radius, center_y + point_radius
                ], fill=rgb_color)

    def draw_eucalyptus_ornament(self, draw: ImageDraw.Draw, x: int, y: int, size: int, color: str):
        """
        Zeichnet ein elegantes Eukalyptus-Ornament
        
        Args:
            draw: ImageDraw-Objekt
            x, y: Position des Ornaments
            size: Größe des Ornaments
            color: Farbe des Ornaments
        """
        # Hauptzweig
        branch_width = max(2, size // 20)
        draw.line([(x, y), (x + size, y + size // 4)], fill=color, width=branch_width)
        
        # Blätter entlang des Zweigs
        leaf_size = size // 8
        for i in range(3):
            leaf_x = x + (i + 1) * size // 4
            leaf_y = y + (i + 1) * size // 16
            
            # Oberes Blatt
            draw.ellipse([
                leaf_x - leaf_size, leaf_y - leaf_size // 2,
                leaf_x + leaf_size, leaf_y + leaf_size // 2
            ], fill=color)
            
            # Unteres Blatt
            draw.ellipse([
                leaf_x - leaf_size, leaf_y + size // 8 - leaf_size // 2,
                leaf_x + leaf_size, leaf_y + size // 8 + leaf_size // 2
            ], fill=color)
    
    def draw_camera_icon(self, draw: ImageDraw.Draw, x: int, y: int, size: int, color: str, heart_rotation: float = 0):
        """
        Zeichnet ein deutlich sichtbares Kamera-Icon mit Herz im Inneren
        
        Args:
            draw: ImageDraw-Objekt
            x, y: Position der Kamera (obere linke Ecke)
            size: Größe der Kamera
            color: Farbe der Kamera
            heart_rotation: Rotation des Herzens in Grad (negativ für Gegenrotation)
        """
        # Kamera-Body (gefülltes Rechteck für bessere Sichtbarkeit)
        body_width = size
        body_height = int(size * 0.7)
        
        # Weißer Hintergrund für Kontrast
        draw.rectangle([
            x - 2, y - 2,
            x + body_width + 2, y + body_height + 2
        ], fill='white', outline=color, width=2)
        
        # Kamera-Body zeichnen (gefüllt)
        draw.rectangle([
            x, y,
            x + body_width, y + body_height
        ], fill=color, outline=color, width=2)
        
        # Objektiv (gefüllter Kreis in der Mitte)
        lens_size = int(size * 0.5)
        lens_x = x + (body_width - lens_size) // 2
        lens_y = y + (body_height - lens_size) // 2
        
        # Weißes Objektiv
        draw.ellipse([
            lens_x, lens_y,
            lens_x + lens_size, lens_y + lens_size
        ], fill='white', outline=color, width=3)
        
        # Sucher/Blitz oben links (kleines Rechteck als "Auslöser")
        sucher_width = int(size * 0.25)  # 25% der Kamera-Breite
        sucher_height = int(size * 0.15)  # 15% der Kamera-Höhe
        sucher_x = x + 3  # Kleiner Abstand vom linken Rand
        sucher_y = y - sucher_height + 3  # Oberhalb des Kamera-Bodys, leicht überlappend
        
        # Sucher/Blitz zeichnen (gefüllt)
        draw.rectangle([
            sucher_x, sucher_y,
            sucher_x + sucher_width, sucher_y + sucher_height
        ], fill=color, outline=color)
        
        # Herz im Objektiv (mit optionaler Rotation)
        heart_size = int(lens_size * 0.6)
        heart_center_x = lens_x + lens_size // 2
        heart_center_y = lens_y + lens_size // 2
        
        if heart_rotation != 0:
            # Versuche zuerst Emoji-Font zu verwenden
            if emoji_font_path and os.path.exists(emoji_font_path):
                # Erstelle temporäres Bild für rotiertes Herz-Emoji mit FreeType2
                heart_img_size = heart_size + 20  # Mehr Puffer für Rotation
                heart_img = Image.new('RGBA', (heart_img_size, heart_img_size), (255, 255, 255, 0))
                heart_draw = ImageDraw.Draw(heart_img)
                
                try:
                    # Lade Emoji Font mit FreeType2 - sehr sichere Größenbehandlung
                    # Minimum 12 Pixel für stabile Emoji-Darstellung
                    safe_font_size = max(12, min(heart_size, 36))  # Zwischen 12 und 36 Pixel
                    
                    # Debug-Ausgabe für Größenberechnung
                    print(f"🔧 Emoji-Font Debug: heart_size={heart_size}, safe_font_size={safe_font_size}")
                    
                    emoji_font = ImageFont.truetype(emoji_font_path, safe_font_size)
                    
                    # Herz-Emoji zeichnen - verwende stabilen Unicode-Charakter
                    emoji_heart = "♥"  # Unicode Herz (U+2665)
                    
                    # Position in der Mitte des temporären Bildes
                    emoji_x = heart_img_size // 2
                    emoji_y = heart_img_size // 2
                    
                    # Robuste Textmaß-Berechnung mit Fallback
                    try:
                        emoji_bbox = heart_draw.textbbox((0, 0), emoji_heart, font=emoji_font)
                        emoji_width = emoji_bbox[2] - emoji_bbox[0]
                        emoji_height = emoji_bbox[3] - emoji_bbox[1]
                    except Exception as bbox_error:
                        print(f"⚠️ textbbox Fehler: {bbox_error} - verwende Fallback-Größe")
                        # Fallback-Größe basierend auf Font-Größe
                        emoji_width = safe_font_size
                        emoji_height = safe_font_size
                    
                    final_x = emoji_x - emoji_width // 2
                    final_y = emoji_y - emoji_height // 2
                    
                    # Herz-Emoji in Gold zeichnen
                    heart_draw.text((final_x, final_y), emoji_heart, 
                                  fill='#d4af37', font=emoji_font)
                    
                    # Rotiere das Herz-Emoji
                    heart_img_rotated = heart_img.rotate(heart_rotation, expand=False)
                    
                    # Füge rotiertes Herz in das Objektiv ein
                    paste_x = heart_center_x - heart_img_size // 2
                    paste_y = heart_center_y - heart_img_size // 2
                    
                    # Paste mit Alpha-Kanal für Transparenz
                    if heart_img_rotated.mode == 'RGBA':
                        draw._image.paste(heart_img_rotated, (paste_x, paste_y), heart_img_rotated)
                    else:
                        draw._image.paste(heart_img_rotated, (paste_x, paste_y))
                    
                    print("💖 Verwendet Emoji-Font für rotiertes Herz")
                    
                except Exception as emoji_error:
                    print(f"⚠️ Emoji-Font Fehler: {emoji_error} - verwende Pixel-Fallback")
                    # Fallback zu Pixel-Herz
                    self._draw_pixel_heart_rotated(heart_draw, heart_size, heart_img_size, heart_rotation, heart_center_x, heart_center_y, draw)
            else:
                # Fallback zu Pixel-Herz
                self._draw_pixel_heart_rotated(None, heart_size, 0, heart_rotation, heart_center_x, heart_center_y, draw)
        else:
            # Versuche zuerst Emoji-Font zu verwenden
            if emoji_font_path and os.path.exists(emoji_font_path):
                try:
                    # Lade Emoji Font mit FreeType2 - sehr sichere Größenbehandlung
                    # Minimum 12 Pixel für stabile Emoji-Darstellung
                    safe_font_size = max(12, min(heart_size, 36))  # Zwischen 12 und 36 Pixel
                    
                    # Debug-Ausgabe für Größenberechnung
                    print(f"🔧 Emoji-Font Debug: heart_size={heart_size}, safe_font_size={safe_font_size}")
                    
                    emoji_font = ImageFont.truetype(emoji_font_path, safe_font_size)
                    
                    # Herz-Emoji zeichnen - verwende stabilen Unicode-Charakter
                    emoji_heart = "♥"  # Unicode Herz (U+2665)
                    
                    # Robuste Textmaß-Berechnung mit Fallback
                    try:
                        emoji_bbox = draw.textbbox((0, 0), emoji_heart, font=emoji_font)
                        emoji_width = emoji_bbox[2] - emoji_bbox[0]
                        emoji_height = emoji_bbox[3] - emoji_bbox[1]
                    except Exception as bbox_error:
                        print(f"⚠️ textbbox Fehler: {bbox_error} - verwende Fallback-Größe")
                        # Fallback-Größe basierend auf Font-Größe
                        emoji_width = safe_font_size
                        emoji_height = safe_font_size
                    
                    final_x = heart_center_x - emoji_width // 2
                    final_y = heart_center_y - emoji_height // 2
                    
                    # Herz-Emoji in Gold zeichnen
                    draw.text((final_x, final_y), emoji_heart, 
                             fill='#d4af37', font=emoji_font)
                    
                    print("💖 Verwendet Emoji-Font für statisches Herz")
                    
                except Exception as emoji_error:
                    print(f"⚠️ Emoji-Font Fehler: {emoji_error} - verwende Pixel-Fallback")
                    # Fallback zu Pixel-Herz
                    self._draw_pixel_heart_static(draw, heart_center_x, heart_center_y, heart_size)
            else:
                # Fallback zu Pixel-Herz
                self._draw_pixel_heart_static(draw, heart_center_x, heart_center_y, heart_size)
    
    def _draw_pixel_heart_rotated(self, heart_draw, heart_size, heart_img_size, heart_rotation, heart_center_x, heart_center_y, main_draw):
        """Zeichnet ein Pixel-Herz mit Rotation als Fallback"""
        heart_img_size = heart_size + 20  # Mehr Puffer für Rotation
        heart_img = Image.new('RGBA', (heart_img_size, heart_img_size), (255, 255, 255, 0))
        heart_draw = ImageDraw.Draw(heart_img)
        
        # Zeichne Pixel-basiertes Herz in der Mitte des temporären Bildes
        temp_heart_x = 10  # Puffer
        temp_heart_y = 10  # Puffer
        
        self._draw_pixel_pattern(heart_draw, temp_heart_x, temp_heart_y, heart_size)
        
        # Rotiere das Herz
        heart_img_rotated = heart_img.rotate(heart_rotation, expand=False)
        
        # Füge rotiertes Herz in das Objektiv ein
        paste_x = heart_center_x - heart_img_size // 2
        paste_y = heart_center_y - heart_img_size // 2
        
        # Paste mit Alpha-Kanal für Transparenz
        if heart_img_rotated.mode == 'RGBA':
            main_draw._image.paste(heart_img_rotated, (paste_x, paste_y), heart_img_rotated)
        else:
            main_draw._image.paste(heart_img_rotated, (paste_x, paste_y))
    
    def _draw_pixel_heart_static(self, draw, heart_center_x, heart_center_y, heart_size):
        """Zeichnet ein statisches Pixel-Herz als Fallback"""
        heart_x = heart_center_x - heart_size // 2
        heart_y = heart_center_y - heart_size // 2
        self._draw_pixel_pattern(draw, heart_x, heart_y, heart_size)
    
    def _draw_pixel_pattern(self, draw, start_x, start_y, heart_size):
        """Zeichnet das Pixel-Herz-Pattern"""
        # Herzfarbe in Gold für bessere Sichtbarkeit
        heart_color = '#d4af37'  # Gold
        
        # Pixel-basiertes Herz - einfach und klar erkennbar
        pixel_size = max(2, heart_size // 8)  # Größe eines "Pixels"
        
        # Herz-Pattern (8x8 Grid) - 1 = gefüllt, 0 = leer
        heart_pattern = [
            [0, 1, 1, 0, 0, 1, 1, 0],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [0, 1, 1, 1, 1, 1, 1, 0],
            [0, 0, 1, 1, 1, 1, 0, 0],
            [0, 0, 0, 1, 1, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0]
        ]
        
        # Zeichne das Pixel-Herz
        for row in range(8):
            for col in range(8):
                if heart_pattern[row][col] == 1:
                    x = start_x + col * pixel_size
                    y = start_y + row * pixel_size
                    draw.rectangle([
                        x, y, x + pixel_size, y + pixel_size
                    ], fill=heart_color)
    
    def create_guest_card(self, guest_data: Dict[str, Any]) -> str:
        """
        Erstellt eine QR-Code-Karte für einen Gast im Stil des Beispielbildes
        
        Args:
            guest_data: Dictionary mit Gastdaten
        
        Returns:
            str: Pfad zur erstellten Kartendatei
        """
        # Gast-Informationen extrahieren
        first_name = guest_data.get('vorname', 'Gast')
        last_name = guest_data.get('nachname', '')
        full_name = f"{first_name} {last_name}".strip()
        gast_id = guest_data.get('id', 'unknown')
        
        # Login-Daten für QR-Code mit korrekten URL-Parametern
        guest_code = guest_data.get('guest_code', f'GUEST{gast_id}')
        guest_password = guest_data.get('guest_password', f'pass{gast_id}')
        
        # URL mit Login-Parametern für automatische Anmeldung
        from urllib.parse import urlencode
        login_params = {
            'guest_code': guest_code,
            'password': guest_password
        }
        query_string = urlencode(login_params)
        # HTTPS URL für die Hochzeitswebsite
        full_login_url = f'https://pascalundkäthe-heiraten.de:8443/login?{query_string}'
        
        # Debug-Ausgabe für URL-Generierung
        print(f"🔗 DEBUG URL für {full_name} (ID: {gast_id}):")
        print(f"   Guest Code: {guest_code}")
        print(f"   Password: {guest_password}")
        print(f"   Full URL: {full_login_url}")
        print(f"   URL Length: {len(full_login_url)} chars")
        
        # QR-Code erstellen - enthält direkt die URL (nicht JSON)
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=8,
            border=2,
        )
        # Direkt die URL in den QR-Code, damit Handys sie korrekt öffnen können
        qr.add_data(full_login_url)
        qr.make(fit=True)
        
        # QR-Code als Bild (kleiner für das neue Layout)
        qr_size = 120
        qr_img = qr.make_image(fill_color=self.qr_color, back_color=self.qr_background)
        qr_img = qr_img.resize((qr_size, qr_size), Image.Resampling.LANCZOS)
        
        # Hauptbild erstellen
        img = Image.new('RGB', (self.card_width, self.card_height), self.colors['background'])
        draw = ImageDraw.Draw(img)
        
        # Schriftarten laden
        title_font = self.get_font(42, bold=False, elegant=True)  # Katharina und Pascal heiraten
        date_font = self.get_font(28, elegant=True)  # 25. July 2026
        greeting_font = self.get_font(32, elegant=True)  # Liebe/r ...
        text_font = self.get_font(20, elegant=True)   # Einladungstext
        login_font = self.get_font(16, elegant=True)  # Login-Daten
        scan_font = self.get_font(18, elegant=True)   # Scan me
        
        # Layout-Berechnungen
        content_margin = 50
        center_x = self.card_width // 2
        
        # Echte Brautpaar-Namen aus der Datenbank laden
        braut_name, braeutigam_name = self.get_couple_names()
        
        # Header: "Katharina und Pascal heiraten"
        current_y = 80
        header_text = f"{braut_name} und {braeutigam_name} heiraten"
        header_bbox = draw.textbbox((0, 0), header_text, font=title_font)
        header_width = header_bbox[2] - header_bbox[0]
        header_x = center_x - header_width // 2
        
        draw.text((header_x, current_y), header_text, 
                 fill=self.colors['primary'], font=title_font)
        
        # Echtes Hochzeitsdatum aus der Datenbank laden (ohne Trennlinie unter Header)
        current_y += 60  # Mehr Abstand zum Datum
        date_text = self.get_wedding_date()
        date_bbox = draw.textbbox((0, 0), date_text, font=date_font)
        date_width = date_bbox[2] - date_bbox[0]
        date_x = center_x - date_width // 2
        
        draw.text((date_x, current_y), date_text, 
                 fill=self.colors['accent'], font=date_font)
        
        # Hochzeitsfoto laden und einfügen (ohne Trennlinie unter Datum)
        current_y += 50  # Abstand zum Foto
        photo_width = 200
        photo_height = 280
        photo_x = center_x - photo_width // 2
        photo_y = current_y
        
        # Versuche echtes Hochzeitsfoto zu laden
        wedding_photo_path = self.get_wedding_photo_path()
        
        if wedding_photo_path:
            try:
                # Echtes Foto laden und anpassen
                wedding_photo = Image.open(wedding_photo_path)
                
                # Foto auf die richtige Größe skalieren (behalte Seitenverhältnis)
                wedding_photo.thumbnail((photo_width, photo_height), Image.Resampling.LANCZOS)
                
                # Zentriere das Foto im verfügbaren Bereich
                actual_width, actual_height = wedding_photo.size
                center_offset_x = (photo_width - actual_width) // 2
                center_offset_y = (photo_height - actual_height) // 2
                
                # Foto-Rahmen zeichnen
                draw.rectangle([
                    photo_x - 3, photo_y - 3,
                    photo_x + photo_width + 3, photo_y + photo_height + 3
                ], outline=self.colors['primary'], width=2)
                
                # Weißer Hintergrund für das Foto
                draw.rectangle([
                    photo_x, photo_y,
                    photo_x + photo_width, photo_y + photo_height
                ], fill='#ffffff')
                
                # Echtes Foto einfügen
                img.paste(wedding_photo, (photo_x + center_offset_x, photo_y + center_offset_y))
                
            except Exception as e:
                print(f"⚠️ Fehler beim Laden des Hochzeitsfotos: {e}")
                # Fallback zu Platzhalter
                self._draw_photo_placeholder(draw, photo_x, photo_y, photo_width, photo_height)
        else:
            # Platzhalter zeichnen
            self._draw_photo_placeholder(draw, photo_x, photo_y, photo_width, photo_height)
        
        # Allgemeine Begrüßung (ohne Trennlinie unter Foto)
        current_y = photo_y + photo_height + 40
        
        # Erste Begrüßungszeile
        greeting_text1 = "Liebe Familie,"
        greeting_bbox1 = draw.textbbox((0, 0), greeting_text1, font=greeting_font)
        greeting_width1 = greeting_bbox1[2] - greeting_bbox1[0]
        greeting_x1 = center_x - greeting_width1 // 2
        
        draw.text((greeting_x1, current_y), greeting_text1, 
                 fill=self.colors['primary'], font=greeting_font)
        
        # Zweite Begrüßungszeile
        current_y += 40
        greeting_text2 = "liebe Freunde,"
        greeting_bbox2 = draw.textbbox((0, 0), greeting_text2, font=greeting_font)
        greeting_width2 = greeting_bbox2[2] - greeting_bbox2[0]
        greeting_x2 = center_x - greeting_width2 // 2
        
        draw.text((greeting_x2, current_y), greeting_text2, 
                 fill=self.colors['primary'], font=greeting_font)
        
        # Einladungstext (mehrzeilig)
        current_y += 60
        invitation_lines = [
            "Ihr seid herzlich zu unserer Hochzeit eingeladen!",
            "",
            "Der QR Code ist euer magisches Portal zu unserem",
            "Hochzeitschaos! Scannt ihn einfach und landet",
            "direkt auf unserer Website. Dort wartet alles",
            "Wichtige auf euch: Zusagen, Absagen, Infos und",
            "jede Menge Details zu unserem großen Tag.",
            "",
            "Klickt euch durch und habt Spaß dabei!"
        ]
        
        for line in invitation_lines:
            if line:  # Nur nicht-leere Zeilen zeichnen
                line_bbox = draw.textbbox((0, 0), line, font=text_font)
                line_width = line_bbox[2] - line_bbox[0]
                line_x = center_x - line_width // 2
                
                draw.text((line_x, current_y), line, 
                         fill=self.colors['text'], font=text_font)
            current_y += 30
        
        # QR-Code rechts unten positionieren
        qr_margin = 80
        qr_x = self.card_width - qr_margin - qr_size
        qr_y = self.card_height - qr_margin - qr_size - 60  # Platz für Text unten
        
        # Goldener Rahmen um QR-Code
        qr_frame_thickness = 4
        draw.rectangle([
            qr_x - qr_frame_thickness, qr_y - qr_frame_thickness,
            qr_x + qr_size + qr_frame_thickness, qr_y + qr_size + qr_frame_thickness
        ], fill=self.colors['accent'])
        
        # QR-Code einfügen
        img.paste(qr_img, (qr_x, qr_y))
        
        # Kamera-Icon komplett außerhalb der oberen linken Ecke des QR-Codes mit +45° Drehung
        camera_size = 50
        camera_x = qr_x - camera_size - 25  # Noch mehr Abstand links vom QR-Code
        camera_y = qr_y - camera_size - 25  # Noch mehr Abstand oberhalb des QR-Codes
        
        # Temporäres Bild für rotierten Kamera-Icon erstellen
        camera_img = Image.new('RGBA', (camera_size * 2, camera_size * 2), (255, 255, 255, 0))
        camera_draw = ImageDraw.Draw(camera_img)
        
        # Kamera in der Mitte des temporären Bildes zeichnen
        # Das Herz dreht sich mit der Kamera zusammen (keine Gegenrotation)
        self.draw_camera_icon(camera_draw, camera_size // 2, camera_size // 2, camera_size, self.colors['accent'], heart_rotation=0)
        
        # Um +45° drehen (entgegengesetzt zur vorherigen Richtung)
        camera_img_rotated = camera_img.rotate(45, expand=True)
        
        # Auf Hauptbild einfügen (mit Transparenz)
        img.paste(camera_img_rotated, (camera_x, camera_y), camera_img_rotated)
        
        # "Scan me" Text unter QR-Code
        scan_text = "Scan me"
        scan_bbox = draw.textbbox((0, 0), scan_text, font=scan_font)
        scan_width = scan_bbox[2] - scan_bbox[0]
        scan_x = qr_x + (qr_size - scan_width) // 2
        scan_y = qr_y + qr_size + 15
        
        draw.text((scan_x, scan_y), scan_text, 
                 fill=self.colors['accent'], font=scan_font)
        
        # Login-Daten unten links (echte Daten aus der Datenbank) - Standard Schrift
        login_x = content_margin
        login_y = self.card_height - 80
        
        # Standard-Schrift für Login-Daten
        login_standard_font = self.get_font(16, elegant=False)
        
        # Verwende echte Login-Daten aus der Datenbank
        guest_code = guest_data.get('guest_code', f'GUEST{gast_id}')
        guest_password = guest_data.get('guest_password', f'pass{gast_id}')
        
        login_text = f"Login: {guest_code}"
        draw.text((login_x, login_y), login_text, 
                 fill=self.colors['text'], font=login_standard_font)
        
        password_text = f"Password: {guest_password}"
        draw.text((login_x, login_y + 25), password_text, 
                 fill=self.colors['text'], font=login_standard_font)
        
        # Datei speichern
        safe_name = "".join(c for c in full_name if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_name = safe_name.replace(' ', '_')
        filename = f"wedding_card_{safe_name}_{gast_id}.png"
        filepath = os.path.join(self.output_dir, filename)
        
        # Als PNG mit hoher Qualität speichern
        img.save(filepath, 'PNG', dpi=(self.dpi, self.dpi), optimize=True)
        
        return filepath
    
    def generate_all_cards(self) -> List[str]:
        """
        Generiert QR-Karten für alle Gäste in der Datenbank
        
        Returns:
            List[str]: Liste der erstellten Dateipfade
        """
        print("🚀 Starte Generierung aller QR-Karten...")
        
        # Alle Gäste aus der Datenbank laden
        guests = self.db_manager.get_all_guests()
        
        if not guests:
            print("⚠️ Keine Gäste in der Datenbank gefunden")
            return []
        
        print(f"👥 {len(guests)} Gäste gefunden")
        
        generated_files = []
        
        for i, guest in enumerate(guests, 1):
            try:
                print(f"📝 Erstelle Karte {i}/{len(guests)} für {guest.get('vorname', 'Unbekannt')} {guest.get('nachname', '')}")
                
                filepath = self.create_guest_card(guest)
                generated_files.append(filepath)
                
                print(f"✅ Karte erstellt: {os.path.basename(filepath)}")
                
            except Exception as e:
                print(f"❌ Fehler bei Gast {guest.get('id', 'unknown')}: {e}")
                continue
        
        print(f"\n🎉 {len(generated_files)} QR-Karten erfolgreich erstellt!")
        print(f"📂 Karten gespeichert in: {self.output_dir}")
        
        return generated_files
    
    def generate_test_card(self) -> str:
        """
        Generiert eine Test-Karte für Stephan Kreutzer aus der Datenbank
        
        Returns:
            str: Pfad zur erstellten Test-Karte
        """
        print("🧪 Erstelle Test-Karte für Stephan Kreutzer...")
        
        # Alle Gäste aus der Datenbank laden
        guests = self.db_manager.get_all_guests()
        
        # Stephan Kreutzer suchen
        stephan_guest = None
        for guest in guests:
            if (guest.get('vorname', '').lower() == 'stephan' and 
                guest.get('nachname', '').lower() == 'kreutzer'):
                stephan_guest = guest
                break
        
        if not stephan_guest:
            print("❌ Stephan Kreutzer nicht in der Datenbank gefunden")
            print("💡 Verfügbare Gäste:")
            for guest in guests[:5]:  # Zeige ersten 5 Gäste
                print(f"   - {guest.get('vorname', 'N/A')} {guest.get('nachname', 'N/A')} (ID: {guest.get('id', 'N/A')})")
            return None
        
        print(f"✅ Stephan Kreutzer gefunden (ID: {stephan_guest.get('id')})")
        
        filepath = self.create_guest_card(stephan_guest)
        print(f"✅ Test-Karte für Stephan Kreutzer erstellt: {os.path.basename(filepath)}")
        
        return filepath
    
    def test_login_url(self, guest_name: str = None) -> str:
        """
        Generiert eine Test-Login-URL und zeigt Debug-Informationen an
        
        Args:
            guest_name: Name des Gastes (optional, verwendet ersten Gast falls None)
            
        Returns:
            str: Die generierte Login-URL
        """
        print("🔍 Teste Login-URL Generierung...")
        
        guests = self.db_manager.get_all_guests()
        if not guests:
            print("❌ Keine Gäste gefunden")
            return ""
        
        # Gast auswählen
        test_guest = guests[0]  # Ersten Gast als Standard nehmen
        
        if guest_name:
            # Suche nach spezifischem Gast
            for guest in guests:
                full_guest_name = f"{guest.get('vorname', '')} {guest.get('nachname', '')}".lower()
                if guest_name.lower() in full_guest_name:
                    test_guest = guest
                    break
        
        # Login-Daten extrahieren
        guest_code = test_guest.get('guest_code', f'GUEST{test_guest.get("id", "unknown")}')
        guest_password = test_guest.get('guest_password', f'pass{test_guest.get("id", "unknown")}')
        full_name = f"{test_guest.get('vorname', 'Gast')} {test_guest.get('nachname', '')}".strip()
        
        # URL generieren
        from urllib.parse import urlencode
        login_params = {
            'guest_code': guest_code,
            'password': guest_password
        }
        query_string = urlencode(login_params)
        # HTTPS URL für die Hochzeitswebsite
        full_login_url = f'https://pascalundkäthe-heiraten.de:8443/login?{query_string}'
        
        # Debug-Ausgabe
        print(f"\n📋 LOGIN-URL TEST ERGEBNIS:")
        print(f"   Gast: {full_name} (ID: {test_guest.get('id')})")
        print(f"   Guest Code: {guest_code}")
        print(f"   Password: {guest_password}")
        print(f"   📝 URL Parameter:")
        print(f"      guest_code={guest_code}")
        print(f"      password={guest_password}")
        print(f"   🔗 Vollständige URL:")
        print(f"      {full_login_url}")
        print(f"   📏 URL-Länge: {len(full_login_url)} Zeichen")
        
        return full_login_url

def main():
    """Hauptfunktion mit interaktiver Menüführung"""
    print("🎊 QR-Code Karten Generator für Hochzeitsgäste")
    print("=" * 50)
    print("💃 Verwendet Dancing Script Schriftart für elegante Karten")
    print()
    
    try:
        generator = QRCardGenerator()
        
        while True:
            print("\nWas möchtest du tun?")
            print("1. 🧪 Test-Karte erstellen")
            print("2. 🎯 Alle Gäste-Karten erstellen")
            print("3. � Login-URL testen (Debug)")
            print("4. 📊 Alle Login-URLs anzeigen")
            print("5. �🚪 Beenden")
            
            choice = input("\nDeine Wahl (1-5): ").strip()
            
            if choice == '1':
                print("\n" + "="*50)
                filepath = generator.generate_test_card()
                if filepath:
                    print(f"\n✅ Test-Karte erfolgreich erstellt!")
                    print(f"📂 Datei: {os.path.basename(filepath)}")
                    print(f"📍 Pfad: {generator.output_dir}")
                
                # Script beenden nach Einzelkarten-Generierung
                print("\n👋 Test-Karte erstellt - Script wird beendet.")
                break
                
            elif choice == '2':
                print("\n" + "="*50)
                generated_files = generator.generate_all_cards()
                
                if generated_files:
                    print(f"\n📊 Zusammenfassung:")
                    print(f"   - {len(generated_files)} Karten erstellt")
                    print(f"   - Gespeichert in: {generator.output_dir}")
                    print(f"   - Auflösung: {generator.dpi} DPI")
                    print(f"   - Format: {generator.card_width}x{generator.card_height} px")
            
            elif choice == '3':
                print("\n" + "="*50)
                guest_name = input("Gast-Name (leer für ersten Gast): ").strip()
                if not guest_name:
                    guest_name = None
                generator.test_login_url(guest_name)
                
            elif choice == '4':
                print("\n" + "="*50)
                print("📋 ALLE LOGIN-URLs:")
                guests = generator.db_manager.get_all_guests()
                for i, guest in enumerate(guests[:10], 1):  # Erste 10 Gäste
                    guest_code = guest.get('guest_code', f'GUEST{guest.get("id", "unknown")}')
                    guest_password = guest.get('guest_password', f'pass{guest.get("id", "unknown")}')
                    full_name = f"{guest.get('vorname', 'Gast')} {guest.get('nachname', '')}".strip()
                    
                    from urllib.parse import urlencode
                    login_params = {
                        'guest_code': guest_code,
                        'password': guest_password
                    }
                    query_string = urlencode(login_params)
                    # HTTPS URL für die Hochzeitswebsite
                    full_login_url = f'https://pascalundkäthe-heiraten.de:8443/login?{query_string}'
                    
                    print(f"\n{i}. {full_name} (ID: {guest.get('id')})")
                    print(f"   Code: {guest_code} | Password: {guest_password}")
                    print(f"   URL: {full_login_url}")
                
                if len(guests) > 10:
                    print(f"\n... und {len(guests) - 10} weitere Gäste")
                
            elif choice == '5':
                print("\n👋 Auf Wiedersehen!")
                break
                
            else:
                print("❌ Ungültige Eingabe. Bitte wähle 1-5.")
    
    except KeyboardInterrupt:
        print("\n\n⏹️ Abgebrochen durch Benutzer")
    except Exception as e:
        print(f"\n❌ Unerwarteter Fehler: {e}")
        print("💡 Stelle sicher, dass die Datenbank erreichbar ist")

if __name__ == "__main__":
    main()

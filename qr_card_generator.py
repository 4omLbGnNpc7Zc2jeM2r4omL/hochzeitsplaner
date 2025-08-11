#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
QR-Code Karten Generator für Hochzeitsgäste (Web-Integration)
===========================================================
Integrierte Version des QR-Card Generators für die Hochzeitsplaner Web-App
"""

import os
import sys
import json
import base64
import subprocess
import urllib.request
import re
import io
import zipfile
import urllib.error
from datetime import datetime
from typing import List, Dict, Any, Optional
import io
import zipfile
from urllib.parse import urlencode

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
                raise ImportError(f"Konnte {display_name} nicht installieren")
    
    if installed_packages:
        print(f"🔄 {len(installed_packages)} Pakete neu installiert. Script wird fortgesetzt...")
    
    # Nach Installation die Module importieren
    try:
        from PIL import Image, ImageDraw, ImageFont
        import qrcode
        return qrcode
    except ImportError as e:
        raise ImportError(f"Fehler beim Importieren nach Installation: {e}")

# Installiere alle benötigten Pakete
qrcode = install_required_packages()

# Importiere PIL-Module nach der Installation
from PIL import Image, ImageDraw, ImageFont

def download_dancing_script():
    """Lädt Dancing Script Font von Google Fonts herunter"""
    import re
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    fonts_dir = os.path.join(current_dir, 'fonts')
    
    # Font-Dateien
    dancing_script_regular = os.path.join(fonts_dir, 'DancingScript-Regular.ttf')
    dancing_script_bold = os.path.join(fonts_dir, 'DancingScript-Bold.ttf')
    
    # Prüfe ob Fonts bereits vorhanden sind
    if os.path.exists(dancing_script_regular) and os.path.exists(dancing_script_bold):
        return dancing_script_regular, dancing_script_bold
    
    # Fonts-Verzeichnis erstellen
    os.makedirs(fonts_dir, exist_ok=True)
    
    try:
        print("📦 Lade Dancing Script von Google Fonts herunter...")
        
        # Direkte TTF URLs (v28 von Google Fonts)
        font_urls = {
            dancing_script_regular: "https://fonts.gstatic.com/s/dancingscript/v28/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7BMSoHTQ.ttf",
            dancing_script_bold: "https://fonts.gstatic.com/s/dancingscript/v28/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7B1i0HTQ.ttf"
        }
        
        # Fonts herunterladen
        for font_path, font_url in font_urls.items():
            font_name = "Regular" if "Regular" in font_path else "Bold"
            print(f"📥 Lade Dancing Script {font_name}...")
            
            try:
                req = urllib.request.Request(font_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req) as response:
                    with open(font_path, 'wb') as f:
                        f.write(response.read())
                print(f"✅ Dancing Script {font_name} heruntergeladen")
            except Exception as download_error:
                print(f"⚠️ Fehler beim Herunterladen von {font_name}: {download_error}")
                return None, None
        
        if os.path.exists(dancing_script_regular) and os.path.exists(dancing_script_bold):
            print("✅ Dancing Script Fonts erfolgreich heruntergeladen")
            return dancing_script_regular, dancing_script_bold
        else:
            print("⚠️ Dancing Script Fonts konnten nicht heruntergeladen werden")
            return None, None
        
    except Exception as e:
        print(f"⚠️ Fehler beim Herunterladen der Dancing Script Fonts: {e}")
        return None, None

def download_emoji_font():
    """Lädt einen Emoji-Font herunter für bessere Emoji-Darstellung"""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    fonts_dir = os.path.join(current_dir, 'fonts')
    
    # Emoji Font-Datei
    emoji_font_path = os.path.join(fonts_dir, 'NotoColorEmoji.ttf')
    
    # Prüfe ob Font bereits vorhanden ist
    if os.path.exists(emoji_font_path):
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
        return None

# Fonts beim Import herunterladen
dancing_script_regular_path, dancing_script_bold_path = download_dancing_script()
emoji_font_path = download_emoji_font()

class WebQRCardGenerator:
    """Generator für personalisierte QR-Code-Karten (Web-Integration)"""
    
    def __init__(self, data_manager):
        """
        Initialisiert den QR-Code-Karten-Generator für die Web-App
        
        Args:
            data_manager: SQLiteHochzeitsDatenManager Instanz
        """
        self.data_manager = data_manager
        
        # Karten-Dimensionen (Hochformat)
        self.card_width = 800
        self.card_height = 1200
        self.dpi = 300
        
        # Standard-Farben vom First-Login-Modal (als Fallback)
        default_colors = {
            'background': '#ffffff',      # Weiß
            'primary': '#8b7355',         # Braun
            'accent': '#d4af37',          # Gold
            'text': '#5a5a5a',           # Grau
            'white': '#ffffff'
        }
        
        # Lade Einstellungen aus der Datenbank
        print("🔧 Lade Einladungsgenerator-Einstellungen aus Datenbank...")
        db_settings = self._load_invitation_generator_settings()
        
        # Verwende Datenbank-Farben falls verfügbar, sonst Fallback
        self.colors = {
            'background': db_settings.get('backgroundColor', default_colors['background']),
            'primary': db_settings.get('primaryColor', default_colors['primary']),
            'accent': db_settings.get('accentColor', default_colors['accent']),
            'text': default_colors['text'],  # Text-Farbe bleibt immer gleich
            'white': default_colors['white']
        }
        
        # QR-Code Konfiguration - verwende Datenbank-Einstellungen falls verfügbar
        self.qr_size = db_settings.get('qrSize', 120)  # Standard: 120
        self.qr_color = self.colors['accent']  # Immer Akzentfarbe
        self.qr_background = self.colors['white']  # Immer weiß
        
        # Weitere Einstellungen aus Datenbank
        self.include_photo = db_settings.get('includePhoto', True)
        self.show_login_data = db_settings.get('showLoginData', True)
        self.elegant_font = db_settings.get('elegantFont', True)
        self.template = db_settings.get('template', 'elegant')
        
        # Text-Einstellungen aus Datenbank
        self.greeting1 = db_settings.get('greeting1', 'Liebe Familie,')
        self.greeting2 = db_settings.get('greeting2', 'liebe Freunde,')
        self.invitation_text = db_settings.get('invitationText', None)
        # "Scan me" bleibt hart kodiert
        self.scan_text = 'Scan me'
        
        # Standard-Einladungstext falls nicht in Datenbank
        if not self.invitation_text:
            self.invitation_text = [
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
        else:
            # Text aus Datenbank in Zeilen aufteilen
            if isinstance(self.invitation_text, str):
                self.invitation_text = self.invitation_text.split('\n')
        
        # Debug-Ausgabe für angewendete Einstellungen
        if db_settings:
            print("✅ Verwende Einstellungen aus Datenbank:")
            print(f"   Primärfarbe: {self.colors['primary']}")
            print(f"   Akzentfarbe: {self.colors['accent']}")
            print(f"   Hintergrundfarbe: {self.colors['background']}")
            print(f"   QR-Größe: {self.qr_size}")
            print(f"   Foto einschließen: {self.include_photo}")
            print(f"   Login-Daten anzeigen: {self.show_login_data}")
            print(f"   Elegante Schrift: {self.elegant_font}")
            print(f"   Template: {self.template}")
            print(f"   Begrüßung 1: {self.greeting1}")
            print(f"   Begrüßung 2: {self.greeting2}")
            print(f"   Einladungstext: {len(self.invitation_text)} Zeilen")
            print(f"   Scan-Text: {self.scan_text} (hart kodiert)")
        else:
            print("⚠️ Keine Datenbank-Einstellungen gefunden - verwende Standard-Einstellungen")
        
        # Basis-URL für Login (ohne GET-Parameter) - dynamisch aus Konfiguration
        try:
            # Versuche Domain aus den Einstellungen zu laden
            domain = self.data_manager.get_setting('domain', 'pascalundkäthe-heiraten.de')
            self.base_url = f"https://{domain}/login"
            print(f"✅ Domain aus Konfiguration geladen: {domain}")
        except Exception as e:
            # Fallback auf Standard-Domain
            self.base_url = "https://pascalundkäthe-heiraten.de/login"
            print(f"⚠️ Konnte Domain nicht aus Konfiguration laden, verwende Standard: {e}")
    
    def set_colors(self, primary=None, accent=None, background=None):
        """
        Setzt benutzerdefinierte Farben für die Karten
        
        Args:
            primary: Hauptfarbe (Standard: #8b7355)
            accent: Akzentfarbe (Standard: #d4af37)
            background: Hintergrundfarbe (Standard: #ffffff)
        """
        if primary:
            self.colors['primary'] = primary
        if accent:
            self.colors['accent'] = accent
            self.qr_color = accent
        if background:
            self.colors['background'] = background
    
    def set_card_size(self, width=None, height=None):
        """
        Setzt benutzerdefinierte Kartengröße
        
        Args:
            width: Kartenbreite in Pixeln
            height: Kartenhöhe in Pixeln
        """
        if width:
            self.card_width = width
        if height:
            self.card_height = height
    
    def _load_invitation_generator_settings(self) -> Dict[str, Any]:
        """
        Lädt alle Einladungsgenerator-Einstellungen aus der Datenbank
        
        Returns:
            Dict: Dictionary mit allen Einstellungen oder leeres Dict falls Fehler
        """
        try:
            if not self.data_manager:
                return {}
            
            # Alle Einladungsgenerator-relevanten Einstellungen laden
            settings_keys = [
                'invitation_primaryColor',
                'invitation_accentColor', 
                'invitation_backgroundColor',
                'invitation_qrSize',
                'invitation_includePhoto',
                'invitation_showLoginData',
                'invitation_elegantFont',
                'invitation_template',
                'invitation_greetingText',
                'invitation_titleText',
                'invitation_dateText',
                'invitation_invitationText'
                # invitation_scan_text entfernt - "Scan me" bleibt hart kodiert
            ]
            
            settings = {}
            
            for key in settings_keys:
                try:
                    value = self.data_manager.get_setting(key, None)
                    if value is not None and value != '':
                        # Konvertiere die Schlüssel zu dem Format, das die Web-App verwendet
                        # Database keys already have camelCase format after invitation_ prefix
                        web_key = key.replace('invitation_', '')
                        
                        # Konvertiere Werte zu den richtigen Typen
                        if web_key in ['qrSize']:
                            try:
                                value = int(value)
                            except:
                                continue
                        elif web_key in ['includePhoto', 'showLoginData', 'elegantFont']:
                            # Handle both boolean and string values
                            if isinstance(value, bool):
                                value = value
                            elif isinstance(value, str):
                                value = value.lower() in ['true', '1', 'yes', 'on']
                            else:
                                value = bool(value)
                        
                        settings[web_key] = value
                except Exception as e:
                    print(f"⚠️ Fehler beim Laden der Einstellung '{key}': {e}")
                    continue
            
            if settings:
                print(f"✅ {len(settings)} Einladungsgenerator-Einstellungen aus Datenbank geladen")
                print(f"🔧 Geladene Einstellungen: {list(settings.keys())}")
            else:
                print("⚠️ Keine Einladungsgenerator-Einstellungen in Datenbank gefunden")
            
            return settings
            
        except Exception as e:
            print(f"❌ Fehler beim Laden der Einladungsgenerator-Einstellungen: {e}")
            return {}
    
    def set_base_url(self, url):
        """
        Setzt die Basis-URL für den Login
        
        Args:
            url: Basis-URL ohne GET-Parameter
        """
        self.base_url = url
    
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
        # Für Title-Fonts oder wenn explizit nicht elegant: Verwende robuste System-Fonts
        if not elegant:
            return self._get_system_font(size, bold)
        
        if elegant and dancing_script_regular_path and os.path.exists(dancing_script_regular_path):
            try:
                if bold and dancing_script_bold_path and os.path.exists(dancing_script_bold_path):
                    return ImageFont.truetype(dancing_script_bold_path, size)
                else:
                    return ImageFont.truetype(dancing_script_regular_path, size)
            except Exception as e:
                print(f"⚠️ Fehler beim Laden von Dancing Script: {e}")
        
        # Fallback zu System-Fonts
        return self._get_system_font(size, bold)
    
    def _get_system_font(self, size: int, bold: bool = False):
        """Lädt robuste System-Fonts mit guter Unicode-Unterstützung"""
        # Für fette Schriftarten
        if bold:
            bold_fonts = [
                'arialbd.ttf',     # Windows Arial Bold - beste Unicode-Unterstützung
                'calibrib.ttf',    # Windows Calibri Bold
                'Arial Bold',      # Cross-platform
                'Calibri Bold',    # Cross-platform
                'DejaVu Sans Bold',# Linux - gute Unicode-Unterstützung
                'Liberation Sans Bold'
            ]
            
            for font_name in bold_fonts:
                try:
                    return ImageFont.truetype(font_name, size)
                except (OSError, IOError):
                    continue
        
        # Normale Schriftarten mit bester Unicode-Unterstützung
        fallback_fonts = [
            'arial.ttf',       # Windows - beste Unicode-Unterstützung für &
            'calibri.ttf',     # Windows modern
            'Arial',           # Cross-platform standard
            'Calibri',         # Cross-platform modern  
            'DejaVu Sans',     # Linux - gute Unicode-Unterstützung
            'Liberation Sans'  # Linux
        ]
        
        for font_name in fallback_fonts:
            try:
                return ImageFont.truetype(font_name, size)
            except (OSError, IOError):
                continue
        
        # Letzter Fallback: Standard-Font
        try:
            return ImageFont.load_default()
        except:
            return ImageFont.load_default()
    
    def _process_invitation_text(self, text: str, base_font=None, max_width: int = 400) -> List[Dict]:
        """
        Verarbeitet Einladungstext mit HTML-Tags und Absätzen
        
        Args:
            text: Der zu verarbeitende Text mit HTML-Tags
            base_font: Basis-Schriftart (optional)
            max_width: Maximale Breite für Textumbruch
        
        Returns:
            List[Dict]: Liste von formatierten Textzeilen
        """
        import re
        
        if not text:
            return []
        
        # Fallback-Font falls keiner angegeben
        if base_font is None:
            base_font = self.get_font(20, elegant=True)
        
        # HTML-Breaks zu normalen Breaks konvertieren
        text = text.replace('<br>', '\n').replace('<br/>', '\n').replace('<br />', '\n')
        
        # Doppelte Zeilenumbrüche zu Absätzen konvertieren
        paragraphs = text.split('\n\n')
        
        result_lines = []
        
        for i, paragraph in enumerate(paragraphs):
            if not paragraph.strip():
                continue
                
            # Einzelne Zeilenumbrüche innerhalb des Absatzes beibehalten
            lines_in_paragraph = paragraph.split('\n')
            
            for j, line in enumerate(lines_in_paragraph):
                line = line.strip()
                if not line:
                    continue
                
                # Prüfe auf HTML-Tags
                if '<strong>' in line or '<b>' in line:
                    # HTML-Segmente verarbeiten
                    segments = self._parse_html_segments(line, base_font)
                    result_lines.append({
                        'type': 'mixed_text',
                        'segments': segments,
                        'spacing': 30
                    })
                else:
                    # Einfacher Text - Zeilenumbruch falls nötig
                    wrapped_lines = self._wrap_text_to_width(line, base_font, max_width)
                    for wrapped_line in wrapped_lines:
                        result_lines.append({
                            'type': 'text',
                            'text': wrapped_line,
                            'font': base_font,
                            'spacing': 30
                        })
            
            # Größerer Abstand zwischen Absätzen (außer nach dem letzten)
            if i < len(paragraphs) - 1:
                result_lines.append({
                    'type': 'break',
                    'spacing': 40
                })
        
        return result_lines
    
    def _process_line_with_html(self, line: str, base_font, max_width: int) -> List[Dict]:
        """
        Verarbeitet eine Zeile mit HTML-Tags und erstellt Text-Zeilen mit gemischten Schriftarten
        
        Args:
            line: Textzeile mit HTML-Tags
            base_font: Basis-Schriftart
            max_width: Maximale Breite
        
        Returns:
            List[Dict]: Liste von Text-Zeilen
        """
        import re
        
        # Suche nach <strong> oder <b> Tags
        if '<strong>' in line or '<b>' in line:
            # Zerlege den Text in Segmente
            segments = self._parse_html_segments(line, base_font)
            
            # Kombiniere Segmente zu Zeilen, die in die Breite passen
            return self._combine_segments_to_lines(segments, max_width)
        else:
            # Keine HTML-Tags - normaler Textumbruch
            wrapped_lines = self._wrap_text_to_width(line, base_font, max_width)
            return [{
                'type': 'text',
                'text': wrapped_line,
                'font': base_font,
                'spacing': 25
            } for wrapped_line in wrapped_lines]
    
    def _combine_segments_to_lines(self, segments: List[Dict], max_width: int) -> List[Dict]:
        """
        Kombiniert Text-Segmente zu Zeilen unter Berücksichtigung der Breite
        
        Args:
            segments: Liste von Text-Segmenten mit Schriftarten
            max_width: Maximale Breite
        
        Returns:
            List[Dict]: Liste von Text-Zeilen
        """
        from PIL import ImageDraw
        
        # Temporäres Draw-Objekt für Textmessung
        temp_img = Image.new('RGB', (1, 1))
        temp_draw = ImageDraw.Draw(temp_img)
        
        result_lines = []
        current_line_segments = []
        current_line_width = 0
        
        for segment in segments:
            words = segment['text'].split()
            
            for word in words:
                # Teste ob das Wort in die aktuelle Zeile passt
                test_segment = {'text': word, 'font': segment['font']}
                
                try:
                    bbox = temp_draw.textbbox((0, 0), word, font=segment['font'])
                    word_width = bbox[2] - bbox[0]
                    
                    # Füge Leerzeichen hinzu wenn nicht am Zeilenanfang
                    space_width = 0
                    if current_line_segments:
                        space_bbox = temp_draw.textbbox((0, 0), ' ', font=segment['font'])
                        space_width = space_bbox[2] - space_bbox[0]
                except:
                    # Fallback
                    word_width = len(word) * 10
                    space_width = 5
                
                # Prüfe ob Wort in die Zeile passt
                needed_width = word_width + space_width
                
                if current_line_width + needed_width <= max_width or not current_line_segments:
                    # Wort passt in die Zeile
                    if current_line_segments:
                        current_line_segments.append({'text': ' ', 'font': segment['font']})
                        current_line_width += space_width
                    
                    current_line_segments.append(test_segment)
                    current_line_width += word_width
                else:
                    # Wort passt nicht - neue Zeile beginnen
                    if current_line_segments:
                        # Aktuelle Zeile als gemischte Zeile hinzufügen
                        result_lines.append({
                            'type': 'mixed_text',
                            'segments': current_line_segments.copy(),
                            'spacing': 25
                        })
                    
                    # Neue Zeile mit diesem Wort beginnen
                    current_line_segments = [test_segment]
                    current_line_width = word_width
        
        # Letzte Zeile hinzufügen
        if current_line_segments:
            result_lines.append({
                'type': 'mixed_text',
                'segments': current_line_segments,
                'spacing': 25
            })
        
        return result_lines
    
    def _draw_mixed_text_line(self, draw, segments: List[Dict], center_x: int, y: int, color: str) -> int:
        """
        Zeichnet eine Zeile mit gemischten Schriftarten
        
        Args:
            draw: PIL ImageDraw Objekt
            segments: Liste von Text-Segmenten mit Schriftarten
            center_x: X-Position für Zentrierung
            y: Y-Position
            color: Textfarbe
        
        Returns:
            int: Höhe der gezeichneten Zeile
        """
        # Berechne Gesamtbreite der Zeile
        total_width = 0
        line_height = 0
        
        for segment in segments:
            try:
                bbox = draw.textbbox((0, 0), segment['text'], font=segment['font'])
                segment_width = bbox[2] - bbox[0]
                segment_height = bbox[3] - bbox[1]
                
                total_width += segment_width
                line_height = max(line_height, segment_height)
            except:
                # Fallback
                total_width += len(segment['text']) * 10
                line_height = max(line_height, 20)
        
        # Startposition für zentrierte Ausrichtung
        start_x = center_x - total_width // 2
        current_x = start_x
        
        # Zeichne jedes Segment
        for segment in segments:
            draw.text((current_x, y), segment['text'], 
                     fill=color, font=segment['font'])
            
            try:
                bbox = draw.textbbox((0, 0), segment['text'], font=segment['font'])
                segment_width = bbox[2] - bbox[0]
                current_x += segment_width
            except:
                # Fallback
                current_x += len(segment['text']) * 10
        
        return line_height
    
    def _parse_html_segments(self, text: str, base_font) -> List[Dict]:
        """
        Parst HTML-Tags und erstellt Text-Segmente mit entsprechenden Schriftarten
        
        Args:
            text: Text mit HTML-Tags
            base_font: Basis-Schriftart
        
        Returns:
            List[Dict]: Liste von Text-Segmenten mit Schriftart-Info
        """
        import re
        
        segments = []
        
        # Pattern für <strong> und <b> Tags
        pattern = r'(<strong>.*?</strong>|<b>.*?</b>|[^<]+|<[^>]*>)'
        parts = re.findall(pattern, text, re.DOTALL)
        
        for part in parts:
            if not part.strip():
                continue
                
            if part.startswith('<strong>') or part.startswith('<b>'):
                # Fetter Text - extrahiere Inhalt und verwende fette Schriftart
                if part.startswith('<strong>'):
                    content = re.sub(r'</?strong>', '', part)
                else:
                    content = re.sub(r'</?b>', '', part)
                
                # Erstelle fette Version der Schriftart
                try:
                    # Versuche eine fette Schriftart zu erstellen
                    bold_font = self._get_bold_font(base_font)
                    segments.append({
                        'text': content,
                        'font': bold_font
                    })
                except:
                    # Fallback: verwende normale Schriftart
                    segments.append({
                        'text': content,
                        'font': base_font
                    })
            elif part.startswith('<'):
                # Andere HTML-Tags ignorieren
                continue
            else:
                # Normaler Text
                segments.append({
                    'text': part,
                    'font': base_font
                })
        
        return segments
    
    def _get_bold_font(self, base_font):
        """
        Erstellt eine fette Version der gegebenen Schriftart
        
        Args:
            base_font: Basis-Schriftart
        
        Returns:
            ImageFont: Fette Schriftart oder Basis-Schriftart als Fallback
        """
        try:
            # Versuche Dancing Script Bold zu verwenden falls verfügbar
            if dancing_script_bold_path and os.path.exists(dancing_script_bold_path):
                return ImageFont.truetype(dancing_script_bold_path, base_font.size)
        except:
            pass
        
        # Fallback: Versuche andere fette System-Fonts
        fallback_bold_fonts = [
            'georgiai.ttf',    # Windows Georgia Bold
            'timesbd.ttf',     # Windows Times Bold
            'arialbd.ttf',     # Windows Arial Bold
            'Georgia Bold',    # Cross-platform
            'Times New Roman Bold',
            'Arial Bold',
            'DejaVu Serif Bold',
            'Liberation Serif Bold'
        ]
        
        for font_name in fallback_bold_fonts:
            try:
                return ImageFont.truetype(font_name, base_font.size)
            except (OSError, IOError):
                continue
        
        # Letzter Fallback: Basis-Schriftart
        return base_font
    
    def _wrap_text_to_width(self, text: str, font, max_width: int) -> List[str]:
        """
        Bricht Text automatisch um, basierend auf der tatsächlichen Textbreite
        
        Args:
            text: Der zu brechende Text
            font: Schriftart für Breitenberechnung
            max_width: Maximale Breite in Pixeln
        
        Returns:
            List[str]: Liste der umgebrochenen Zeilen
        """
        from PIL import ImageDraw
        
        # Temporäres Draw-Objekt für Textmessung
        temp_img = Image.new('RGB', (1, 1))
        temp_draw = ImageDraw.Draw(temp_img)
        
        words = text.split()
        lines = []
        current_line = ""
        
        for word in words:
            # Teste ob das Wort in die aktuelle Zeile passt
            test_line = current_line + (" " + word if current_line else word)
            
            try:
                bbox = temp_draw.textbbox((0, 0), test_line, font=font)
                text_width = bbox[2] - bbox[0]
            except:
                # Fallback: Zeichenanzahl-basierte Schätzung
                text_width = len(test_line) * 10
            
            if text_width <= max_width:
                current_line = test_line
            else:
                if current_line:
                    lines.append(current_line)
                    current_line = word
                else:
                    # Wort ist zu lang - trotzdem hinzufügen
                    lines.append(word)
        
        if current_line:
            lines.append(current_line)
        
        return lines if lines else [text]
    
    def get_wedding_date(self) -> str:
        """
        Lädt das Hochzeitsdatum aus der Datenbank
        
        Returns:
            str: Formatiertes Hochzeitsdatum
        """
        try:
            # Versuche das Datum aus der Hochzeitsplaner-Config zu laden
            wedding_date = self.data_manager.get_setting('wedding_date', '25. July 2026')
            
            # Falls es ein String-Datum ist, versuche es zu formatieren
            if isinstance(wedding_date, str) and wedding_date != '25. July 2026':
                # Verschiedene Datumsformate versuchen
                date_formats = ['%Y-%m-%d', '%d.%m.%Y', '%d/%m/%Y', '%m/%d/%Y']
                for fmt in date_formats:
                    try:
                        date_obj = datetime.strptime(wedding_date, fmt)
                        return date_obj.strftime('%d. %B %Y')
                    except ValueError:
                        continue
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
            braut_name = self.data_manager.get_setting('braut_name', 'Katharina')
            braeutigam_name = self.data_manager.get_setting('braeutigam_name', 'Pascal')
            
            return braut_name, braeutigam_name
            
        except Exception as e:
            print(f"⚠️ Fehler beim Laden der Brautpaar-Namen: {e}")
            return "Katharina", "Pascal"
    
    def get_wedding_photo_from_database(self):
        """
        Lädt das Hochzeitsfoto aus der Datenbank (Base64-Format)
        
        Returns:
            str oder None: Base64-Foto-Daten falls gefunden
        """
        try:
            if not self.data_manager:
                return None
            
            # Lade Einstellungen aus der Datenbank
            settings = self.data_manager.load_settings()
            
            if not settings:
                return None
            
            # Extrahiere Foto-Daten
            photo_data = settings.get('first_login_image_data', '')
            
            if photo_data and len(photo_data) > 100:  # Base64-Daten sollten länger sein
                return photo_data
            else:
                return None
                
        except Exception as e:
            print(f"❌ Fehler beim Laden des Hochzeitsfotos aus Datenbank: {e}")
            return None

    def get_wedding_photo_path(self) -> Optional[str]:
        """
        Sucht nach einem Hochzeitsfoto in verschiedenen Verzeichnissen
        
        Returns:
            str oder None: Pfad zum Hochzeitsfoto falls gefunden
        """
        current_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Mögliche Pfade für Hochzeitsfotos
        possible_paths = [
            os.path.join(current_dir, 'static', 'images', 'brautpaar.jpg'),
            os.path.join(current_dir, 'static', 'images', 'brautpaar.png'),
            os.path.join(current_dir, 'static', 'images', 'wedding.jpg'),
            os.path.join(current_dir, 'static', 'images', 'wedding.png'),
            os.path.join(current_dir, 'static', 'images', 'hochzeit.jpg'),
            os.path.join(current_dir, 'static', 'images', 'hochzeit.png'),
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                return path
        
        return None
    
    def create_guest_card(self, guest_data: Dict[str, Any], template: str = "elegant") -> bytes:
        """
        Erstellt eine QR-Code-Karte für einen Gast
        
        Args:
            guest_data: Gast-Daten aus der Datenbank
            template: Template-Stil ("elegant", "classic", "modern")
        
        Returns:
            bytes: PNG-Bilddaten der erstellten Karte
        """
        # Gast-Informationen extrahieren
        gast_id = guest_data.get('id', 1)
        vorname = guest_data.get('vorname', 'Gast')
        nachname = guest_data.get('nachname', '')
        full_name = f"{vorname} {nachname}".strip()
        
        # Login-Daten generieren falls nicht vorhanden
        guest_code = guest_data.get('guest_code') or f'GUEST{gast_id}'
        guest_password = guest_data.get('guest_password') or f'pass{gast_id}'
        
        # Login-URL erstellen
        login_params = {
            'guest_code': guest_code,
            'password': guest_password
        }
        query_string = urlencode(login_params)
        full_login_url = f'{self.base_url}?{query_string}'
        
        # QR-Code erstellen
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=8,
            border=2,
        )
        qr.add_data(full_login_url)
        qr.make(fit=True)
        
        # QR-Code als Bild
        qr_img = qr.make_image(fill_color=self.qr_color, back_color=self.qr_background)
        qr_img = qr_img.resize((self.qr_size, self.qr_size), Image.Resampling.LANCZOS)
        
        # Hauptbild erstellen
        img = Image.new('RGB', (self.card_width, self.card_height), self.colors['background'])
        draw = ImageDraw.Draw(img)
        
        # Template-spezifisches Layout
        if template == "modern":
            self._draw_modern_template(draw, img, qr_img, full_name, guest_code, guest_password)
        elif template == "classic":
            self._draw_classic_template(draw, img, qr_img, full_name, guest_code, guest_password)
        else:  # elegant (default)
            self._draw_elegant_template(draw, img, qr_img, full_name, guest_code, guest_password)
        
        # Als PNG in Memory speichern
        img_buffer = io.BytesIO()
        img.save(img_buffer, 'PNG', dpi=(self.dpi, self.dpi), optimize=True)
        img_buffer.seek(0)
        
        return img_buffer.getvalue()
    
    def _sanitize_filename(self, filename: str) -> str:
        """Bereinigt einen Dateinamen von ungültigen Zeichen für Windows/Linux"""
        import re
        # Entferne/ersetze ungültige Zeichen für Windows-Dateisystem
        # Ungültige Zeichen: < > : " | ? * / \
        sanitized = re.sub(r'[<>:"|?*/\\]', '_', filename)
        # Entferne aufeinanderfolgende Unterstriche
        sanitized = re.sub(r'_+', '_', sanitized)
        # Entferne führende/folgende Unterstriche und Leerzeichen
        sanitized = sanitized.strip('_ ')
        # Stelle sicher, dass der Dateiname nicht leer ist
        if not sanitized:
            sanitized = 'unknown'
        return sanitized
    
    def generate_invitation_card(self, guest_data: Dict[str, Any], frontend_settings: Dict[str, Any], template: str = "elegant") -> str:
        """
        Erstellt eine QR-Code-Karte mit Frontend-Settings für einen Gast
        
        Args:
            guest_data: Gast-Daten aus der Datenbank
            frontend_settings: Settings aus dem Frontend (titleText, dateText, etc.)
            template: Template-Stil ("elegant", "classic", "modern")
        
        Returns:
            str: Dateipfad der erstellten PNG-Karte
        """
        # Frontend-Settings temporär speichern
        original_colors = self.colors.copy()
        original_qr_size = self.qr_size
        
        try:
            # Frontend-Farben anwenden
            if frontend_settings.get('primaryColor'):
                self.colors['primary'] = frontend_settings['primaryColor']
            if frontend_settings.get('accentColor'):
                self.colors['accent'] = frontend_settings['accentColor']
                self.qr_color = frontend_settings['accentColor']
            if frontend_settings.get('backgroundColor'):
                self.colors['background'] = frontend_settings['backgroundColor']
            
            # QR-Code Größe anwenden
            if frontend_settings.get('qrSize'):
                self.qr_size = int(frontend_settings['qrSize'])
            
            # Frontend-Settings für Template-Rendering speichern
            self._frontend_settings = frontend_settings
            
            # Karte erstellen mit modifizierten Einstellungen
            card_data = self.create_guest_card(guest_data, template)
            
            # Temporäre Datei erstellen
            import tempfile
            import os
            temp_dir = os.path.join(os.path.dirname(__file__), 'qr_cards')
            os.makedirs(temp_dir, exist_ok=True)
            
            # Dateiname erstellen und bereinigen
            vorname = guest_data.get('vorname', 'Gast')
            nachname = guest_data.get('nachname', '')
            gast_id = guest_data.get('id', 1)
            
            # Namen bereinigen für sicheren Dateinamen
            safe_vorname = self._sanitize_filename(vorname)
            safe_nachname = self._sanitize_filename(nachname)
            
            filename = f"wedding_card_{safe_vorname}_{safe_nachname}_{gast_id}.png"
            filepath = os.path.join(temp_dir, filename)
            
            # PNG-Datei speichern
            with open(filepath, 'wb') as f:
                f.write(card_data)
            
            return filepath
            
        finally:
            # Originale Einstellungen wiederherstellen
            self.colors = original_colors
            self.qr_size = original_qr_size
            self.qr_color = original_colors['accent']
            if hasattr(self, '_frontend_settings'):
                delattr(self, '_frontend_settings')
    
    def _draw_elegant_template(self, draw, img, qr_img, full_name, guest_code, guest_password):
        """Zeichnet das elegante Template mit Frontend-Settings"""
        # Frontend-Settings verwenden falls verfügbar
        frontend_settings = getattr(self, '_frontend_settings', {})
        
        # Schriftarten laden (mit Frontend elegant_font Setting)
        elegant_font = frontend_settings.get('elegantFont', True)
        title_font = self.get_font(42, bold=False, elegant=elegant_font)
        date_font = self.get_font(28, elegant=elegant_font)
        greeting_font = self.get_font(32, elegant=elegant_font)
        text_font = self.get_font(20, elegant=elegant_font)
        login_font = self.get_font(16, elegant=False)  # Login-Daten (Standard-Schrift!)
        scan_font = self.get_font(18, elegant=elegant_font)
        
        # Layout-Berechnungen
        content_margin = 50
        center_x = self.card_width // 2
        
        # Header-Text - verwende Frontend-Settings falls vorhanden
        current_y = 80
        header_text = frontend_settings.get('titleText')
        if not header_text:
            braut_name, braeutigam_name = self.get_couple_names()
            header_text = f"{braut_name} und {braeutigam_name} heiraten"
        
        header_bbox = draw.textbbox((0, 0), header_text, font=title_font)
        header_width = header_bbox[2] - header_bbox[0]
        header_x = center_x - header_width // 2
        
        draw.text((header_x, current_y), header_text, 
                 fill=self.colors['primary'], font=title_font)
        
        # Hochzeitsdatum - verwende Frontend-Settings falls vorhanden
        current_y += 60
        date_text = frontend_settings.get('dateText') or self.get_wedding_date()
        date_bbox = draw.textbbox((0, 0), date_text, font=date_font)
        date_width = date_bbox[2] - date_bbox[0]
        date_x = center_x - date_width // 2
        
        draw.text((date_x, current_y), date_text, 
                 fill=self.colors['accent'], font=date_font)
        
        # Foto-Bereich - nur anzeigen falls aktiviert
        show_photo = frontend_settings.get('includePhoto', True)
        if show_photo:
            current_y += 50
            photo_width = 200
            photo_height = 280
            photo_x = center_x - photo_width // 2
            photo_y = current_y
            
            # Versuche Foto aus Datenbank zu laden (Base64)
            wedding_photo_data = self.get_wedding_photo_from_database()
            
            if wedding_photo_data:
                try:
                    # Base64-Daten zu PIL Image konvertieren
                    import base64
                    from io import BytesIO
                    
                    # Falls Data-URL Format, Base64-Teil extrahieren
                    if wedding_photo_data.startswith('data:image/'):
                        if ',' in wedding_photo_data:
                            wedding_photo_data = wedding_photo_data.split(',', 1)[1]
                    
                    # Base64 zu Image konvertieren
                    image_data = base64.b64decode(wedding_photo_data)
                    wedding_photo = Image.open(BytesIO(image_data))
                    
                    # Foto mit abgerundeten Ecken erstellen
                    photo_with_rounded_corners = self._create_rounded_image(wedding_photo, photo_width, photo_height, corner_radius=15)
                    
                    # Weißer Hintergrund für besseren Kontrast
                    draw.rectangle([
                        photo_x, photo_y,
                        photo_x + photo_width, photo_y + photo_height
                    ], fill='#ffffff')
                    
                    # Foto mit abgerundeten Ecken einfügen
                    actual_width, actual_height = photo_with_rounded_corners.size
                    center_offset_x = (photo_width - actual_width) // 2
                    center_offset_y = (photo_height - actual_height) // 2
                    
                    if photo_with_rounded_corners.mode == 'RGBA':
                        img.paste(photo_with_rounded_corners, (photo_x + center_offset_x, photo_y + center_offset_y), photo_with_rounded_corners)
                    else:
                        img.paste(photo_with_rounded_corners, (photo_x + center_offset_x, photo_y + center_offset_y))
                    
                    # Dekorativer Eckrahmen in Akzentfarbe
                    self._draw_corner_frame(draw, photo_x + center_offset_x, photo_y + center_offset_y, 
                                          actual_width, actual_height, self.colors['accent'])
                    
                except Exception as e:
                    print(f"⚠️ Fehler beim Laden des Hochzeitsfotos aus Datenbank: {e}")
                    # Fallback zu Datei-Suche
                    wedding_photo_path = self.get_wedding_photo_path()
                    
                    if wedding_photo_path:
                        try:
                            wedding_photo = Image.open(wedding_photo_path)
                            
                            # Foto mit abgerundeten Ecken erstellen
                            photo_with_rounded_corners = self._create_rounded_image(wedding_photo, photo_width, photo_height, corner_radius=15)
                            
                            # Weißer Hintergrund für besseren Kontrast
                            draw.rectangle([
                                photo_x, photo_y,
                                photo_x + photo_width, photo_y + photo_height
                            ], fill='#ffffff')
                            
                            # Foto mit abgerundeten Ecken einfügen
                            actual_width, actual_height = photo_with_rounded_corners.size
                            center_offset_x = (photo_width - actual_width) // 2
                            center_offset_y = (photo_height - actual_height) // 2
                            
                            if photo_with_rounded_corners.mode == 'RGBA':
                                img.paste(photo_with_rounded_corners, (photo_x + center_offset_x, photo_y + center_offset_y), photo_with_rounded_corners)
                            else:
                                img.paste(photo_with_rounded_corners, (photo_x + center_offset_x, photo_y + center_offset_y))
                            
                            # Dekorativer Eckrahmen in Akzentfarbe
                            self._draw_corner_frame(draw, photo_x + center_offset_x, photo_y + center_offset_y, 
                                                  actual_width, actual_height, self.colors['accent'])
                            
                        except Exception as file_error:
                            print(f"⚠️ Fehler beim Laden des Hochzeitsfotos aus Datei: {file_error}")
                            # Platzhalter-Rechteck
                            draw.rectangle([
                                photo_x, photo_y,
                                photo_x + photo_width, photo_y + photo_height
                            ], outline=self.colors['primary'], fill='#f8f9fa', width=2)
                            
                            placeholder_text = "Hochzeitsfoto"
                            placeholder_bbox = draw.textbbox((0, 0), placeholder_text, font=text_font)
                            placeholder_width = placeholder_bbox[2] - placeholder_bbox[0]
                            placeholder_x = photo_x + (photo_width - placeholder_width) // 2
                            placeholder_y = photo_y + photo_height // 2 - 20
                            
                            draw.text((placeholder_x, placeholder_y), placeholder_text, 
                                     fill=self.colors['primary'], font=text_font)
            
            # Weiter nach dem Foto
            current_y += photo_height + 50
        else:
            # Kein Foto - weniger Abstand
            current_y += 30
        
        # Begrüßung - verwende Datenbank-Texte als Priorität, Frontend-Text als Fallback
        if hasattr(self, 'greeting1') and hasattr(self, 'greeting2'):
            # Verwende Datenbank-Texte
            greeting_text = f"{self.greeting1}\n{self.greeting2}"
        else:
            # Fallback zu Frontend-Settings
            greeting_text = frontend_settings.get('greetingText', 'Liebe Familie,\nliebe Freunde,')
        greeting_lines = self._process_invitation_text(greeting_text, greeting_font, self.card_width - 200)
        
        for line_data in greeting_lines:
            if line_data['type'] == 'text':
                line_text = line_data['text']
                font_to_use = line_data.get('font', greeting_font)
                
                line_bbox = draw.textbbox((0, 0), line_text, font=font_to_use)
                line_width = line_bbox[2] - line_bbox[0]
                line_x = center_x - line_width // 2
                
                draw.text((line_x, current_y), line_text, 
                         fill=self.colors['primary'], font=font_to_use)
                current_y += line_data.get('spacing', 40)
            elif line_data['type'] == 'mixed_text':
                # Gemischte Zeile mit verschiedenen Schriftarten
                current_y += self._draw_mixed_text_line(draw, line_data['segments'], 
                                                      center_x, current_y, 
                                                      self.colors['primary'])
                current_y += line_data.get('spacing', 40)
            elif line_data['type'] == 'break':
                current_y += line_data.get('spacing', 20)
        
        # Einladungstext - verwende Datenbank-Text als Priorität, Frontend-Text als Fallback
        current_y += 60
        if hasattr(self, 'invitation_text') and self.invitation_text:
            # Verwende Datenbank-Text
            if isinstance(self.invitation_text, list):
                invitation_text = '\n'.join(self.invitation_text)
            else:
                invitation_text = self.invitation_text
        else:
            # Fallback zu Frontend-Settings
            invitation_text = frontend_settings.get('invitationText', 'Ihr seid herzlich zu unserer Hochzeit eingeladen!\n\nDer QR Code ist euer magisches Portal zu unserem Hochzeitschaos!')
        
        # HTML-Tags verarbeiten und Text formatieren (mehr Innenabstand: 200px = 100px pro Seite)
        formatted_lines = self._process_invitation_text(invitation_text, text_font, self.card_width - 400)
        
        for line_data in formatted_lines:
            if line_data['type'] == 'text':
                line_text = line_data['text']
                font_to_use = line_data.get('font', text_font)
                
                line_bbox = draw.textbbox((0, 0), line_text, font=font_to_use)
                line_width = line_bbox[2] - line_bbox[0]
                line_x = center_x - line_width // 2
                
                draw.text((line_x, current_y), line_text, 
                         fill=self.colors['text'], font=font_to_use)
                current_y += line_data.get('spacing', 30)
            elif line_data['type'] == 'mixed_text':
                # Gemischte Zeile mit verschiedenen Schriftarten
                current_y += self._draw_mixed_text_line(draw, line_data['segments'], 
                                                      center_x, current_y, 
                                                      self.colors['text'])
                current_y += line_data.get('spacing', 30)
            elif line_data['type'] == 'break':
                current_y += line_data.get('spacing', 20)
        
        # QR-Code rechts unten positionieren (weiter nach unten verschoben)
        qr_margin = 80
        qr_x = self.card_width - qr_margin - self.qr_size
        qr_y = self.card_height - qr_margin - self.qr_size  # QR-Code 4 Zeilen weiter unten (ca. 100px nach unten)
        
        # Goldener Rahmen um QR-Code (4px)
        qr_frame_thickness = 2
        draw.rectangle([
            qr_x - qr_frame_thickness, qr_y - qr_frame_thickness,
            qr_x + self.qr_size + qr_frame_thickness, qr_y + self.qr_size + qr_frame_thickness
        ], fill=self.colors['accent'])
        
        # QR-Code einfügen
        img.paste(qr_img, (qr_x, qr_y))
        
        # Kamera-Icon links oben vom QR-Code mit +45° Drehung (Mitte der Kamera auf QR-Code-Ecke)
        camera_size = 50
        # Berechne Position so, dass die Mitte der Kamera genau auf der oberen linken QR-Code-Ecke liegt
        camera_x = qr_x - camera_size // 2   # Mitte der Kamera auf X-Position der QR-Code-Ecke
        camera_y = qr_y - camera_size // 2   # Mitte der Kamera auf Y-Position der QR-Code-Ecke
        
        # Kamera-Icon mit Rotation zeichnen
        self._draw_camera_icon_with_rotation(draw, camera_x, camera_y, camera_size, 45)
        
        # "Scan me" Text unter QR-Code (hart kodiert)
        scan_text = self.scan_text  # Hart kodiert als "Scan me"
        scan_bbox = draw.textbbox((0, 0), scan_text, font=scan_font)
        scan_width = scan_bbox[2] - scan_bbox[0]
        scan_x = qr_x + (self.qr_size - scan_width) // 2
        scan_y = qr_y + self.qr_size + 15
        
        draw.text((scan_x, scan_y), scan_text, 
                 fill=self.colors['accent'], font=scan_font)
        
        # Login-Daten unten links (falls aktiviert)
        show_login = frontend_settings.get('showLoginData', True)
        if show_login:
            login_x = content_margin
            login_y = self.card_height - 80
            
            login_text = f"Login: {guest_code}"
            draw.text((login_x, login_y), login_text, 
                     fill=self.colors['text'], font=login_font)
            
            password_text = f"Password: {guest_password}"
            draw.text((login_x, login_y + 25), password_text, 
                     fill=self.colors['text'], font=login_font)
    
    def _draw_classic_template(self, draw, img, qr_img, full_name, guest_code, guest_password):
        """Zeichnet das klassische Template mit Frontend-Settings"""
        # Frontend-Settings verwenden falls verfügbar
        frontend_settings = getattr(self, '_frontend_settings', {})
        
        # Schriftarten
        elegant_font = frontend_settings.get('elegantFont', False)
        title_font = self.get_font(36, bold=True, elegant=elegant_font)  # Behalte ursprünglich elegant_font
        text_font = self.get_font(18, elegant=elegant_font)
        login_font = self.get_font(14, elegant=False)
        
        center_x = self.card_width // 2
        current_y = 60
        
        # Titel - verwende Frontend-Text falls vorhanden
        title_text = frontend_settings.get('titleText')
        if not title_text:
            braut_name, braeutigam_name = self.get_couple_names()
            title_text = f"{braut_name} & {braeutigam_name}"
        
        title_bbox = draw.textbbox((0, 0), title_text, font=title_font)
        title_width = title_bbox[2] - title_bbox[0]
        title_x = center_x - title_width // 2
        
        draw.text((title_x, current_y), title_text, 
                 fill=self.colors['primary'], font=title_font)
        
        # Datum - verwende Frontend-Text falls vorhanden
        current_y += 80
        date_text = frontend_settings.get('dateText') or self.get_wedding_date()
        date_bbox = draw.textbbox((0, 0), date_text, font=text_font)
        date_width = date_bbox[2] - date_bbox[0]
        date_x = center_x - date_width // 2
        
        draw.text((date_x, current_y), date_text, 
                 fill=self.colors['text'], font=text_font)
        
        # Linie
        current_y += 50
        line_y = current_y
        draw.line([50, line_y, self.card_width - 50, line_y], 
                 fill=self.colors['primary'], width=2)
        
        # Foto-Bereich - nur anzeigen falls aktiviert (klassisches Template)
        show_photo = frontend_settings.get('includePhoto', False)  # Standardmäßig aus für klassisch
        if show_photo:
            current_y += 30
            photo_width = 160  # Kleiner für klassisches Template
            photo_height = 200
            photo_x = center_x - photo_width // 2
            photo_y = current_y
            
            # Versuche Foto aus Datenbank zu laden (Base64)
            wedding_photo_data = self.get_wedding_photo_from_database()
            
            if wedding_photo_data:
                try:
                    # Base64-Daten zu PIL Image konvertieren
                    import base64
                    from io import BytesIO
                    
                    # Falls Data-URL Format, Base64-Teil extrahieren
                    if wedding_photo_data.startswith('data:image/'):
                        if ',' in wedding_photo_data:
                            wedding_photo_data = wedding_photo_data.split(',', 1)[1]
                    
                    # Base64 zu Image konvertieren
                    image_data = base64.b64decode(wedding_photo_data)
                    wedding_photo = Image.open(BytesIO(image_data))
                    
                    # Foto mit abgerundeten Ecken erstellen
                    photo_with_rounded_corners = self._create_rounded_image(wedding_photo, photo_width, photo_height, corner_radius=10)
                    
                    # Weißer Hintergrund für besseren Kontrast
                    draw.rectangle([
                        photo_x, photo_y,
                        photo_x + photo_width, photo_y + photo_height
                    ], fill='#ffffff')
                    
                    # Foto mit abgerundeten Ecken einfügen
                    actual_width, actual_height = photo_with_rounded_corners.size
                    center_offset_x = (photo_width - actual_width) // 2
                    center_offset_y = (photo_height - actual_height) // 2
                    
                    if photo_with_rounded_corners.mode == 'RGBA':
                        img.paste(photo_with_rounded_corners, (photo_x + center_offset_x, photo_y + center_offset_y), photo_with_rounded_corners)
                    else:
                        img.paste(photo_with_rounded_corners, (photo_x + center_offset_x, photo_y + center_offset_y))
                    
                    # Dekorativer Eckrahmen in Hauptfarbe (klassisch)
                    self._draw_corner_frame(draw, photo_x + center_offset_x, photo_y + center_offset_y, 
                                          actual_width, actual_height, self.colors['primary'])
                    
                    print("✅ Hochzeitsfoto im klassischen Template eingefügt")
                    
                except Exception as e:
                    print(f"⚠️ Fehler beim Laden des Hochzeitsfotos: {e}")
                    # Fallback: Platzhalter
                    self._draw_photo_placeholder(draw, photo_x, photo_y, photo_width, photo_height)
            else:
                # Fallback: Platzhalter
                self._draw_photo_placeholder(draw, photo_x, photo_y, photo_width, photo_height)
            
            current_y += photo_height + 30
        else:
            current_y += 20
        
        # Begrüßung - verwende Frontend-Text falls vorhanden mit automatischem Umbruch
        current_y += 40
        greeting_text = frontend_settings.get('greetingText', 'Liebe Familie, liebe Freunde!')
        
        if greeting_text and greeting_text.strip():
            # HTML-Text verarbeiten mit verbesserter Engine
            processed_lines = self._process_invitation_text(greeting_text, text_font, self.card_width - 200)
            
            for line_data in processed_lines:
                if line_data['type'] == 'text':
                    line_text = line_data['text']
                    font_to_use = line_data.get('font', text_font)
                    
                    line_bbox = draw.textbbox((0, 0), line_text, font=font_to_use)
                    line_width = line_bbox[2] - line_bbox[0]
                    line_x = center_x - line_width // 2
                    
                    draw.text((line_x, current_y), line_text, 
                             fill=self.colors['primary'], font=font_to_use)
                    current_y += line_data.get('spacing', 30)
                elif line_data['type'] == 'mixed_text':
                    # Gemischte Zeile mit verschiedenen Schriftarten
                    current_y += self._draw_mixed_text_line(draw, line_data['segments'], 
                                                          center_x, current_y, 
                                                          self.colors['primary'])
                    current_y += line_data.get('spacing', 30)
                elif line_data['type'] == 'break':
                    current_y += line_data.get('spacing', 15)
        
        # Einladungstext - verwende Frontend invitationText
        invitation_text = frontend_settings.get('invitationText')
        if invitation_text and invitation_text.strip():
            current_y += 30
            
            # HTML-Text verarbeiten mit verbesserter Engine
            processed_lines = self._process_invitation_text(invitation_text, text_font, self.card_width - 200)
            
            for line_data in processed_lines:
                if line_data['type'] == 'text':
                    line_text = line_data['text']
                    font_to_use = line_data.get('font', text_font)
                    
                    line_bbox = draw.textbbox((0, 0), line_text, font=font_to_use)
                    line_width = line_bbox[2] - line_bbox[0]
                    line_x = center_x - line_width // 2
                    
                    draw.text((line_x, current_y), line_text, 
                             fill=self.colors['text'], font=font_to_use)
                    current_y += line_data.get('spacing', 30)
                elif line_data['type'] == 'mixed_text':
                    # Gemischte Zeile mit verschiedenen Schriftarten
                    current_y += self._draw_mixed_text_line(draw, line_data['segments'], 
                                                          center_x, current_y, 
                                                          self.colors['text'])
                    current_y += line_data.get('spacing', 30)
                elif line_data['type'] == 'break':
                    current_y += line_data.get('spacing', 15)
        
        # QR-Code zentriert
        current_y += 50
        qr_x = center_x - self.qr_size // 2
        qr_y = current_y
        
        img.paste(qr_img, (qr_x, qr_y))
        
        # Login-Daten unten (falls aktiviert)
        show_login = frontend_settings.get('showLoginData', True)
        if show_login:
            login_y = self.card_height - 100
            
            login_text = f"Code: {guest_code}"
            login_bbox = draw.textbbox((0, 0), login_text, font=login_font)
            login_width = login_bbox[2] - login_bbox[0]
            login_x = center_x - login_width // 2
            
            draw.text((login_x, login_y), login_text, 
                     fill=self.colors['text'], font=login_font)
            
            password_text = f"Passwort: {guest_password}"
            password_bbox = draw.textbbox((0, 0), password_text, font=login_font)
            password_width = password_bbox[2] - password_bbox[0]
            password_x = center_x - password_width // 2
            
            draw.text((password_x, login_y + 25), password_text, 
                     fill=self.colors['text'], font=login_font)
    
    def _draw_modern_template(self, draw, img, qr_img, full_name, guest_code, guest_password):
        """Zeichnet das moderne Template mit Frontend-Settings"""
        # Frontend-Settings verwenden falls verfügbar
        frontend_settings = getattr(self, '_frontend_settings', {})
        
        # Schriftarten
        elegant_font = frontend_settings.get('elegantFont', True)
        title_font = self.get_font(40, bold=False, elegant=elegant_font)  # Behalte ursprünglich elegant_font
        subtitle_font = self.get_font(24, elegant=elegant_font)
        text_font = self.get_font(16, elegant=False)
        
        center_x = self.card_width // 2
        current_y = 100
        
        # Titel - verwende Frontend-Text falls vorhanden
        title_text = frontend_settings.get('titleText')
        if not title_text:
            braut_name, braeutigam_name = self.get_couple_names()
            title_text = f"{braut_name} ♥ {braeutigam_name}"
        
        title_bbox = draw.textbbox((0, 0), title_text, font=title_font)
        title_width = title_bbox[2] - title_bbox[0]
        title_x = center_x - title_width // 2
        
        draw.text((title_x, current_y), title_text, 
                 fill=self.colors['accent'], font=title_font)
        
        # Foto-Bereich - nur anzeigen falls aktiviert (modernes Template)
        show_photo = frontend_settings.get('includePhoto', False)
        if show_photo:
            current_y += 80
            photo_width = 120  # Kompakt für modernes Template
            photo_height = 150
            photo_x = center_x - photo_width // 2
            photo_y = current_y
            
            # Versuche Foto aus Datenbank zu laden (Base64)
            wedding_photo_data = self.get_wedding_photo_from_database()
            
            if wedding_photo_data:
                try:
                    # Base64-Daten zu PIL Image konvertieren
                    import base64
                    from io import BytesIO
                    
                    # Falls Data-URL Format, Base64-Teil extrahieren
                    if wedding_photo_data.startswith('data:image/'):
                        if ',' in wedding_photo_data:
                            wedding_photo_data = wedding_photo_data.split(',', 1)[1]
                    
                    # Base64 zu Image konvertieren
                    image_data = base64.b64decode(wedding_photo_data)
                    wedding_photo = Image.open(BytesIO(image_data))
                    
                    # Foto mit abgerundeten Ecken erstellen (kleinerer Radius für modern)
                    photo_with_rounded_corners = self._create_rounded_image(wedding_photo, photo_width, photo_height, corner_radius=8)
                    
                    # Weißer Hintergrund für besseren Kontrast
                    draw.rectangle([
                        photo_x, photo_y,
                        photo_x + photo_width, photo_y + photo_height
                    ], fill='#ffffff')
                    
                    # Foto mit abgerundeten Ecken einfügen
                    actual_width, actual_height = photo_with_rounded_corners.size
                    center_offset_x = (photo_width - actual_width) // 2
                    center_offset_y = (photo_height - actual_height) // 2
                    
                    if photo_with_rounded_corners.mode == 'RGBA':
                        img.paste(photo_with_rounded_corners, (photo_x + center_offset_x, photo_y + center_offset_y), photo_with_rounded_corners)
                    else:
                        img.paste(photo_with_rounded_corners, (photo_x + center_offset_x, photo_y + center_offset_y))
                    
                    # Dekorativer Eckrahmen in Akzentfarbe (modern)
                    self._draw_corner_frame(draw, photo_x + center_offset_x, photo_y + center_offset_y, 
                                          actual_width, actual_height, self.colors['accent'])
                    
                    print("✅ Hochzeitsfoto im modernen Template eingefügt")
                    
                except Exception as e:
                    print(f"⚠️ Fehler beim Laden des Hochzeitsfotos: {e}")
                    # Fallback: Platzhalter
                    self._draw_photo_placeholder(draw, photo_x, photo_y, photo_width, photo_height)
            else:
                # Fallback: Platzhalter
                self._draw_photo_placeholder(draw, photo_x, photo_y, photo_width, photo_height)
            
            current_y += photo_height + 40
        else:
            current_y += 60
        
        # Großer QR-Code im Zentrum
        current_y += 150
        large_qr_size = int(frontend_settings.get('qrSize', 200))
        if large_qr_size < 150:
            large_qr_size = 200  # Mindestgröße für modernes Template
        
        qr_img_large = qr_img.resize((large_qr_size, large_qr_size), Image.Resampling.LANCZOS)
        qr_x = center_x - large_qr_size // 2
        qr_y = current_y
        
        # QR-Code Schatten/Rahmen
        shadow_offset = 5
        draw.rectangle([
            qr_x + shadow_offset, qr_y + shadow_offset,
            qr_x + large_qr_size + shadow_offset, qr_y + large_qr_size + shadow_offset
        ], fill='#e0e0e0')
        
        img.paste(qr_img_large, (qr_x, qr_y))
        
        # Gast-Name unter QR-Code
        current_y += large_qr_size + 50
        guest_text = full_name
        guest_bbox = draw.textbbox((0, 0), guest_text, font=subtitle_font)
        guest_width = guest_bbox[2] - guest_bbox[0]
        guest_x = center_x - guest_width // 2
        
        draw.text((guest_x, current_y), guest_text, 
                 fill=self.colors['primary'], font=subtitle_font)
        
        # Datum - verwende Frontend-Text falls vorhanden
        current_y += 50
        date_text = frontend_settings.get('dateText') or self.get_wedding_date()
        date_bbox = draw.textbbox((0, 0), date_text, font=text_font)
        date_width = date_bbox[2] - date_bbox[0]
        date_x = center_x - date_width // 2
        
        draw.text((date_x, current_y), date_text, 
                 fill=self.colors['text'], font=text_font)
        
        # Begrüßungstext falls vorhanden
        greeting_text = frontend_settings.get('greetingText')
        if greeting_text and greeting_text.strip():
            current_y += 30
            # Kompakter Text mit HTML-Unterstützung
            processed_lines = self._process_invitation_text(greeting_text, text_font, self.card_width - 200)
            
            # Nur die ersten 2 Zeilen für Begrüßung
            lines_shown = 0
            for line_data in processed_lines:
                if isinstance(line_data, dict) and lines_shown < 2:
                    if 'segments' in line_data:
                        current_y += self._draw_mixed_text_line(draw, line_data['segments'], 
                                                              center_x, current_y, 
                                                              self.colors['primary'])
                        current_y += 15  # Kompakter Abstand
                    else:
                        line_text = line_data.get('text', str(line_data))
                        if len(line_text) > 50:
                            line_text = line_text[:47] + "..."
                        
                        line_bbox = draw.textbbox((0, 0), line_text, font=text_font)
                        line_width = line_bbox[2] - line_bbox[0]
                        line_x = center_x - line_width // 2
                        
                        draw.text((line_x, current_y), line_text, 
                                 fill=self.colors['primary'], font=text_font)
                        current_y += 20
                    lines_shown += 1
                elif isinstance(line_data, str) and lines_shown < 2:
                    if len(line_data) > 50:
                        line_data = line_data[:47] + "..."
                    
                    line_bbox = draw.textbbox((0, 0), line_data, font=text_font)
                    line_width = line_bbox[2] - line_bbox[0]
                    line_x = center_x - line_width // 2
                    
                    draw.text((line_x, current_y), line_data, 
                             fill=self.colors['primary'], font=text_font)
                    current_y += 20
                    lines_shown += 1
        
        # Einladungstext falls vorhanden - mit verbesserter HTML-Engine
        invitation_text = frontend_settings.get('invitationText')
        if invitation_text and invitation_text.strip():
            current_y += 20
            # Für modernes Template: Kompakter Text mit HTML-Unterstützung
            processed_lines = self._process_invitation_text(invitation_text, text_font, self.card_width - 200)
            
            # Nur die ersten 3 Textzeilen für kompaktes Design
            lines_shown = 0
            for line_data in processed_lines:
                if isinstance(line_data, dict) and lines_shown < 3:
                    # HTML-Verarbeitung mit gemischten Fonts (verwende _draw_mixed_text_line)
                    if 'segments' in line_data:
                        current_y += self._draw_mixed_text_line(draw, line_data['segments'], 
                                                              center_x, current_y, 
                                                              self.colors['text'])
                        current_y += 20  # Kompakter Abstand für modernes Template
                    else:
                        # Fallback für einfache Texte
                        line_text = line_data.get('text', str(line_data))
                        if len(line_text) > 60:
                            line_text = line_text[:57] + "..."
                        
                        line_bbox = draw.textbbox((0, 0), line_text, font=text_font)
                        line_width = line_bbox[2] - line_bbox[0]
                        line_x = center_x - line_width // 2
                        
                        draw.text((line_x, current_y), line_text, 
                                 fill=self.colors['text'], font=text_font)
                        current_y += 25
                    lines_shown += 1
                elif isinstance(line_data, str) and lines_shown < 3:
                    # Fallback für einfachen Text
                    if len(line_data) > 60:
                        line_data = line_data[:57] + "..."
                    
                    line_bbox = draw.textbbox((0, 0), line_data, font=text_font)
                    line_width = line_bbox[2] - line_bbox[0]
                    line_x = center_x - line_width // 2
                    
                    draw.text((line_x, current_y), line_data, 
                             fill=self.colors['text'], font=text_font)
                    current_y += 25
                    lines_shown += 1
        
        # Login-Daten kompakt unten (falls aktiviert)
        show_login = frontend_settings.get('showLoginData', True)
        if show_login:
            login_y = self.card_height - 60
            login_text = f"{guest_code} • {guest_password}"
            login_bbox = draw.textbbox((0, 0), login_text, font=text_font)
            login_width = login_bbox[2] - login_bbox[0]
            login_x = center_x - login_width // 2
            
            draw.text((login_x, login_y), login_text, 
                     fill=self.colors['text'], font=text_font)
    
    def _draw_camera_icon_with_rotation(self, draw, x, y, size, rotation_degrees):
        """Zeichnet ein Kamera-Icon mit Rotation (wie im HTML-Preview)"""
        # Erstelle temporäres Bild für die Rotation
        temp_size = size + 40  # Extra Platz für Rotation
        temp_img = Image.new('RGBA', (temp_size, temp_size), (255, 255, 255, 0))
        temp_draw = ImageDraw.Draw(temp_img)
        
        # Kamera in der Mitte des temporären Bildes zeichnen
        temp_x = (temp_size - size) // 2
        temp_y = (temp_size - size) // 2
        self._draw_camera_icon(temp_draw, temp_x, temp_y, size)
        
        # Rotiere das temporäre Bild
        rotated_img = temp_img.rotate(rotation_degrees, expand=False)
        
        # Füge rotiertes Bild in das Hauptbild ein
        paste_x = x - (temp_size - size) // 2
        paste_y = y - (temp_size - size) // 2
        
        # Paste mit Alpha-Kanal für Transparenz
        if rotated_img.mode == 'RGBA':
            draw._image.paste(rotated_img, (paste_x, paste_y), rotated_img)
        else:
            draw._image.paste(rotated_img, (paste_x, paste_y))

    def _draw_camera_icon(self, draw, x, y, size):
        """Zeichnet ein deutlich sichtbares Kamera-Icon mit Herz im Inneren (ohne Rotation - wird von _draw_camera_icon_with_rotation gehandhabt)"""
        # Kamera-Body (gefülltes Rechteck für bessere Sichtbarkeit)
        body_width = size
        body_height = int(size * 0.7)
        
        # Weißer Hintergrund für Kontrast
        draw.rectangle([
            x - 2, y - 2,
            x + body_width + 2, y + body_height + 2
        ], fill='white', outline=self.colors['accent'], width=2)
        
        # Kamera-Body zeichnen (gefüllt)
        draw.rectangle([
            x, y,
            x + body_width, y + body_height
        ], fill=self.colors['accent'], outline=self.colors['accent'], width=2)
        
        # Objektiv (gefüllter Kreis in der Mitte)
        lens_size = int(size * 0.5)
        lens_x = x + (body_width - lens_size) // 2
        lens_y = y + (body_height - lens_size) // 2
        
        # Weißes Objektiv
        draw.ellipse([
            lens_x, lens_y,
            lens_x + lens_size, lens_y + lens_size
        ], fill='white', outline=self.colors['accent'], width=3)
        
        # Sucher/Blitz oben links (kleines Rechteck als "Auslöser")
        sucher_width = int(size * 0.25)  # 25% der Kamera-Breite
        sucher_height = int(size * 0.15)  # 15% der Kamera-Höhe
        sucher_x = x + 3  # Kleiner Abstand vom linken Rand
        sucher_y = y - sucher_height + 3  # Oberhalb des Kamera-Bodys, leicht überlappend
        
        # Sucher/Blitz zeichnen (gefüllt)
        draw.rectangle([
            sucher_x, sucher_y,
            sucher_x + sucher_width, sucher_y + sucher_height
        ], fill=self.colors['accent'], outline=self.colors['accent'])
        
        # Herz-Emoji im Objektiv (wird von der übergeordneten Rotation mitgedreht)
        heart_size = int(lens_size * 0.7)  # Etwas größeres Herz für bessere Sichtbarkeit
        heart_center_x = lens_x + lens_size // 2 + 3
        heart_center_y = lens_y + lens_size // 2 + 2
        
        # Versuche Emoji-Font zu verwenden
        emoji_font_path = os.path.join(os.path.dirname(__file__), 'fonts', 'NotoColorEmoji.ttf')
        if os.path.exists(emoji_font_path):
            try:
                from PIL import ImageFont
                # Sichere Font-Größe für Emoji - etwas größer für bessere Sichtbarkeit
                safe_font_size = max(14, min(heart_size, 42))
                emoji_font = ImageFont.truetype(emoji_font_path, safe_font_size)
                
                # Herz-Emoji (Unicode Herz)
                emoji_heart = "♥"  # Unicode Herz (U+2665)
                
                # Textmaße berechnen
                try:
                    emoji_bbox = draw.textbbox((0, 0), emoji_heart, font=emoji_font)
                    emoji_width = emoji_bbox[2] - emoji_bbox[0]
                    emoji_height = emoji_bbox[3] - emoji_bbox[1]
                except:
                    # Fallback-Größe
                    emoji_width = safe_font_size
                    emoji_height = safe_font_size
                
                # Präzisere Zentrierung des Herzens (Feinabstimmung nach visueller Analyse)
                final_x = heart_center_x - emoji_width // 2 - 11  # 11 Pixel nach links (war 14, jetzt 3 weniger)
                final_y = heart_center_y - emoji_height // 2 + 5  # 5 Pixel nach unten (war 6, jetzt 1 weniger)
                
                # Herz-Emoji in Gold zeichnen
                draw.text((final_x, final_y), emoji_heart, fill='#d4af37', font=emoji_font)
                
            except Exception as e:
                # Fallback: Pixel-Herz
                self._draw_pixel_heart_fallback(draw, heart_center_x, heart_center_y, heart_size)
        else:
            # Fallback: Pixel-Herz
            self._draw_pixel_heart_fallback(draw, heart_center_x, heart_center_y, heart_size)

    def _draw_pixel_heart_fallback(self, draw, heart_center_x, heart_center_y, heart_size):
        """Zeichnet ein Pixel-Herz als Fallback (wie in der Referenz)"""
        # Herzfarbe in Gold für bessere Sichtbarkeit (wie in der Referenz)
        heart_color = '#d4af37'  # Gold
        
        # Einfaches Herz-Pattern
        pixel_size = max(1, heart_size // 8)
        start_x = heart_center_x - heart_size // 2
        start_y = heart_center_y - heart_size // 2
        
        # Vereinfachtes Herz-Muster
        heart_pattern = [
            [0,1,0,1,0],
            [1,1,1,1,1],
            [1,1,1,1,1],
            [0,1,1,1,0],
            [0,0,1,0,0]
        ]
        
        for row, line in enumerate(heart_pattern):
            for col, pixel in enumerate(line):
                if pixel:
                    px = start_x + col * pixel_size
                    py = start_y + row * pixel_size
                    draw.rectangle([
                        px, py,
                        px + pixel_size, py + pixel_size
                    ], fill=heart_color)
    
    def _create_rounded_image(self, image, max_width, max_height, corner_radius=15):
        """
        Erstellt ein Bild mit abgerundeten Ecken
        
        Args:
            image: PIL Image
            max_width: Maximale Breite
            max_height: Maximale Höhe
            corner_radius: Radius für abgerundete Ecken
        
        Returns:
            PIL Image mit abgerundeten Ecken und Alpha-Kanal
        """
        # Skaliere das Bild auf die gewünschte Größe
        image = image.copy()
        image.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
        
        # Erstelle Maske für abgerundete Ecken
        width, height = image.size
        mask = Image.new('L', (width, height), 0)
        mask_draw = ImageDraw.Draw(mask)
        
        # Zeichne abgerundetes Rechteck in die Maske
        mask_draw.rounded_rectangle([0, 0, width, height], radius=corner_radius, fill=255)
        
        # Konvertiere Bild zu RGBA falls nötig
        if image.mode != 'RGBA':
            image = image.convert('RGBA')
        
        # Erstelle neues Bild mit Transparenz
        rounded_image = Image.new('RGBA', (width, height), (255, 255, 255, 0))
        rounded_image.paste(image, (0, 0))
        
        # Wende die Maske an
        rounded_image.putalpha(mask)
        
        return rounded_image
    
    def _draw_corner_frame(self, draw, x, y, width, height, color):
        """
        Zeichnet dekorative Rahmenlinien auf den geraden Seiten des Fotos bis zu den abgerundeten Ecken
        
        Args:
            draw: PIL ImageDraw Objekt
            x, y: Position des Fotos
            width, height: Größe des Fotos
            color: Farbe der Rahmenlinien
        """
        stroke_width = 1    # Breite der Striche
        offset = 12          # Abstand vom Foto
        corner_radius = 15  # Muss mit dem Radius in _create_rounded_image übereinstimmen
        
        # Koordinaten mit Offset
        left = x - offset
        top = y - offset
        right = x + width + offset
        bottom = y + height + offset
        
        # Berechne die Endpunkte der geraden Linien (wo die Rundung beginnt)
        # Zusätzlich 4 Pixel kürzer an allen Seiten
        line_shortening = 4
        
        # Oben: von links+radius+4px bis rechts-radius-4px
        draw.line([left + corner_radius + line_shortening, top, 
                  right - corner_radius - line_shortening, top], 
                 fill=color, width=stroke_width)
        
        # Unten: von links+radius+4px bis rechts-radius-4px
        draw.line([left + corner_radius + line_shortening, bottom, 
                  right - corner_radius - line_shortening, bottom], 
                 fill=color, width=stroke_width)
        
        # Links: von oben+radius+4px bis unten-radius-4px
        draw.line([left, top + corner_radius + line_shortening, 
                  left, bottom - corner_radius - line_shortening], 
                 fill=color, width=stroke_width)
        
        # Rechts: von oben+radius+4px bis unten-radius-4px
        draw.line([right, top + corner_radius + line_shortening, 
                  right, bottom - corner_radius - line_shortening], 
                 fill=color, width=stroke_width)

    def _draw_photo_placeholder(self, draw, x, y, width, height):
        """Zeichnet einen Foto-Platzhalter"""
        # Foto-Rahmen
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
    
    def generate_all_cards(self, template: str = "elegant", output_format: str = "zip") -> bytes:
        """
        Generiert QR-Karten für alle Gäste
        
        Args:
            template: Template-Stil ("elegant", "classic", "modern")
            output_format: Ausgabeformat ("zip" oder "single")
        
        Returns:
            bytes: ZIP-Archiv mit allen Karten oder einzelne Karte
        """
        # Alle Gäste laden
        guests = self.data_manager.get_all_guests()
        
        if not guests:
            raise ValueError("Keine Gäste in der Datenbank gefunden")
        
        if output_format == "zip":
            # ZIP-Archiv erstellen
            zip_buffer = io.BytesIO()
            
            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for guest in guests:
                    try:
                        # Karte generieren
                        card_data = self.create_guest_card(guest, template)
                        
                        # Dateiname erstellen und bereinigen
                        vorname = guest.get('vorname', 'Gast')
                        nachname = guest.get('nachname', '')
                        full_name = f"{vorname} {nachname}".strip()
                        safe_name = self._sanitize_filename(full_name)
                        filename = f"wedding_card_{safe_name}_{guest.get('id', 'unknown')}.png"
                        
                        # Zur ZIP hinzufügen
                        zip_file.writestr(filename, card_data)
                        
                    except Exception as e:
                        print(f"⚠️ Fehler bei Gast {guest.get('id', 'unknown')}: {e}")
                        continue
            
            zip_buffer.seek(0)
            return zip_buffer.getvalue()
        
        else:
            # Nur erste Karte als Beispiel
            if guests:
                return self.create_guest_card(guests[0], template)
            else:
                raise ValueError("Keine Gäste verfügbar")
    
    def generate_test_card(self, template: str = "elegant") -> bytes:
        """
        Generiert eine Test-Karte mit Demo-Daten
        
        Args:
            template: Template-Stil ("elegant", "classic", "modern")
        
        Returns:
            bytes: PNG-Bilddaten der Test-Karte
        """
        # Demo-Gast-Daten
        test_guest = {
            'id': 999,
            'vorname': 'Max',
            'nachname': 'Mustermann',
            'guest_code': 'DEMO123',
            'guest_password': 'test456'
        }
        
        return self.create_guest_card(test_guest, template)

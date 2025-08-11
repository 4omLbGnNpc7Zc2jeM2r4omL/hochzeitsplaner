#!/usr/bin/env python3
"""
PWA Icon Generator für Hochzeitsplaner
Erstellt alle benötigten Icon-Größen aus einem Basis-Icon
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_wedding_icon(size, output_path):
    """Erstellt ein Hochzeits-Icon in der angegebenen Größe"""
    
    # Erstelle ein neues Bild mit rosa Hintergrund
    img = Image.new('RGBA', (size, size), (214, 51, 132, 255))  # #d63384
    draw = ImageDraw.Draw(img)
    
    # Erstelle einen weißen Kreis als Hintergrund
    margin = size // 10
    circle_size = size - (2 * margin)
    circle_pos = (margin, margin, margin + circle_size, margin + circle_size)
    draw.ellipse(circle_pos, fill=(255, 255, 255, 255))
    
    # Emoji-Font-Size basierend auf Icon-Größe
    font_size = size // 2
    
    try:
        # Versuche eine Emoji-Font zu laden (falls verfügbar)
        font = ImageFont.truetype("seguiemj.ttf", font_size)  # Windows Emoji Font
    except:
        try:
            # Fallback für andere Systeme
            font = ImageFont.truetype("NotoColorEmoji.ttf", font_size)
        except:
            # Standard Font als letzter Fallback
            font = ImageFont.load_default()
    
    # Herz-Emoji hinzufügen
    heart = "💕"
    
    # Text-Größe berechnen und zentrieren
    bbox = draw.textbbox((0, 0), heart, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    text_x = (size - text_width) // 2
    text_y = (size - text_height) // 2
    
    # Emoji zeichnen
    draw.text((text_x, text_y), heart, font=font, fill=(214, 51, 132, 255))
    
    # Icon speichern
    img.save(output_path, 'PNG')
    print(f"Icon erstellt: {output_path} ({size}x{size})")

def main():
    """Erstelle alle benötigten Icon-Größen"""
    
    # Icon-Verzeichnis erstellen
    icon_dir = "static/icons"
    os.makedirs(icon_dir, exist_ok=True)
    
    # Alle benötigten Größen
    sizes = [72, 96, 128, 144, 152, 192, 384, 512]
    
    for size in sizes:
        output_path = os.path.join(icon_dir, f"icon-{size}x{size}.png")
        create_wedding_icon(size, output_path)
    
    print(f"\n✅ Alle {len(sizes)} Icons wurden erfolgreich erstellt!")
    print("Die Icons befinden sich im Verzeichnis: static/icons/")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Debug-Script für Foto-Galerie
"""

import requests
import json
from pprint import pprint

# Basis-URL der Anwendung
BASE_URL = "http://localhost:5000"

def test_login():
    """Teste Login-Funktionalität"""
    print("=== LOGIN TEST ===")
    
    login_data = {
        'username': 'admin',
        'password': 'hochzeit2025'
    }
    
    session = requests.Session()
    
    try:
        response = session.post(f"{BASE_URL}/api/login", data=login_data)
        print(f"Login Status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Login erfolgreich!")
            return session
        else:
            print(f"❌ Login fehlgeschlagen: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Fehler beim Login: {e}")
        return None

def test_approved_gallery():
    """Teste die Approved-Gallery API (öffentlich zugänglich)"""
    print("\n=== APPROVED GALLERY TEST (Öffentlich) ===")
    
    try:
        response = requests.get(f"{BASE_URL}/api/approved-gallery")
        print(f"Approved Gallery Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ {len(data)} genehmigte Uploads gefunden:")
            for upload in data[:5]:  # Nur erste 5 anzeigen
                print(f"  - ID {upload['id']}: {upload['original_filename']} (von {upload['gast_vorname']} {upload['gast_nachname']})")
            return data
        else:
            print(f"❌ Fehler bei Approved Gallery: {response.text}")
            return []
            
    except Exception as e:
        print(f"❌ Fehler bei Approved Gallery: {e}")
        return []

def test_pending_uploads(session):
    """Teste Pending Uploads API (für Admin)"""
    print("\n=== PENDING UPLOADS TEST (Admin) ===")
    
    try:
        response = session.get(f"{BASE_URL}/api/admin/pending-uploads")
        print(f"Pending Uploads Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ {len(data)} ausstehende Uploads gefunden:")
            for upload in data[:5]:  # Nur erste 5 anzeigen
                print(f"  - ID {upload['id']}: {upload['original_filename']} (Status: {upload['admin_approved']})")
            return data
        else:
            print(f"❌ Fehler bei Pending Uploads: {response.text}")
            return []
            
    except Exception as e:
        print(f"❌ Fehler bei Pending Uploads: {e}")
        return []

def test_gallery_image_access(upload_id):
    """Teste Gallery Image Access"""
    print(f"\n=== GALLERY IMAGE ACCESS TEST (ID: {upload_id}) ===")
    
    try:
        response = requests.get(f"{BASE_URL}/api/gallery-image/{upload_id}")
        print(f"Gallery Image Status: {response.status_code}")
        print(f"Content-Type: {response.headers.get('Content-Type', 'Unknown')}")
        print(f"Content-Length: {len(response.content)} bytes")
        
        if response.status_code == 200:
            print("✅ Bild-Zugriff erfolgreich!")
            return True
        else:
            print(f"❌ Bild-Zugriff fehlgeschlagen: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Fehler bei Bild-Zugriff: {e}")
        return False

def main():
    """Haupttest-Funktion"""
    print("🚀 Foto-Galerie Debug Tests")
    print("=" * 50)
    
    # 1. Teste öffentliche Galerie API (ohne Login)
    approved_uploads = test_approved_gallery()
    
    # 2. Login testen
    session = test_login()
    
    if session:
        # 3. Teste Admin-Bereich
        pending_uploads = test_pending_uploads(session)
        
        # 4. Teste Bild-Zugriff wenn Uploads vorhanden
        if approved_uploads:
            test_upload = approved_uploads[0]
            test_gallery_image_access(test_upload['id'])
        elif pending_uploads:
            print("\n⚠️  Keine genehmigten Uploads gefunden, teste mit ausstehenden Uploads...")
            test_upload = pending_uploads[0]
            # Dieser sollte fehlschlagen, da nicht genehmigt
            test_gallery_image_access(test_upload['id'])
    
    print("\n✅ Debug-Tests abgeschlossen!")
    
    if not approved_uploads:
        print("\n💡 LÖSUNG: Es sind keine genehmigten Uploads vorhanden!")
        print("   → Gehen Sie zur Upload-Genehmigung und genehmigen Sie einige Uploads")
        print("   → URL: http://localhost:8080/admin/upload-approval")

if __name__ == "__main__":
    main()

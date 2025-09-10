#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Spotify Manager für Hochzeitsplaner
Verwaltet die Integration mit der Spotify Web API
"""

import json
import logging
import requests
import time
import base64
from urllib.parse import urlencode
from config_manager import ConfigManager


class SpotifyManager:
    """Manager für Spotify Web API Integration"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.config_manager = ConfigManager()
        self.base_url = "https://api.spotify.com/v1"
        self.auth_url = "https://accounts.spotify.com/api/token"
        self.access_token = None
        self.token_expires_at = 0
        
        # Spotify-Konfiguration laden
        self.client_id = self.config_manager.get_spotify_client_id()
        self.client_secret = self.config_manager.get_spotify_client_secret()
        self.enabled = self.config_manager.get_spotify_enabled()
        
        if not self.client_id or not self.client_secret:
            self.logger.warning("Spotify Client ID oder Secret nicht konfiguriert")
            self.enabled = False

    def get_access_token(self):
        """Hole oder erneuere Access Token für Spotify API"""
        if not self.enabled:
            self.logger.warning("Spotify-Integration ist deaktiviert")
            return None
            
        # Prüfe ob Token noch gültig ist
        if self.access_token and time.time() < self.token_expires_at:
            return self.access_token
            
        try:
            # Client Credentials für Base64-Encoding
            credentials = f"{self.client_id}:{self.client_secret}"
            credentials_b64 = base64.b64encode(credentials.encode()).decode()
            
            headers = {
                'Authorization': f'Basic {credentials_b64}',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
            
            data = {
                'grant_type': 'client_credentials'
            }
            
            response = requests.post(self.auth_url, headers=headers, data=data, timeout=10)
            
            if response.status_code == 200:
                token_data = response.json()
                self.access_token = token_data['access_token']
                # Token läuft normalerweise nach 1 Stunde ab, wir nehmen 55 Minuten als Sicherheit
                self.token_expires_at = time.time() + (token_data.get('expires_in', 3600) - 300)
                
                self.logger.info("Spotify Access Token erfolgreich erhalten")
                return self.access_token
            else:
                self.logger.error(f"Fehler beim Spotify Token: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            self.logger.error(f"Fehler beim Spotify Authentication: {e}")
            return None

    def search_tracks(self, query, limit=20):
        """Suche nach Tracks bei Spotify"""
        if not self.enabled:
            return {'success': False, 'error': 'Spotify-Integration deaktiviert'}
            
        access_token = self.get_access_token()
        if not access_token:
            return {'success': False, 'error': 'Spotify-Authentifizierung fehlgeschlagen'}
            
        try:
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
            
            params = {
                'q': query,
                'type': 'track',
                'limit': min(limit, 50),  # Spotify API erlaubt max 50
                'market': 'DE'  # Deutsche Region für bessere Ergebnisse
            }
            
            url = f"{self.base_url}/search?" + urlencode(params)
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                tracks = []
                
                for track in data.get('tracks', {}).get('items', []):
                    # Künstler zusammenfassen
                    artists = ', '.join([artist['name'] for artist in track['artists']])
                    
                    # Album-Cover URL
                    image_url = None
                    if track['album']['images']:
                        # Nimm das mittlere Bild (meist 300x300)
                        images = track['album']['images']
                        image_url = images[len(images)//2]['url'] if images else None
                    
                    track_info = {
                        'id': track['id'],
                        'name': track['name'],
                        'artists': artists,
                        'album': track['album']['name'],
                        'duration_ms': track['duration_ms'],
                        'popularity': track['popularity'],
                        'preview_url': track.get('preview_url'),
                        'external_urls': track['external_urls'],
                        'spotify_url': track['external_urls'].get('spotify'),
                        'image_url': image_url,
                        'release_date': track['album'].get('release_date'),
                        'uri': track['uri']
                    }
                    tracks.append(track_info)
                
                self.logger.info(f"Spotify-Suche erfolgreich: {len(tracks)} Tracks für '{query}'")
                return {'success': True, 'tracks': tracks}
                
            else:
                self.logger.error(f"Spotify Search Fehler: {response.status_code} - {response.text}")
                return {'success': False, 'error': f'Spotify API Fehler: {response.status_code}'}
                
        except Exception as e:
            self.logger.error(f"Fehler bei Spotify-Suche: {e}")
            return {'success': False, 'error': 'Suchfehler bei Spotify'}

    def get_track_details(self, track_id):
        """Hole detaillierte Informationen zu einem Track"""
        if not self.enabled:
            return {'success': False, 'error': 'Spotify-Integration deaktiviert'}
            
        access_token = self.get_access_token()
        if not access_token:
            return {'success': False, 'error': 'Spotify-Authentifizierung fehlgeschlagen'}
            
        try:
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
            
            url = f"{self.base_url}/tracks/{track_id}"
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                track = response.json()
                
                # Künstler zusammenfassen
                artists = ', '.join([artist['name'] for artist in track['artists']])
                
                # Album-Cover URL
                image_url = None
                if track['album']['images']:
                    images = track['album']['images']
                    image_url = images[len(images)//2]['url'] if images else None
                
                track_info = {
                    'id': track['id'],
                    'name': track['name'],
                    'artists': artists,
                    'album': track['album']['name'],
                    'duration_ms': track['duration_ms'],
                    'popularity': track['popularity'],
                    'preview_url': track.get('preview_url'),
                    'external_urls': track['external_urls'],
                    'spotify_url': track['external_urls'].get('spotify'),
                    'image_url': image_url,
                    'release_date': track['album'].get('release_date'),
                    'uri': track['uri']
                }
                
                self.logger.info(f"Spotify Track Details erfolgreich geladen: {track['name']}")
                return {'success': True, 'track': track_info}
                
            else:
                self.logger.error(f"Spotify Track Details Fehler: {response.status_code}")
                return {'success': False, 'error': f'Track nicht gefunden: {response.status_code}'}
                
        except Exception as e:
            self.logger.error(f"Fehler beim Laden der Track-Details: {e}")
            return {'success': False, 'error': 'Fehler beim Laden der Track-Details'}

    def is_configured(self):
        """Prüfe ob Spotify korrekt konfiguriert ist"""
        return (self.enabled and 
                bool(self.client_id) and 
                bool(self.client_secret) and
                self.get_access_token() is not None)

    def get_audio_features(self, track_id):
        """Hole Audio-Features für einen Track (optional für erweiterte Funktionen)"""
        if not self.enabled:
            return {'success': False, 'error': 'Spotify-Integration deaktiviert'}
            
        access_token = self.get_access_token()
        if not access_token:
            return {'success': False, 'error': 'Spotify-Authentifizierung fehlgeschlagen'}
            
        try:
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
            
            url = f"{self.base_url}/audio-features/{track_id}"
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                features = response.json()
                self.logger.info(f"Audio Features erfolgreich geladen für Track: {track_id}")
                return {'success': True, 'features': features}
            else:
                self.logger.warning(f"Audio Features nicht verfügbar: {response.status_code}")
                return {'success': False, 'error': 'Audio Features nicht verfügbar'}
                
        except Exception as e:
            self.logger.error(f"Fehler beim Laden der Audio Features: {e}")
            return {'success': False, 'error': 'Fehler beim Laden der Audio Features'}


# Test-Funktion für Entwicklung
def test_spotify_manager():
    """Test-Funktion für die Spotify-Integration"""
    print("🎵 Teste Spotify Manager...")
    
    spotify = SpotifyManager()
    
    if not spotify.is_configured():
        print("❌ Spotify ist nicht konfiguriert")
        return False
    
    print("✅ Spotify ist konfiguriert")
    
    # Test-Suche
    result = spotify.search_tracks("Bohemian Rhapsody", limit=3)
    if result['success']:
        print(f"✅ Suche erfolgreich: {len(result['tracks'])} Tracks gefunden")
        
        # Teste Track-Details
        if result['tracks']:
            track_id = result['tracks'][0]['id']
            details = spotify.get_track_details(track_id)
            if details['success']:
                print("✅ Track-Details erfolgreich geladen")
            else:
                print(f"❌ Track-Details Fehler: {details['error']}")
    else:
        print(f"❌ Suche fehlgeschlagen: {result['error']}")
        return False
    
    return True


if __name__ == "__main__":
    test_spotify_manager()

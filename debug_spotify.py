#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Debug Spotify API Response
"""

from spotify_manager import SpotifyManager
import json

spotify = SpotifyManager()

# Test mit Ed Sheeran
result = spotify.search_tracks("Ed Sheeran Sapphire", limit=1)

if result['success'] and result['tracks']:
    track = result['tracks'][0]
    print("=== Debug Spotify Track Structure ===")
    print(json.dumps(track, indent=2, ensure_ascii=False))
else:
    print(f"Fehler: {result}")

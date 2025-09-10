#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Push Notification Manager für Hochzeitsplaner
Verwaltet Web Push Notifications für Admin-Benachrichtigungen
"""

import json
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from pywebpush import webpush, WebPushException
from config_manager import ConfigManager
import sqlite3

logger = logging.getLogger(__name__)


class PushNotificationManager:
    def __init__(self):
        self.config_manager = ConfigManager()
        self.auth_config = self.load_auth_config()
        vapid_config = self.auth_config.get('auth', {}).get('vapid_keys', {})
        self.vapid_keys = vapid_config
        
    def load_auth_config(self):
        """Lade auth_config.json direkt"""
        try:
            with open('auth_config.json', 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Fehler beim Laden der Auth-Konfiguration: {e}")
            return {'auth': {'users': [], 'vapid_keys': {}}}
        
    def get_connection(self):
        """Hole SQLite-Datenbankverbindung"""
        try:
            # Verwende den gleichen Pfad wie der HochzeitsDatenManager
            from pathlib import Path
            data_dir = Path("data")
            db_path = data_dir / "hochzeit.db"
            return sqlite3.connect(str(db_path))
        except Exception as e:
            logger.error(f"Fehler beim Verbinden zur Datenbank: {e}")
            return None
        
    def get_vapid_keys(self) -> Dict[str, str]:
        """Hole VAPID-Schlüssel aus der Konfiguration"""
        return {
            'public_key': self.vapid_keys.get('public_key', ''),
            'private_key': self.vapid_keys.get('private_key', ''),
            'email': self.vapid_keys.get('email', 'mailto:admin@hochzeitsplaner.de')
        }
    
    def save_push_subscription(self, user_id: str, subscription_data: Dict) -> bool:
        """Speichere Push-Subscription für einen Benutzer"""
        try:
            connection = self.get_connection()
            if not connection:
                logger.error("❌ Keine Datenbankverbindung")
                return False
                
            cursor = connection.cursor()
            
            # Erstelle Tabelle falls nicht vorhanden
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS push_subscriptions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    user_role TEXT DEFAULT 'admin',
                    endpoint TEXT NOT NULL,
                    p256dh_key TEXT NOT NULL,
                    auth_key TEXT NOT NULL,
                    user_agent TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_active BOOLEAN DEFAULT TRUE,
                    UNIQUE(user_id, endpoint)
                )
            """)
            
            # **DEBUG: Validiere Subscription-Daten**
            logger.info(f"🔧 Speichere Push Subscription für user_id: {user_id}")
            logger.info(f"🔧 Subscription data keys: {list(subscription_data.keys())}")
            
            # Validiere Subscription-Struktur
            if 'subscription' in subscription_data:
                # Unwrap nested subscription
                subscription = subscription_data['subscription']
                logger.info(f"🔧 Using nested subscription with keys: {list(subscription.keys())}")
            else:
                subscription = subscription_data
                logger.info(f"🔧 Using direct subscription with keys: {list(subscription.keys())}")
            
            # Validiere erforderliche Felder
            required_fields = ['endpoint', 'keys']
            for field in required_fields:
                if field not in subscription:
                    logger.error(f"❌ Fehlendes Feld in Subscription: {field}")
                    return False
            
            if 'p256dh' not in subscription['keys'] or 'auth' not in subscription['keys']:
                logger.error(f"❌ Fehlende Keys in subscription['keys']: {list(subscription['keys'].keys())}")
                return False
            
            logger.info(f"🔧 Endpoint: {subscription['endpoint'][:50]}...")
            logger.info(f"🔧 Keys: p256dh={subscription['keys']['p256dh'][:20]}..., auth={subscription['keys']['auth'][:20]}...")
            
            # Speichere oder aktualisiere Subscription
            cursor.execute("""
                INSERT OR REPLACE INTO push_subscriptions 
                (user_id, user_role, endpoint, p256dh_key, auth_key, last_used, user_agent)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                str(user_id),  # Ensure string
                'admin',
                subscription['endpoint'],
                subscription['keys']['p256dh'],
                subscription['keys']['auth'],
                datetime.now().isoformat(),
                subscription_data.get('userAgent', 'Unknown')
            ))
            
            connection.commit()
            logger.info(f"✅ Push-Subscription für User {user_id} gespeichert")
            return True
            
        except Exception as e:
            logger.error(f"❌ Fehler beim Speichern der Push-Subscription: {e}")
            logger.error(f"❌ Subscription data: {subscription_data}")
            return False
        finally:
            if 'connection' in locals():
                connection.close()
    
    def get_admin_subscriptions(self) -> List[Dict]:
        """Hole alle aktiven Push-Subscriptions von Admins"""
        try:
            connection = self.get_connection()
            if not connection:
                return []
                
            cursor = connection.cursor()
            
            # **VEREINFACHTE ADMIN-ERKENNUNG:**
            # Alle user_role='admin' Subscriptions holen
            cursor.execute("""
                SELECT ps.endpoint, ps.p256dh_key, ps.auth_key, ps.user_id
                FROM push_subscriptions ps
                WHERE ps.is_active = 1 
                AND ps.user_role = 'admin'
            """)
            
            subscriptions = []
            for row in cursor.fetchall():
                subscriptions.append({
                    'endpoint': row[0],
                    'keys': {
                        'p256dh': row[1],
                        'auth': row[2]
                    },
                    'user_id': row[3]
                })
            
            logger.info(f"🔍 {len(subscriptions)} aktive Admin-Subscriptions gefunden")
            
            # **DEBUG: Zeige alle Subscriptions in DB**
            cursor.execute("SELECT user_id, user_role, is_active, created_at FROM push_subscriptions")
            all_subs = cursor.fetchall()
            logger.info(f"🔧 Alle Subscriptions in DB: {all_subs}")
            
            return subscriptions
            
        except Exception as e:
            logger.error(f"❌ Fehler beim Abrufen der Admin-Subscriptions: {e}")
            return []
        finally:
            if 'connection' in locals():
                connection.close()
    
    def send_push_notification(self, title: str, body: str, data: Optional[Dict] = None) -> bool:
        """Sende Push-Notification an alle Admins"""
        try:
            subscriptions = self.get_admin_subscriptions()
            if not subscriptions:
                logger.warning("Keine aktiven Admin-Subscriptions für Push-Notification")
                return False
            
            vapid_keys = self.get_vapid_keys()
            if not all([vapid_keys['public_key'], vapid_keys['private_key']]):
                logger.error("VAPID-Schlüssel nicht vollständig konfiguriert")
                return False
            
            notification_data = {
                'title': title,
                'body': body,
                'icon': '/static/icons/apple-touch-icon.png',
                'badge': '/static/icons/apple-touch-icon.png',
                'tag': 'hochzeitsplaner-admin',
                'timestamp': datetime.now().isoformat(),
                'data': data or {}
            }
            
            successful_sends = 0
            failed_sends = 0
            
            for subscription in subscriptions:
                try:
                    # Korrekte pywebpush Parameter-Struktur
                    response = webpush(
                        subscription_info=subscription,
                        data=json.dumps(notification_data),
                        vapid_private_key=vapid_keys['private_key'],
                        vapid_claims={
                            "sub": vapid_keys['email']
                        }
                    )
                    successful_sends += 1
                    user_id = subscription['user_id']
                    logger.debug(f"✅ Push an User {user_id}: {response}")
                    
                except WebPushException as e:
                    failed_sends += 1
                    logger.error(f"❌ Push-Notification fehlgeschlagen für User {subscription['user_id']}: {e}")
                    
                    # Bei ungültiger Subscription: deaktivieren
                    if e.response and e.response.status_code in [410, 413]:
                        self._deactivate_subscription(subscription['endpoint'])
            
            logger.info(f"Push-Notifications: {successful_sends} erfolgreich, {failed_sends} fehlgeschlagen")
            return successful_sends > 0
            
        except Exception as e:
            logger.error(f"Fehler beim Senden der Push-Notifications: {e}")
            return False
    
    def _deactivate_subscription(self, endpoint: str):
        """Deaktiviere ungültige Subscription"""
        try:
            connection = self.get_connection()
            if not connection:
                return
                
            cursor = connection.cursor()
            
            cursor.execute("""
                UPDATE push_subscriptions 
                SET is_active = FALSE 
                WHERE endpoint = ?
            """, (endpoint,))
            
            connection.commit()
            logger.info(f"Ungültige Subscription deaktiviert: {endpoint}")
            
        except Exception as e:
            logger.error(f"Fehler beim Deaktivieren der Subscription: {e}")
        finally:
            if 'connection' in locals() and connection:
                connection.close()
    
    def get_rsvp_statistics(self) -> Dict[str, int]:
        """Hole aktuelle RSVP-Statistiken"""
        try:
            connection = self.get_connection()
            if not connection:
                return {'zugesagt': 0, 'abgesagt': 0, 'offen': 0, 'gesamt': 0}
                
            cursor = connection.cursor()
            
            # Hole RSVP-Statistiken
            cursor.execute("""
                SELECT 
                    COUNT(CASE WHEN status = 'Zugesagt' THEN 1 END) as zugesagt,
                    COUNT(CASE WHEN status = 'Abgesagt' THEN 1 END) as abgesagt,
                    COUNT(CASE WHEN status = 'Offen' OR status IS NULL THEN 1 END) as offen,
                    COUNT(*) as gesamt
                FROM gaeste
            """)
            
            result = cursor.fetchone()
            if result:
                return {
                    'zugesagt': result[0] or 0,
                    'abgesagt': result[1] or 0,
                    'offen': result[2] or 0,
                    'gesamt': result[3] or 0
                }
            else:
                return {'zugesagt': 0, 'abgesagt': 0, 'offen': 0, 'gesamt': 0}
                
        except Exception as e:
            logger.error(f"Fehler beim Abrufen der RSVP-Statistiken: {e}")
            return {'zugesagt': 0, 'abgesagt': 0, 'offen': 0, 'gesamt': 0}
        finally:
            if 'connection' in locals() and connection:
                connection.close()
    
    def send_rsvp_notification(self, guest_name: str, guest_id: int, 
                              rsvp_status: str, message: str = "") -> bool:
        """Sende Benachrichtigung bei neuer RSVP mit Statistiken"""
        title = "🎉 Neue RSVP eingegangen!"
        
        status_text = {
            'zugesagt': 'hat zugesagt',
            'abgesagt': 'hat abgesagt', 
            'maybe': 'ist sich unsicher'
        }.get(rsvp_status.lower(), rsvp_status)
        
        # Hole aktuelle Statistiken
        stats = self.get_rsvp_statistics()
        
        body = f"{guest_name} {status_text}\n"
        body += f"📊 Status: {stats['zugesagt']} zugesagt, "
        body += f"{stats['abgesagt']} abgesagt, {stats['offen']} offen"
        
        if message:
            body += f"\n💬 {message[:40]}{'...' if len(message) > 40 else ''}"
        
        data = {
            'type': 'rsvp',
            'guest_id': guest_id,
            'guest_name': guest_name,
            'status': rsvp_status,
            'statistics': stats,
            'url': f'/gaesteliste?highlight={guest_id}'
        }
        
        return self.send_push_notification(title, body, data)
    
    def send_gift_notification(self, guest_name: str, gift_name: str) -> bool:
        """Sende Benachrichtigung bei neuer Geschenkauswahl"""
        title = "🎁 Neues Geschenk ausgewählt!"
        body = f"{guest_name} hat '{gift_name}' ausgewählt"
        
        data = {
            'type': 'gift',
            'guest_name': guest_name,
            'gift_name': gift_name,
            'url': '/geschenkliste'
        }
        
        return self.send_push_notification(title, body, data)
    
    def send_upload_notification(self, guest_name: str, file_count: int) -> bool:
        """Sende Benachrichtigung bei neuen Uploads"""
        title = "📸 Neue Dateien hochgeladen!"
        file_text = "Datei" if file_count == 1 else "Dateien"
        body = f"{guest_name} hat {file_count} {file_text} hochgeladen"
        
        data = {
            'type': 'upload',
            'guest_name': guest_name,
            'file_count': file_count,
            'url': '/upload_approval'
        }
        
        return self.send_push_notification(title, body, data)
    
    def cleanup_old_subscriptions(self, days: int = 30):
        """Entferne alte, inaktive Subscriptions"""
        try:
            connection = self.get_connection()
            if not connection:
                return
                
            cursor = connection.cursor()
            
            cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
            
            cursor.execute("""
                DELETE FROM push_subscriptions 
                WHERE (is_active = FALSE OR last_used < ?) 
                AND created_at < ?
            """, (cutoff_date, cutoff_date))
            
            deleted = cursor.rowcount
            connection.commit()
            
            if deleted > 0:
                logger.info(f"{deleted} alte Push-Subscriptions entfernt")
                
        except Exception as e:
            logger.error(f"Fehler beim Bereinigen der Subscriptions: {e}")
        finally:
            if 'connection' in locals() and connection:
                connection.close()


# Singleton-Instanz
push_manager = PushNotificationManager()

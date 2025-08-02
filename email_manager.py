#!/usr/bin/env python3
"""
E-Mail Manager für Hochzeitsplaner
Ermöglicht das Versenden von E-Mails über SMTP
"""

import smtplib
import imaplib
import email
import json
import os
import logging
import sqlite3
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
import threading
import time

class EmailManager:
    def __init__(self, config_path: str = "auth_config.json"):
        """Initialisiert den EmailManager mit SMTP- und IMAP-Konfiguration."""
        self.config_path = config_path
        self.config = self._load_config()
        self.logger = logging.getLogger(__name__)
        self.email_history = self._load_email_history()
        self.data_manager = None  # Wird später gesetzt
        self.check_interval = 600  # 10 Minuten in Sekunden
        self.checking_thread = None
        self.stop_checking = False
        
    def _load_config(self) -> Dict[str, Any]:
        """Lädt die E-Mail-Konfiguration aus der JSON-Datei."""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as file:
                config = json.load(file)
                # Validate required SMTP fields
                required_smtp_fields = ['smtp_server', 'smtp_port', 'username', 'password']
                smtp_config = config.get('email', {})
                for field in required_smtp_fields:
                    if field not in smtp_config:
                        raise ValueError(f"Fehlende SMTP-Konfiguration: {field}")
                
                # IMAP config ist optional
                imap_config = smtp_config.get('imap', {})
                if imap_config:
                    required_imap_fields = ['imap_server', 'imap_port']
                    for field in required_imap_fields:
                        if field not in imap_config:
                            logging.warning(f"IMAP-Konfiguration unvollständig: {field} fehlt")
                
                return config
        except FileNotFoundError:
            raise FileNotFoundError(f"Konfigurationsdatei nicht gefunden: {self.config_path}")
        except json.JSONDecodeError as e:
            raise ValueError(f"Fehler beim Lesen der Konfiguration: {e}")
        except Exception as e:
            raise Exception(f"Unerwarteter Fehler beim Laden der Konfiguration: {e}")
    
    def _load_email_history(self) -> List[Dict[str, Any]]:
        """Lädt die E-Mail-Historie aus einer JSON-Datei."""
        history_file = "email_history.json"
        try:
            if os.path.exists(history_file):
                with open(history_file, 'r', encoding='utf-8') as file:
                    return json.load(file)
            return []
        except Exception as e:
            self.logger.warning(f"Fehler beim Laden der E-Mail-Historie: {e}")
            return []
    
    def _save_email_history(self):
        """Speichert die E-Mail-Historie in eine JSON-Datei."""
        history_file = "email_history.json"
        try:
            with open(history_file, 'w', encoding='utf-8') as file:
                json.dump(self.email_history, file, indent=2, ensure_ascii=False)
        except Exception as e:
            self.logger.error(f"Fehler beim Speichern der E-Mail-Historie: {e}")
    
    def is_enabled(self) -> bool:
        """Prüft, ob E-Mail-Funktionalität aktiviert ist"""
        return self.config.get('email', {}).get('enabled', False)
    
    def test_connection(self) -> Dict[str, Any]:
        """
        Testet die SMTP-Verbindung
        
        Returns:
            Dict mit Status und Nachricht
        """
        if not self.is_enabled():
            return {
                "success": False,
                "message": "E-Mail-Funktionalität ist deaktiviert"
            }
        
        required_fields = ['smtp_server', 'smtp_port', 'username', 'password']
        missing_fields = [field for field in required_fields if not self.config.get(field)]
        
        if missing_fields:
            return {
                "success": False,
                "message": f"Fehlende Konfiguration: {', '.join(missing_fields)}"
            }
        
        try:
            server = smtplib.SMTP(self.config['smtp_server'], self.config['smtp_port'])
            
            if self.config.get('use_tls', True):
                server.starttls()
            
            server.login(self.config['username'], self.config['password'])
            server.quit()
            
            return {
                "success": True,
                "message": "SMTP-Verbindung erfolgreich getestet"
            }
            
        except Exception as e:
            self.logger.error(f"SMTP-Verbindungstest fehlgeschlagen: {e}")
            return {
                "success": False,
                "message": f"Verbindungsfehler: {str(e)}"
            }
    
    def send_email(self, 
                   to_emails: List[str], 
                   subject: str, 
                   body: str,
                   html_body: Optional[str] = None,
                   cc_emails: Optional[List[str]] = None,
                   bcc_emails: Optional[List[str]] = None,
                   attachments: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Sendet eine E-Mail
        
        Args:
            to_emails: Liste der Empfänger-E-Mail-Adressen
            subject: E-Mail-Betreff
            body: E-Mail-Text (Plain Text)
            html_body: E-Mail-Text (HTML, optional)
            cc_emails: CC-Empfänger (optional)
            bcc_emails: BCC-Empfänger (optional)
            attachments: Liste der Dateipfade für Anhänge (optional)
            
        Returns:
            Dict mit Status und Details
        """
        if not self.is_enabled():
            return {
                "success": False,
                "message": "E-Mail-Funktionalität ist deaktiviert"
            }
        
        if not to_emails:
            return {
                "success": False,
                "message": "Keine Empfänger angegeben"
            }
        
        try:
            # E-Mail-Konfiguration
            email_config = self.config['email']
            
            # E-Mail erstellen
            msg = MIMEMultipart('alternative')
            
            # Header setzen
            from_email = email_config.get('from_email', email_config.get('username', ''))
            from_name = email_config.get('from_name', 'Hochzeitsplaner')
            
            msg['From'] = f"{from_name} <{from_email}>"
            msg['To'] = ', '.join(to_emails)
            msg['Subject'] = f"{email_config.get('default_subject_prefix', '')}{subject}"
            
            if email_config.get('reply_to'):
                msg['Reply-To'] = email_config['reply_to']
            
            if cc_emails:
                msg['Cc'] = ', '.join(cc_emails)
            
            # Schöne sichtbare Signatur hinzufügen
            signature = f"""

---

Mit freundlichen Grüßen
Pascal Schumacher & Katharina Schaffrath


❤️ Powered by Hochzeitsplaner"""
            
            body_with_signature = body + signature
            
            # Text-Teil hinzufügen
            text_part = MIMEText(body_with_signature, 'plain', 'utf-8')
            msg.attach(text_part)
            
            # HTML-Teil hinzufügen (falls vorhanden)
            if html_body:
                # Schöne HTML-Signatur
                html_signature = """
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.5;">
                    <p style="margin: 0; margin-bottom: 10px;"><strong>Mit freundlichen Grüßen</strong></p>
                    <p style="margin: 0; margin-bottom: 20px;">Pascal Schumacher & Katharina Schaffrath</p>
                    
                    <p style="margin: 0; font-size: 12px; color: #888; font-style: italic;">
                        ❤️ <em>Powered by Hochzeitsplaner</em>
                    </p>
                </div>
                """
                
                html_with_signature = html_body + html_signature
                html_part = MIMEText(html_with_signature, 'html', 'utf-8')
                msg.attach(html_part)
            
            # Anhänge hinzufügen
            if attachments:
                for file_path in attachments:
                    if os.path.isfile(file_path):
                        with open(file_path, 'rb') as attachment:
                            part = MIMEBase('application', 'octet-stream')
                            part.set_payload(attachment.read())
                            encoders.encode_base64(part)
                            part.add_header(
                                'Content-Disposition',
                                f'attachment; filename= {os.path.basename(file_path)}'
                            )
                            msg.attach(part)
            
            # E-Mail senden
            server = smtplib.SMTP(email_config['smtp_server'], email_config['smtp_port'])
            
            if email_config.get('use_tls', True):
                server.starttls()
            
            server.login(email_config['username'], email_config['password'])
            
            # Alle Empfänger sammeln
            all_recipients = to_emails.copy()
            if cc_emails:
                all_recipients.extend(cc_emails)
            if bcc_emails:
                all_recipients.extend(bcc_emails)
            
            server.send_message(msg, to_addrs=all_recipients)
            server.quit()
            
            self.logger.info(f"E-Mail erfolgreich gesendet an: {', '.join(to_emails)}")
            
            return {
                "success": True,
                "message": f"E-Mail erfolgreich an {len(all_recipients)} Empfänger gesendet",
                "recipients": len(all_recipients),
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            error_msg = f"Fehler beim E-Mail-Versand: {str(e)}"
            self.logger.error(error_msg)
            return {
                "success": False,
                "message": error_msg,
                "timestamp": datetime.now().isoformat()
            }
    
    def send_guest_invitation(self, guest_email: str, guest_name: str, 
                            event_date: str, event_location: str,
                            rsvp_link: Optional[str] = None) -> Dict[str, Any]:
        """
        Sendet eine Hochzeitseinladung per E-Mail
        
        Args:
            guest_email: E-Mail-Adresse des Gastes
            guest_name: Name des Gastes
            event_date: Hochzeitsdatum
            event_location: Hochzeitsort
            rsvp_link: Link zur RSVP-Seite (optional)
            
        Returns:
            Dict mit Status und Details
        """
        subject = "Einladung zu unserer Hochzeit"
        
        # Plain Text Version
        body = f"""Liebe/r {guest_name},

wir laden Dich herzlich zu unserer Hochzeit ein!

Datum: {event_date}
Ort: {event_location}

"""
        
        if rsvp_link:
            body += f"Bitte bestätige Deine Teilnahme unter: {rsvp_link}\n\n"
        
        body += """Wir freuen uns sehr auf Dich!

Herzliche Grüße
Pascal & Käthe"""
        
        # HTML Version
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2 style="color: #8B4513;">Einladung zu unserer Hochzeit</h2>
            
            <p>Liebe/r <strong>{guest_name}</strong>,</p>
            
            <p>wir laden Dich herzlich zu unserer Hochzeit ein!</p>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #8B4513; margin: 20px 0;">
                <p><strong>Datum:</strong> {event_date}</p>
                <p><strong>Ort:</strong> {event_location}</p>
            </div>
        """
        
        if rsvp_link:
            html_body += f"""
            <p>
                <a href="{rsvp_link}" style="background-color: #8B4513; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                    Teilnahme bestätigen
                </a>
            </p>
            """
        
        html_body += """
            <p>Wir freuen uns sehr auf Dich!</p>
            
            <p style="margin-top: 30px;">
                Herzliche Grüße<br>
                <strong>Pascal & Käthe</strong>
            </p>
        </body>
        </html>
        """
        
        return self.send_email(
            to_emails=[guest_email],
            subject=subject,
            body=body,
            html_body=html_body
        )
    
    def send_reminder_email(self, guest_email: str, guest_name: str,
                          reminder_text: str) -> Dict[str, Any]:
        """
        Sendet eine Erinnerungs-E-Mail
        
        Args:
            guest_email: E-Mail-Adresse des Gastes
            guest_name: Name des Gastes
            reminder_text: Erinnerungstext
            
        Returns:
            Dict mit Status und Details
        """
        subject = "Erinnerung: Unsere Hochzeit"
        
        body = f"""Liebe/r {guest_name},

{reminder_text}

Herzliche Grüße
Pascal & Käthe"""
        
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2 style="color: #8B4513;">Erinnerung: Unsere Hochzeit</h2>
            
            <p>Liebe/r <strong>{guest_name}</strong>,</p>
            
            <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
                {reminder_text.replace(chr(10), '<br>')}
            </div>
            
            <p style="margin-top: 30px;">
                Herzliche Grüße<br>
                <strong>Pascal & Käthe</strong>
            </p>
        </body>
        </html>
        """
        
        return self.send_email(
            to_emails=[guest_email],
            subject=subject,
            body=body,
            html_body=html_body
        )
    
    def send_task_email(self, 
                       task_id: int,
                       task_title: str,
                       to_emails: List[str], 
                       subject: str, 
                       body: str,
                       html_body: Optional[str] = None,
                       cc_emails: Optional[List[str]] = None,
                       in_reply_to: Optional[str] = None,
                       references: Optional[str] = None) -> Dict[str, Any]:
        """
        Sendet eine aufgabenbezogene E-Mail mit Thread-ID
        
        Args:
            task_id: ID der verknüpften Aufgabe
            task_title: Titel der Aufgabe
            to_emails: Empfänger-E-Mail-Adressen
            subject: E-Mail-Betreff
            body: E-Mail-Text (Plain Text)
            html_body: E-Mail-Text (HTML, optional)
            cc_emails: CC-Empfänger (optional)
            in_reply_to: Message-ID der E-Mail, auf die geantwortet wird
            references: References Header für Threading
            
        Returns:
            Dict mit Erfolgsstatus und Details
        """
        if not self.is_enabled():
            return {
                "success": False,
                "message": "E-Mail-Funktionalität ist deaktiviert"
            }
        
        try:
            # Thread-ID für Aufgabe generieren
            thread_id = f"task-{task_id}-{uuid.uuid4().hex[:8]}"
            
            # E-Mail-Betreff ohne Aufgaben-Prefix vorne (ID nur in Headers)
            prefixed_subject = subject
            
            # E-Mail-Konfiguration
            email_config = self.config['email']
            
            # E-Mail erstellen
            msg = MIMEMultipart('alternative')
            msg['From'] = f"{email_config.get('from_name', 'Hochzeitsplaner')} <{email_config['from_email']}>"
            msg['To'] = ', '.join(to_emails)
            msg['Subject'] = prefixed_subject
            msg['Reply-To'] = email_config.get('reply_to', email_config['from_email'])
            
            # Threading-Headers für Antworten
            if in_reply_to:
                msg['In-Reply-To'] = in_reply_to
                if references:
                    msg['References'] = references
                else:
                    msg['References'] = in_reply_to
            
            # Custom Headers für Thread-Tracking
            msg['X-Task-ID'] = str(task_id)
            msg['X-Thread-ID'] = thread_id
            msg['Message-ID'] = f"<{thread_id}@hochzeitsplaner.local>"
            
            if cc_emails:
                msg['Cc'] = ', '.join(cc_emails)
            
            # Aufgaben-Kontext für automatische Zuordnung (diskret am Ende der E-Mail)
            task_context = f"\n\n[Intern: Task #{task_id} | {task_title} | {thread_id}]"
            
            # Verbesserte professionelle Signatur
            signature = f"""

---

Mit freundlichen Grüßen
Pascal Schumacher & Katharina Schaffrath

❤️ Powered by Hochzeitsplaner"""
            
            body_with_context = body + signature + task_context
            
            # Text-Teil hinzufügen
            text_part = MIMEText(body_with_context, 'plain', 'utf-8')
            msg.attach(text_part)
            
            # HTML-Teil hinzufügen (falls vorhanden)
            if html_body:
                # Verbesserte HTML-Signatur mit kursivem, kleinerem "Powered by"
                html_signature = """
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.5;">
                    <p style="margin: 0; margin-bottom: 10px;"><strong>Mit freundlichen Grüßen</strong></p>
                    <p style="margin: 0; margin-bottom: 20px;">Pascal Schumacher & Katharina Schaffrath</p>
                    
                    <p style="margin: 0; font-size: 11px; color: #888; font-style: italic;">
                        ❤️ <em>Powered by Hochzeitsplaner</em>
                    </p>
                </div>
                """
                
                # Diskrete Task-Informationen für automatische Zuordnung (sehr klein und unauffällig)
                html_context = f"""
                <div style="font-size: 8px; color: #f0f0f0; margin-top: 30px; font-family: monospace;">
                    [Intern: Task #{task_id} | {task_title} | {thread_id}]
                </div>
                """
                html_with_context = html_body + html_signature + html_context
                html_part = MIMEText(html_with_context, 'html', 'utf-8')
                msg.attach(html_part)
            
            # E-Mail senden
            server = smtplib.SMTP(email_config['smtp_server'], email_config['smtp_port'])
            
            if email_config.get('use_tls', True):
                server.starttls()
            
            server.login(email_config['username'], email_config['password'])
            
            # Alle Empfänger zusammenfassen
            all_recipients = to_emails.copy()
            if cc_emails:
                all_recipients.extend(cc_emails)
            
            server.send_message(msg, to_addrs=all_recipients)
            server.quit()
            
            self.logger.info(f"Aufgaben-E-Mail gesendet: Task #{task_id}, Thread {thread_id}")
            
            return {
                "success": True,
                "message": "Aufgaben-E-Mail erfolgreich gesendet",
                "thread_id": thread_id,
                "message_id": msg['Message-ID'],
                "sent_to": to_emails,
                "cc_to": cc_emails or [],
                "sent_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"Fehler beim Senden der Aufgaben-E-Mail: {e}")
            return {
                "success": False,
                "message": f"Fehler beim Senden: {str(e)}"
            }
    
    def set_data_manager(self, data_manager):
        """Setzt die Referenz zum DataManager für Task-Updates."""
        self.data_manager = data_manager
    
    def start_email_checking(self):
        """Startet den automatischen E-Mail-Abruf in einem separaten Thread."""
        if self.checking_thread is None or not self.checking_thread.is_alive():
            self.stop_checking = False
            self.checking_thread = threading.Thread(target=self._email_checking_loop, daemon=True)
            self.checking_thread.start()
            print("✅ Automatischer E-Mail-Abruf gestartet (alle 10 Minuten)")
    
    def stop_email_checking(self):
        """Stoppt den automatischen E-Mail-Abruf."""
        self.stop_checking = True
        if self.checking_thread and self.checking_thread.is_alive():
            self.checking_thread.join(timeout=5)
        print("📧 E-Mail-Checking gestoppt")
    
    def _email_checking_loop(self):
        """Haupt-Loop für den automatischen E-Mail-Abruf."""
        while not self.stop_checking:
            try:
                self.check_for_new_emails()
            except Exception as e:
                self.logger.error(f"Fehler beim automatischen E-Mail-Abruf: {e}")
            
            # Warte 10 Minuten oder bis stop_checking True wird
            for _ in range(600):  # 600 Sekunden = 10 Minuten
                if self.stop_checking:
                    break
                time.sleep(1)
    
    def check_for_new_emails(self):
        """Prüft auf neue E-Mails und verknüpft sie mit Aufgaben."""
        try:
            imap_config = self.config.get('email', {}).get('imap', {})
            if not imap_config or not imap_config.get('imap_server'):
                self.logger.debug("IMAP-Konfiguration nicht verfügbar - überspringe E-Mail-Abruf")
                return
            
            # IMAP-Verbindung herstellen
            imap_server = imap_config['imap_server']
            imap_port = imap_config.get('imap_port', 993)
            username = self.config['email']['username']
            password = self.config['email']['password']
            
            self.logger.debug(f"Verbinde zu IMAP-Server: {imap_server}:{imap_port}")
            
            # SSL-Verbindung zum IMAP-Server
            imap = imaplib.IMAP4_SSL(imap_server, imap_port)
            
            # IONOS Catch-All Login: Username in Anführungszeichen setzen für * Zeichen
            if '*' in username:
                # Für IONOS Catch-All Adressen muss der Username quotiert werden
                imap.login(f'"{username}"', password)
            else:
                imap.login(username, password)
            
            # Wähle INBOX
            imap.select('INBOX')
            
            # Suche nach ungelesenen E-Mails
            status, messages = imap.search(None, 'UNSEEN')
            
            if status != 'OK':
                self.logger.warning("Keine ungelesenen E-Mails gefunden")
                imap.close()
                imap.logout()
                return
            
            message_ids = messages[0].split()
            self.logger.info(f"{len(message_ids)} ungelesene E-Mails gefunden")
            
            for msg_id in message_ids:
                try:
                    self._process_email(imap, msg_id)
                except Exception as e:
                    self.logger.error(f"Fehler beim Verarbeiten der E-Mail {msg_id}: {e}")
            
            imap.close()
            imap.logout()
            
        except Exception as e:
            self.logger.error(f"Fehler beim IMAP-E-Mail-Abruf: {e}")
    
    def _process_email(self, imap, msg_id):
        """Verarbeitet eine einzelne E-Mail und verknüpft sie mit einer Aufgabe."""
        try:
            # E-Mail abrufen ohne als gelesen zu markieren
            status, msg_data = imap.fetch(msg_id, '(BODY.PEEK[])')
            if status != 'OK':
                return
            
            # E-Mail parsen
            email_body = msg_data[0][1]
            email_message = email.message_from_bytes(email_body)
            
            # E-Mail-Headers extrahieren
            subject = email_message.get('Subject', '')
            from_addr = email_message.get('From', '')
            to_addr = email_message.get('To', '')
            message_id = email_message.get('Message-ID', '')
            in_reply_to = email_message.get('In-Reply-To', '')
            references = email_message.get('References', '')
            date_received = email_message.get('Date', '')
            
            self.logger.debug(f"Verarbeite E-Mail: {subject} von {from_addr}")
            
            # Prüfe auf Thread-ID in References oder In-Reply-To
            task_id = self._extract_task_id_from_email(in_reply_to, references, message_id)
            
            if task_id:
                # E-Mail-Content extrahieren
                content = self._extract_email_content(email_message)
                
                # E-Mail zur Historie hinzufügen
                email_entry = {
                    'id': str(uuid.uuid4()),
                    'task_id': task_id,
                    'type': 'received',
                    'from': from_addr,
                    'to': to_addr,
                    'subject': subject,
                    'content': content,
                    'timestamp': datetime.now().isoformat(),
                    'message_id': message_id,
                    'in_reply_to': in_reply_to
                }
                
                self.email_history.append(email_entry)
                self._save_email_history()
                
                # Update Task mit neuer E-Mail (falls DataManager verfügbar)
                if self.data_manager:
                    self._update_task_with_email(task_id, email_entry)
                
                self.logger.info(f"E-Mail verknüpft mit Aufgabe {task_id}: {subject}")
            else:
                self.logger.debug(f"E-Mail konnte keiner Aufgabe zugeordnet werden: {subject}")
                
        except Exception as e:
            self.logger.error(f"Fehler beim Verarbeiten der E-Mail: {e}")
    
    def _extract_task_id_from_email(self, in_reply_to, references, message_id):
        """Extrahiert die Task-ID aus E-Mail-Headers."""
        # Suche in allen vorhandenen E-Mails nach Thread-ID Übereinstimmungen
        for email_entry in self.email_history:
            if email_entry.get('type') == 'sent':
                # Prüfe Message-ID Übereinstimmung
                if (in_reply_to and email_entry.get('message_id') == in_reply_to):
                    return email_entry.get('task_id')
                
                # Prüfe References
                if references and email_entry.get('message_id') in references:
                    return email_entry.get('task_id')
        
        return None
    
    def _extract_email_content(self, email_message):
        """Extrahiert den Textinhalt einer E-Mail."""
        content = ""
        
        if email_message.is_multipart():
            for part in email_message.walk():
                content_type = part.get_content_type()
                if content_type == "text/plain":
                    try:
                        payload = part.get_payload(decode=True)
                        if payload:
                            content = payload.decode('utf-8', errors='ignore')
                            break
                    except Exception as e:
                        self.logger.warning(f"Fehler beim Dekodieren des E-Mail-Inhalts: {e}")
        else:
            try:
                payload = email_message.get_payload(decode=True)
                if payload:
                    content = payload.decode('utf-8', errors='ignore')
            except Exception as e:
                self.logger.warning(f"Fehler beim Dekodieren des E-Mail-Inhalts: {e}")
        
        return content.strip()
    
    def _extract_thread_id(self, email_message):
        """Extrahiert die Thread-ID aus einer E-Mail."""
        # Thread-ID kann aus verschiedenen Headern kommen
        thread_id = email_message.get('Thread-Topic', '')
        if not thread_id:
            thread_id = email_message.get('In-Reply-To', '')
        if not thread_id:
            thread_id = email_message.get('References', '')
        if not thread_id:
            # Fallback: Message-ID verwenden
            thread_id = email_message.get('Message-ID', '')
        
        return thread_id
    
    def _decode_header(self, header_value):
        """Dekodiert E-Mail-Header korrekt (z.B. Subject, From)"""
        if not header_value:
            return ''
        
        try:
            from email.header import decode_header
            decoded_parts = decode_header(header_value)
            decoded_string = ''
            
            for part, encoding in decoded_parts:
                if isinstance(part, bytes):
                    if encoding:
                        decoded_string += part.decode(encoding)
                    else:
                        # Fallback zu utf-8 wenn keine Encoding angegeben
                        decoded_string += part.decode('utf-8', errors='ignore')
                else:
                    decoded_string += str(part)
            
            return decoded_string.strip()
        except Exception as e:
            self.logger.warning(f"Fehler beim Dekodieren des Headers '{header_value}': {e}")
            return str(header_value) if header_value else ''
    
    def _update_task_with_email(self, task_id, email_entry):
        """Aktualisiert eine Aufgabe mit einer neuen E-Mail."""
        try:
            if self.data_manager:
                tasks = self.data_manager.lade_aufgaben()
                for task in tasks:
                    if task.get('id') == task_id:
                        if 'emails' not in task:
                            task['emails'] = []
                        task['emails'].append({
                            'type': 'received',
                            'from': email_entry.get('from'),
                            'subject': email_entry.get('subject'),
                            'timestamp': email_entry.get('timestamp')
                        })
                        self.data_manager.speichere_aufgaben(tasks)
                        break
        except Exception as e:
            self.logger.error(f"Fehler beim Aktualisieren der Aufgabe {task_id}: {e}")
    
    def get_unread_emails(self) -> List[Dict[str, Any]]:
        """Ruft alle ungelesenen E-Mails ab"""
        if not self.is_enabled():
            return []
        
        try:
            mail = imaplib.IMAP4_SSL(self.config['email']['imap']['imap_server'], 
                                    self.config['email']['imap']['imap_port'])
            
            # Login mit korrekter Formatierung für IONOS
            username = f'"{self.config["email"]["username"]}"'
            mail.login(username, self.config['email']['password'])
            
            mail.select('INBOX')
            
            # Suche nach ungelesenen E-Mails
            result, data = mail.search(None, 'UNSEEN')
            
            if result != 'OK':
                self.logger.error("Fehler beim Suchen nach ungelesenen E-Mails")
                return []
            
            unread_emails = []
            email_ids = data[0].split()
            
            for email_id in email_ids:
                try:
                    # E-Mail-Details abrufen ohne als gelesen zu markieren
                    result, msg_data = mail.fetch(email_id, '(BODY.PEEK[])')
                    if result == 'OK':
                        email_message = email.message_from_bytes(msg_data[0][1])
                        
                        # E-Mail-Details extrahieren
                        email_info = {
                            'email_id': email_id.decode(),
                            'subject': self._decode_header(email_message.get('Subject')) or 'Kein Betreff',
                            'from_email': self._decode_header(email_message.get('From')) or 'Unbekannter Absender',
                            'to_email': self._decode_header(email_message.get('To')) or '',
                            'date': email_message.get('Date', '') or '',
                            'received_at': datetime.now().isoformat(),
                            'body': self._extract_email_content(email_message),
                            'message_id': email_message.get('Message-ID', ''),
                            'thread_id': self._extract_thread_id(email_message)
                        }
                        
                        unread_emails.append(email_info)
                        
                except Exception as e:
                    self.logger.error(f"Fehler beim Verarbeiten der E-Mail {email_id}: {e}")
                    continue
            
            mail.close()
            mail.logout()
            
            self.logger.info(f"✅ {len(unread_emails)} ungelesene E-Mails abgerufen")
            return unread_emails
            
        except Exception as e:
            self.logger.error(f"Fehler beim Abrufen ungelesener E-Mails: {e}")
            return []
    
    def get_all_emails(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Ruft alle E-Mails ab (gelesen und ungelesen), limitiert auf die neuesten"""
        if not self.is_enabled():
            return []
        
        try:
            mail = imaplib.IMAP4_SSL(self.config['email']['imap']['imap_server'], 
                                    self.config['email']['imap']['imap_port'])
            
            # Login mit korrekter Formatierung für IONOS
            username = f'"{self.config["email"]["username"]}"'
            mail.login(username, self.config['email']['password'])
            
            mail.select('INBOX')
            
            # Suche nach allen E-Mails, sortiert nach Datum (neueste zuerst)
            result, data = mail.search(None, 'ALL')
            
            if result != 'OK':
                self.logger.error("Fehler beim Suchen nach E-Mails")
                return []
            
            all_emails = []
            email_ids = data[0].split()
            
            # Nur die neuesten E-Mails abrufen (rückwärts durch die Liste)
            recent_email_ids = email_ids[-limit:] if len(email_ids) > limit else email_ids
            recent_email_ids.reverse()  # Neueste zuerst
            
            for email_id in recent_email_ids:
                try:
                    # E-Mail-Details abrufen ohne als gelesen zu markieren
                    result, msg_data = mail.fetch(email_id, '(BODY.PEEK[] FLAGS)')
                    if result == 'OK':
                        email_message = email.message_from_bytes(msg_data[0][1])
                        
                        # Flags extrahieren um zu sehen ob gelesen/ignoriert
                        flags_match = msg_data[0][0].decode()
                        is_read = '\\Seen' in flags_match
                        is_ignored = '\\Flagged' in flags_match
                        
                        # Prüfe auch lokale Ignored-Liste
                        if not is_ignored:
                            ignored_emails = self._get_ignored_emails()
                            is_ignored = email_id.decode() in ignored_emails
                        
                        # E-Mail-Details extrahieren
                        email_info = {
                            'email_id': email_id.decode(),
                            'subject': self._decode_header(email_message.get('Subject')) or 'Kein Betreff',
                            'from_email': self._decode_header(email_message.get('From')) or 'Unbekannter Absender',
                            'to_email': self._decode_header(email_message.get('To')) or '',
                            'date': email_message.get('Date', '') or '',
                            'received_at': datetime.now().isoformat(),
                            'body': self._extract_email_content(email_message),
                            'message_id': email_message.get('Message-ID', ''),
                            'thread_id': self._extract_thread_id(email_message),
                            'is_read': is_read,
                            'is_ignored': is_ignored
                        }
                        
                        all_emails.append(email_info)
                        
                except Exception as e:
                    self.logger.error(f"Fehler beim Verarbeiten der E-Mail {email_id}: {e}")
                    continue
            
            mail.close()
            mail.logout()
            
            self.logger.info(f"✅ {len(all_emails)} E-Mails abgerufen")
            return all_emails
            
        except Exception as e:
            self.logger.error(f"Fehler beim Abrufen der E-Mails: {e}")
            return []
    
    def get_email_by_id(self, email_id: str) -> Dict[str, Any]:
        """Ruft eine E-Mail anhand ihrer ID ab"""
        if not self.is_enabled():
            return None
        
        try:
            mail = imaplib.IMAP4_SSL(self.config['email']['imap']['imap_server'], 
                                    self.config['email']['imap']['imap_port'])
            
            # Login mit korrekter Formatierung für IONOS
            username = f'"{self.config["email"]["username"]}"'
            mail.login(username, self.config['email']['password'])
            
            mail.select('INBOX')
            
            # E-Mail-Details abrufen ohne als gelesen zu markieren
            result, msg_data = mail.fetch(email_id.encode(), '(BODY.PEEK[])')
            if result == 'OK':
                email_message = email.message_from_bytes(msg_data[0][1])
                
                # E-Mail-Details extrahieren
                email_info = {
                    'email_id': email_id,
                    'subject': self._decode_header(email_message.get('Subject')) or 'Kein Betreff',
                    'from_email': self._decode_header(email_message.get('From')) or 'Unbekannter Absender',
                    'to_email': self._decode_header(email_message.get('To')) or '',
                    'date': email_message.get('Date', '') or '',
                    'received_at': datetime.now().isoformat(),
                    'body': self._extract_email_content(email_message),
                    'message_id': email_message.get('Message-ID', ''),
                    'thread_id': self._extract_thread_id(email_message)
                }
                
                mail.close()
                mail.logout()
                
                return email_info
            else:
                self.logger.error(f"E-Mail mit ID {email_id} nicht gefunden")
                return None
                
        except Exception as e:
            self.logger.error(f"Fehler beim Abrufen der E-Mail {email_id}: {e}")
            return None
    
    def mark_email_as_read(self, email_id: str) -> bool:
        """Markiert eine E-Mail als gelesen"""
        if not self.is_enabled():
            return False
        
        try:
            mail = imaplib.IMAP4_SSL(self.config['email']['imap']['imap_server'], 
                                    self.config['email']['imap']['imap_port'])
            
            # Login mit korrekter Formatierung für IONOS
            username = f'"{self.config["email"]["username"]}"'
            mail.login(username, self.config['email']['password'])
            
            mail.select('INBOX')
            
            # E-Mail als gelesen markieren
            mail.store(email_id.encode(), '+FLAGS', '\\Seen')
            
            mail.close()
            mail.logout()
            
            self.logger.info(f"✅ E-Mail {email_id} als gelesen markiert")
            return True
            
        except Exception as e:
            self.logger.error(f"Fehler beim Markieren der E-Mail {email_id} als gelesen: {e}")
            return False

    def mark_email_as_ignored(self, email_id: str) -> bool:
        """Markiert eine E-Mail als ignoriert (nur SQLite-Datenbank)"""
        if not self.is_enabled():
            return False
        
        try:
            db_path = os.path.join(os.path.dirname(__file__), 'data', 'hochzeit.db')
            
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                
                # Prüfe ob bereits ignoriert
                cursor.execute("SELECT id FROM ignored_emails WHERE email_id = ?", (email_id,))
                if cursor.fetchone():
                    self.logger.info(f"E-Mail {email_id} ist bereits als ignoriert markiert")
                    return True
                
                # Markiere als ignoriert
                cursor.execute("""
                    INSERT INTO ignored_emails (email_id, ignored_by) 
                    VALUES (?, ?)
                """, (email_id, 'system'))
                
                conn.commit()
                
            self.logger.info(f"✅ E-Mail {email_id} als ignoriert markiert (SQLite)")
            return True
            
        except Exception as e:
            self.logger.error(f"Fehler beim Markieren der E-Mail {email_id} als ignoriert: {e}")
            return False

    def is_email_ignored(self, email_id: str) -> bool:
        """Prüft ob eine E-Mail ignoriert ist (nur SQLite-Datenbank)"""
        if not self.is_enabled():
            return False
        
        try:
            db_path = os.path.join(os.path.dirname(__file__), 'data', 'hochzeit.db')
            
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT id FROM ignored_emails WHERE email_id = ?", (email_id,))
                result = cursor.fetchone()
                return result is not None
            
        except Exception as e:
            self.logger.error(f"Fehler beim Prüfen des Ignored-Status für E-Mail {email_id}: {e}")
            return False

    def remove_email_from_ignored(self, email_id: str) -> bool:
        """Entfernt eine E-Mail aus der Ignored-Liste (nur SQLite-Datenbank)"""
        if not self.is_enabled():
            return False
        
        try:
            db_path = os.path.join(os.path.dirname(__file__), 'data', 'hochzeit.db')
            
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                
                # Prüfe ob E-Mail ignoriert ist
                cursor.execute("SELECT id FROM ignored_emails WHERE email_id = ?", (email_id,))
                if not cursor.fetchone():
                    self.logger.info(f"E-Mail {email_id} ist nicht als ignoriert markiert")
                    return True
                
                # Entferne aus Ignored-Liste
                cursor.execute("DELETE FROM ignored_emails WHERE email_id = ?", (email_id,))
                conn.commit()
                
            self.logger.info(f"✅ E-Mail {email_id} aus Ignored-Liste entfernt (SQLite)")
            return True
            
        except Exception as e:
            self.logger.error(f"Fehler beim Entfernen der E-Mail {email_id} aus Ignored-Liste: {e}")
            return False

    def _get_ignored_emails(self) -> List[str]:
        """Ruft die Liste der ignorierten E-Mail-IDs aus der SQLite-Datenbank ab"""
        try:
            db_path = os.path.join(os.path.dirname(__file__), 'data', 'hochzeit.db')
            
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT email_id FROM ignored_emails")
                results = cursor.fetchall()
                return [row[0] for row in results]
            
        except Exception as e:
            self.logger.error(f"Fehler beim Laden der Ignored-Liste aus SQLite: {e}")
            return []

def get_email_manager() -> EmailManager:
    """Factory-Funktion für den E-Mail Manager"""
    return EmailManager()

if __name__ == "__main__":
    # Test der E-Mail-Funktionalität
    email_manager = EmailManager()
    
    print("🧪 E-Mail Manager Test")
    print("=" * 30)
    
    if email_manager.is_enabled():
        print("✅ E-Mail-Funktionalität ist aktiviert")
        
        # Verbindungstest
        result = email_manager.test_connection()
        if result['success']:
            print("✅ SMTP-Verbindung erfolgreich")
        else:
            print(f"❌ SMTP-Verbindung fehlgeschlagen: {result['message']}")
    else:
        print("⚠️ E-Mail-Funktionalität ist deaktiviert")
        print("Aktiviere sie in der auth_config.json:")
        print('"email": { "enabled": true, ... }')

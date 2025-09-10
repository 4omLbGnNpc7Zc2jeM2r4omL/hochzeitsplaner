"""
Erweiterte Konfiguration für die Friendly Captcha Automation
"""

import json
import os
from dataclasses import dataclass
from typing import Dict, List, Optional

@dataclass
class AutomationConfig:
    """Konfigurationsklasse für die Automation"""
    url: str = "https://friendly-captcha-demo.onrender.com/"
    username: str = "admin"
    password: str = "admin123"
    headless: bool = False
    timeout: int = 30
    screenshot_dir: str = "D:\\Interzero\\Screenshots"
    log_level: str = "INFO"

class ConfigManager:
    """Manager für Automation-Konfiguration"""
    
    def __init__(self, config_file="automation_config.json"):
        self.config_file = config_file
        self.config = AutomationConfig()
        self.load_config()
    
    def load_config(self):
        """Konfiguration aus JSON-Datei laden"""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                # Konfiguration aktualisieren
                for key, value in data.items():
                    if hasattr(self.config, key):
                        setattr(self.config, key, value)
                        
                print(f"Konfiguration geladen aus: {self.config_file}")
            else:
                self.save_config()  # Standard-Konfiguration erstellen
                
        except Exception as e:
            print(f"Fehler beim Laden der Konfiguration: {e}")
    
    def save_config(self):
        """Konfiguration in JSON-Datei speichern"""
        try:
            config_dict = {
                "url": self.config.url,
                "username": self.config.username,
                "password": self.config.password,
                "headless": self.config.headless,
                "timeout": self.config.timeout,
                "screenshot_dir": self.config.screenshot_dir,
                "log_level": self.config.log_level
            }
            
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config_dict, f, indent=4, ensure_ascii=False)
                
            print(f"Konfiguration gespeichert in: {self.config_file}")
            
        except Exception as e:
            print(f"Fehler beim Speichern der Konfiguration: {e}")

# Verschiedene Captcha-Strategien
class CaptchaStrategies:
    """Verschiedene Strategien zum Umgehen von Captchas"""
    
    @staticmethod
    def friendly_captcha_strategy(driver, wait_time=30):
        """
        Strategie speziell für Friendly Captcha
        Friendly Captcha löst sich oft automatisch ohne Benutzerinteraktion
        """
        import time
        from selenium.webdriver.common.by import By
        from selenium.common.exceptions import NoSuchElementException
        
        print("Friendly Captcha Strategie wird angewendet...")
        
        # Warten und beobachten
        start_time = time.time()
        while time.time() - start_time < wait_time:
            try:
                # Prüfen auf Friendly Captcha Indikatoren
                captcha_indicators = [
                    "div[data-sitekey]",
                    ".frc-captcha",
                    ".friendly-challenge",
                    "input[name='frc-captcha-solution']"
                ]
                
                for indicator in captcha_indicators:
                    try:
                        element = driver.find_element(By.CSS_SELECTOR, indicator)
                        
                        # Prüfen ob bereits gelöst
                        if indicator == "input[name='frc-captcha-solution']":
                            if element.get_attribute("value"):
                                print("Friendly Captcha bereits gelöst!")
                                return True
                        
                        # Bei anderen Indikatoren prüfen auf "completed" Status
                        if "completed" in element.get_attribute("class") or "":
                            print("Friendly Captcha Status: completed")
                            return True
                            
                    except NoSuchElementException:
                        continue
                
                time.sleep(1)
                
            except Exception as e:
                print(f"Fehler in Captcha-Strategie: {e}")
                time.sleep(1)
        
        print("Captcha-Timeout erreicht, fahre trotzdem fort...")
        return True  # Optimistisch fortfahren
    
    @staticmethod
    def generic_captcha_strategy(driver, wait_time=30):
        """Generische Captcha-Strategie"""
        import time
        print("Generische Captcha-Strategie - warte auf manuelle Lösung...")
        time.sleep(wait_time)
        return True

# Form-Daten Templates
FORM_TEMPLATES = {
    "contact_form": {
        "name": "Max Mustermann",
        "email": "max.mustermann@example.com",
        "subject": "Test Nachricht",
        "message": "Dies ist eine automatisierte Testnachricht.",
        "phone": "+49 123 456789"
    },
    
    "registration_form": {
        "firstname": "Max",
        "lastname": "Mustermann", 
        "email": "max.mustermann@example.com",
        "password": "SecurePassword123!",
        "confirm_password": "SecurePassword123!",
        "terms": True,
        "newsletter": False
    },
    
    "feedback_form": {
        "rating": "5",
        "feedback": "Sehr gute Erfahrung mit der Website!",
        "recommend": True,
        "email": "feedback@example.com"
    }
}

def get_form_template(template_name):
    """Hole ein vordefiniertes Formular-Template"""
    return FORM_TEMPLATES.get(template_name, {})

# Utility-Funktionen
def create_screenshot_directory(path):
    """Screenshot-Verzeichnis erstellen"""
    try:
        os.makedirs(path, exist_ok=True)
        print(f"Screenshot-Verzeichnis erstellt: {path}")
    except Exception as e:
        print(f"Fehler beim Erstellen des Screenshot-Verzeichnisses: {e}")

def log_automation_results(results, log_file="automation_log.txt"):
    """Automation-Ergebnisse protokollieren"""
    try:
        with open(log_file, 'a', encoding='utf-8') as f:
            import datetime
            timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            f.write(f"\n{timestamp} - Automation Results:\n")
            for key, value in results.items():
                f.write(f"  {key}: {value}\n")
            f.write("-" * 50 + "\n")
    except Exception as e:
        print(f"Fehler beim Protokollieren: {e}")

if __name__ == "__main__":
    # Beispiel für Konfiguration
    config_manager = ConfigManager()
    print("Aktuelle Konfiguration:")
    print(f"URL: {config_manager.config.url}")
    print(f"Username: {config_manager.config.username}")
    print(f"Headless: {config_manager.config.headless}")
    
    # Beispiel für Form-Template
    contact_data = get_form_template("contact_form")
    print("\nKontaktformular-Template:")
    for key, value in contact_data.items():
        print(f"  {key}: {value}")

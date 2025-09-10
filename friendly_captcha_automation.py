"""
Automatisierung der Dateneingabe für friendly-captcha-demo.onrender.com

Dieses Script automatisiert die Anmeldung und Dateneingabe auf der Demo-Seite
mit Friendly Captcha System.
"""

import time
import logging
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager

# Logging konfigurieren
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class FriendlyCaptchaAutomation:
    def __init__(self, headless=False):
        """
        Initialisiert den Selenium WebDriver
        
        Args:
            headless (bool): Browser im Hintergrund ausführen
        """
        self.driver = None
        self.wait = None
        self.setup_driver(headless)
    
    def setup_driver(self, headless=False):
        """Chrome WebDriver konfigurieren"""
        try:
            chrome_options = Options()
            if headless:
                chrome_options.add_argument("--headless")
            
            # Zusätzliche Optionen für bessere Kompatibilität
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--disable-gpu")
            chrome_options.add_argument("--window-size=1920,1080")
            chrome_options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
            
            # WebDriver automatisch installieren und starten
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
            self.wait = WebDriverWait(self.driver, 20)
            
            logger.info("Chrome WebDriver erfolgreich initialisiert")
            
        except Exception as e:
            logger.error(f"Fehler beim Initialisieren des WebDrivers: {e}")
            raise
    
    def navigate_to_site(self, url="https://friendly-captcha-demo.onrender.com/"):
        """Zur Zielseite navigieren"""
        try:
            logger.info(f"Navigiere zu: {url}")
            self.driver.get(url)
            time.sleep(3)  # Seite laden lassen
            
            # Warten bis die Seite vollständig geladen ist
            self.wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            logger.info("Seite erfolgreich geladen")
            
        except Exception as e:
            logger.error(f"Fehler beim Laden der Seite: {e}")
            raise
    
    def wait_for_captcha_solution(self, timeout=30):
        """
        Wartet darauf, dass das Friendly Captcha gelöst wird
        Friendly Captcha löst sich oft automatisch oder nach kurzer Zeit
        """
        try:
            logger.info("Warte auf Captcha-Lösung...")
            
            # Verschiedene Selektoren für Friendly Captcha
            captcha_selectors = [
                "div[data-sitekey]",
                ".frc-captcha",
                ".friendly-challenge",
                "div[class*='captcha']",
                "div[id*='captcha']"
            ]
            
            captcha_element = None
            for selector in captcha_selectors:
                try:
                    captcha_element = self.driver.find_element(By.CSS_SELECTOR, selector)
                    logger.info(f"Captcha gefunden mit Selektor: {selector}")
                    break
                except NoSuchElementException:
                    continue
            
            if captcha_element:
                # Warten bis das Captcha gelöst ist (meist automatisch)
                start_time = time.time()
                while time.time() - start_time < timeout:
                    try:
                        # Prüfen ob Captcha gelöst ist (verschiedene Indikatoren)
                        if self.is_captcha_solved():
                            logger.info("Captcha erfolgreich gelöst!")
                            return True
                        time.sleep(1)
                    except Exception:
                        pass
                
                logger.warning("Captcha-Timeout erreicht")
                return False
            else:
                logger.info("Kein Captcha gefunden oder bereits gelöst")
                return True
                
        except Exception as e:
            logger.error(f"Fehler beim Warten auf Captcha: {e}")
            return False
    
    def is_captcha_solved(self):
        """Prüft ob das Captcha gelöst wurde"""
        try:
            # Verschiedene Indikatoren für ein gelöstes Captcha
            solved_indicators = [
                "input[name='frc-captcha-solution']",
                ".frc-success",
                "div[data-state='completed']",
                "div[class*='solved']"
            ]
            
            for indicator in solved_indicators:
                try:
                    element = self.driver.find_element(By.CSS_SELECTOR, indicator)
                    if element and (element.get_attribute("value") or 
                                  "success" in element.get_attribute("class") or
                                  "completed" in element.get_attribute("data-state") or ""):
                        return True
                except NoSuchElementException:
                    continue
            
            return False
            
        except Exception:
            return False
    
    def login(self, username="admin", password="admin123"):
        """Automatische Anmeldung"""
        try:
            logger.info("Versuche automatische Anmeldung...")
            
            # Warten auf Login-Formular
            username_selectors = [
                "input[name='username']",
                "input[type='text']",
                "input[id*='user']",
                "input[placeholder*='user' i]"
            ]
            
            password_selectors = [
                "input[name='password']",
                "input[type='password']",
                "input[id*='pass']",
                "input[placeholder*='pass' i]"
            ]
            
            submit_selectors = [
                "button[type='submit']",
                "input[type='submit']",
                "button[class*='submit']",
                "button[class*='login']"
            ]
            
            # Username eingeben
            username_field = None
            for selector in username_selectors:
                try:
                    username_field = self.wait.until(
                        EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
                    )
                    break
                except TimeoutException:
                    continue
            
            if username_field:
                username_field.clear()
                username_field.send_keys(username)
                logger.info("Username eingegeben")
            else:
                logger.error("Username-Feld nicht gefunden")
                return False
            
            # Password eingeben
            password_field = None
            for selector in password_selectors:
                try:
                    password_field = self.driver.find_element(By.CSS_SELECTOR, selector)
                    break
                except NoSuchElementException:
                    continue
            
            if password_field:
                password_field.clear()
                password_field.send_keys(password)
                logger.info("Password eingegeben")
            else:
                logger.error("Password-Feld nicht gefunden")
                return False
            
            # Captcha lösen lassen
            if not self.wait_for_captcha_solution():
                logger.warning("Captcha konnte nicht automatisch gelöst werden")
                # Trotzdem versuchen fortzufahren
            
            # Submit-Button klicken
            submit_button = None
            for selector in submit_selectors:
                try:
                    submit_button = self.driver.find_element(By.CSS_SELECTOR, selector)
                    if submit_button.is_enabled():
                        break
                except NoSuchElementException:
                    continue
            
            if submit_button and submit_button.is_enabled():
                submit_button.click()
                logger.info("Login-Formular abgesendet")
                time.sleep(3)
                return True
            else:
                logger.error("Submit-Button nicht gefunden oder nicht aktiviert")
                return False
                
        except Exception as e:
            logger.error(f"Fehler beim Login: {e}")
            return False
    
    def fill_form_data(self, form_data):
        """
        Füllt Formulardaten aus
        
        Args:
            form_data (dict): Dictionary mit Feldnamen und Werten
        """
        try:
            logger.info("Fülle Formulardaten aus...")
            
            for field_name, value in form_data.items():
                try:
                    # Verschiedene Selektoren für Formularfelder
                    field_selectors = [
                        f"input[name='{field_name}']",
                        f"input[id='{field_name}']",
                        f"textarea[name='{field_name}']",
                        f"select[name='{field_name}']",
                        f"input[placeholder*='{field_name}' i]"
                    ]
                    
                    field_element = None
                    for selector in field_selectors:
                        try:
                            field_element = self.driver.find_element(By.CSS_SELECTOR, selector)
                            break
                        except NoSuchElementException:
                            continue
                    
                    if field_element:
                        if field_element.tag_name.lower() == 'select':
                            # Dropdown-Menü
                            from selenium.webdriver.support.ui import Select
                            select = Select(field_element)
                            select.select_by_visible_text(value)
                        else:
                            # Text-Input oder Textarea
                            field_element.clear()
                            field_element.send_keys(str(value))
                        
                        logger.info(f"Feld '{field_name}' ausgefüllt mit: {value}")
                    else:
                        logger.warning(f"Feld '{field_name}' nicht gefunden")
                        
                except Exception as e:
                    logger.error(f"Fehler beim Ausfüllen von Feld '{field_name}': {e}")
            
            return True
            
        except Exception as e:
            logger.error(f"Fehler beim Ausfüllen der Formulardaten: {e}")
            return False
    
    def take_screenshot(self, filename="screenshot.png"):
        """Screenshot erstellen"""
        try:
            screenshot_path = f"d:\\Hochzeitsplaner\\{filename}"
            self.driver.save_screenshot(screenshot_path)
            logger.info(f"Screenshot gespeichert: {screenshot_path}")
        except Exception as e:
            logger.error(f"Fehler beim Erstellen des Screenshots: {e}")
    
    def close(self):
        """WebDriver schließen"""
        if self.driver:
            self.driver.quit()
            logger.info("WebDriver geschlossen")

def main():
    """Hauptfunktion für die Automatisierung"""
    automation = None
    
    try:
        # Automation initialisieren
        automation = FriendlyCaptchaAutomation(headless=False)
        
        # Zur Seite navigieren
        automation.navigate_to_site()
        
        # Screenshot vor dem Login
        automation.take_screenshot("before_login.png")
        
        # Login versuchen
        if automation.login():
            logger.info("Login erfolgreich!")
            
            # Screenshot nach dem Login
            automation.take_screenshot("after_login.png")
            
            # Beispiel für weitere Formulardaten
            form_data = {
                "email": "test@example.com",
                "name": "Test User",
                "message": "Automatisierte Testnachricht"
            }
            
            # Formulardaten ausfüllen (falls weitere Formulare vorhanden)
            automation.fill_form_data(form_data)
            
            # Finale Screenshot
            automation.take_screenshot("final_result.png")
            
        else:
            logger.error("Login fehlgeschlagen")
            automation.take_screenshot("login_failed.png")
        
        # Kurz warten um Ergebnis zu sehen
        time.sleep(5)
        
    except Exception as e:
        logger.error(f"Unerwarteter Fehler: {e}")
        if automation:
            automation.take_screenshot("error_screenshot.png")
    
    finally:
        if automation:
            automation.close()

if __name__ == "__main__":
    main()

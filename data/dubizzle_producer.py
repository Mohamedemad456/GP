import os
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup
import time
import csv
import threading
import concurrent.futures
import math
import re
import json
from kafka import KafkaProducer

# --- CONFIGURATION ---
KAFKA_TOPIC = "car-listings"
KAFKA_BOOTSTRAP_SERVERS = ['localhost:9092']

# --- YOUR BRAVE PATH ---
BRAVE_PATH = "/usr/bin/brave" 

# --- INITIALIZE PRODUCER ---
print(f"Connecting to Kafka at {KAFKA_BOOTSTRAP_SERVERS}...")
try:
    producer = KafkaProducer(
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        value_serializer=lambda x: json.dumps(x).encode('utf-8')
    )
    print("✅ Kafka Producer connected!")
except Exception as e:
    print(f"⚠️ Kafka connection failed: {e}")
    producer = None

class DubizzleCarScraper:
    def __init__(self, headless=False):
        chrome_options = Options()
        
        # 1. TELL SELENIUM TO USE YOUR BRAVE BROWSER
        if os.path.exists(BRAVE_PATH):
            chrome_options.binary_location = BRAVE_PATH
        else:
            raise FileNotFoundError(f"Could not find Brave at {BRAVE_PATH}")

        # 2. LOCAL LINUX SETTINGS
        if headless:
            chrome_options.add_argument('--headless')
        
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        
        # 3. LAUNCH DRIVER (Using Chrome Manager since Brave is Chromium)
        try:
            self.driver = webdriver.Chrome(
                service=Service(ChromeDriverManager().install()), 
                options=chrome_options
            )
        except Exception as e:
            print("\n❌ CRITICAL: Selenium could not launch Brave.")
            raise e

        self.driver.set_page_load_timeout(30)
        self.wait = WebDriverWait(self.driver, 20)
        self.cars_data = []
        self.seen_urls = set()
    
    def scrape_page(self, url, page_num, transmission_type):
        print(f"Scraping: {url}")
        try:
            self.driver.get(url)
            self.wait.until(EC.text_to_be_present_in_element((By.TAG_NAME, "body"), "EGP"))
        except:
            print(f"Page {page_num} timed out or no content.")
            return

        time.sleep(2)
        
        try:
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(1)
        except: pass
        
        soup = BeautifulSoup(self.driver.page_source, 'html.parser')
        
        raw_listings = soup.find_all('li')
        listings = [x for x in raw_listings if "EGP" in x.get_text()]
        if not listings:
            raw_listings = soup.find_all('article')
            listings = [x for x in raw_listings if "EGP" in x.get_text()]

        print(f"Found {len(listings)} listings on page {page_num}")
        
        for listing in listings:
            try:
                car_data = self.extract_car_data(listing, page_num, transmission_type)
                if car_data and car_data['url'] not in self.seen_urls:
                    self.seen_urls.add(car_data['url'])
                    self.cars_data.append(car_data)
                    
                    if producer:
                        clean_data = car_data.copy()
                        if 'price_egp' in clean_data:
                             clean_data['price_egp'] = re.sub(r'[^\d]', '', str(clean_data['price_egp']))
                        if 'mileage_km' in clean_data:
                             clean_data['mileage_km'] = re.sub(r'[^\d]', '', str(clean_data['mileage_km']))
                        
                        clean_data['source'] = 'dubizzle'
                        producer.send(KAFKA_TOPIC, clean_data)
            except:
                continue
        
        if producer: producer.flush()

    def extract_car_data(self, listing, page_num, transmission_type):
        try:
            car = {}
            text_content = listing.get_text(" ", strip=True)
            
            link_elem = listing.find('a', href=True)
            if not link_elem: return None
            raw_link = link_elem['href']
            car['url'] = 'https://www.dubizzle.com.eg' + raw_link if not raw_link.startswith('http') else raw_link
            
            price_match = re.search(r'EGP\s*([\d,]+)', text_content)
            car['price_egp'] = price_match.group(1).replace(",", "") if price_match else "0"

            year_match = re.search(r'\b(19[8-9]\d|20[0-2]\d)\b', text_content)
            car['year'] = year_match.group(0) if year_match else "N/A"

            km_match = re.search(r'([\d,]+)\s*[kK]m', text_content)
            car['mileage_km'] = km_match.group(1).replace(",", "") if km_match else "0"
            
            title_elem = listing.find(['h2', 'h3', 'h4'])
            car['title'] = title_elem.get_text(strip=True) if title_elem else "N/A"

            spans = listing.find_all('span')
            car['location'] = spans[-1].get_text(strip=True) if spans else "N/A"

            if transmission_type.lower() == "manual":
                car['transmission'] = "Manual"
            elif transmission_type.lower() == "automatic":
                car['transmission'] = "Automatic"
            else:
                car['transmission'] = "N/A"

            car['page'] = page_num
            car['scraped_at'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            return car
        except:
            return None

    def close(self):
        try: self.driver.quit()
        except: pass

def scrape_batch(page_range, base_url, headless=True, transmission_type=""):
    start_page, end_page = page_range
    print(f"Worker started for pages {start_page} to {end_page}")
    worker_scraper = DubizzleCarScraper(headless=headless)
    results = []
    try:
        for page in range(start_page, end_page + 1):
            url = f"{base_url}&page={page}" if page > 1 else base_url
            worker_scraper.scrape_page(url, page, transmission_type)
        results = worker_scraper.cars_data
    except Exception as e:
        print(f"Worker crashed: {e}")
    finally:
        worker_scraper.close()
    return results

if __name__ == "__main__":
    TOTAL_PAGES_TO_SCRAPE = 2
    NUM_WORKERS = 1
    HEADLESS_MODE = False  # Set to False so you can see Brave working
    all_cars = []

    def scrape_manual_cars():
        BASE_URL = "https://www.dubizzle.com.eg/en/vehicles/cars-for-sale/used/?filter=transmission_eq_1"  
        scrape_batch((1, 2), BASE_URL, HEADLESS_MODE, "manual")

    def scrape_automatic_cars():
        BASE_URL = "https://www.dubizzle.com.eg/en/vehicles/cars-for-sale/used/?filter=transmission_eq_2"  
        scrape_batch((1, 2), BASE_URL, HEADLESS_MODE, "automatic")

    print(f"🚀 Launching Brave from: {BRAVE_PATH}")
    
    scrape_manual_cars()
    scrape_automatic_cars()

    if producer: producer.close()
    print("Done.")
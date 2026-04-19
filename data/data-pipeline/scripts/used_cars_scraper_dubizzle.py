from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from bs4 import BeautifulSoup
import time
import csv
import threading
import concurrent.futures
import math
import re
import random

class DubizzleCarScraper:
    def __init__(self, headless=True, max_pages_before_restart=50):
        self.headless = headless
        self.max_pages_before_restart = max_pages_before_restart
        self.pages_scraped = 0
        self.driver = None
        self.wait = None
        self.cars_data = []
        self.seen_urls = set()
        self._init_browser()
    
    def _init_browser(self):
        """Initialize or reinitialize Chrome browser with FAST settings"""
        if self.driver:
            try:
                self.driver.quit()
            except:
                pass
        
        chrome_options = Options()
        if self.headless:
            chrome_options.add_argument('--headless')
        
        # OPTIMIZATION: Disable images and CSS to load pages faster
        chrome_options.add_argument('--headless=new')  # Newer headless mode
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--window-size=1920,1080')
        chrome_options.add_argument('--disable-extensions')
        chrome_options.add_argument('--disable-plugins')
        chrome_options.add_argument('--no-first-run')
        chrome_options.add_argument('--no-default-browser-check')
        chrome_options.add_argument('--disable-web-resources')  # Skip resource loading
        chrome_options.add_argument('--disable-features=TranslateUI')
        
        # OPTIMIZATION: Disable images for faster loading
        prefs = {
            'profile.managed_default_content_settings.images': 2,  # Disable images
            'perfLoggingPrefs': {
                'enableNetwork': False,
                'enablePage': False,
            }
        }
        chrome_options.add_experimental_option('prefs', prefs)
        
        chrome_options.page_load_strategy = 'eager'  # Don't wait for everything
        chrome_options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        
        self.driver = webdriver.Chrome(options=chrome_options)
        self.driver.set_page_load_timeout(20)  # FASTER: reduced from 40
        self.wait = WebDriverWait(self.driver, 10)  # FASTER: reduced from 25
        self.pages_scraped = 0
        print(f"[BROWSER] Initialized (headless mode)")
    
    def _check_and_recycle_browser(self):
        """Recycle browser if needed"""
        self.pages_scraped += 1
        if self.pages_scraped >= self.max_pages_before_restart:
            print(f"[BROWSER] Recycling after {self.pages_scraped} pages")
            self._init_browser()
    
    def scrape_page(self, url, page_num, transmission_type, retry_count=2):
        """OPTIMIZED: Faster page scraping with reduced retries"""
        for attempt in range(retry_count):
            try:
                # OPTIMIZATION: Minimal delay (was 1-3s, now 0.5-1s)
                time.sleep(random.uniform(0.5, 1.0))
                
                # OPTIMIZATION: Print only on failure
                if attempt > 0:
                    print(f"[SCRAPE] Page {page_num} retry {attempt}")
                
                start_time = time.time()
                self.driver.get(url)
                load_time = time.time() - start_time
                
                # OPTIMIZATION: Don't wait for EGP, just try to parse
                # (EGP might be in JavaScript or lazy-loaded)
                try:
                    self.wait.until(EC.presence_of_all_elements_located((By.TAG_NAME, "li")))
                except:
                    pass  # Continue anyway
                
                # OPTIMIZATION: Single scroll instead of 3
                time.sleep(0.3)
                try:
                    self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                    time.sleep(0.3)
                except:
                    pass
                
                soup = BeautifulSoup(self.driver.page_source, 'html.parser')
                
                # OPTIMIZATION: Single attempt, no fallback
                raw_listings = soup.find_all('li')
                listings = [x for x in raw_listings if "EGP" in x.get_text()]
                
                if len(listings) == 0:
                    # Fallback only if we get nothing
                    raw_listings = soup.find_all('article')
                    listings = [x for x in raw_listings if "EGP" in x.get_text()]
                
                # Extract listings
                for listing in listings:
                    try:
                        car_data = self.extract_car_data(listing, page_num, transmission_type)
                        if car_data and car_data['url'] not in self.seen_urls:
                            self.seen_urls.add(car_data['url'])
                            self.cars_data.append(car_data)
                    except:
                        continue
                
                self._check_and_recycle_browser()
                
                # OPTIMIZATION: Log progress every 20 pages only
                if page_num % 20 == 0:
                    print(f"[OK] Page {page_num}: {len(listings)} cars, total: {len(self.cars_data)}")
                
                return True
                
            except Exception as e:
                if attempt < retry_count - 1:
                    # OPTIMIZATION: Shorter retry delays
                    time.sleep(2 * (attempt + 1))
                else:
                    print(f"[FAIL] Page {page_num}: {str(e)[:50]}")
                    self._check_and_recycle_browser()
                    return False
        
        return False

    def extract_car_data(self, listing, page_num, transmission_type):
        """OPTIMIZED: Faster extraction with simpler parsing"""
        try:
            car = {}
            text_content = listing.get_text(" ", strip=True)
            
            # 1. URL (required, skip if missing)
            link_elem = listing.find('a', href=True)
            if not link_elem:
                return None
            raw_link = link_elem['href']
            car['url'] = 'https://www.dubizzle.com.eg' + raw_link if not raw_link.startswith('http') else raw_link
            
            # 2. Price
            price_match = re.search(r'EGP\s*[\d,]+', text_content)
            car['price_egp'] = price_match.group(0) if price_match else "N/A"

            # 3. Year
            year_match = re.search(r'\b(19[8-9]\d|20[0-2]\d)\b', text_content)
            car['year'] = year_match.group(0) if year_match else "N/A"

            # 4. Mileage
            km_match = re.search(r'[\d,]+\s*[kK]m', text_content)
            car['mileage_km'] = km_match.group(0) if km_match else "N/A"
            
            # 5. Title
            title_elem = listing.find(['h2', 'h3', 'h4'])
            car['title'] = title_elem.get_text(strip=True) if title_elem else link_elem.get('aria-label', 'N/A')

            # 6. Location
            spans = listing.find_all('span', class_='f7d5e47e')
            car['location'] = spans[-1].get_text(strip=True) if spans else "N/A"

            # 7. Transmission
            car['transmission'] = "Manual" if transmission_type.lower() == "manual" else "Automatic"

            # 8. Fuel Type
            fuel_types = ['Benzine', 'Natural Gas', 'Diesel', 'Electric', 'Hybrid']
            car['fuel'] = "N/A"
            for ft in fuel_types:
                if ft in text_content:
                    car['fuel'] = ft
                    break

            car['page'] = page_num
            car['scraped_at'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            return car
            
        except:
            return None

    def close(self):
        """Close browser"""
        if self.driver:
            try:
                self.driver.quit()
            except:
                pass


def scrape_batch(page_range, base_url, headless=True, transmission_type=""):
    """Worker function - OPTIMIZED"""
    start_page, end_page = page_range
    print(f"[WORKER] Starting pages {start_page}-{end_page}")
    
    worker_scraper = DubizzleCarScraper(headless=headless, max_pages_before_restart=50)
    results = []
    
    try:
        for page in range(start_page, end_page + 1):
            url = f"{base_url}&page={page}" if page > 1 else base_url
            worker_scraper.scrape_page(url, page, transmission_type, retry_count=2)
        
        results = worker_scraper.cars_data
        print(f"[DONE] Pages {start_page}-{end_page}: {len(results)} total cars")
        
    except Exception as e:
        print(f"[ERROR] Worker {start_page}-{end_page}: {e}")
    finally:
        worker_scraper.close()
    
    return results


if __name__ == "__main__":

    # ===== CONFIGURATION =====
    TOTAL_PAGES_TO_SCRAPE = 150 # 150 pages for each transmission
    NUM_WORKERS = 1
    HEADLESS_MODE = True
    
    print(f"\n[CONFIG] Pages: {TOTAL_PAGES_TO_SCRAPE} | Workers: {NUM_WORKERS} | Headless: {HEADLESS_MODE}\n")
    
    all_cars = []

    def scrape_transmission(transmission_name, transmission_filter, transmission_type):
        """Generic function for both transmissions"""
        print(f"\n[TASK] Starting {transmission_name}...")
        BASE_URL = f"https://www.dubizzle.com.eg/en/vehicles/cars-for-sale/used/?filter={transmission_filter}"
        
        pages_per_worker = math.ceil(TOTAL_PAGES_TO_SCRAPE / NUM_WORKERS)
        batches = []
        
        for i in range(NUM_WORKERS):
            start = i * pages_per_worker + 1
            end = min((i + 1) * pages_per_worker, TOTAL_PAGES_TO_SCRAPE)
            if start <= end:
                batches.append((start, end))
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=NUM_WORKERS) as executor:
            future_to_batch = {
                executor.submit(scrape_batch, batch, BASE_URL, HEADLESS_MODE, transmission_type): batch 
                for batch in batches
            }
            for future in concurrent.futures.as_completed(future_to_batch):
                try:
                    data = future.result()
                    all_cars.extend(data)
                except Exception as exc:
                    print(f"[ERROR] {exc}")
        
        count = len([c for c in all_cars if c['transmission'] == transmission_type.capitalize()])
        print(f"[DONE] {transmission_name}: {count} cars\n")

    # Scrape both transmissions
    scrape_transmission("MANUAL", "transmission_eq_1", "manual")
    scrape_transmission("AUTOMATIC", "transmission_eq_2", "automatic")

    # Deduplicate and save
    unique_cars_dict = {car['url']: car for car in all_cars}
    unique_cars_list = list(unique_cars_dict.values())

    print(f"\n[RESULTS]")
    print(f"  Total raw: {len(all_cars)}")
    print(f"  Unique: {len(unique_cars_list)}")
    print(f"  Manual: {len([c for c in unique_cars_list if c['transmission'] == 'Manual'])}")
    print(f"  Automatic: {len([c for c in unique_cars_list if c['transmission'] == 'Automatic'])}")
    
    if unique_cars_list:
        keys = unique_cars_list[0].keys()
        with open('/opt/airflow/data/dubizzle_cars.csv', 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(unique_cars_list)
        print(f"[SAVE] /opt/airflow/data/dubizzle_cars.csv\n")
    else:
        print("[ERROR] No cars scraped!\n")
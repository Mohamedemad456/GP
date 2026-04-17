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
import re  # Added for robust text extraction

class DubizzleCarScraper:
    def __init__(self, headless=True):
        chrome_options = Options()
        if headless:
            chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--window-size=1920,1080')
        chrome_options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        chrome_options.page_load_strategy = 'eager'
        
        self.driver = webdriver.Chrome(options=chrome_options)
        self.driver.set_page_load_timeout(30)
        self.wait = WebDriverWait(self.driver, 20)
        self.cars_data = []
        self.seen_urls = set()
    
    def scrape_page(self, url, page_num, transmission_type):
        print(f"Scraping: {url}")
        try:
            self.driver.get(url)
        except Exception as e:
            print(f"Error loading page: {e}")
            return
        
        # FIX 1: Wait for "EGP" to appear. 
        # This guarantees that the listings (which contain prices) have actually loaded.
        try:
            self.wait.until(EC.text_to_be_present_in_element((By.TAG_NAME, "body"), "EGP"))
        except:
            print("Error: content (EGP) never loaded on page")
            return

        time.sleep(2) # Brief pause for layout to settle
        
        # Scroll to load all lazy images/items
        try:
            for _ in range(3):
                self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(1)
        except:
            pass
        
        soup = BeautifulSoup(self.driver.page_source, 'html.parser')
        
        # FIX 2: Broad Selector
        # Instead of looking for specific class names, we grab ALL list items ('li')
        # and check if they look like a car listing (contain 'EGP').
        raw_listings = soup.find_all('li')
        listings = [x for x in raw_listings if "EGP" in x.get_text()]
        
        if not listings:
            # Fallback: Try looking for articles if LI method fails
            raw_listings = soup.find_all('article')
            listings = [x for x in raw_listings if "EGP" in x.get_text()]

        print(f"Found {len(listings)} listings on page {page_num}")
        
        for listing in listings:
            try:
                car_data = self.extract_car_data(listing, page_num, transmission_type)
                if car_data and car_data['url'] not in self.seen_urls:
                    self.seen_urls.add(car_data['url'])
                    self.cars_data.append(car_data)
            except Exception as e:
                # print(f"Skipping bad listing: {e}")
                continue

    def extract_car_data(self, listing, page_num, transmission_type):
        """Extract data using Regex and Text Analysis (Classes break too easily)"""
        try:
            car = {}
            text_content = listing.get_text(" ", strip=True) # Get all text in one string
            
            # 1. URL
            link_elem = listing.find('a', href=True)
            if not link_elem: return None
            raw_link = link_elem['href']
            car['url'] = 'https://www.dubizzle.com.eg' + raw_link if not raw_link.startswith('http') else raw_link
            
            # 2. Price (Find 'EGP' followed by numbers)
            # Looks for "EGP 1,234,567" or similar patterns
            price_match = re.search(r'EGP\s*[\d,]+', text_content)
            car['price_egp'] = price_match.group(0) if price_match else "N/A"

            # 3. Year (Find any 4-digit number between 1980 and 2027)
            year_match = re.search(r'\b(19[8-9]\d|20[0-2]\d)\b', text_content)
            car['year'] = year_match.group(0) if year_match else "N/A"

            # 4. Mileage (Find number followed by 'km' or 'Km')
            km_match = re.search(r'[\d,]+\s*[kK]m', text_content)
            car['mileage_km'] = km_match.group(0) if km_match else "N/A"
            
            # 5. Title (Usually the text inside the Heading tag)
            title_elem = listing.find(['h2', 'h3', 'h4'])
            if title_elem:
                car['title'] = title_elem.get_text(strip=True)
            else:
                # Fallback: If no heading, assume title is the aria-label of the link
                car['title'] = link_elem.get('aria-label', link_elem.get('title', 'N/A'))

            # 6. Location (Everything else is hard, but location is usually at the end)
            # We will search for common Egyptian cities to be safe, or take the last span
            # This is a simple heuristic:
            spans = listing.find_all('span', class_='f7d5e47e')
            
            if spans:
                car['location'] = spans[-1].get_text(strip=True) # Often the last item is location/time
            else:
                car['location'] = "N/A"

            # 7. Transmission
            if transmission_type.lower() == "manual":
                car['transmission'] = "Manual"
            elif transmission_type.lower() == "automatic":
                car['transmission'] = "Automatic"
            else:
                car['transmission'] = "N/A"

            # 8. Fuel Type
            fuel_types = ['Benzine', 'Natural Gas', 'Diesel', 'Electric', 'Hybrid']
            if any(ft in text_content for ft in fuel_types):
                for ft in fuel_types:
                    if ft in text_content:
                        car['fuel'] = ft
                        break
            else:
                car['fuel'] = "N/A"

            car['page'] = page_num
            car['scraped_at'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            return car
            
        except Exception as e:
            return None

    def close(self):
        self.driver.quit()

# --- Worker Function (Unchanged logic, just updated for new class) ---
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
    finally:
        worker_scraper.close()
    return results

if __name__ == "__main__":

    TOTAL_PAGES_TO_SCRAPE = 10 # Number of pages will be 200 after the pipeline
    NUM_WORKERS = 1 # Number workers for each type of transmission max 3 after the pipeline
    HEADLESS_MODE = True
    all_cars = []


    def scrape_manual_cars():
    
        BASE_URL = "https://www.dubizzle.com.eg/en/vehicles/cars-for-sale/used/?filter=transmission_eq_1"  
        pages_per_worker = math.ceil(TOTAL_PAGES_TO_SCRAPE / NUM_WORKERS)
        batches = []
        for i in range(NUM_WORKERS):
            start = i * pages_per_worker + 1
            end = min((i + 1) * pages_per_worker, TOTAL_PAGES_TO_SCRAPE)
            if start <= end:
                batches.append((start, end))
                
        print(f"Starting {len(batches)} workers...")

        with concurrent.futures.ThreadPoolExecutor(max_workers=NUM_WORKERS) as executor:
            future_to_batch = {
                executor.submit(scrape_batch, batch, BASE_URL, HEADLESS_MODE, "manual"): batch 
                for batch in batches
            }
            for future in concurrent.futures.as_completed(future_to_batch):
                try:
                    data = future.result()
                    all_cars.extend(data)
                except Exception as exc:
                    print(f"Worker exception: {exc}")
    

    def scrape_automatic_cars():
    
        BASE_URL = "https://www.dubizzle.com.eg/en/vehicles/cars-for-sale/used/?filter=transmission_eq_2"  
        pages_per_worker = math.ceil(TOTAL_PAGES_TO_SCRAPE / NUM_WORKERS)
        batches = []
        for i in range(NUM_WORKERS):
            start = i * pages_per_worker + 1
            end = min((i + 1) * pages_per_worker, TOTAL_PAGES_TO_SCRAPE)
            if start <= end:
                batches.append((start, end))
                
        print(f"Starting {len(batches)} workers...")

        with concurrent.futures.ThreadPoolExecutor(max_workers=NUM_WORKERS) as executor:
            future_to_batch = {
                executor.submit(scrape_batch, batch, BASE_URL, HEADLESS_MODE, "automatic"): batch 
                for batch in batches
            }
            for future in concurrent.futures.as_completed(future_to_batch):
                try:
                    data = future.result()
                    all_cars.extend(data)
                except Exception as exc:
                    print(f"Worker exception: {exc}")

    scrap1 = threading.Thread(target=scrape_manual_cars)
    scrap2 = threading.Thread(target=scrape_automatic_cars)

    scrap1.start()
    scrap2.start()
    scrap1.join()
    scrap2.join()

    # Deduplicate
    unique_cars_dict = {car['url']: car for car in all_cars}
    unique_cars_list = list(unique_cars_dict.values())

    print(f"Total raw results: {len(all_cars)}")
    print(f"Total unique cars: {len(unique_cars_list)}")
    
    if unique_cars_list:
        keys = unique_cars_list[0].keys()
        with open('/opt/airflow/data/dubizzle_cars.csv', 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(unique_cars_list)
        print("Saved to /opt/airflow/data/dubizzle_cars.csv")
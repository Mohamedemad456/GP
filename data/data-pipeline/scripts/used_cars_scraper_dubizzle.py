from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from bs4 import BeautifulSoup
import time
import csv
import re
import random


class DubizzleCarScraper:
    def __init__(self, headless=True, max_pages_before_restart=100):
        self.headless = headless
        self.max_pages_before_restart = max_pages_before_restart
        self.pages_scraped = 0
        self.driver = None
        self.wait = None
        self.cars_data = []
        self.seen_urls = set()
        self._init_browser()

    def _init_browser(self):
        """Initialize Chrome browser with maximum optimization"""
        if self.driver:
            try:
                self.driver.quit()
            except Exception:
                pass

        chrome_options = Options()
        chrome_options.add_argument('--headless=new')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--window-size=1920,1080')
        chrome_options.add_argument('--disable-extensions')
        chrome_options.add_argument('--disable-plugins')
        chrome_options.add_argument('--no-first-run')
        chrome_options.add_argument('--no-default-browser-check')
        chrome_options.add_argument('--disable-web-resources')
        chrome_options.add_argument('--disable-features=TranslateUI')
        chrome_options.add_argument('--disable-sync')
        chrome_options.add_argument('--disable-notifications')
        chrome_options.add_argument('--disable-popup-blocking')
        chrome_options.add_argument('--disable-translate')
        chrome_options.add_argument('--blink-settings=imagesEnabled=false')

        prefs = {
            'profile.managed_default_content_settings.images': 2,
            'perfLoggingPrefs': {
                'enableNetwork': False,
                'enablePage': False,
            }
        }
        chrome_options.add_experimental_option('prefs', prefs)
        chrome_options.page_load_strategy = 'eager'
        chrome_options.add_argument(
            'user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        )

        self.driver = webdriver.Chrome(options=chrome_options)
        self.driver.set_page_load_timeout(15)
        self.wait = WebDriverWait(self.driver, 8)
        self.pages_scraped = 0
        print("[✓] Browser initialized")

    def _check_and_recycle_browser(self):
        """Recycle browser to free memory"""
        self.pages_scraped += 1
        if self.pages_scraped >= self.max_pages_before_restart:
            print(f"[↻] Recycling browser after {self.pages_scraped} pages")
            self._init_browser()

    def scrape_page(self, url, page_num, retry_count=3):
        """Optimized page scraping with better waiting"""
        for attempt in range(retry_count):
            try:
                time.sleep(random.uniform(0.5, 1.2))

                self.driver.get(url)

                # Wait for listings to load
                try:
                    self.wait.until(
                        EC.presence_of_all_elements_located((By.XPATH, "//li[contains(., 'EGP')]"))
                    )
                except Exception:
                    # Fallback: wait for any li elements
                    try:
                        self.wait.until(
                            EC.presence_of_all_elements_located((By.TAG_NAME, "li"))
                        )
                    except Exception:
                        pass

                time.sleep(0.5)
                
                # Scroll to load lazy content
                for _ in range(3):
                    try:
                        self.driver.execute_script("window.scrollBy(0, 500);")
                        time.sleep(0.2)
                    except Exception:
                        pass

                time.sleep(0.5)

                soup = BeautifulSoup(self.driver.page_source, 'html.parser')

                # Primary: find li with EGP
                raw_listings = soup.find_all('li')
                listings = [x for x in raw_listings if "EGP" in x.get_text()]

                # Fallback 1: article tags
                if not listings:
                    raw_listings = soup.find_all('article')
                    listings = [x for x in raw_listings if "EGP" in x.get_text()]

                # Fallback 2: div with listing class
                if not listings:
                    raw_listings = soup.find_all('div', class_=re.compile('listing|item|product', re.I))
                    listings = [x for x in raw_listings if "EGP" in x.get_text()]

                if listings:
                    for listing in listings:
                        car_data = self.extract_car_data(listing, page_num)
                        if car_data and car_data['url'] not in self.seen_urls:
                            self.seen_urls.add(car_data['url'])
                            self.cars_data.append(car_data)

                    self._check_and_recycle_browser()
                    print(f"[✓] Page {page_num:3d} | {len(listings):2d} cars | Total: {len(self.cars_data):4d}")
                    return True
                else:
                    if attempt < retry_count - 1:
                        print(f"[⟳] Page {page_num:3d} | Retry {attempt + 1}/{retry_count - 1}")
                        time.sleep(2)
                    else:
                        print(f"[⚠] Page {page_num:3d} | No listings found after {retry_count} attempts")
                        self._check_and_recycle_browser()
                        return False

            except Exception as e:
                if attempt < retry_count - 1:
                    print(f"[⟳] Page {page_num:3d} | Retry {attempt + 1}/{retry_count - 1} - {str(e)[:30]}")
                    time.sleep(2)
                else:
                    print(f"[✗] Page {page_num:3d} | Error: {str(e)[:40]}")
                    self._check_and_recycle_browser()
                    return False

        return False

    def extract_car_data(self, listing, page_num):
        """Fast car data extraction"""
        try:
            car = {}
            text_content = listing.get_text(" ", strip=True)

            # URL (required)
            link_elem = listing.find('a', href=True)
            if not link_elem:
                return None
            raw_link = link_elem['href']
            car['url'] = (
                'https://www.dubizzle.com.eg' + raw_link 
                if not raw_link.startswith('http') 
                else raw_link
            )

            # Price
            price_match = re.search(r'EGP\s*[\d,]+', text_content)
            car['price_egp'] = price_match.group(0) if price_match else "N/A"

            # Year
            year_match = re.search(r'\b(19[8-9]\d|20[0-2]\d)\b', text_content)
            car['year'] = year_match.group(0) if year_match else "N/A"

            # Mileage
            km_elem = listing.find(lambda tag: tag.name == 'div' and tag.get('aria-label') == 'Kilometers')
            if km_elem:
                km_span = km_elem.find('span', class_='b7af14b4')
                car['mileage_km'] = km_span.get_text(strip=True) if km_span else "N/A"
            else:
                car['mileage_km'] = "N/A"

            # Title
            title_parts = []
            make_elem = listing.find('span', class_='_8206696c')
            if make_elem:
                title_parts.append(make_elem.get_text(strip=True))
                model_elem = make_elem.find_next_sibling('span', class_='_8206696c')
                if model_elem:
                    title_parts.append(model_elem.get_text(strip=True))

            title = ' '.join(title_parts) if title_parts else "N/A"
            car['title'] = (
                f"{title} {car['year']}" 
                if car['year'] != "N/A" and title != "N/A" 
                else title
            )

            # Location
            location_elem = listing.find(
                lambda tag: tag.name == 'span' and tag.get('aria-label') == 'Location'
            )
            car['location'] = location_elem.get_text(strip=True) if location_elem else "N/A"

            # Transmission
            transmission_elem = listing.find(
                lambda tag: tag.name == 'div' and tag.get('aria-label') == 'Transmission'
            )
            if transmission_elem:
                trans_span = transmission_elem.find('span', class_='_2c0b5171 b7af14b4')
                car['transmission'] = trans_span.get_text(strip=True) if trans_span else "N/A"
            else:
                car['transmission'] = "N/A"

            # Fuel Type
            fuel_types = ['Benzine', 'Natural Gas', 'Diesel', 'Electric', 'Hybrid']
            car['fuel'] = "N/A"
            for ft in fuel_types:
                if ft in text_content:
                    car['fuel'] = ft
                    break

            car['page'] = page_num
            car['scraped_at'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            return car

        except Exception:
            return None

    def close(self):
        """Close browser"""
        if self.driver:
            try:
                self.driver.quit()
            except Exception:
                pass


def scrape_all_pages(total_pages, base_url, headless=True):
    """Main scraping function"""
    print(f"\n{'='*60}")
    print(f"  DUBIZZLE CAR SCRAPER")
    print(f"  Total Pages: {total_pages}")
    print(f"  Estimated Time: ~{total_pages * 3.5 / 60:.1f} minutes")
    print(f"{'='*60}\n")

    scraper = DubizzleCarScraper(headless=headless, max_pages_before_restart=100)

    try:
        start_time = time.time()

        for page in range(1, total_pages + 1):
            url = f"{base_url}?page={page}" if page > 1 else base_url
            scraper.scrape_page(url, page)

            # Progress update every 25 pages
            if page % 25 == 0:
                elapsed = time.time() - start_time
                avg_per_page = elapsed / page
                remaining_pages = total_pages - page
                est_remaining = remaining_pages * avg_per_page / 60
                print(f"[⏱] {page}/{total_pages} done | Avg: {avg_per_page:.1f}s/page | ETA: {est_remaining:.1f}min")

        elapsed = time.time() - start_time
        print(f"\n[✓] Scraping completed in {elapsed:.1f} seconds ({elapsed/60:.1f} minutes)")

    except KeyboardInterrupt:
        print("\n[⚠] Scraping interrupted by user")
    except Exception as e:
        print(f"\n[✗] Error during scraping: {e}")
    finally:
        scraper.close()

    return scraper.cars_data


def save_to_csv(cars_data, filename='/opt/airflow/data/dubizzle_cars.csv'):
    """Save data to CSV"""
    if not cars_data:
        print("[✗] No cars to save")
        return

    # Remove duplicates
    unique_cars_dict = {car['url']: car for car in cars_data}
    unique_cars_list = list(unique_cars_dict.values())

    keys = unique_cars_list[0].keys()

    try:
        with open(filename, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(unique_cars_list)

        print(f"\n{'='*60}")
        print(f"  RESULTS")
        print(f"  Total Raw: {len(cars_data)}")
        print(f"  Unique: {len(unique_cars_list)}")
        print(f"  File: {filename}")
        print(f"{'='*60}\n")

    except Exception as e:
        print(f"[✗] Error saving CSV: {e}")


if __name__ == "__main__":

    TOTAL_PAGES = 5 # 200 after testing
    HEADLESS_MODE = True
    BASE_URL = "https://www.dubizzle.com.eg/en/vehicles/cars-for-sale/used/"

    all_cars = scrape_all_pages(
        total_pages=TOTAL_PAGES,
        base_url=BASE_URL,
        headless=HEADLESS_MODE
    )

    save_to_csv(all_cars)
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
import pandas as pd
import time  # <--- This is the tool for sleeping
import re
from datetime import datetime

# --- CONFIGURATION ---
BASE_URL = "https://eg.hatla2ee.com/en/car/page/"
PAGES_TO_SCRAPE = 10 ######################################## 696

def clean_text(text):
    if not text: return None
    return text.strip().replace("\n", " ").replace("\r", " ")

with sync_playwright() as p:
    print("Launching browser (Ultra-Light Mode)...")
    
    # 1. DISABLING GPU & SANDBOX reduces overhead significantly
    browser = p.chromium.launch(
        headless=True, 
        args=["--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"]
    )
    
    context = browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    )
    page = context.new_page()

    # 2. BLOCKING IMAGES/CSS prevents CPU from decoding heavy media
    page.route("**/*", lambda route: route.abort() 
        if route.request.resource_type in ["image", "media", "font", "stylesheet"] 
        else route.continue_()
    )

    all_cars = []

    for page_num in range(1, PAGES_TO_SCRAPE + 1):
        target_url = f"{BASE_URL}{page_num}"
        print(f"Processing Page {page_num}/{PAGES_TO_SCRAPE}...")
        
        try:
            page.goto(target_url, timeout=90000)
            
            # --- CPU COOL-DOWN 1: Sleep after loading ---
            # Lets the page settle before we start scrolling
            time.sleep(2) 
            
            try:
                page.wait_for_selector('.newCarListUnit, div[data-slot="card-content"]', timeout=15000)
            except:
                pass 

            # --- CPU COOL-DOWN 2: Slow Scroll ---
            # Scroll in small steps with pauses to avoid spiking the CPU
            for _ in range(3): 
                page.mouse.wheel(0, 1500)
                time.sleep(1.5) # <--- Sleep 1.5 seconds between each scroll
            
            html = page.content()
            soup = BeautifulSoup(html, "lxml")
            
            # Parsing Logic (Same as before)
            page_cards = []
            
            new_slots = soup.find_all("div", attrs={"data-slot": "card-content"})
            for slot in new_slots:
                if slot.parent:
                    page_cards.append({"type": "new", "html": slot.parent, "slot": slot})
            
            old_units = soup.find_all("div", class_="newCarListUnit")
            for unit in old_units:
                page_cards.append({"type": "old", "html": unit, "slot": unit})
            
            print(f"  -> Found {len(page_cards)} cars.")
            
            for item in page_cards:
                try:
                    card = item["html"]
                    slot = item["slot"]
                    
                    # Title
                    title = "N/A"
                    if item["type"] == "new":
                        t_tag = slot.find("a")
                        if t_tag: title = clean_text(t_tag.text)
                    else:
                        h = card.find("div", class_="newCarListUnit_header")
                        if h: title = clean_text(h.text)

                    # Price
                    price = "0"
                    full_text = card.get_text(" ", strip=True)
                    p_match = re.search(r'(\d{1,3}(?:,\d{3})*)\s*EGP', full_text)
                    if p_match: price = p_match.group(1).replace(",", "")
                    
                    # Specs
                    year, mileage, transmission, fuel = None, None, None, None
                    tags = slot.find_all(["span", "div"])
                    clean_tags = [t.text.strip() for t in tags if t.text.strip()]
                    
                    for text in clean_tags:
                        if len(text) > 25: continue
                        text_l = text.lower()
                        
                        if not year and re.match(r'^(19|20)\d{2}$', text): year = text
                        elif not mileage and "km" in text_l:
                            clean_km = text_l.replace("km", "").replace(",", "").strip()
                            if clean_km.isdigit() or "low" in clean_km: mileage = clean_km
                        elif not transmission and text_l in ["automatic", "manual", "cvt", "dsg"]:
                            transmission = text.capitalize()
                        elif not fuel and text_l in ["gas", "electric", "hybrid", "diesel", "natural gas"]:
                            fuel = text.capitalize()

                    # Location
                    location = "N/A"
                    svg = card.find("svg", class_="min-w-3")
                    if svg and svg.parent: location = clean_text(svg.parent.text)
                    elif location == "N/A":
                        l_div = card.find("div", class_="newCarListUnit_data_city")
                        if l_div: location = clean_text(l_div.text)

                    all_cars.append({
                        "title": title, "year": year, "mileage_km": mileage,
                        "transmission": transmission, "fuel": fuel, "price_egp": price,
                        "location": location, "page": page_num,
                        "scraped_at": datetime.utcnow().isoformat()
                    })
                    
                except: continue
            
            # --- CPU COOL-DOWN 3: Sleep between pages ---
            print("  Sleeping for 2 seconds to cool down...")
            time.sleep(2) 

        except Exception as e:
            print(f"Error on Page {page_num}: {e}")
            continue

    browser.close()

# Save
df = pd.DataFrame(all_cars)
if not df.empty:
    df = df.dropna(subset=['title'])
    df.drop_duplicates(subset=["title", "price_egp", "location"], inplace=True)
    df.to_csv("data/hatla2ee_ultra_light.csv", index=False)
    print(f"DONE! Saved {len(df)} cars.")
else:
    print("No data found.")
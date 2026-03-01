#!/usr/bin/env python3
"""
Global model normalization — one-time script.
Fixes trim bleeding, junk, spacing, case, typos, and misclassifications
across ALL brands in cars_with_make_model.csv.

Run:  python src/_normalize_all_brands.py
"""

import pandas as pd
import re

CSV = "data/raw/cars_with_make_model.csv"
PARQUET = "data/raw/cars_with_make_model.parquet"

df = pd.read_csv(CSV)
total = len(df)
before_unique = df["model"].nunique()
print(f"Before: {total} rows, {before_unique} unique models")

changes = 0

# ─────────────────────────────────────────────────────────────────────
# 0.  GENERAL CLEANUP  (applied to every row)
# ─────────────────────────────────────────────────────────────────────
def clean_model(m):
    if pd.isna(m):
        return m
    m = str(m).strip()
    # trailing pipe / slash / backslash
    m = re.sub(r'[\|/\\]+\s*$', '', m).strip()
    # trailing lonely parentheses  "650 (" → "650"
    m = re.sub(r'\(\s*\)?\s*$', '', m).strip()
    # "Other", dashes, dots → Unknown
    if m.lower() in ('other', '-', '– –', '. .', ''):
        return 'Unknown'
    return m

for i in range(total):
    old = df.at[i, 'model']
    new = clean_model(old)
    if str(new) != str(old):
        df.at[i, 'model'] = new
        changes += 1

# ─────────────────────────────────────────────────────────────────────
# 1.  BRAND-SPECIFIC  model-name overrides  (old → new)
# ─────────────────────────────────────────────────────────────────────
BRAND_MODEL_MAP = {
    # ── BMW ──────────────────────────────────────────────────────────
    'BMW': {
        # trim bleeding
        '320i M': '320i', '320i m': '320i',
        '320i M-Sport': '320i', '320i M-sport': '320i',
        '320i msport 2000cc': '320i', '320i M-Sport Model': '320i',
        '320i G20 320i G20': '320i', '320M': '320',
        '330i m': '330i', '330i M-Sport': '330i',
        '430i xDrive M-Sport': '430i',
        '520i special order': '520i',
        '530i Msport': '530i',
        'm-sport 530 2000CC': '530',
        '218i M': '218i',
        # spacing
        '218 i': '218i', 'i 218': '218i',
        # junk already stripped above ("650 (", "730LI (", "520i |")
        # but add fallback:
        '650': '650', '730LI': '730LI',
        # case
        '740li': '740LI', '730Li': '730LI',
        # chassis code w/ junk
        'E46 Model': 'E46',
        'E93 335i Convertible (ORIGINAL)': '335i',
        'Gran Coupe M': 'Unknown',
        # bad parse
        '4 40': '440',
        # pure junk → Unknown
        'Luxury': 'Unknown', 'luxury': 'Unknown',
        '4': 'Unknown', '2': 'Unknown', '30': 'Unknown', 'X': 'Unknown',
        # spacing for X-M (keep — M-division cars are distinct)
        'X4M': 'X4 M',
    },

    # ── Hyundai ──────────────────────────────────────────────────────
    'Hyundai': {
        # case
        'cn7': 'CN7', 'Hd': 'HD', 'i10': 'I10',
        # merge into Elantra gen codes
        'ELENTRA HD': 'Elantra HD',
        'Elantra Coupe': 'Elantra',
        # CN7 standalone → Elantra CN7
        'CN7': 'Elantra CN7',
        # spacing
        'IX 35': 'IX35',
        # junk / price in model
        'fully': 'Unknown', '26000': 'Unknown', '73.500 3': 'Unknown',
        '39.000': 'Unknown', '98': 'Unknown', 'p2': 'Unknown',
        'x16': 'Unknown', '100': 'Unknown',
        # parse errors
        '20 I20': 'I20', '20': 'Unknown', '10': 'I10',
        # typo
        'Accel': 'Excel',
    },

    # ── Volkswagen ───────────────────────────────────────────────────
    'Volkswagen': {
        # ID-series spacing + trim
        'ID 4': 'ID4', 'ID 6': 'ID6',
        'ID4 Pure plus': 'ID4', 'ID4 crozz pro': 'ID4',
        'Id6 Pro Import': 'ID6', 'ID6': 'ID6',
        # case
        'pointer': 'Pointer',
        # Golf EV
        'E Golf': 'E-Golf',
        # typo
        'Turan': 'Touran',
        # junk
        '10': 'Unknown', 'T': 'Unknown', 'Cross': 'Unknown',
    },

    # ── Citroën ──────────────────────────────────────────────────────
    'Citroën': {
        # brand prefix in model + junk
        'Citroen C Elysee': 'C Elysee', 'Citroen C Elysee /': 'C Elysee',
        'C-Elysée': 'C Elysee', 'C-Elysée – 97,000': 'C Elysee',
        'Citroen C5 Aircross': 'C5 Aircross',
        '5 Citroen C5 Aircross': 'C5 Aircross',
        'C5 Aircross Shine': 'C5 Aircross',
        'Citroen C3 Aircross': 'C3 Aircross',
        'Citroen C5 /': 'C5',
        'C5 shine': 'C5', 'C5 x7': 'C5',
        'Citroen C3 \\ 3': 'C3', 'C3 1600': 'C3',
        '4 \\ Citroen C4X': 'C4X',
        'C4 Grand Picasso Grand Picasso high line': 'C4 Grand Picasso',
        '4 shine': 'C4', '4 (( ))': 'Unknown',
        'CITROEN DS7 OPERA': 'DS7',
        # DS case
        'Ds5': 'DS5', 'Ds3': 'DS3', 'Ds4': 'DS4',
        # case
        'Ax': 'AX',
        # junk
        '29.000 3': 'Unknown',
    },

    # ── Audi ─────────────────────────────────────────────────────────
    'Audi': {
        # number-only → real model (trim stripped)
        '8 S line': 'Q8', '8 S LINE PLUS': 'Q8',
        '3 S line': 'A3', '3 1400cc sline': 'A3', '3 90': 'A3', '3 Q3': 'Q3',
        '5 A5 S line': 'A5',
        'A 4 S LINE': 'A4',
        # spacing
        'RSQ3': 'RS Q3',
        # case
        'Q8 E-tron': 'Q8 E-Tron', 'Q6 e-tron quattro': 'Q6 E-Tron',
        # junk
        '3': 'Unknown',
    },

    # ── Porsche ──────────────────────────────────────────────────────
    'Porsche': {
        'cayeen s wakieel': 'Cayenne S',
        'Boxter 718': '718 Boxster',
        'GTS': 'Unknown',  # GTS is a trim across many Porsche models
    },

    # ── Volvo ────────────────────────────────────────────────────────
    'Volvo': {
        'XC 40': 'XC40',
        'XC40 Recharge': 'XC40', 'XC40 Ultimate': 'XC40',
        's80': 'S80',
        # incomplete / ambiguous numbers
        '60': 'Unknown', '80': 'Unknown', '90': 'Unknown', '40': 'Unknown',
    },

    # ── Chrysler ─────────────────────────────────────────────────────
    'Chrysler': {
        'Town and Country': 'Town & Country',
        'M300': '300',
    },

    # ── Nissan ───────────────────────────────────────────────────────
    'Nissan': {
        'X-Trail': 'XTrail', 'X-Trail /': 'XTrail',
        'Pick up': 'Pickup',
        'Tekna': 'Unknown',      # trim level
        'Accent': 'Unknown',     # Hyundai model, misclassified
        'Datsun': 'Unknown',     # brand, not model
    },

    # ── Toyota ───────────────────────────────────────────────────────
    'Toyota': {
        'Rav 4': 'RAV4', 'bz4X': 'BZ4X',
        'GR86 USA': 'GR86',
        'GL': 'Unknown',
    },

    # ── Kia ──────────────────────────────────────────────────────────
    'Kia': {
        'koup': 'Cerato Koup',
        'carnival2004': 'Carnival',
        '3 K3': 'K3',
        '399': 'Unknown', '99': 'Unknown', '. .': 'Unknown',
    },

    # ── Chevrolet ────────────────────────────────────────────────────
    'Chevrolet': {
        'spark': 'Spark',
        'new': 'Unknown',
        '5000 /': 'Unknown',
        '300 | N3002024': 'N300',
        '| Pickup/Dababa': 'Pickup',
        'Pickup/Dababa': 'Pickup',
    },

    # ── Renault ──────────────────────────────────────────────────────
    'Renault': {
        'Renualt Kadjar Signature': 'Kadjar',
        '( ) Kadjar': 'Kadjar',
        'Renult captuer': 'Captur',
        'high line': 'Unknown', 'Dynamic': 'Unknown',
        'Mokka': 'Unknown', 'Optima': 'Unknown',
        'Stepway': 'Sandero Stepway',
        'MCV': 'Logan MCV',
        '99': 'Unknown',
    },

    # ── Peugeot ──────────────────────────────────────────────────────
    'Peugeot': {
        '308 sw': '308 SW',         # case
        '508 GT Line': '508',
        'Allure Pack 3008 .': '3008',
        '307XT': '307',
        '204 204': '204',
        # pure trims → Unknown
        'Gt Line': 'Unknown', 'GTI': 'Unknown', 'GT': 'Unknown',
        'Top Line': 'Unknown', 'Top Line Panorama': 'Unknown',
        'First': 'Unknown', 'Alure plus': 'Unknown',
    },

    # ── Ford ─────────────────────────────────────────────────────────
    'Ford': {
        'focus': 'Focus',
        '70000': 'Unknown', '400/750': 'Unknown', '( )': 'Unknown',
        'Eco 130': 'EcoSport', 'Connected': 'Unknown',
        'Tang L': 'Unknown',
    },

    # ── Suzuki ───────────────────────────────────────────────────────
    'Suzuki': {
        'S-Presso2021': 'S Presso',
        '55000 7': 'Unknown', '10000 5': 'Unknown', '60': 'Unknown',
        'Fan': 'Van',
    },

    # ── Mitsubishi ───────────────────────────────────────────────────
    'Mitsubishi': {
        'Atrage': 'Attrage',
        '4*4': 'Unknown',
    },

    # ── Skoda ────────────────────────────────────────────────────────
    'Skoda': {
        'Felecia': 'Felicia',
        'Felicia combi': 'Felicia Combi',
        # bare generation codes → Octavia gen
        'a4': 'Octavia A4', 'a4 98': 'Octavia A4',
        'A7': 'Octavia A7', 'A8': 'Octavia A8',
    },

    # ── Chery ────────────────────────────────────────────────────────
    'Chery': {
        '11': 'A11', '15': 'A15',
        'Speranza cherry A113 Year': 'A113',
    },

    # ── Geely ────────────────────────────────────────────────────────
    'Geely': {
        'Pandido': 'Pandino',  # typo (7 rows)
        'X Pandido': 'X Pandino',
        'Coolray': 'Cool Ray',
        'Sparky': 'Spark',
    },

    # ── MG ───────────────────────────────────────────────────────────
    'MG': {
        'MG 5': '5', 'MG 6': '6', 'MG 4': '4', 'MG 7': '7',
        'Hs': 'HS',
        'Ex 7': 'EX7',
        'RX5 Plus': 'RX5',
        # misclassified → handled in BRAND_FIXES below
    },

    # ── Proton ───────────────────────────────────────────────────────
    'Proton': {
        '-2': 'Gen-2', '-2 Gen-2': 'Gen-2', '-2 \\ Gen-2': 'Gen-2',
        '-Gen 2 \\ 2': 'Gen-2',
        'Gen 2': 'Gen-2',
    },

    # ── Seat ─────────────────────────────────────────────────────────
    'Seat': {
        'ibizah petas': 'Ibiza',
        'fr': 'FR', 'Fr': 'FR',
        's550': 'Unknown', '99': 'Unknown',
    },

    # ── Speranza ─────────────────────────────────────────────────────
    'Speranza': {
        '113': 'A113', '113 / A113': 'A113',
        '213': 'A213',
        '516': 'A516', '620': 'A620',
        '11': 'A11', '12': 'A12',
        '29.000 113': 'A113',
    },

    # ── Mini ─────────────────────────────────────────────────────────
    'Mini': {
        'Country man': 'Countryman',
        'Mini Cooper S': 'Cooper S',
        '2024_ Cooper Countryman': 'Countryman',
        '4 Countryman': 'Countryman',
        '109.000 80.000K. M 10': 'Unknown',
        'All4': 'Unknown',
        'F55': 'Cooper',
    },

    # ── Lada ─────────────────────────────────────────────────────────
    'Lada': {
        '2017': '2107',   # likely typo
    },

    # ── Daihatsu ─────────────────────────────────────────────────────
    'Daihatsu': {
        'Grand terios': 'Grand Terios',
        'SIRION': 'Sirion',
    },

    # ── Brilliance ───────────────────────────────────────────────────
    'Brilliance': {
        'FRV /': 'FRV',
    },

    # ── Changan ──────────────────────────────────────────────────────
    'Changan': {
        'CS 55': 'CS55', 'CS 35': 'CS35', 'CS 15': 'CS15',
        'CS 35 Plus': 'CS35 Plus', 'CS 85': 'CS85',
        'CS55 pluse': 'CS55 Plus',
        'Benni mini': 'Benni Mini',
        'Eado plus': 'Eado Plus',
        '15 CS15': 'CS15',
    },

    # ── Soueast ──────────────────────────────────────────────────────
    'Soueast': {
        'S 06': 'S06', 'S 05': 'S05', 'S 09': 'S09', 'S 07': 'S07',
        '06': 'S06',
    },

    # ── Zotye ────────────────────────────────────────────────────────
    'Zotye': {
        'Explosion': 'Xplosion',
        '600': 'T600',
    },

    # ── Tesla ────────────────────────────────────────────────────────
    'Tesla': {
        'x D100': 'Model X',
        'Cyberbeast foundation ser.': 'Cybertruck',
        'Model': 'Unknown',
    },

    # ── Subaru ───────────────────────────────────────────────────────
    'Subaru': {
        '2000cc 90': 'Unknown',
        '– 1600 – 4 – –': 'Unknown',
    },

    # ── Jeep ─────────────────────────────────────────────────────────
    'Jeep': {
        'KK unique condition': 'Cherokee',
        'kk': 'Cherokee',
        'High line 4*4': 'Unknown',
        'Top Line Limited': 'Unknown',
        '4*2': 'Unknown',
        'Pajero': 'Unknown',    # Mitsubishi model
        'Kodiaq': 'Unknown',   # Skoda model
    },

    # ── JAC ──────────────────────────────────────────────────────────
    'JAC': {
        '5 J5': 'J5',
        '10': 'Unknown',
    },

    # ── Avatr ────────────────────────────────────────────────────────
    'Avatr': {
        '3 Up': 'Unknown',
        '12 Max P300 Import': '12',
        '12 Royal Edition': '12',
        '6.0': 'Unknown',
    },

    # ── DFSK ─────────────────────────────────────────────────────────
    'DFSK': {
        '580': 'EAGLE 580',
        '20': 'Unknown',
    },

    # ── GAC ──────────────────────────────────────────────────────────
    'GAC': {
        'GS3 Emzoom': 'Emzoom',
        'GS4 max': 'GS4',
    },

    # ── FAW ──────────────────────────────────────────────────────────
    'FAW': {
        '79': 'Unknown',
    },

    # ── SsangYong ────────────────────────────────────────────────────
    'SsangYong': {
        'SsangYong Taurus': 'Taurus',
    },

    # ── BAIC ─────────────────────────────────────────────────────────
    'BAIC': {
        '30': 'BJ30',
    },

    # ── Jetour ───────────────────────────────────────────────────────
    'Jetour': {
        '95': 'X95', '90': 'X90',
        '2 T2': 'T2',
        'X 70 FL': 'X70',
    },

    # ── Fiat ─────────────────────────────────────────────────────────
    'Fiat': {
        '500 X': '500X', '500X X500': '500X',
        '500 L': '500L', '500 E': '500E',
        '128 Nova': '128',
        'Punto evo': 'Punto Evo',
        'Florid': 'Florida',
    },

    # ── Daewoo ───────────────────────────────────────────────────────
    'Daewoo': {
        # looks clean
    },

    # ── Opel ─────────────────────────────────────────────────────────
    # (not audited above — check separately if needed)
}

# apply brand-specific maps
for i in range(total):
    make = df.at[i, 'make']
    model = str(df.at[i, 'model'])
    bmap = BRAND_MODEL_MAP.get(make, {})
    if model in bmap:
        df.at[i, 'model'] = bmap[model]
        changes += 1

# ─────────────────────────────────────────────────────────────────────
# 2.  BRAND MISCLASSIFICATIONS  (wrong make)
# ─────────────────────────────────────────────────────────────────────
BRAND_FIXES = [
    # (current_make, current_model_pattern, new_make, new_model)
    ('BMW',      'Alto',                          'Suzuki',    'Alto'),
    ('MG',       'C 180',                         'Mercedes',  'C180'),
    ('MG',       'E 200',                         'Mercedes',  'E200'),
    ('MG',       'C 350',                         'Mercedes',  'C350'),
    ('MG',       'Model Y',                       'Tesla',     'Model Y'),
    ('MG',       'Alto',                          'Suzuki',    'Alto'),
    ('JAC',      'Jaguar F-Type Model',           'Jaguar',    'F-Type'),
    ('JAC',      'Jaguar F-Pace',                 'Jaguar',    'F-Pace'),
    ('JAC',      'jaguar f pace R dynamic',       'Jaguar',    'F-Pace'),
    ('Chrysler', 'Civic',                         'Honda',     'Civic'),
    ('Chrysler', 'Cruze',                         'Chevrolet', 'Cruze'),
    ('Chrysler', 'C30',                           'Volvo',     'C30'),
    ('Seat',     'Golf',                          'Volkswagen','Golf'),
    ('Renault',  'Model Y',                       'Tesla',     'Model Y'),
    ('BAIC',     'Citroen C4 Grand Picasso \\ 4', 'Citroën',   'C4 Grand Picasso'),
]

for cur_make, cur_model, new_make, new_model in BRAND_FIXES:
    mask = (df['make'] == cur_make) & (df['model'] == cur_model)
    n = mask.sum()
    if n > 0:
        df.loc[mask, 'make'] = new_make
        df.loc[mask, 'model'] = new_model
        changes += n
        print(f"  brand fix: {cur_make} / {cur_model} → {new_make} / {new_model}  ({n} rows)")

# ─────────────────────────────────────────────────────────────────────
# 3.  SAVE
# ─────────────────────────────────────────────────────────────────────
after_unique = df['model'].nunique()
print(f"\nAfter : {total} rows, {after_unique} unique models")
print(f"Unique models reduced by {before_unique - after_unique}  ({before_unique} → {after_unique})")
print(f"Total cell changes: {changes}")

df.to_csv(CSV, index=False)
df.to_parquet(PARQUET, index=False)
print(f"\nSaved to {CSV} and {PARQUET}")

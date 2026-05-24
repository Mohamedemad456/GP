"""
Compute per-price-tier and per-make-model evaluation metrics for the production
XGBoost quantile model, with and without filtering out high-MAPE (>50%) models.

Outputs:
  models/metrics/per_tier_metrics.csv
  models/metrics/per_tier_metrics_filtered.csv   (MAPE>50% excluded)
  models/metrics/per_make_model_metrics.csv
  models/metrics/per_make_model_metrics_filtered.csv
"""

import sys
import json
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import xgboost as xgb
import joblib

# ── Locate ml-service root ────────────────────────────────────────────────────
def find_ml_root(start=None):
    start = (start or Path.cwd()).resolve()
    for c in (start, *start.parents):
        if (c / 'app' / 'core' / 'config.py').exists():
            return c
    raise FileNotFoundError('Cannot find ml-service root')

ML_ROOT = find_ml_root()
if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

from app.core.config import settings

PICKLES_DIR  = ML_ROOT / 'models' / 'pickles'
METRICS_DIR = ML_ROOT / 'models' / 'metrics'
METRICS_DIR.mkdir(parents=True, exist_ok=True)

RANDOM_STATE = 42
TEST_SIZE    = 0.20
MIN_ROWS_PER_MODEL = 5

CAT_COLS = ['make', 'model', 'transmission', 'fuel', 'location',
            'body_type', 'drivetrain', 'brand_origin', 'car_segment']
NUM_COLS = ['year', 'mileage_km', 'mileage_per_year', 'engine_cc',
            'horsepower', 'seating_capacity']
FEATURE_COLS = NUM_COLS + CAT_COLS
QUANTILES = {'lower': 0.05, 'median': 0.50, 'upper': 0.95}

# ── Load data ─────────────────────────────────────────────────────────────────
df_raw = settings.load_data('processed').copy()
print(f'Dataset shape: {df_raw.shape}')

# ── Rare-category grouping ────────────────────────────────────────────────────
_model_counts = df_raw.groupby(['make', 'model']).size().reset_index(name='n')
_rare_models  = _model_counts.loc[_model_counts['n'] < MIN_ROWS_PER_MODEL]
RARE_MODEL_SET = set(zip(_rare_models['make'], _rare_models['model']))

def apply_rare_grouping(df):
    df = df.copy()
    if 'model' in df.columns and 'make' in df.columns:
        mask = [(m, mo) in RARE_MODEL_SET for m, mo in zip(df['make'], df['model'])]
        df.loc[mask, 'model'] = df.loc[mask, 'make'].apply(lambda x: f'OTHER_{x}')
    return df

df_raw = apply_rare_grouping(df_raw)

# ── Reproduce split E: stratified by price bins ───────────────────────────────
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

def _build_price_bins(price: pd.Series, desired_bins: int = 10) -> pd.Series:
    s = pd.to_numeric(price, errors='coerce').fillna(price.median())
    for q in [desired_bins, 8, 6, 5, 4, 3]:
        try:
            b = pd.qcut(s, q=q, duplicates='drop')
        except Exception:
            continue
        codes = b.cat.codes.astype(int)
        rare  = codes.value_counts()[codes.value_counts() < 2].index
        codes = codes.where(~codes.isin(rare), -1)
        if codes.value_counts().min() >= 2:
            return codes
    return pd.Series(np.zeros(len(s), dtype=int), index=price.index)

strat_price = _build_price_bins(df_raw['price_egp'])
idx_all     = df_raw.index.to_numpy()
tr_idx, te_idx = train_test_split(
    idx_all, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=strat_price
)
print(f'Train: {len(tr_idx):,}   Test: {len(te_idx):,}')

# ── Load saved model & label encoders ─────────────────────────────────────────
MODEL_PKL = PICKLES_DIR / 'xgb_quantile_models.joblib'
LE_PKL    = PICKLES_DIR / 'label_encoders.joblib'

assert MODEL_PKL.exists(), f'Model pkl not found: {MODEL_PKL}'
assert LE_PKL.exists(),    f'Label encoders not found: {LE_PKL}'

models         = joblib.load(MODEL_PKL)
label_encoders = joblib.load(LE_PKL)
print(f'Loaded model keys: {list(models.keys())}')

# ── Label-encode test features ────────────────────────────────────────────────
df_enc = df_raw[FEATURE_COLS].copy()
for col, le in label_encoders.items():
    if col in df_enc.columns:
        known = set(le.classes_)
        df_enc[col] = df_enc[col].fillna('__MISSING__').astype(str)
        df_enc[col] = df_enc[col].apply(lambda v: v if v in known else '__MISSING__')
        df_enc[col] = le.transform(df_enc[col])

X_te = df_enc.loc[te_idx]
y_te = df_raw.loc[te_idx, 'price_egp'].values

# ── Inference ─────────────────────────────────────────────────────────────────
dm_te  = xgb.DMatrix(X_te, enable_categorical=True)
y_pred_med   = models['median'].predict(dm_te)
y_pred_lower = models['lower'].predict(dm_te)
y_pred_upper = models['upper'].predict(dm_te)

# ── Metric helpers ────────────────────────────────────────────────────────────
def safe_mape(y_true, y_pred):
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    eps = 1e-9
    return float(np.mean(np.abs((y_true - y_pred) / np.maximum(np.abs(y_true), eps))) * 100)

def compute_group_metrics(y_true, y_pred):
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    if len(y_true) < 2:
        return dict(MAE=float(mean_absolute_error(y_true, y_pred)),
                    MAPE_pct=safe_mape(y_true, y_pred),
                    R2=np.nan, RMSE=np.nan, n=len(y_true))
    mae  = float(mean_absolute_error(y_true, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    r2   = float(r2_score(y_true, y_pred))
    mape = safe_mape(y_true, y_pred)
    return dict(MAE=mae, RMSE=rmse, R2=r2, MAPE_pct=mape, n=len(y_true))

# ── Build test dataframe ──────────────────────────────────────────────────────
df_test = df_raw.loc[te_idx, ['make', 'model', 'price_egp']].copy()
df_test['pred_median'] = y_pred_med
df_test['pred_lower']  = y_pred_lower
df_test['pred_upper']  = y_pred_upper

# ── Per-make-model metrics ────────────────────────────────────────────────────
model_rows = []
for (brand, mdl), grp in df_test.groupby(['make', 'model']):
    if len(grp) < 5:
        continue
    yt = grp['price_egp'].values
    yp = grp['pred_median'].values
    m = compute_group_metrics(yt, yp)
    m['make'] = brand
    m['model'] = mdl
    m['mean_price'] = float(np.mean(yt))
    # CI coverage
    coverage = float(np.mean((yt >= grp['pred_lower'].values) & (yt <= grp['pred_upper'].values)) * 100)
    m['coverage_pct'] = coverage
    model_rows.append(m)

df_model_diag = pd.DataFrame(model_rows)
print(f'\nMake-model combos with ≥5 test rows: {len(df_model_diag)}')

# Save full per-make-model metrics
df_model_diag.to_csv(METRICS_DIR / 'per_make_model_metrics.csv', index=False)
print(f'Saved per_make_model_metrics.csv ({len(df_model_diag)} rows)')

# ── Per-price-tier metrics ────────────────────────────────────────────────────
# Define price tiers
def assign_tier(price):
    if price < 300_000:
        return 'Budget (<300K)'
    elif price < 700_000:
        return 'Mid-Range (300K-700K)'
    elif price < 1_500_000:
        return 'Premium (700K-1.5M)'
    else:
        return 'Luxury (1.5M+)'

df_test['tier'] = df_test['price_egp'].apply(assign_tier)

tier_rows = []
for tier, grp in df_test.groupby('tier', observed=True):
    yt = grp['price_egp'].values
    yp = grp['pred_median'].values
    m = compute_group_metrics(yt, yp)
    m['tier'] = tier
    # CI coverage
    coverage = float(np.mean((yt >= grp['pred_lower'].values) & (yt <= grp['pred_upper'].values)) * 100)
    m['coverage_pct'] = coverage
    tier_rows.append(m)

df_tier = pd.DataFrame(tier_rows)
# Sort tiers logically
tier_order = ['Budget (<300K)', 'Mid-Range (300K-700K)', 'Premium (700K-1.5M)', 'Luxury (1.5M+)']
df_tier['tier'] = pd.Categorical(df_tier['tier'], categories=tier_order, ordered=True)
df_tier = df_tier.sort_values('tier').reset_index(drop=True)

print('\n=== Per-Price-Tier Metrics (ALL models) ===')
print(df_tier[['tier', 'n', 'MAE', 'RMSE', 'MAPE_pct', 'R2', 'coverage_pct']].to_string(index=False))

df_tier.to_csv(METRICS_DIR / 'per_tier_metrics.csv', index=False)
print(f'\nSaved per_tier_metrics.csv')

# ── Filtered: exclude make-model combos with MAPE > 50% ──────────────────────
HIGH_MAPE_THRESHOLD = 50.0
bad_combos = set(
    df_model_diag.loc[df_model_diag['MAPE_pct'] > HIGH_MAPE_THRESHOLD, 'make'] + '|' +
    df_model_diag.loc[df_model_diag['MAPE_pct'] > HIGH_MAPE_THRESHOLD, 'model']
)
print(f'\nExcluding {len(bad_combos)} make-model combos with MAPE > {HIGH_MAPE_THRESHOLD}%')

df_test_filtered = df_test[
    ~df_test.apply(lambda r: f"{r['make']}|{r['model']}" in bad_combos, axis=1)
].copy()
print(f'Test rows: {len(df_test)} → {len(df_test_filtered)} (removed {len(df_test) - len(df_test_filtered)})')

# Per-tier filtered
tier_rows_f = []
for tier, grp in df_test_filtered.groupby('tier', observed=True):
    yt = grp['price_egp'].values
    yp = grp['pred_median'].values
    m = compute_group_metrics(yt, yp)
    m['tier'] = tier
    coverage = float(np.mean((yt >= grp['pred_lower'].values) & (yt <= grp['pred_upper'].values)) * 100)
    m['coverage_pct'] = coverage
    tier_rows_f.append(m)

df_tier_f = pd.DataFrame(tier_rows_f)
df_tier_f['tier'] = pd.Categorical(df_tier_f['tier'], categories=tier_order, ordered=True)
df_tier_f = df_tier_f.sort_values('tier').reset_index(drop=True)

print('\n=== Per-Price-Tier Metrics (EXCLUDING MAPE>50% combos) ===')
print(df_tier_f[['tier', 'n', 'MAE', 'RMSE', 'MAPE_pct', 'R2', 'coverage_pct']].to_string(index=False))

df_tier_f.to_csv(METRICS_DIR / 'per_tier_metrics_filtered.csv', index=False)
print(f'Saved per_tier_metrics_filtered.csv')

# Per-make-model filtered
df_model_diag_f = df_model_diag[df_model_diag['MAPE_pct'] <= HIGH_MAPE_THRESHOLD].copy()
df_model_diag_f.to_csv(METRICS_DIR / 'per_make_model_metrics_filtered.csv', index=False)
print(f'Saved per_make_model_metrics_filtered.csv ({len(df_model_diag_f)} rows)')

# ── Overall metrics (with and without filter) ─────────────────────────────────
overall = compute_group_metrics(df_test['price_egp'].values, df_test['pred_median'].values)
overall_f = compute_group_metrics(df_test_filtered['price_egp'].values, df_test_filtered['pred_median'].values)

overall['coverage_pct'] = float(np.mean(
    (df_test['price_egp'].values >= df_test['pred_lower'].values) &
    (df_test['price_egp'].values <= df_test['pred_upper'].values)
) * 100)
overall_f['coverage_pct'] = float(np.mean(
    (df_test_filtered['price_egp'].values >= df_test_filtered['pred_lower'].values) &
    (df_test_filtered['price_egp'].values <= df_test_filtered['pred_upper'].values)
) * 100)

print('\n=== Overall Metrics ===')
print(f'ALL:      MAE={overall["MAE"]:,.0f}  MAPE={overall["MAPE_pct"]:.2f}%  R2={overall["R2"]:.4f}  Coverage={overall["coverage_pct"]:.1f}%')
print(f'FILTERED: MAE={overall_f["MAE"]:,.0f}  MAPE={overall_f["MAPE_pct"]:.2f}%  R2={overall_f["R2"]:.4f}  Coverage={overall_f["coverage_pct"]:.1f}%')

# Save overall as JSON for easy reference in the MD file
overall_json = {
    'all': {k: round(v, 4) if isinstance(v, float) else v for k, v in overall.items()},
    'filtered': {k: round(v, 4) if isinstance(v, float) else v for k, v in overall_f.items()},
    'high_mape_threshold': HIGH_MAPE_THRESHOLD,
    'n_excluded_combos': len(bad_combos),
    'n_test_all': len(df_test),
    'n_test_filtered': len(df_test_filtered),
}
METADATA_DIR = ML_ROOT / 'models' / 'metadata'
METADATA_DIR.mkdir(parents=True, exist_ok=True)
with open(METADATA_DIR / 'overall_metrics.json', 'w') as f:
    json.dump(overall_json, f, indent=2)
print(f'Saved overall_metrics.json')

# ── Per-make metrics (aggregated) ─────────────────────────────────────────────
make_rows = []
for make, grp in df_test.groupby('make'):
    if len(grp) < 10:
        continue
    yt = grp['price_egp'].values
    yp = grp['pred_median'].values
    m = compute_group_metrics(yt, yp)
    m['make'] = make
    coverage = float(np.mean((yt >= grp['pred_lower'].values) & (yt <= grp['pred_upper'].values)) * 100)
    m['coverage_pct'] = coverage
    make_rows.append(m)

df_make = pd.DataFrame(make_rows).sort_values('MAPE_pct')
df_make.to_csv(METRICS_DIR / 'per_make_metrics.csv', index=False)
print(f'\nSaved per_make_metrics.csv ({len(df_make)} makes with ≥10 test rows)')

# ── Summary stats for the presentation ────────────────────────────────────────
print('\n' + '='*60)
print('SUMMARY FOR PRESENTATION')
print('='*60)
print(f'\nDataset: {len(df_raw):,} rows, {df_raw["make"].nunique()} makes, {df_raw["model"].nunique()} models')
print(f'Test set: {len(df_test):,} rows (split E: stratified by price)')
print(f'\nProduction model: XGBoost Quantile (q=0.05/0.50/0.95)')
print(f'  Overall MAPE: {overall["MAPE_pct"]:.2f}%')
print(f'  Overall R²:   {overall["R2"]:.4f}')
print(f'  Overall MAE:  {overall["MAE"]:,.0f} EGP')
print(f'  Coverage:     {overall["coverage_pct"]:.1f}%')
print(f'\nFiltered (MAPE≤50% combos only):')
print(f'  Overall MAPE: {overall_f["MAPE_pct"]:.2f}%')
print(f'  Overall R²:   {overall_f["R2"]:.4f}')
print(f'  Overall MAE:  {overall_f["MAE"]:,.0f} EGP')
print(f'  Coverage:     {overall_f["coverage_pct"]:.1f}%')
print(f'\nPer-make-model MAPE stats:')
print(f'  Median: {df_model_diag["MAPE_pct"].median():.1f}%')
print(f'  Mean:   {df_model_diag["MAPE_pct"].mean():.1f}%')
print(f'  Min:    {df_model_diag["MAPE_pct"].min():.1f}%')
print(f'  Max:    {df_model_diag["MAPE_pct"].max():.1f}%')
print(f'  Combos >50% MAPE: {(df_model_diag["MAPE_pct"] > 50).sum()} / {len(df_model_diag)}')

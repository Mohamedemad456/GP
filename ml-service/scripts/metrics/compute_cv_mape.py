"""
Compute per-make-model MAPE across the full dataset using 5-fold CV.
Every (make, model) combo in the dataset gets a MAPE — no minimum threshold.

Outputs:
  models/metrics/make_model_mape_cv.csv
"""
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
import xgboost as xgb
from sklearn.metrics import r2_score, mean_absolute_error
from sklearn.model_selection import StratifiedKFold

warnings.filterwarnings('ignore')

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
METRICS_DIR  = ML_ROOT / 'models' / 'metrics'
METRICS_DIR.mkdir(parents=True, exist_ok=True)

OUT_CSV = METRICS_DIR / 'make_model_mape_cv.csv'

# ── Hyperparameters from saved metadata ──────────────────────────────────────
XGB_BEST_PARAMS = {
    "learning_rate": 0.015490483286740053,
    "max_depth": 11,
    "min_child_weight": 4,
    "subsample": 0.6622077411666858,
    "colsample_bytree": 0.8536659127023519,
    "reg_alpha": 0.085522303812033,
    "reg_lambda": 1.3969605300880791e-07,
    "gamma": 0.447036756545783,
    "max_bin": 512,
}

RANDOM_STATE = 42
N_FOLDS = 5
MIN_ROWS_PER_MODEL = 5

CAT_COLS = ['make', 'model', 'transmission', 'fuel', 'location',
            'body_type', 'drivetrain', 'brand_origin', 'car_segment']
NUM_COLS = ['year', 'mileage_km', 'mileage_per_year', 'engine_cc',
            'horsepower', 'seating_capacity']
FEATURE_COLS = NUM_COLS + CAT_COLS

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
print(f'Rare combos collapsed: {len(RARE_MODEL_SET)}')

# ── Load label encoders ─────────────────────────────────────────────────────
LE_PKL = PICKLES_DIR / 'label_encoders.joblib'
assert LE_PKL.exists(), f'Label encoders not found: {LE_PKL}'
label_encoders = joblib.load(LE_PKL)

# ── Encode full feature matrix ──────────────────────────────────────────────
df_enc = df_raw[FEATURE_COLS].copy()
for col, le in label_encoders.items():
    if col in df_enc.columns:
        known = set(le.classes_)
        df_enc[col] = df_enc[col].fillna('__MISSING__').astype(str)
        df_enc[col] = df_enc[col].apply(lambda v: v if v in known else '__MISSING__')
        df_enc[col] = le.transform(df_enc[col])

X_all = df_enc
y_all = df_raw['price_egp'].values
print(f'Feature matrix shape: {X_all.shape}')

# ── Build price bins for stratification ───────────────────────────────────────
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

# ── 5-Fold Cross-Validation predictions ──────────────────────────────────────
cv = StratifiedKFold(n_splits=N_FOLDS, shuffle=True, random_state=RANDOM_STATE)

all_preds = np.zeros(len(y_all), dtype=float)
fold_idx = 0

for train_idx, val_idx in cv.split(X_all, strat_price):
    fold_idx += 1
    print(f'\nFold {fold_idx}/{N_FOLDS}: train={len(train_idx):,} val={len(val_idx):,}')

    X_tr, X_val = X_all.iloc[train_idx], X_all.iloc[val_idx]
    y_tr, y_val = y_all[train_idx], y_all[val_idx]

    dm_tr = xgb.DMatrix(X_tr, label=y_tr, enable_categorical=True)
    dm_val = xgb.DMatrix(X_val, enable_categorical=True)

    params = {
        **XGB_BEST_PARAMS,
        "objective": "reg:squarederror",
        "eval_metric": "mae",
        "tree_method": "hist",
        "seed": RANDOM_STATE,
    }

    model = xgb.train(params, dm_tr, num_boost_round=1500, verbose_eval=False)
    preds = model.predict(dm_val)
    all_preds[val_idx] = preds

    fold_mape = float(np.mean(np.abs((y_val - preds) / np.maximum(np.abs(y_val), 1e-9))) * 100)
    print(f'  Fold MAPE: {fold_mape:.2f}%')

# ── Compute per-make-model MAPE on full dataset ────────────────────────────
def safe_mape(y_true, y_pred):
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    eps = 1e-9
    return float(np.mean(np.abs((y_true - y_pred) / np.maximum(np.abs(y_true), eps))) * 100)

df_full = df_raw[['make', 'model', 'price_egp']].copy()
df_full['pred'] = all_preds

model_rows = []
for (brand, mdl), grp in df_full.groupby(['make', 'model']):
    yt = grp['price_egp'].values
    yp = grp['pred'].values
    n = len(grp)
    mape = safe_mape(yt, yp)
    mae  = float(mean_absolute_error(yt, yp))
    r2   = float(r2_score(yt, yp)) if n > 2 else np.nan
    mean_price = float(np.mean(yt))
    model_rows.append({
        'make': brand,
        'model': mdl,
        'n': n,
        'MAPE_pct': mape,
        'MAE': mae,
        'R2': r2,
        'mean_price': mean_price,
    })

df_model_diag = pd.DataFrame(model_rows)
print(f'\nTotal make-model combos: {len(df_model_diag)}')
print(f'MAPE range: {df_model_diag["MAPE_pct"].min():.1f}% - {df_model_diag["MAPE_pct"].max():.1f}%')
print(f'MAPE median: {df_model_diag["MAPE_pct"].median():.1f}%')

# ── Export ────────────────────────────────────────────────────────────────────
export_cols = ['make', 'model', 'MAPE_pct', 'n', 'MAE', 'R2', 'mean_price']
df_export = df_model_diag[export_cols].copy()
df_export.to_csv(OUT_CSV, index=False)
print(f'\nExported {len(df_export)} rows to {OUT_CSV}')

# Show worst and best
print('\nTop 10 worst MAPE:')
print(df_export.nlargest(10, 'MAPE_pct')[['make','model','n','mean_price','MAPE_pct']].round(1).to_string(index=False))
print('\nTop 10 best MAPE:')
print(df_export.nsmallest(10, 'MAPE_pct')[['make','model','n','mean_price','MAPE_pct']].round(1).to_string(index=False))

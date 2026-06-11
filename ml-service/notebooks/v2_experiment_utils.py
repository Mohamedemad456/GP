from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

import lightgbm as lgb
import numpy as np
import optuna
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupShuffleSplit, KFold, train_test_split
from sklearn.preprocessing import LabelEncoder
import xgboost as xgb

RANDOM_STATE = 42
TEST_SIZE = 0.20
TARGET_COLS = ["price_egp_log", "price_egp"]
BASE_NUM_COLS = [
    "year",
    "mileage_km",
    "mileage_per_year",
    "engine_cc",
    "horsepower",
    "seating_capacity",
]
BASE_CAT_COLS = [
    "make",
    "model",
    "transmission",
    "fuel",
    "location",
    "body_type",
    "drivetrain",
    "brand_origin",
    "car_segment",
]
PLAN2_NUM_FEATURES = ["log_mileage_km", "mileage_ratio", "year_bucket", "make_model_count"]
PLAN2_CAT_FEATURES = ["mm_price_tier"]
DEFAULT_QUANTILES_3 = {"lower": 0.05, "median": 0.50, "upper": 0.95}
DEFAULT_QUANTILES_5 = {"q05": 0.05, "q10": 0.10, "q50": 0.50, "q90": 0.90, "q95": 0.95}
XGB_BASE_PARAMS = {
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
LGBM_BASE_PARAMS = {
    "learning_rate": 0.027681271280960946,
    "num_leaves": 62,
    "max_depth": 10,
    "min_child_samples": 12,
    "subsample": 0.715216053848345,
    "colsample_bytree": 0.5431488908733526,
    "reg_alpha": 0.49247701388255255,
    "reg_lambda": 1.7238989341211074e-05,
    "min_split_gain": 0.02774152144413644,
}


def find_ml_root(start: Path | None = None) -> Path:
    start = (start or Path.cwd()).resolve()
    for candidate in (start, *start.parents):
        if (candidate / "app" / "core" / "config.py").exists():
            return candidate
    raise FileNotFoundError("Cannot find ml-service root")


ML_ROOT = find_ml_root()
DATA_MANIFEST_PATH = ML_ROOT / "data" / "data_manifest.json"
PROCESSED_VERSIONS_DIR = ML_ROOT / "data" / "processed" / "versions"
EXPERIMENTS_DIR = ML_ROOT / "models" / "experiments" / "plan2_plan4"


def load_data_manifest() -> dict:
    with DATA_MANIFEST_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def available_dataset_tags() -> list[str]:
    manifest = load_data_manifest()
    return list(manifest.get("versions", {}).keys())


def processed_path_for_tag(tag: str) -> Path:
    manifest = load_data_manifest()
    versions = manifest.get("versions", {})
    if tag in versions:
        rel_path = versions[tag]["processed_path"]
        return (ML_ROOT / rel_path).resolve()
    candidate = PROCESSED_VERSIONS_DIR / f"processed_{tag}.csv"
    if candidate.exists():
        return candidate
    raise FileNotFoundError(f"No processed dataset found for tag: {tag}")


def _normalize_string_columns(df: pd.DataFrame, columns: Iterable[str]) -> pd.DataFrame:
    out = df.copy()
    for column in columns:
        if column in out.columns:
            out[column] = out[column].astype(str).str.strip()
            out.loc[out[column].isin(["nan", "None", "<NA>"]), column] = np.nan
    return out


def _normalize_numeric_columns(df: pd.DataFrame, columns: Iterable[str]) -> pd.DataFrame:
    out = df.copy()
    for column in columns:
        if column in out.columns:
            series = out[column]
            if not pd.api.types.is_numeric_dtype(series):
                series = series.astype(str).str.replace(",", "", regex=False).str.strip()
            out[column] = pd.to_numeric(series, errors="coerce")
    return out


def normalize_processed_df(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out = out.loc[:, ~out.columns.astype(str).str.startswith("Unnamed:")]
    out = _normalize_string_columns(out, BASE_CAT_COLS)
    out = _normalize_numeric_columns(
        out,
        BASE_NUM_COLS + ["car_age", "price_egp", "price_egp_log"],
    )
    if "car_age" not in out.columns and "year" in out.columns:
        out["car_age"] = (pd.Timestamp.utcnow().year - out["year"]).clip(lower=0)
    return out


def load_processed_dataset(tag: str) -> pd.DataFrame:
    path = processed_path_for_tag(tag)
    df = pd.read_csv(path)
    df = normalize_processed_df(df)
    df["_dataset_tag"] = tag
    return df


def dataset_summary(df: pd.DataFrame) -> pd.DataFrame:
    summary = {
        "rows": len(df),
        "make_count": df["make"].nunique(dropna=True),
        "model_count": df["model"].nunique(dropna=True),
        "price_min": df["price_egp"].min(),
        "price_median": df["price_egp"].median(),
        "price_max": df["price_egp"].max(),
    }
    return pd.DataFrame([summary])


def build_price_bins(price: pd.Series, desired_bins: int = 10) -> pd.Series:
    series = pd.to_numeric(price, errors="coerce").fillna(price.median())
    for q in [desired_bins, 8, 6, 5, 4, 3]:
        try:
            bins = pd.qcut(series, q=q, duplicates="drop")
        except ValueError:
            continue
        codes = bins.cat.codes.astype(int)
        rare_codes = codes.value_counts()[codes.value_counts() < 2].index
        codes = codes.where(~codes.isin(rare_codes), -1)
        if codes.value_counts().min() >= 2:
            return codes
    return pd.Series(np.zeros(len(series), dtype=int), index=price.index)


def build_primary_splits(
    df: pd.DataFrame,
    test_size: float = TEST_SIZE,
    random_state: int = RANDOM_STATE,
) -> dict[str, tuple[np.ndarray, np.ndarray]]:
    idx_all = df.index.to_numpy()
    price_bins = build_price_bins(df["price_egp"])
    tr_price, te_price = train_test_split(
        idx_all,
        test_size=test_size,
        random_state=random_state,
        stratify=price_bins,
    )
    groups = df["make"].fillna("UNKNOWN").astype(str) + "__" + df["model"].fillna("UNKNOWN").astype(str)
    splitter = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=random_state)
    tr_group_i, te_group_i = next(splitter.split(df, groups=groups))
    tr_group = df.index[tr_group_i].to_numpy()
    te_group = df.index[te_group_i].to_numpy()
    return {
        "price_stratified": (tr_price, te_price),
        "make_model_grouped": (tr_group, te_group),
    }


def fit_train_lookups(train_df: pd.DataFrame) -> pd.DataFrame:
    medians = (
        train_df.groupby(["make", "model"], dropna=False)["price_egp"]
        .median()
        .rename("median_price_egp")
        .reset_index()
    )
    medians["mm_price_tier"] = pd.cut(
        medians["median_price_egp"],
        bins=[0, 500_000, 1_500_000, 4_000_000, float("inf")],
        labels=["economy", "standard", "luxury", "ultra_luxury"],
        include_lowest=True,
    ).astype(str)
    counts = (
        train_df.groupby(["make", "model"], dropna=False)
        .size()
        .rename("make_model_count")
        .reset_index()
    )
    return medians.merge(counts, on=["make", "model"], how="left")


def apply_train_lookups(df: pd.DataFrame, lookup_df: pd.DataFrame) -> pd.DataFrame:
    merged = df.merge(
        lookup_df[["make", "model", "mm_price_tier", "make_model_count"]],
        on=["make", "model"],
        how="left",
    )
    merged["mm_price_tier"] = merged["mm_price_tier"].fillna("standard")
    merged["make_model_count"] = pd.to_numeric(merged["make_model_count"], errors="coerce").fillna(1).clip(lower=1)
    return merged


def add_plan2_features(
    df: pd.DataFrame,
    lookup_df: pd.DataFrame | None = None,
    current_year: int | None = None,
) -> pd.DataFrame:
    out = df.copy()
    current_year = current_year or int(pd.Timestamp.utcnow().year)
    if lookup_df is not None:
        out = apply_train_lookups(out, lookup_df)
    else:
        out["mm_price_tier"] = out.get("mm_price_tier", pd.Series("standard", index=out.index))
        out["make_model_count"] = pd.to_numeric(
            out.get("make_model_count", pd.Series(1, index=out.index)),
            errors="coerce",
        ).fillna(1).clip(lower=1)
    year = pd.to_numeric(out["year"], errors="coerce")
    mileage = pd.to_numeric(out["mileage_km"], errors="coerce")
    car_age = pd.to_numeric(out.get("car_age", current_year - year), errors="coerce")
    car_age = car_age.fillna(current_year - year).clip(lower=1)
    out["log_mileage_km"] = np.log1p(mileage.fillna(0).clip(lower=0))
    out["mileage_ratio"] = (mileage / (car_age * 15_000)).clip(lower=0, upper=5)
    out["mileage_ratio"] = out["mileage_ratio"].fillna(1.0)
    out["year_bucket"] = np.floor_divide(year.fillna(current_year).astype(int) - 2000, 5)
    out["mm_price_tier"] = out["mm_price_tier"].fillna("standard").astype(str)
    return out


def build_feature_spec(active_plan2_features: Iterable[str] | None = None) -> tuple[list[str], list[str], list[str]]:
    active_plan2_features = set(active_plan2_features or [])
    num_cols = list(BASE_NUM_COLS)
    cat_cols = list(BASE_CAT_COLS)
    for feature in PLAN2_NUM_FEATURES:
        if feature in active_plan2_features:
            num_cols.append(feature)
    for feature in PLAN2_CAT_FEATURES:
        if feature in active_plan2_features:
            cat_cols.append(feature)
    return num_cols, cat_cols, num_cols + cat_cols


def make_lgbm_frame(df: pd.DataFrame, feature_cols: list[str], cat_cols: list[str]) -> pd.DataFrame:
    frame = df[feature_cols].copy()
    for column in cat_cols:
        frame[column] = frame[column].astype("category")
    return frame


def fit_label_encoders(df_train: pd.DataFrame, cat_cols: list[str]) -> dict[str, LabelEncoder]:
    encoders: dict[str, LabelEncoder] = {}
    for column in cat_cols:
        encoder = LabelEncoder()
        values = df_train[column].fillna("__MISSING__").astype(str).tolist() + ["__UNKNOWN__"]
        encoder.fit(values)
        encoders[column] = encoder
    return encoders


def transform_with_label_encoders(
    df: pd.DataFrame,
    feature_cols: list[str],
    cat_cols: list[str],
    encoders: dict[str, LabelEncoder],
) -> pd.DataFrame:
    frame = df[feature_cols].copy()
    for column in cat_cols:
        values = df[column].fillna("__MISSING__").astype(str)
        allowed = set(encoders[column].classes_)
        safe_values = values.where(values.isin(allowed), "__UNKNOWN__")
        frame[column] = encoders[column].transform(safe_values)
    return frame


def compute_metrics_egp(y_true: np.ndarray, y_pred: np.ndarray, is_log: bool = False) -> dict:
    y_true_arr = np.asarray(y_true, dtype=float)
    y_pred_arr = np.asarray(y_pred, dtype=float)
    if is_log:
        if float(np.nanmedian(y_true_arr)) < 10:
            y_true_arr = np.power(10.0, y_true_arr)
            y_pred_arr = np.power(10.0, y_pred_arr)
        else:
            y_true_arr = np.exp(y_true_arr)
            y_pred_arr = np.exp(y_pred_arr)
    mae = float(mean_absolute_error(y_true_arr, y_pred_arr))
    rmse = float(np.sqrt(mean_squared_error(y_true_arr, y_pred_arr)))
    r2 = float(r2_score(y_true_arr, y_pred_arr))
    denom = np.maximum(np.abs(y_true_arr), 1e-9)
    ape = np.abs((y_true_arr - y_pred_arr) / denom)
    return {
        "MAE": mae,
        "RMSE": rmse,
        "R2": r2,
        "MAPE_pct": float(np.mean(ape) * 100),
        "Within_10pct": float(np.mean(ape <= 0.10) * 100),
        "Within_15pct": float(np.mean(ape <= 0.15) * 100),
    }


def compute_interval_metrics(y_true: np.ndarray, pred_map: dict[str, np.ndarray], is_log: bool = False) -> dict:
    quantile_order = {
        "lower": 0.05,
        "median": 0.50,
        "upper": 0.95,
        "q05": 0.05,
        "q10": 0.10,
        "q50": 0.50,
        "q90": 0.90,
        "q95": 0.95,
    }
    ordered_keys = sorted(pred_map.keys(), key=lambda key: quantile_order[key])
    values = [np.asarray(pred_map[key], dtype=float) for key in ordered_keys]
    matrix = np.column_stack(values)
    if is_log:
        if float(np.nanmedian(y_true)) < 10:
            matrix = np.power(10.0, matrix)
            y_true_eval = np.power(10.0, np.asarray(y_true, dtype=float))
        else:
            matrix = np.exp(matrix)
            y_true_eval = np.exp(np.asarray(y_true, dtype=float))
    else:
        y_true_eval = np.asarray(y_true, dtype=float)
    matrix = np.sort(matrix, axis=1)
    lower_80 = matrix[:, 1] if matrix.shape[1] >= 5 else matrix[:, 0]
    median = matrix[:, matrix.shape[1] // 2]
    upper_80 = matrix[:, -2] if matrix.shape[1] >= 5 else matrix[:, -1]
    lower_90 = matrix[:, 0]
    upper_90 = matrix[:, -1]
    width = (upper_80 - lower_80) / np.maximum(np.abs(median), 1e-9)
    return {
        "Coverage_80_pct": float(np.mean((y_true_eval >= lower_80) & (y_true_eval <= upper_80)) * 100),
        "Coverage_90_pct": float(np.mean((y_true_eval >= lower_90) & (y_true_eval <= upper_90)) * 100),
        "Mean_width_pct": float(np.mean(width) * 100),
    }


def safe_mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    y_true_arr = np.asarray(y_true, dtype=float)
    y_pred_arr = np.asarray(y_pred, dtype=float)
    denom = np.maximum(np.abs(y_true_arr), 1e-9)
    return float(np.mean(np.abs((y_true_arr - y_pred_arr) / denom)) * 100)


def per_make_model_mape_df(df_eval: pd.DataFrame, y_pred_egp: np.ndarray, min_rows: int = 5) -> pd.DataFrame:
    df_diag = df_eval[["make", "model", "price_egp"]].copy()
    df_diag["pred_egp"] = np.asarray(y_pred_egp, dtype=float)
    rows: list[dict] = []
    for (make, model), group in df_diag.groupby(["make", "model"], dropna=False):
        if len(group) < min_rows:
            continue
        rows.append(
            {
                "make": make,
                "model": model,
                "n_test": len(group),
                "MAPE_pct": safe_mape(group["price_egp"].to_numpy(), group["pred_egp"].to_numpy()),
            }
        )
    return pd.DataFrame(rows).sort_values(["MAPE_pct", "n_test"], ascending=[False, False]).reset_index(drop=True)


def sample_weights_from_price(price: pd.Series) -> np.ndarray:
    bins = pd.cut(
        price,
        bins=[0, 500_000, 1_500_000, 4_000_000, float("inf")],
        labels=["economy", "standard", "luxury", "ultra_luxury"],
        include_lowest=True,
    )
    weights = bins.map(
        {
            "economy": 1.5,
            "standard": 1.0,
            "luxury": 1.0,
            "ultra_luxury": 0.8,
        }
    )
    return pd.to_numeric(weights, errors="coerce").fillna(1.0).to_numpy(dtype=float)


def make_experiment_dir(name: str) -> Path:
    target = EXPERIMENTS_DIR / name
    target.mkdir(parents=True, exist_ok=True)
    return target


def split_train_val_indices(
    train_idx: np.ndarray,
    val_fraction: float = 0.10,
    random_state: int = RANDOM_STATE,
) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(random_state)
    val_size = max(1, int(len(train_idx) * val_fraction))
    val_idx = np.sort(rng.choice(train_idx, size=val_size, replace=False))
    train_only = np.array([idx for idx in train_idx if idx not in set(val_idx.tolist())])
    return train_only, val_idx


def tune_lgbm_quantile(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_valid: pd.DataFrame,
    y_valid: pd.Series,
    cat_cols: list[str],
    *,
    alpha: float = 0.50,
    n_trials: int = 40,
    n_estimators_max: int = 2000,
    early_stopping_rounds: int = 50,
    random_state: int = RANDOM_STATE,
    sample_weight_train: np.ndarray | None = None,
    sample_weight_valid: np.ndarray | None = None,
) -> tuple[dict, optuna.study.Study]:
    optuna.logging.set_verbosity(optuna.logging.WARNING)
    dtrain = lgb.Dataset(
        X_train,
        label=y_train,
        weight=sample_weight_train,
        categorical_feature=cat_cols,
        free_raw_data=False,
    )
    dvalid = lgb.Dataset(
        X_valid,
        label=y_valid,
        weight=sample_weight_valid,
        categorical_feature=cat_cols,
        free_raw_data=False,
        reference=dtrain,
    )

    def objective(trial: optuna.Trial) -> float:
        params = {
            "objective": "quantile",
            "alpha": alpha,
            "metric": "quantile",
            "verbosity": -1,
            "n_jobs": -1,
            "seed": random_state,
            "subsample_freq": 1,
            "feature_pre_filter": False,
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.30, log=True),
            "num_leaves": trial.suggest_int("num_leaves", 15, 127),
            "max_depth": trial.suggest_int("max_depth", 3, 12),
            "min_child_samples": trial.suggest_int("min_child_samples", 10, 100),
            "subsample": trial.suggest_float("subsample", 0.5, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
            "reg_alpha": trial.suggest_float("reg_alpha", 1e-8, 10.0, log=True),
            "reg_lambda": trial.suggest_float("reg_lambda", 1e-8, 10.0, log=True),
            "min_split_gain": trial.suggest_float("min_split_gain", 0.0, 1.0),
        }
        model = lgb.train(
            params,
            dtrain,
            num_boost_round=n_estimators_max,
            valid_sets=[dvalid],
            callbacks=[
                lgb.early_stopping(early_stopping_rounds, verbose=False),
                lgb.log_evaluation(-1),
            ],
        )
        preds = model.predict(X_valid)
        residual = y_valid.to_numpy(dtype=float) - preds
        return float(np.mean(np.where(residual >= 0, alpha * residual, (alpha - 1.0) * residual)))

    study = optuna.create_study(
        direction="minimize",
        sampler=optuna.samplers.TPESampler(seed=random_state),
    )
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)
    return study.best_params, study


def tune_xgb_quantile(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_valid: pd.DataFrame,
    y_valid: pd.Series,
    *,
    alpha: float = 0.50,
    n_trials: int = 40,
    n_estimators_max: int = 2000,
    early_stopping_rounds: int = 50,
    random_state: int = RANDOM_STATE,
    sample_weight_train: np.ndarray | None = None,
    sample_weight_valid: np.ndarray | None = None,
) -> tuple[dict, optuna.study.Study]:
    optuna.logging.set_verbosity(optuna.logging.WARNING)
    dtrain = xgb.DMatrix(X_train, label=y_train, weight=sample_weight_train, enable_categorical=True)
    dvalid = xgb.DMatrix(X_valid, label=y_valid, weight=sample_weight_valid, enable_categorical=True)

    def objective(trial: optuna.Trial) -> float:
        params = {
            "objective": "reg:quantileerror",
            "quantile_alpha": alpha,
            "eval_metric": "quantile",
            "tree_method": "hist",
            "device": "cpu",
            "seed": random_state,
            "nthread": -1,
            "verbosity": 0,
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.30, log=True),
            "max_depth": trial.suggest_int("max_depth", 3, 12),
            "min_child_weight": trial.suggest_int("min_child_weight", 1, 50),
            "subsample": trial.suggest_float("subsample", 0.5, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
            "reg_alpha": trial.suggest_float("reg_alpha", 1e-8, 10.0, log=True),
            "reg_lambda": trial.suggest_float("reg_lambda", 1e-8, 10.0, log=True),
            "gamma": trial.suggest_float("gamma", 0.0, 5.0),
            "max_bin": trial.suggest_categorical("max_bin", [128, 256, 512]),
        }
        model = xgb.train(
            params,
            dtrain,
            num_boost_round=n_estimators_max,
            evals=[(dvalid, "val")],
            early_stopping_rounds=early_stopping_rounds,
            verbose_eval=False,
        )
        preds = model.predict(dvalid)
        residual = y_valid.to_numpy(dtype=float) - preds
        return float(np.mean(np.where(residual >= 0, alpha * residual, (alpha - 1.0) * residual)))

    study = optuna.create_study(
        direction="minimize",
        sampler=optuna.samplers.TPESampler(seed=random_state),
    )
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)
    return study.best_params, study


def train_lgbm_quantile_models(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_valid: pd.DataFrame,
    y_valid: pd.Series,
    cat_cols: list[str],
    quantiles: dict[str, float],
    *,
    params: dict,
    n_estimators_max: int = 2000,
    early_stopping_rounds: int = 50,
    sample_weight_train: np.ndarray | None = None,
    sample_weight_valid: np.ndarray | None = None,
) -> dict[str, lgb.Booster]:
    models: dict[str, lgb.Booster] = {}
    for name, alpha in quantiles.items():
        full_params = {
            **params,
            "objective": "quantile",
            "alpha": alpha,
            "metric": "quantile",
            "verbosity": -1,
            "n_jobs": -1,
            "subsample_freq": 1,
            "feature_pre_filter": False,
        }
        dtrain = lgb.Dataset(
            X_train,
            label=y_train,
            weight=sample_weight_train,
            categorical_feature=cat_cols,
            free_raw_data=False,
        )
        dvalid = lgb.Dataset(
            X_valid,
            label=y_valid,
            weight=sample_weight_valid,
            categorical_feature=cat_cols,
            free_raw_data=False,
            reference=dtrain,
        )
        models[name] = lgb.train(
            full_params,
            dtrain,
            num_boost_round=n_estimators_max,
            valid_sets=[dvalid],
            callbacks=[
                lgb.early_stopping(early_stopping_rounds, verbose=False),
                lgb.log_evaluation(-1),
            ],
        )
    return models


def train_xgb_quantile_models(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_valid: pd.DataFrame,
    y_valid: pd.Series,
    quantiles: dict[str, float],
    *,
    params: dict,
    n_estimators_max: int = 2000,
    early_stopping_rounds: int = 50,
    sample_weight_train: np.ndarray | None = None,
    sample_weight_valid: np.ndarray | None = None,
) -> dict[str, xgb.Booster]:
    dtrain = xgb.DMatrix(X_train, label=y_train, weight=sample_weight_train, enable_categorical=True)
    dvalid = xgb.DMatrix(X_valid, label=y_valid, weight=sample_weight_valid, enable_categorical=True)
    models: dict[str, xgb.Booster] = {}
    for name, alpha in quantiles.items():
        full_params = {
            **params,
            "objective": "reg:quantileerror",
            "quantile_alpha": alpha,
            "eval_metric": "quantile",
            "tree_method": "hist",
            "device": "cpu",
            "verbosity": 0,
        }
        models[name] = xgb.train(
            full_params,
            dtrain,
            num_boost_round=n_estimators_max,
            evals=[(dvalid, "val")],
            early_stopping_rounds=early_stopping_rounds,
            verbose_eval=False,
        )
    return models


def predict_lgbm_quantiles(models: dict[str, lgb.Booster], X: pd.DataFrame) -> dict[str, np.ndarray]:
    return {name: np.asarray(model.predict(X), dtype=float) for name, model in models.items()}


def predict_xgb_quantiles(models: dict[str, xgb.Booster], X: pd.DataFrame) -> dict[str, np.ndarray]:
    dmatrix = xgb.DMatrix(X, enable_categorical=True)
    return {name: np.asarray(model.predict(dmatrix), dtype=float) for name, model in models.items()}


def blend_prediction_maps(
    pred_maps: list[dict[str, np.ndarray]],
    weights: list[float] | None = None,
) -> dict[str, np.ndarray]:
    if not pred_maps:
        raise ValueError("pred_maps must not be empty")
    weights = weights or [1.0 / len(pred_maps)] * len(pred_maps)
    keys = pred_maps[0].keys()
    return {
        key: sum(weight * np.asarray(pred_map[key], dtype=float) for weight, pred_map in zip(weights, pred_maps))
        for key in keys
    }


def evaluate_point_and_interval(
    y_true: np.ndarray,
    pred_map: dict[str, np.ndarray],
    *,
    is_log_target: bool,
) -> dict:
    ordered_keys = list(pred_map.keys())
    median_key = "median" if "median" in ordered_keys else "q50"
    metrics = compute_metrics_egp(y_true, pred_map[median_key], is_log=is_log_target)
    metrics.update(compute_interval_metrics(y_true, pred_map, is_log=is_log_target))
    return metrics


def run_kfold_point_cv(
    df: pd.DataFrame,
    feature_cols: list[str],
    cat_cols: list[str],
    target_col: str,
    *,
    framework: str,
    params: dict,
    n_splits: int = 5,
    random_state: int = RANDOM_STATE,
) -> pd.DataFrame:
    is_log = target_col == "price_egp_log"
    kf = KFold(n_splits=n_splits, shuffle=True, random_state=random_state)
    rows: list[dict] = []
    for fold, (train_pos, test_pos) in enumerate(kf.split(df), start=1):
        train_df = df.iloc[train_pos].copy()
        test_df = df.iloc[test_pos].copy()
        if framework.lower() == "lgbm":
            enc_train = make_lgbm_frame(train_df, feature_cols, cat_cols)
            enc_test = make_lgbm_frame(test_df, feature_cols, cat_cols)
            val_cut = max(1, int(len(train_df) * 0.10))
            valid_df = train_df.iloc[:val_cut].copy()
            fit_df = train_df.iloc[val_cut:].copy()
            models = train_lgbm_quantile_models(
                make_lgbm_frame(fit_df, feature_cols, cat_cols),
                fit_df[target_col],
                make_lgbm_frame(valid_df, feature_cols, cat_cols),
                valid_df[target_col],
                cat_cols,
                {"median": 0.50},
                params=params,
                n_estimators_max=1200,
                early_stopping_rounds=40,
            )
            pred_map = predict_lgbm_quantiles(models, enc_test)
        else:
            encoders = fit_label_encoders(train_df, cat_cols)
            encoded_train = transform_with_label_encoders(train_df, feature_cols, cat_cols, encoders)
            encoded_test = transform_with_label_encoders(test_df, feature_cols, cat_cols, encoders)
            val_cut = max(1, int(len(train_df) * 0.10))
            valid_df = train_df.iloc[:val_cut].copy()
            fit_df = train_df.iloc[val_cut:].copy()
            models = train_xgb_quantile_models(
                transform_with_label_encoders(fit_df, feature_cols, cat_cols, encoders),
                fit_df[target_col],
                transform_with_label_encoders(valid_df, feature_cols, cat_cols, encoders),
                valid_df[target_col],
                {"median": 0.50},
                params=params,
                n_estimators_max=1200,
                early_stopping_rounds=40,
            )
            pred_map = predict_xgb_quantiles(models, encoded_test)
        fold_metrics = compute_metrics_egp(test_df[target_col].to_numpy(), pred_map["median"], is_log=is_log)
        rows.append({"fold": fold, "framework": framework, **fold_metrics})
    return pd.DataFrame(rows)


def run_kfold_per_make_model_cv(
    df: pd.DataFrame,
    feature_cols: list[str],
    cat_cols: list[str],
    target_col: str,
    *,
    framework: str,
    params: dict,
    n_splits: int = 5,
    random_state: int = RANDOM_STATE,
    min_rows: int = 5,
    return_oof: bool = False,
) -> tuple[pd.DataFrame, dict] | tuple[pd.DataFrame, dict, np.ndarray]:
    is_log = target_col == "price_egp_log"
    kf = KFold(n_splits=n_splits, shuffle=True, random_state=random_state)
    oof_preds = np.full(len(df), np.nan, dtype=float)
    framework_key = framework.lower()

    for train_pos, test_pos in kf.split(df):
        train_df = df.iloc[train_pos].copy()
        test_df = df.iloc[test_pos].copy()
        val_cut = max(1, int(len(train_df) * 0.10))
        valid_df = train_df.iloc[:val_cut].copy()
        fit_df = train_df.iloc[val_cut:].copy()
        if framework_key in {"lgbm", "lightgbm"}:
            enc_test = make_lgbm_frame(test_df, feature_cols, cat_cols)
            models = train_lgbm_quantile_models(
                make_lgbm_frame(fit_df, feature_cols, cat_cols),
                fit_df[target_col],
                make_lgbm_frame(valid_df, feature_cols, cat_cols),
                valid_df[target_col],
                cat_cols,
                {"median": 0.50},
                params=params,
                n_estimators_max=1200,
                early_stopping_rounds=40,
            )
            pred_map = predict_lgbm_quantiles(models, enc_test)
        elif framework_key in {"weightedensemble", "weighted_ensemble"}:
            ensemble_params = params or {}
            xgb_params = ensemble_params.get("xgb", {})
            lgbm_params = ensemble_params.get("lgbm", {})
            blend_weights = ensemble_params.get("weights", [0.55, 0.45])
            encoders = fit_label_encoders(train_df, cat_cols)
            pred_map_xgb = predict_xgb_quantiles(
                train_xgb_quantile_models(
                    transform_with_label_encoders(fit_df, feature_cols, cat_cols, encoders),
                    fit_df[target_col],
                    transform_with_label_encoders(valid_df, feature_cols, cat_cols, encoders),
                    valid_df[target_col],
                    {"median": 0.50},
                    params=xgb_params,
                    n_estimators_max=1200,
                    early_stopping_rounds=40,
                ),
                transform_with_label_encoders(test_df, feature_cols, cat_cols, encoders),
            )
            pred_map_lgbm = predict_lgbm_quantiles(
                train_lgbm_quantile_models(
                    make_lgbm_frame(fit_df, feature_cols, cat_cols),
                    fit_df[target_col],
                    make_lgbm_frame(valid_df, feature_cols, cat_cols),
                    valid_df[target_col],
                    cat_cols,
                    {"median": 0.50},
                    params=lgbm_params,
                    n_estimators_max=1200,
                    early_stopping_rounds=40,
                ),
                make_lgbm_frame(test_df, feature_cols, cat_cols),
            )
            pred_map = blend_prediction_maps([pred_map_xgb, pred_map_lgbm], weights=blend_weights)
        else:
            encoders = fit_label_encoders(train_df, cat_cols)
            encoded_test = transform_with_label_encoders(test_df, feature_cols, cat_cols, encoders)
            models = train_xgb_quantile_models(
                transform_with_label_encoders(fit_df, feature_cols, cat_cols, encoders),
                fit_df[target_col],
                transform_with_label_encoders(valid_df, feature_cols, cat_cols, encoders),
                valid_df[target_col],
                {"median": 0.50},
                params=params,
                n_estimators_max=1200,
                early_stopping_rounds=40,
            )
            pred_map = predict_xgb_quantiles(models, encoded_test)
        median_pred = pred_map["median"]

        if is_log:
            if float(np.nanmedian(train_df[target_col].to_numpy())) < 10:
                median_pred = np.power(10.0, np.asarray(median_pred, dtype=float))
            else:
                median_pred = np.exp(np.asarray(median_pred, dtype=float))
        else:
            median_pred = np.asarray(median_pred, dtype=float)

        oof_preds[test_pos] = median_pred

    y_true_all = df["price_egp"].to_numpy(dtype=float)
    overall_metrics = compute_metrics_egp(y_true_all, oof_preds, is_log=False)

    df_diag = df[["make", "model", "price_egp"]].copy()
    df_diag["pred_egp"] = oof_preds
    rows: list[dict] = []
    for (make, model), group in df_diag.groupby(["make", "model"], dropna=False):
        if len(group) < min_rows:
            continue
        yt = group["price_egp"].to_numpy(dtype=float)
        yp = group["pred_egp"].to_numpy(dtype=float)
        if np.isnan(yp).any():
            continue
        rows.append({
            "make": make,
            "model": model,
            "n": len(group),
            "MAPE_pct": safe_mape(yt, yp),
            "MAE": float(mean_absolute_error(yt, yp)),
            "R2": float(r2_score(yt, yp)) if len(group) > 2 else np.nan,
            "mean_price": float(np.mean(yt)),
        })
    per_mm_df = pd.DataFrame(rows).sort_values("MAPE_pct", ascending=True).reset_index(drop=True)
    if return_oof:
        return per_mm_df, overall_metrics, oof_preds
    return per_mm_df, overall_metrics

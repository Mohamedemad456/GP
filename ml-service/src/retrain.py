"""
Monthly retraining orchestrator.

Steps:
    1. Pull latest data from Supabase (data_loader)
    2. Clean raw data (data_cleaner)
    3. Parse any new unique titles (title_parser)
    4. Run full feature engineering pipeline (feature_engineering)
    5. Train new models with Optuna tuning (train)
    6. Evaluate against current active model (evaluate)
    7. If new model is better → save and activate
    8. If new model is worse → save but don't activate (manual review)

Usage:
    python -m src.retrain --version v1.1.0
"""

# TODO: Implement retraining orchestration

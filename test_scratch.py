import sys
from pathlib import Path
sys.path.insert(0, str(Path("ai-service").resolve()))
from app.services.car_lookup import CarSpecsLookup, normalize_text
from rapidfuzz import process, fuzz

lookup = CarSpecsLookup(
    csv_path=Path("ml-service/data/lookups/AI_lookup.csv"),
    aliases_yaml_path=Path("ai-service/data/lookups/car_aliases.yaml"),
    egypt_market_notes_yaml_path=Path("ai-service/data/egypt_market_notes.yaml"),
)
lookup.load()

q1 = "عندي lancer puma 2008 ايه رايك فيها"
print("Top Model matches for q1:")
for m in process.extract(q1, lookup._model_candidates, scorer=fuzz.token_set_ratio, limit=5):
    print(m)

q2 = "what are the specs of a sentra"
print("\nTop Model matches for q2 (no punctuation):")
for m in process.extract(q2, lookup._model_candidates, scorer=fuzz.token_set_ratio, limit=5):
    print(m)


import json
import joblib
import pandas as pd
from urllib.parse import quote_plus
from sqlalchemy import create_engine
from sklearn.ensemble import RandomForestClassifier
import os
from dotenv import load_dotenv
load_dotenv(r"C:\Users\VIJAYA SAWANT\OneDrive\Desktop\HoneyChain\.env")

MODEL_FILE = "condition_model.joblib"
GAIN_FILE = "gain_by_condition.json"
FEATURES = ["hive_temp", "hive_humidity"]


def train_and_save():
    password = quote_plus(os.getenv("DB_PASSWORD"))
    engine = create_engine(f"mysql+pymysql://root:{password}@localhost:3306/honeychain")
    df = pd.read_sql("SELECT * FROM hive_readings ORDER BY data_source, reading_date", engine)

    y = (df["condition_type"] == "non_ideal").astype(int)
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(df[FEATURES], y)
    joblib.dump(model, MODEL_FILE)

    df["gain"] = df.groupby("data_source")["honey_weight"].diff()
    ok = df[df["gain"] >= 0]                      # skip extraction days
    gains = ok.groupby("condition_type")["gain"].mean().round(3).to_dict()
    with open(GAIN_FILE, "w") as f:
        json.dump(gains, f)
    print("Saved model and gain table:", gains)


def predict_hive(hive_temp, hive_humidity):
    model = joblib.load(MODEL_FILE)
    with open(GAIN_FILE) as f:
        gains = json.load(f)
    x = pd.DataFrame([[hive_temp, hive_humidity]], columns=FEATURES)
    p_non_ideal = float(model.predict_proba(x)[0][1])
    condition = "non_ideal" if p_non_ideal >= 0.5 else "ideal"
    return {
        "condition": condition,
        "confidence": round(max(p_non_ideal, 1 - p_non_ideal), 3),
        "est_daily_gain_kg": gains[condition],
    }


if __name__ == "__main__":
    train_and_save()
    print(predict_hive(33.0, 58.0))   # should look ideal
    print(predict_hive(22.0, 90.0))   # should look non-ideal
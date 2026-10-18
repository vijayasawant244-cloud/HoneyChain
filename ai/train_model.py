import pandas as pd
from urllib.parse import quote_plus
from sqlalchemy import create_engine
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix
import os
from dotenv import load_dotenv
load_dotenv(r"C:\Users\VIJAYA SAWANT\OneDrive\Desktop\HoneyChain\.env")

password = quote_plus(os.getenv("DB_PASSWORD"))
engine = create_engine(f"mysql+pymysql://root:{password}@localhost:3306/honeychain")
df = pd.read_sql("SELECT * FROM hive_readings", engine)

y = (df["condition_type"] == "non_ideal").astype(int)   # 1 = non-ideal, 0 = ideal

def run(features, name):
    X = df[features]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y)
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    pred = model.predict(X_test)
    print(f"\n--- {name} ---")
    print("Accuracy:", round(accuracy_score(y_test, pred), 3))
    print(confusion_matrix(y_test, pred))
    print(dict(zip(features, model.feature_importances_.round(3))))

run(["hive_temp", "hive_humidity", "environmental_temp", "relative_humidity", "wind_speed"],
    "Version A: hive sensors + outside readings")

run(["environmental_temp", "relative_humidity", "wind_speed"],
    "Version B: outside readings only")
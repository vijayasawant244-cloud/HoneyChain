import pandas as pd
from urllib.parse import quote_plus
from sqlalchemy import create_engine
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
import os
from dotenv import load_dotenv
load_dotenv(r"C:\Users\VIJAYA SAWANT\OneDrive\Desktop\HoneyChain\.env")

password = quote_plus(os.getenv("DB_PASSWORD"))
engine = create_engine(f"mysql+pymysql://root:{password}@localhost:3306/honeychain")
df = pd.read_sql("SELECT * FROM hive_readings", engine)

df["day_of_year"] = pd.to_datetime(df["reading_date"]).dt.dayofyear

train = df[df["day_of_year"] <= 292]
test = df[df["day_of_year"] > 292]

# how does honey weight change over the year?
print(df.groupby("condition_type")["honey_weight"].describe().round(1))
print("Correlation of honey_weight with day_of_year:",
      round(df["honey_weight"].corr(df["day_of_year"]), 2))

def run(features, name):
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(train[features], train["honey_weight"])
    pred = model.predict(test[features])
    base = [train["honey_weight"].mean()] * len(test)
    print(f"\n--- {name} ---")
    print("MAE (kg):", round(mean_absolute_error(test["honey_weight"], pred), 2),
          "| baseline MAE:", round(mean_absolute_error(test["honey_weight"], base), 2))
    print("R2:", round(r2_score(test["honey_weight"], pred), 3))

sensors = ["hive_temp", "hive_humidity", "environmental_temp", "relative_humidity", "wind_speed"]
run(sensors, "Sensors only")
run(sensors + ["day_of_year"], "Sensors + day of year")
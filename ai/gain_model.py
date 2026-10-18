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
df = pd.read_sql("SELECT * FROM hive_readings ORDER BY data_source, reading_date", engine)

df["gain"] = df.groupby("data_source")["honey_weight"].diff()
df["day_of_year"] = pd.to_datetime(df["reading_date"]).dt.dayofyear
df = df.dropna(subset=["gain"])
df = df[df["gain"] >= 0]                 # drop extraction days

# does temperature/humidity still matter INSIDE each condition?
for cond, g in df.groupby("condition_type"):
    print(cond, g[["hive_temp", "hive_humidity", "gain"]].corr()["gain"].round(2).to_dict())

train = df[df["day_of_year"] <= 292]
test = df[df["day_of_year"] > 292]

# baseline 1: overall average; baseline 2: average per condition
b1 = [train["gain"].mean()] * len(test)
means = train.groupby("condition_type")["gain"].mean()
b2 = test["condition_type"].map(means)

print("\nBaseline overall    MAE:", round(mean_absolute_error(test["gain"], b1), 3))
print("Baseline per-condition MAE:", round(mean_absolute_error(test["gain"], b2), 3))

features = ["hive_temp", "hive_humidity", "environmental_temp", "relative_humidity", "wind_speed"]
model = RandomForestRegressor(n_estimators=200, random_state=42)
model.fit(train[features], train["gain"])
pred = model.predict(test[features])

print("Model               MAE:", round(mean_absolute_error(test["gain"], pred), 3))
print("Model R2:", round(r2_score(test["gain"], pred), 3))
print(dict(zip(features, model.feature_importances_.round(3))))
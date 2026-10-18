import pandas as pd
from sqlalchemy import create_engine
import os
from dotenv import load_dotenv
load_dotenv(r"C:\Users\VIJAYA SAWANT\OneDrive\Desktop\HoneyChain\.env")

folder = r"C:\Users\VIJAYA SAWANT\OneDrive\Desktop\HoneyChain\data"

files = {
    "Honey_Production_Dataset_2023 (1).csv": ("2023", "ideal"),
    "Honey_Production_Dataset_for_2024.csv": ("2024", "ideal"),
    "Honey_Production_Dataset__No Ideal (2024).csv": ("2024_non_ideal", "non_ideal"),
}

columns = ["reading_date", "environmental_temp", "relative_humidity", "hive_temp",
           "hive_humidity", "wind_speed", "honey_weight", "total_weight", "extract_honey"]

frames = []
for name, (source, condition) in files.items():
    df = pd.read_csv(folder + "\\" + name, encoding="utf-8")
    df = df.iloc[:, :9]          # keep first 9 columns, drop the extra Year label
    df.columns = columns         # use our own clean column names
    df["reading_date"] = pd.to_datetime(df["reading_date"], format="%B %d, %Y")
    df["extract_honey"] = df["extract_honey"].astype(str).str.lower().eq("true").astype(int)
    df["data_source"] = source
    df["condition_type"] = condition
    frames.append(df)

all_data = pd.concat(frames, ignore_index=True)

from urllib.parse import quote_plus
password = quote_plus(os.getenv("DB_PASSWORD"))
engine = create_engine(f"mysql+pymysql://root:{password}@localhost:3306/honeychain")
all_data.to_sql("hive_readings", engine, if_exists="append", index=False)

print(all_data.groupby("data_source").size())
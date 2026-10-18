import pandas as pd
from urllib.parse import quote_plus
from sqlalchemy import create_engine
import matplotlib.pyplot as plt
import os
from dotenv import load_dotenv
load_dotenv(r"C:\Users\VIJAYA SAWANT\OneDrive\Desktop\HoneyChain\.env")

password = quote_plus(os.getenv("DB_PASSWORD"))
engine = create_engine(f"mysql+pymysql://root:{password}@localhost:3306/honeychain")

df = pd.read_sql("SELECT * FROM hive_readings", engine)

print(df.shape)                      # rows, columns
print(df.isnull().sum())             # missing values per column

# average / min / max per condition
print(df.groupby("condition_type")[["hive_temp", "hive_humidity", "honey_weight"]]
        .agg(["mean", "min", "max"]).round(1))

# is total_weight just honey_weight plus a constant?
print((df["total_weight"] - df["honey_weight"]).round(2).value_counts().head())

# which 2024 day is missing?
d = pd.to_datetime(df[df["data_source"] == "2024"]["reading_date"])
print(pd.date_range("2024-01-01", "2024-12-31").difference(d))

df.boxplot(column="hive_temp", by="condition_type")
plt.savefig("hive_temp_by_condition.png")
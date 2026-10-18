import pandas as pd
from urllib.parse import quote_plus
from sqlalchemy import create_engine
import matplotlib.pyplot as plt
import os
from dotenv import load_dotenv
load_dotenv(r"C:\Users\VIJAYA SAWANT\OneDrive\Desktop\HoneyChain\.env")

password = quote_plus(os.getenv("DB_PASSWORD"))
engine = create_engine(f"mysql+pymysql://root:{password}@localhost:3306/honeychain")
df = pd.read_sql("SELECT * FROM hive_readings ORDER BY data_source, reading_date", engine)

df["gain"] = df.groupby("data_source")["honey_weight"].diff()

print("Days honey_weight dropped (likely extraction):", (df["gain"] < 0).sum())
print("Days with extract_honey = 1:", df["extract_honey"].sum())

normal = df[df["gain"] >= 0]
print(normal.groupby("condition_type")["gain"].describe().round(2))

sensors = ["hive_temp", "hive_humidity", "environmental_temp", "relative_humidity", "wind_speed"]
print(normal[sensors + ["gain"]].corr()["gain"].round(2))

fig, axes = plt.subplots(3, 1, figsize=(10, 8))
for ax, (src, g) in zip(axes, df.groupby("data_source")):
    ax.plot(g["reading_date"], g["honey_weight"])
    ax.set_title(src)
plt.tight_layout()
plt.savefig("honey_weight_over_time.png")
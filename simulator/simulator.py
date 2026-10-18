import csv
import random
from datetime import datetime, timedelta

HIVES = ["H001", "H002", "H003", "H004", "H005"]

def generate_hive_reading(hive_id, timestamp, abnormal=False):
    if abnormal:
        temperature = round(random.uniform(39, 43), 2)
        humidity = round(random.uniform(80, 95), 2)
        weight = round(random.uniform(15, 22), 2)
        activity = round(random.uniform(10, 30), 2)
    else:
        temperature = round(random.uniform(32, 36), 2)
        humidity = round(random.uniform(55, 75), 2)
        weight = round(random.uniform(25, 40), 2)
        activity = round(random.uniform(60, 95), 2)

    battery = round(random.uniform(70, 100), 2)

    return {
        "hive_id": hive_id,
        "timestamp": timestamp.isoformat(),
        "temperature": temperature,
        "humidity": humidity,
        "weight": weight,
        "activity_level": activity,
        "battery_level": battery,
        "status": "ABNORMAL" if abnormal else "NORMAL"
    }


def generate_dataset(filename="hive_data.csv", readings_per_hive=100):
    rows = []

    start_time = datetime.now() - timedelta(hours=readings_per_hive)

    for hive_id in HIVES:
        for i in range(readings_per_hive):
            timestamp = start_time + timedelta(hours=i)

            # Simulate abnormal conditions occasionally
            abnormal = random.random() < 0.10

            reading = generate_hive_reading(
                hive_id,
                timestamp,
                abnormal
            )

            rows.append(reading)

    with open(filename, "w", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

    print(f"Generated {len(rows)} hive readings.")
    print(f"Saved to {filename}")


if __name__ == "__main__":
    generate_dataset()
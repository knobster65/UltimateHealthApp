import csv
import io
from datetime import datetime
from sqlalchemy.orm import Session

from app.models import ExerciseEntry


def parse_apple_health_csv(content: bytes, db: Session, batch_id: str, user_id: int) -> int:
    text = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text), delimiter="\t")

    entries_created = 0
    seen = set()

    for row in reader:
        activity = row.get("Activity Name", "").strip()
        if not activity:
            continue

        try:
            start_str = row.get("Start Date", "")
            end_str = row.get("End Date", "")
            duration_sec = float(row.get("Duration (sec)", 0))
            calories = float(row.get("Total Calories", 0) or row.get("Active Calories", 0))

            distance_m = row.get("Distance (m)", "")
            distance_km = float(distance_m) / 1000 if distance_m else None

            avg_hr = row.get("Average Heart Rate")
            max_hr = row.get("Maximum Heart Rate")
            avg_hr = int(avg_hr) if avg_hr else None
            max_hr = int(max_hr) if max_hr else None

            start_dt = parse_apple_date(start_str)
            end_dt = parse_apple_date(end_str) if end_str else None

            dedup_key = (start_dt.isoformat() if start_dt else "", activity, duration_sec)
            if dedup_key in seen:
                continue
            seen.add(dedup_key)

            if not start_dt:
                continue

            entry = ExerciseEntry(
                user_id=user_id,
                workout_type=activity,
                start_time=start_dt,
                end_time=end_dt or start_dt,
                duration_min=round(duration_sec / 60, 1),
                distance_km=round(distance_km, 3) if distance_km else None,
                calories_burned=round(calories, 1),
                avg_heart_rate=avg_hr,
                max_heart_rate=max_hr,
                import_source="apple_health",
                import_batch_id=batch_id,
            )
            db.add(entry)
            entries_created += 1
        except (ValueError, TypeError):
            continue

    db.commit()
    return entries_created


def parse_apple_date(date_str: str) -> datetime | None:
    formats = [
        "%m/%d/%Y, %I:%M:%S %p",
        "%m/%d/%Y, %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%d %H:%M:%S",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    return None

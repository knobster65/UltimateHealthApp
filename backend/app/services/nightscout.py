import httpx
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models import GlucoseReading, GlucoseSyncLog
from app.config import settings


def sync_nightscout(db: Session, user_id: int) -> dict:
    if not settings.NIGHTSCOUT_URL or not settings.NIGHTSCOUT_API_TOKEN:
        return {"error": "Nightscout not configured", "entries_fetched": 0, "entries_stored": 0}

    last_sync = db.execute(
        select(GlucoseSyncLog).where(GlucoseSyncLog.user_id == user_id).order_by(GlucoseSyncLog.synced_at.desc()).limit(1)
    ).scalar_one_or_none()

    start_time = last_sync.end_time if last_sync else None

    url = f"{settings.NIGHTSCOUT_URL.rstrip('/')}/api/v1/entries.json"
    params = {
        "count": 0,
        "apiKey": settings.NIGHTSCOUT_API_TOKEN,
    }
    if start_time:
        params["find[date][$gte]"] = int(start_time.timestamp() * 1000)

    try:
        response = httpx.get(url, params=params, timeout=60.0)
        response.raise_for_status()
    except Exception as e:
        return {"error": str(e), "entries_fetched": 0, "entries_stored": 0}

    entries = response.json()
    stored = 0
    now = datetime.now(timezone.utc)

    for entry in entries:
        ns_id = entry.get("_id")
        existing = db.execute(
            select(GlucoseReading).where(GlucoseReading.user_id == user_id, GlucoseReading.source_entry_id == ns_id)
        ).scalar_one_or_none()
        if existing:
            continue

        timestamp_ms = entry.get("date", 0)
        if isinstance(timestamp_ms, str):
            timestamp_ms = int(timestamp_ms)
        dt = datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc)

        reading = GlucoseReading(
            user_id=user_id,
            date_time=dt,
            value_mgdl=float(entry.get("sgv", 0)),
            trend=entry.get("direction"),
            type=entry.get("type", "sgv"),
            source_entry_id=ns_id,
            sync_source="nightscout",
        )
        db.add(reading)
        stored += 1

    end_time = datetime.now(timezone.utc)
    if entries:
        last_entry_ts = max(e.get("date", 0) for e in entries)
        if isinstance(last_entry_ts, str):
            last_entry_ts = int(last_entry_ts)
        end_time = datetime.fromtimestamp(last_entry_ts / 1000, tz=timezone.utc)

    log = GlucoseSyncLog(
        user_id=user_id,
        start_time=start_time,
        end_time=end_time,
        entries_fetched=len(entries),
        entries_stored=stored,
    )
    db.add(log)
    db.commit()

    return {
        "synced_at": now.isoformat(),
        "entries_fetched": len(entries),
        "entries_stored": stored,
    }

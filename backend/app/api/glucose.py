from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.database import get_db
from app.models import User, GlucoseReading, GlucoseSyncLog
from app.auth import get_current_user
from app.schemas import GlucoseReadingRead, GlucoseStats, NightscoutConfig
from app.services.nightscout import sync_nightscout

router = APIRouter()


@router.get("/readings", response_model=list[GlucoseReadingRead])
def list_readings(
    start: datetime | None = None,
    end: datetime | None = None,
    limit: int = Query(default=1000, le=5000),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(GlucoseReading).where(GlucoseReading.user_id == user.id)
    if start:
        stmt = stmt.where(GlucoseReading.date_time >= start)
    if end:
        stmt = stmt.where(GlucoseReading.date_time <= end)
    stmt = stmt.order_by(GlucoseReading.date_time.desc()).limit(limit)
    return db.execute(stmt).scalars().all()


@router.post("/sync")
def trigger_sync(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    result = sync_nightscout(db, user.id)
    return result


@router.get("/sync/status")
def sync_status(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    last = db.execute(
        select(GlucoseSyncLog).where(GlucoseSyncLog.user_id == user.id).order_by(GlucoseSyncLog.synced_at.desc()).limit(1)
    ).scalar_one_or_none()
    total = db.execute(
        select(func.count(GlucoseReading.id)).where(GlucoseReading.user_id == user.id)
    ).scalar()
    return {"last_sync": last.synced_at.isoformat() if last else None, "total_readings": total}


@router.get("/stats", response_model=GlucoseStats)
def get_stats(
    start: datetime | None = None,
    end: datetime | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not end:
        end = datetime.now()
    if not start:
        start = end - timedelta(days=7)

    stmt = (
        select(GlucoseReading)
        .where(GlucoseReading.user_id == user.id)
        .where(GlucoseReading.date_time >= start, GlucoseReading.date_time <= end)
        .order_by(GlucoseReading.date_time.asc())
    )
    readings = db.execute(stmt).scalars().all()
    if not readings:
        return GlucoseStats(avg_glucose=0, time_in_range_pct=0, below_range_pct=0, above_range_pct=0, very_high_pct=0)

    values = [r.value_mgdl for r in readings]
    total = len(values)
    avg = sum(values) / total

    below = sum(1 for v in values if v < 70)
    in_range = sum(1 for v in values if 70 <= v <= 180)
    above = sum(1 for v in values if 180 < v <= 250)
    very_high = sum(1 for v in values if v > 250)

    mgd = None
    if len(values) > 1:
        diffs = [abs(values[i] - values[i + 1]) for i in range(len(values) - 1)]
        mgd = round(sum(diffs) / len(diffs), 1)

    gmi = round(3.31 + (0.02392 * avg), 1) if avg > 0 else None

    return GlucoseStats(
        avg_glucose=round(avg, 1),
        time_in_range_pct=round(in_range / total * 100, 1),
        below_range_pct=round(below / total * 100, 1),
        above_range_pct=round(above / total * 100, 1),
        very_high_pct=round(very_high / total * 100, 1),
        mgd=mgd,
        gmi=gmi,
    )


@router.post("/config")
def set_config(req: NightscoutConfig, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    import re
    env_path = ".env"
    lines: list[str] = []
    try:
        with open(env_path) as f:
            lines = f.readlines()
    except FileNotFoundError:
        pass

    ns_keys = {"NIGHTSCOUT_URL", "NIGHTSCOUT_API_TOKEN"}
    new_lines: list[str] = []
    found = {k: False for k in ns_keys}

    for line in lines:
        key = line.split("=", 1)[0].strip()
        if key in ns_keys:
            found[key] = True
            continue
        new_lines.append(line)

    for key, val in [("NIGHTSCOUT_URL", req.nightscout_url), ("NIGHTSCOUT_API_TOKEN", req.api_token)]:
        new_lines.append(f"{key}={val}\n")

    with open(env_path, "w") as f:
        f.writelines(new_lines)

    return {"ok": True}


@router.get("/config")
def get_config(_user: User = Depends(get_current_user)):
    from app.config import settings
    return {
        "nightscout_url": settings.NIGHTSCOUT_URL or "",
        "configured": bool(settings.NIGHTSCOUT_URL),
    }

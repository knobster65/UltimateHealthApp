import os
import time
from datetime import date, datetime
from pathlib import Path
import asyncio

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app.models import User, BloodTest, BloodMarker
from app.auth import get_current_user
from app.schemas import BloodTestCreate, BloodTestRead, BloodTestUpdate, MarkerRead
from app.config import settings
from app.services.pdf_parser import parse_pdf_with_ai

router = APIRouter()


@router.get("/", response_model=list[BloodTestRead])
def list_tests(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    tests = db.execute(select(BloodTest).order_by(BloodTest.date_tested.desc())).scalars().all()
    return tests


@router.post("/", response_model=BloodTestRead)
def create_test(req: BloodTestCreate, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    test = BloodTest(date_tested=req.date_tested, lab_name=req.lab_name, notes=req.notes)
    db.add(test)
    db.flush()
    for m in req.markers:
        flagged = False
        if m.low_ref is not None and m.value < m.low_ref:
            flagged = True
        if m.high_ref is not None and m.value > m.high_ref:
            flagged = True
        marker = BloodMarker(test_id=test.id, **m.model_dump(), is_flagged=flagged)
        db.add(marker)
    db.commit()
    db.refresh(test)
    return test


@router.get("/{test_id}", response_model=BloodTestRead)
def get_test(test_id: int, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    test = db.execute(select(BloodTest).where(BloodTest.id == test_id)).scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Not found")
    return test


@router.put("/{test_id}", response_model=BloodTestRead)
def update_test(test_id: int, req: BloodTestUpdate, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    test = db.execute(select(BloodTest).where(BloodTest.id == test_id)).scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Not found")
    for field, value in req.model_dump(exclude_unset=True).items():
        if field != "markers":
            setattr(test, field, value)
    if req.markers is not None:
        db.execute(BloodMarker.__table__.delete().where(BloodMarker.test_id == test_id))
        for m in req.markers:
            flagged = False
            if m.low_ref is not None and m.value < m.low_ref:
                flagged = True
            if m.high_ref is not None and m.value > m.high_ref:
                flagged = True
            marker = BloodMarker(test_id=test.id, **m.model_dump(), is_flagged=flagged)
            db.add(marker)
    db.commit()
    db.refresh(test)
    return test


@router.delete("/{test_id}")
def delete_test(test_id: int, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    test = db.execute(select(BloodTest).where(BloodTest.id == test_id)).scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Not found")
    if test.pdf_path:
        pdf_full = Path(settings.UPLOAD_DIR) / test.pdf_path
        if pdf_full.exists():
            pdf_full.unlink()
    db.delete(test)
    db.commit()
    return {"ok": True}


@router.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...), db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files allowed")
    upload_dir = Path(settings.UPLOAD_DIR) / "blood_tests"
    upload_dir.mkdir(parents=True, exist_ok=True)
    timestamp = str(int(time.time()))
    filename = f"{timestamp}_{file.filename}"
    filepath = upload_dir / filename
    with open(filepath, "wb") as f:
        content = await file.read()
        if len(content) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
            filepath.unlink()
            raise HTTPException(status_code=400, detail="File too large")
        f.write(content)
    return {"pdf_path": f"blood_tests/{filename}"}


@router.post("/parse-pdf")
async def parse_pdf(file: UploadFile = File(...), db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    """Upload and parse a blood test PDF using AbacusAI, returning structured marker data."""
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    pdf_bytes = await file.read()
    if len(pdf_bytes) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large")

    try:
        markers = await parse_pdf_with_ai(pdf_bytes)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"PDF parsing failed: {str(e)}")

    return {"markers": markers}


@router.get("/markers/trends")
def marker_trends(marker_name: str, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    stmt = (
        select(BloodMarker, BloodTest.date_tested)
        .join(BloodTest)
        .where(BloodMarker.marker_name.ilike(f"%{marker_name}%"))
        .order_by(BloodTest.date_tested.asc())
    )
    results = db.execute(stmt).all()
    return [
        {
            "marker": m.marker_name,
            "value": m.value,
            "unit": m.unit,
            "low_ref": m.low_ref,
            "high_ref": m.high_ref,
            "date_tested": t_date.isoformat(),
        }
        for m, t_date in results
    ]


@router.get("/pdf/{filename}")
def serve_pdf(filename: str, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    filepath = Path(settings.UPLOAD_DIR) / "blood_tests" / filename
    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(status_code=404, detail="PDF not found")
    return FileResponse(filepath, media_type="application/pdf", filename=filename)

from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app.models import User, MedicationEntry, MedicationInteraction
from app.auth import get_current_user
from app.schemas import (
    MedicationCreate, MedicationRead, MedicationUpdate,
    MedicationInteractionRead, BloodTestRead, MarkerRead
)
from app.services.pdf_parser import call_ai_api

router = APIRouter()


@router.get("/", response_model=list[MedicationRead])
def list_medications(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    meds = db.query(MedicationEntry).filter(
        MedicationEntry.user_id == user.id,
    ).order_by(
        MedicationEntry.end_date.is_(None).desc(),
        MedicationEntry.start_date.desc()
    ).all()
    return meds


@router.post("/", response_model=MedicationRead)
def add_medication(req: MedicationCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    med = MedicationEntry(
        user_id=user.id,
        medication_name=req.medication_name,
        dosage=req.dosage,
        frequency=req.frequency,
        start_date=req.start_date,
        end_date=req.end_date,
        notes=req.notes,
    )
    db.add(med)
    db.commit()
    db.refresh(med)
    return med


@router.put("/{med_id}", response_model=MedicationRead)
def update_medication(med_id: int, req: MedicationUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    med = db.query(MedicationEntry).filter(
        MedicationEntry.id == med_id,
        MedicationEntry.user_id == user.id,
    ).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")

    for field, value in req.model_dump(exclude_unset=True).items():
        setattr(med, field, value)

    db.commit()
    db.refresh(med)
    return med


@router.delete("/{med_id}")
def delete_medication(med_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    med = db.query(MedicationEntry).filter(
        MedicationEntry.id == med_id,
        MedicationEntry.user_id == user.id,
    ).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")
    db.delete(med)
    db.query(MedicationInteraction).filter(
        MedicationInteraction.user_id == user.id,
        MedicationInteraction.medication_name == med.medication_name,
    ).delete()
    db.commit()
    return {"ok": True}


@router.get("/check-interactions")
async def check_interactions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from app.models import BloodTest, BloodMarker

    today = date.today()
    active_meds = db.query(MedicationEntry).filter(
        MedicationEntry.user_id == user.id,
        (MedicationEntry.end_date.is_(None)) | (MedicationEntry.end_date >= today)
    ).all()

    if not active_meds:
        return {"interactions": []}

    six_months_ago = (datetime.now() - timedelta(days=180)).date()
    recent_tests = db.query(BloodTest).filter(
        BloodTest.user_id == user.id,
        BloodTest.date_tested >= six_months_ago
    ).order_by(BloodTest.date_tested.desc()).all()

    all_markers = []
    for test in recent_tests:
        for marker in test.markers:
            all_markers.append({
                "marker_name": marker.marker_name,
                "value": marker.value,
                "unit": marker.unit,
                "category": marker.category,
                "low_ref": marker.low_ref,
                "high_ref": marker.high_ref,
                "date_tested": test.date_tested.isoformat()
            })

    med_summary = "\n".join([f"- {m.medication_name} ({m.dosage}, {m.frequency})" for m in active_meds])
    marker_summary = "\n".join([f"{m['marker_name']}: {m['value']} {m['unit']}" for m in all_markers[:30]])

    messages = [
        {"role": "system", "content": """You are a medical assistant analyzing potential medication-blood test interactions.
Return ONLY a JSON array of objects with these fields:
- medication_name: The medication involved
- blood_marker: The affected lab marker (or null if general)
- interaction_type: "warning" if clinically significant, "info" if noteworthy but less critical
- description: Clear explanation of the interaction in patient-friendly language

Focus on known pharmacological effects like:
- Metformin lowering B12/folate levels
- Statins potentially elevating liver enzymes or causing CK elevation
- ACE inhibitors/ARBs affecting potassium and creatinine
- Beta-blockers masking hypoglycemia symptoms
- Thiazides causing hyperglycemia
- NSAIDs reducing kidney function markers
- Antibiotics affecting various markers"""},
        {"role": "user", "content": f"My current medications:\n{med_summary}\n\nMy recent blood test results:\n{marker_summary}\n\nPlease analyze these for any interactions."}
    ]

    try:
        raw_text = await call_ai_api(messages)

        import json
        import re
        try:
            interactions = json.loads(raw_text)
        except json.JSONDecodeError:
            match = re.search(r'\[\s*{.*}\s*\]', raw_text, re.DOTALL)
            if match:
                interactions = json.loads(match.group(0))
            else:
                return {"error": f"Could not parse AI response", "raw": raw_text[:200]}

        existing_interactions = db.query(MedicationInteraction).filter(
            MedicationInteraction.user_id == user.id,
        ).all()
        for interaction in existing_interactions:
            db.delete(interaction)
        db.commit()

        saved_count = 0
        for interaction in interactions:
            if isinstance(interaction, dict):
                new_interaction = MedicationInteraction(
                    user_id=user.id,
                    medication_name=interaction.get("medication_name", "Unknown"),
                    blood_marker=interaction.get("blood_marker"),
                    interaction_type=interaction.get("interaction_type", "info"),
                    description=interaction.get("description", ""),
                )
                db.add(new_interaction)
                saved_count += 1

        db.commit()

        return {
            "interactions": interactions,
            "count": len(interactions),
            "saved_to_db": saved_count,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")


@router.get("/get-interactions", response_model=list[MedicationInteractionRead])
def get_saved_interactions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    interactions = db.query(MedicationInteraction).filter(
        MedicationInteraction.user_id == user.id,
    ).order_by(MedicationInteraction.date_found.desc()).all()
    return interactions

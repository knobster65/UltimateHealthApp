import pytest


@pytest.mark.asyncio
async def test_add_medication(logged_in_client):
    resp = await logged_in_client.post("/api/medications/", json={
        "medication_name": "Metformin",
        "dosage": "500mg",
        "frequency": "Twice daily",
        "start_date": "2025-01-01",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["medication_name"] == "Metformin"
    assert data["dosage"] == "500mg"


@pytest.mark.asyncio
async def test_list_medications(logged_in_client):
    resp = await logged_in_client.get("/api/medications/")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_update_medication(logged_in_client):
    resp = await logged_in_client.post("/api/medications/", json={
        "medication_name": "Lisinopril",
        "dosage": "10mg",
        "start_date": "2025-03-01",
    })
    med_id = resp.json()["id"]

    resp = await logged_in_client.put(f"/api/medications/{med_id}", json={"dosage": "20mg"})
    assert resp.status_code == 200
    assert resp.json()["dosage"] == "20mg"


@pytest.mark.asyncio
async def test_delete_medication(logged_in_client):
    resp = await logged_in_client.post("/api/medications/", json={
        "medication_name": "Temp Med",
        "start_date": "2025-01-01",
    })
    med_id = resp.json()["id"]

    resp = await logged_in_client.delete(f"/api/medications/{med_id}")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_medication_active_first(logged_in_client):
    # Active medication (no end_date)
    await logged_in_client.post("/api/medications/", json={
        "medication_name": "Active Med",
        "start_date": "2025-01-01",
    })
    # Ended medication
    resp = await logged_in_client.post("/api/medications/", json={
        "medication_name": "Ended Med",
        "start_date": "2024-01-01",
        "end_date": "2024-06-01",
    })

    resp = await logged_in_client.get("/api/medications/")
    meds = resp.json()
    # Active meds should appear first in the list
    if len(meds) >= 2:
        assert any(m["medication_name"] == "Active Med" for m in meds[:1])


@pytest.mark.asyncio
async def test_update_end_medication(logged_in_client):
    resp = await logged_in_client.post("/api/medications/", json={
        "medication_name": "Short Course",
        "start_date": "2025-01-01",
    })
    med_id = resp.json()["id"]

    resp = await logged_in_client.put(f"/api/medications/{med_id}", json={"end_date": "2025-04-01"})
    assert resp.status_code == 200
    assert resp.json()["end_date"] is not None

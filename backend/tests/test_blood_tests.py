import pytest


@pytest.mark.asyncio
async def test_create_blood_test(logged_in_client):
    resp = await logged_in_client.post("/api/blood-tests/", json={
        "date_tested": "2025-08-15",
        "lab_name": "Quest Diagnostics",
        "notes": "Annual checkup",
        "markers": [
            {"category": "glucose", "marker_name": "HbA1c", "value": 6.8, "unit": "%", "low_ref": 4.0, "high_ref": 5.7},
            {"category": "lipids", "marker_name": "LDL Cholesterol", "value": 142, "unit": "mg/dL", "low_ref": 0, "high_ref": 100},
        ],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["lab_name"] == "Quest Diagnostics"
    assert len(data["markers"]) == 2


@pytest.mark.asyncio
async def test_list_blood_tests(logged_in_client):
    resp = await logged_in_client.get("/api/blood-tests/")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_get_blood_test_detail(logged_in_client):
    # Create one first
    resp = await logged_in_client.post("/api/blood-tests/", json={
        "date_tested": "2025-09-01",
        "markers": [
            {"category": "glucose", "marker_name": "Fasting Glucose", "value": 95, "unit": "mg/dL", "low_ref": 70, "high_ref": 100},
        ],
    })
    test_id = resp.json()["id"]

    resp = await logged_in_client.get(f"/api/blood-tests/{test_id}")
    assert resp.status_code == 200
    assert resp.json()["date_tested"] == "2025-09-01"


@pytest.mark.asyncio
async def test_update_blood_test(logged_in_client):
    resp = await logged_in_client.post("/api/blood-tests/", json={
        "date_tested": "2025-09-01",
        "markers": [
            {"category": "glucose", "marker_name": "HbA1c", "value": 5.5, "unit": "%"},
        ],
    })
    test_id = resp.json()["id"]

    resp = await logged_in_client.put(f"/api/blood-tests/{test_id}", json={"lab_name": "Updated Lab"})
    assert resp.status_code == 200
    assert resp.json()["lab_name"] == "Updated Lab"


@pytest.mark.asyncio
async def test_delete_blood_test(logged_in_client):
    resp = await logged_in_client.post("/api/blood-tests/", json={
        "date_tested": "2025-09-01",
        "markers": [
            {"category": "glucose", "marker_name": "HbA1c", "value": 5.5, "unit": "%"},
        ],
    })
    test_id = resp.json()["id"]

    resp = await logged_in_client.delete(f"/api/blood-tests/{test_id}")
    assert resp.status_code == 200

    resp = await logged_in_client.get(f"/api/blood-tests/{test_id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_blood_test_404(logged_in_client):
    resp = await logged_in_client.get("/api/blood-tests/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_flagged_marker_detection(logged_in_client):
    # Create a marker value outside the reference range
    resp = await logged_in_client.post("/api/blood-tests/", json={
        "date_tested": "2025-10-01",
        "markers": [
            {"category": "glucose", "marker_name": "HbA1c", "value": 8.5, "unit": "%", "low_ref": 4.0, "high_ref": 5.7},
        ],
    })
    assert resp.status_code == 200
    marker = resp.json()["markers"][0]
    assert marker["is_flagged"] is True

import pytest


@pytest.mark.asyncio
async def test_login_success(client):
    resp = await client.post("/api/auth/login", json={
        "username": "testuser",
        "password": "password",
    })
    assert resp.status_code == 200
    assert "token" in resp.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    resp = await client.post("/api/auth/login", json={
        "username": "testuser",
        "password": "wrongpassword",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_wrong_username(client):
    resp = await client.post("/api/auth/login", json={
        "username": "nonexistent",
        "password": "anything",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_protected_endpoint_requires_auth(client):
    resp = await client.get("/api/blood-tests/")
    # FastAPI returns 403 when no Bearer header is provided at all
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_dashboard_stats(logged_in_client):
    resp = await logged_in_client.get("/api/dashboard/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert "exercise_workouts_this_week" in data


@pytest.mark.asyncio
async def test_glucose_stats(logged_in_client):
    resp = await logged_in_client.get("/api/glucose/stats")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_exercise_summary(logged_in_client):
    from datetime import date, timedelta

    week_start = (date.today() - timedelta(days=7)).isoformat()
    resp = await logged_in_client.get(f"/api/exercise/summary?week_start={week_start}")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_meal_plan_list(logged_in_client):
    resp = await logged_in_client.get("/api/meal-plans/")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_recipe_list(logged_in_client):
    resp = await logged_in_client.get("/api/recipes/")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)

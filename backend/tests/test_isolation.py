from datetime import date

from sqlalchemy import select

import pytest


@pytest.mark.asyncio
async def test_signup_endpoint(client):
    resp = await client.post("/api/auth/signup", json={
        "username": "newuser",
        "password": "secret123",
    })
    assert resp.status_code == 200
    assert "token" in resp.json()


@pytest.mark.asyncio
async def test_signup_duplicate_username(client):
    # seed_user fixture already created "testuser"
    resp = await client.post("/api/auth/signup", json={
        "username": "testuser",
        "password": "secret123",
    })
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_signup_short_password(client):
    resp = await client.post("/api/auth/signup", json={
        "username": "shortpw",
        "password": "abc",
    })
    assert resp.status_code == 400


class TestUserIsolation:
    """Verify users can only access their own data at the model level."""

    def test_blood_test_scoped_to_user(self, db_session):
        from app.models import User, BloodTest, BloodMarker
        from app.auth import hash_password

        u1 = User(username="alice", password_hash=hash_password("pass"))
        u2 = User(username="bob", password_hash=hash_password("pass"))
        db_session.add_all([u1, u2])
        db_session.commit()

        test1 = BloodTest(user_id=u1.id, date_tested=date(2025, 8, 1))
        test2 = BloodTest(user_id=u2.id, date_tested=date(2025, 8, 2))
        db_session.add_all([test1, test2])
        db_session.commit()

        # Each user should only see their own tests via filtered query
        alice_tests = db_session.execute(
            select(BloodTest).where(BloodTest.user_id == u1.id)
        ).scalars().all()
        bob_tests = db_session.execute(
            select(BloodTest).where(BloodTest.user_id == u2.id)
        ).scalars().all()

        assert len(alice_tests) == 1
        assert alice_tests[0].id == test1.id
        assert len(bob_tests) == 1
        assert bob_tests[0].id == test2.id

    def test_cascade_delete_user_removes_data(self, db_session):
        from app.models import User, BloodTest
        from app.auth import hash_password

        user = User(username="tempuser", password_hash=hash_password("pass"))
        db_session.add(user)
        db_session.commit()

        test = BloodTest(user_id=user.id, date_tested=date(2025, 8, 1))
        db_session.add(test)
        db_session.commit()
        test_id = test.id

        remaining_count = db_session.execute(
            select(BloodTest).where(BloodTest.id == test_id)
        ).scalar_one_or_none()
        assert remaining_count is not None

        db_session.delete(user)
        db_session.commit()

        # CASCADE should have deleted the blood test too
        remaining = db_session.execute(
            select(BloodTest).where(BloodTest.id == test_id)
        ).scalar_one_or_none()
        assert remaining is None


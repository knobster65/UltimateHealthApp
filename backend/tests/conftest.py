import os
os.environ["DATABASE_URL"] = "sqlite:///test.db"
os.environ["SECRET_KEY"] = "test-secret-key-do-not-use"

import pytest
from httpx import AsyncClient, ASGITransport

from app.database import LocalSession, engine, Base
from app.main import app


@pytest.fixture(scope="session", autouse=True)
def _setup_db():
    """Create tables once at the start of the test session."""
    Base.metadata.create_all(bind=engine)


@pytest.fixture(autouse=True)
def _clear_tables(db_session):
    """Wipe all tables before each test to ensure isolation."""
    for table in reversed(Base.metadata.sorted_tables):
        db_session.execute(table.delete())
    db_session.commit()


@pytest.fixture()
def db_session():
    session = LocalSession()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture(autouse=True)
def seed_user(db_session):
    from app.models import User
    from app.auth import hash_password

    user = User(username="testuser", password_hash=hash_password("password"))
    db_session.add(user)
    db_session.commit()


@pytest.fixture()
async def client(db_session):
    from app.database import get_db

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac
    finally:
        app.dependency_overrides.clear()


@pytest.fixture()
def auth_token(db_session):
    from app.auth import create_token
    from app.models import User

    user = db_session.query(User).first()
    return f"Bearer {create_token(user.id)}"


@pytest.fixture()
async def logged_in_client(client, auth_token):
    client.headers["Authorization"] = auth_token
    yield client

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings

engine = create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False})

LocalSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)
SessionLocal = LocalSession  # alias for convenience


class Base(DeclarativeBase):
    pass


def get_db():
    db = LocalSession()
    try:
        yield db
    finally:
        db.close()


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()

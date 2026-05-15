from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import router
from app.database import engine, Base, LocalSession
from app.config import settings

Base.metadata.create_all(bind=engine)

# --- Migration: add user_id columns to all domain tables if missing ---
def _migrate_user_id():
    """Add user_id FK to all tables and backfill existing rows with first user's ID."""
    db = LocalSession()
    try:
        conn = engine.raw_connection()
        cursor = conn.cursor()

        # Tables that need user_id added
        columns_to_add = {
            "blood_tests": ("user_id", "INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE"),
            "medication_entries": ("user_id", "INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE"),
            "recipes": ("user_id", "INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE"),
            "meal_plans": ("user_id", "INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE"),
            "glucose_readings": ("user_id", "INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE"),
            "glucose_sync_log": ("user_id", "INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE"),
            "exercise_entries": ("user_id", "INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE"),
            "medication_interactions": ("user_id", "INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE"),
        }

        for table, (col, col_def) in columns_to_add.items():
            try:
                cursor.execute(f"PRAGMA table_info({table})")
                cols = [row[1] for row in cursor.fetchall()]
                if col not in cols:
                    cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}")
            except Exception:
                pass

        conn.commit()
        cursor.close()
        conn.close()
    except Exception:
        db.rollback()
    finally:
        db.close()


_migrate_user_id()

app = FastAPI(title="UltimateHealthApp")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.ALLOWED_ORIGINS] if settings.ALLOWED_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
def health():
    return {"status": "ok"}

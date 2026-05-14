# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project Overview

Single-user health dashboard for diabetes management. Tracks blood glucose (with Nightscout CGM sync), blood tests, exercise imports from Apple Health CSV, recipes, weekly meal plans, and auto-generated shopping lists. SQLite backend with no multi-tenancy — all data belongs to the one user.

## Tech Stack

- **Backend:** FastAPI + SQLAlchemy 2.0 (mapped_column) + Pydantic 2.x + Uvicorn, SQLite with WAL journal mode
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS + TanStack Query + Recharts + Axios
- **Auth:** Custom HMAC-signed token (not JWT), stored in localStorage. `SECRET_KEY` from `.env`, 30-day expiry default.

## Directory Layout

```
backend/app/
  main.py            # FastAPI app, CORS, creates all tables on startup
  api/router.py      # Mounts all API routers under /api prefix
  api/<module>.py    # Per-domain endpoint modules (login, blood_tests, glucose, etc.)
  models.py          # All SQLAlchemy models in one file (User, BloodTest/Marker, Recipe/Ingredient/Nutrition, MealPlan/Entry, GlucoseReading/SyncLog, ExerciseEntry)
  schemas.py         # Pydantic request/response models, organized by domain with section comments
  auth.py            # PBKDF2 password hashing, HMAC token create/verify, get_current_user dependency
  config.py          # pydantic-settings with .env loading
  database.py        # engine, sessionmaker, Base, get_db dependency (SQLite WAL mode)
  services/nightscout.py   # Incremental CGM sync from Nightscout API
  services/exercise_parser.py  # Apple Health CSV import (tab-delimited)

frontend/src/
  App.tsx            # React Router + TanStack Query provider, ProtectedRoute wrapper
  lib/api.ts         # Axios instance with Bearer token interceptor + 401 redirect
  hooks/use*.ts      # Per-domain data hooks wrapping axios calls to the API
  types/index.ts     # Shared TypeScript interfaces mirroring Pydantic schemas
  pages/             # Feature page components organized by domain
```

## Commands

### Backend
```bash
cd /home/os/UltimateHealthApp/backend
# Activate venv first: source venv/bin/activate
# Or use the start script (takes optional port):
bash /home/os/UltimateHealthApp/start_backend.sh 8000

# Production: gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

### Frontend
```bash
cd /home/os/UltimateHealthApp/frontend
npm run dev         # Dev server on port 5174, proxies /api to backend :8000
npm run build       # Type-check then Vite production build
```

## Key Details

- **No alembic migrations in use** — tables are created via `Base.metadata.create_all()` on startup. Schema changes require manual SQLite edits or dropping/recreating the DB.
- **No test suite exists** — `backend/tests/` directory is empty.
- **Vite proxy** forwards `/api` to `localhost:8000` in dev, so frontend always calls `/api/*`.
- **Auth:** First boot hits `POST /api/auth/setup` to create the user. Subsequent logins via `POST /api/auth/login` return an HMAC token. Token expired → 401 → axios interceptor clears localStorage and redirects to `/login`.
- **Glucose sync** is incremental — it tracks the last sync end_time in `glucose_sync_log` and only fetches newer entries from Nightscout.
- **Exercise import** expects Apple Health's tab-delimited CSV format with specific column names (Activity Name, Start Date, Duration (sec), Total Calories, etc.).

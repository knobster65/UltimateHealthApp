from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response as FastAPIResponse
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.database import get_db
from app.models import User
from app.schemas import LoginRequest, TokenResponse, UserInfo
from app.auth import hash_password, verify_password, create_token, get_current_user

router = APIRouter()


@router.get("/setup-check")
def setup_check(db: Session = Depends(get_db)):
    exists = db.execute(select(func.count(User.id))).scalar() > 0
    return {"account_exists": exists}


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.execute(select(User).where(User.username == req.username)).scalar_one_or_none()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return TokenResponse(token=create_token(user.id))


@router.post("/logout")
def logout(_user: User = Depends(get_current_user)):
    return {"message": "Logged out"}


@router.get("/session", response_model=UserInfo)
def session(user: User = Depends(get_current_user)):
    return UserInfo(id=user.id, username=user.username)


@router.post("/setup", response_model=TokenResponse)
def setup_account(req: LoginRequest, db: Session = Depends(get_db)):
    exists = db.execute(select(func.count(User.id))).scalar() > 0
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Account already exists. Use /signup instead.")
    user = User(username=req.username, password_hash=hash_password(req.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenResponse(token=create_token(user.id))


MIN_PASSWORD_LEN = 4


@router.post("/signup", response_model=TokenResponse)
def signup(req: LoginRequest, db: Session = Depends(get_db)):
    if len(req.password) < MIN_PASSWORD_LEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password must be at least {MIN_PASSWORD_LEN} characters",
        )
    existing = db.execute(select(User).where(User.username == req.username)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken",
        )
    user = User(username=req.username, password_hash=hash_password(req.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenResponse(token=create_token(user.id))

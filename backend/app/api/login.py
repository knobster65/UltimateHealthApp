from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.database import get_db, User
from app.models import User as UserModel
from app.schemas import LoginRequest, TokenResponse, UserInfo
from app.auth import hash_password, verify_password, create_token, get_current_user

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.execute(select(UserModel).where(UserModel.username == req.username)).scalar_one_or_none()
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
    exists = db.execute(select(func.count(UserModel.id))).scalar() > 0
    if exists:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account already exists")
    user = UserModel(username=req.username, password_hash=hash_password(req.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenResponse(token=create_token(user.id))

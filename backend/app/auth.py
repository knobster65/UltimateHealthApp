from datetime import datetime, timedelta, timezone
import hmac
import hashlib
import secrets
import os

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app.models import User
from app.config import settings

security = HTTPBearer()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 480000)
    return f"{salt}:{key.hex()}"


def verify_password(plain: str, hashed: str) -> bool:
    try:
        salt, hash_value = hashed.split(":")
        key = hashlib.pbkdf2_hmac('sha256', plain.encode(), salt.encode(), 480000)
        return hmac.compare_digest(key.hex(), hash_value)
    except ValueError:
        return False


def create_token(user_id: int) -> str:
    timestamp = str(datetime.now(timezone.utc).timestamp())
    payload = f"{user_id}:{timestamp}"
    signature = hmac.new(settings.SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{signature}"


def verify_token(token: str) -> int | None:
    try:
        payload, sig = token.rsplit(".", 1)
        expected = hmac.new(settings.SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        user_id_str, ts_str = payload.rsplit(":", 1)
        user_id = int(user_id_str)
        created_at = datetime.fromtimestamp(float(ts_str), tz=timezone.utc)
        if datetime.now(timezone.utc) - created_at > timedelta(hours=settings.TOKEN_EXPIRE_HOURS):
            return None
        return user_id
    except Exception:
        return None


def get_current_user(token: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)) -> User:
    user_id = verify_token(token.credentials)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

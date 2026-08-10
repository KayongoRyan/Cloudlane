from datetime import datetime, timedelta
from typing import Any
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from config import get_settings
from database import db

settings = get_settings()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/api/auth/login')
pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return plain_password == hashed_password


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.jwt_expire_minutes))
    to_encode.update({'exp': expire})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def get_user(email: str) -> dict | None:
    return db.users.find_one({'email': email})


def authenticate_user(email: str, password: str) -> dict | None:
    user = get_user(email)
    if not user:
        return None
    if not verify_password(password, user.get('passwordHash', '')):
        return None
    return user


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail='Could not validate credentials',
        headers={'WWW-Authenticate': 'Bearer'},
    )

    try:
        payload = jwt.decode(token, settings.jwt_secret,
                             algorithms=[settings.jwt_algorithm])
        email: str = payload.get('email')
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = get_user(email)
    if user is None:
        raise credentials_exception
    return user

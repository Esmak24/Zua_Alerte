from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlmodel import Session

from app.auth import (
    create_access_token,
    get_current_user,
    get_user_by_email,
    hash_password,
    verify_password,
)
from app.database import get_session
from app.models import User


router = APIRouter(
    prefix="/api/v1/auth",
    tags=["Auth"],
)


def validate_email_format(email: str) -> str:
    normalized = email.strip().lower()
    if "@" not in normalized or "." not in normalized.split("@")[-1]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email invalide.",
        )
    if len(normalized) < 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email invalide.",
        )
    return normalized


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=1)
    email: str
    phone: Optional[str] = None
    password: str = Field(min_length=6)


class LoginRequest(BaseModel):
    email: str
    password: str


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None


class UserOut(BaseModel):
    id: int
    full_name: str
    email: str
    phone: Optional[str] = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


def user_to_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
    )


@router.post("/register", response_model=AuthResponse)
def register(
    payload: RegisterRequest,
    session: Session = Depends(get_session),
):
    email = validate_email_format(payload.email)
    full_name = payload.full_name.strip()

    if not full_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le nom complet est obligatoire.",
        )

    if get_user_by_email(session, email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un compte existe déjà avec cet email.",
        )

    phone = payload.phone.strip() if payload.phone else None

    user = User(
        full_name=full_name,
        email=email,
        phone=phone or None,
        password_hash=hash_password(payload.password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    token = create_access_token(user.id, user.email)

    return AuthResponse(
        access_token=token,
        user=user_to_out(user),
    )


@router.post("/login", response_model=AuthResponse)
def login(
    payload: LoginRequest,
    session: Session = Depends(get_session),
):
    email = validate_email_format(payload.email)
    user = get_user_by_email(session, email)

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Compte inactif.",
        )

    token = create_access_token(user.id, user.email)

    return AuthResponse(
        access_token=token,
        user=user_to_out(user),
    )


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return user_to_out(current_user)


@router.put("/me", response_model=UserOut)
def update_me(
    payload: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    user = session.get(User, current_user.id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable.",
        )

    if payload.full_name is not None:
        name = payload.full_name.strip()
        if not name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le nom complet ne peut pas être vide.",
            )
        user.full_name = name

    if payload.phone is not None:
        phone = payload.phone.strip()
        user.phone = phone or None

    user.updated_at = datetime.now(timezone.utc)
    session.add(user)
    session.commit()
    session.refresh(user)

    return user_to_out(user)


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    return {
        "message": "Déconnexion effectuée.",
        "user_id": current_user.id,
    }

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.auth import get_current_user
from app.database import get_session
from app.models import User, UserReference


router = APIRouter(
    prefix="/api/v1/references",
    tags=["References"],
)


class ReferenceCreate(BaseModel):
    reference_user_id: int


class ReferenceOut(BaseModel):
    id: int
    user_id: int
    reference_user_id: int
    full_name: str
    email: str
    phone: Optional[str] = None
    created_at: datetime
    is_active: bool


def to_out(session: Session, link: UserReference) -> ReferenceOut:
    ref_user = session.get(User, link.reference_user_id)

    if not ref_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur de référence introuvable.",
        )

    return ReferenceOut(
        id=link.id,
        user_id=link.user_id,
        reference_user_id=link.reference_user_id,
        full_name=ref_user.full_name,
        email=ref_user.email,
        phone=ref_user.phone,
        created_at=link.created_at,
        is_active=link.is_active,
    )


@router.get("", response_model=List[ReferenceOut])
@router.get("/", response_model=List[ReferenceOut], include_in_schema=False)
def list_references(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    links = session.exec(
        select(UserReference).where(
            UserReference.user_id == current_user.id,
            UserReference.is_active == True,  # noqa: E712
        )
    ).all()

    result: List[ReferenceOut] = []
    for link in links:
        try:
            result.append(to_out(session, link))
        except HTTPException:
            continue

    return result


@router.post("", response_model=ReferenceOut)
@router.post("/", response_model=ReferenceOut, include_in_schema=False)
def add_reference(
    payload: ReferenceCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if payload.reference_user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez pas vous ajouter vous-même.",
        )

    target = session.get(User, payload.reference_user_id)

    if not target or not target.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable.",
        )

    existing = session.exec(
        select(UserReference).where(
            UserReference.user_id == current_user.id,
            UserReference.reference_user_id == payload.reference_user_id,
            UserReference.is_active == True,  # noqa: E712
        )
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cette personne est déjà dans vos personnes de référence.",
        )

    # Réactiver un lien soft-deleted s'il existe
    inactive = session.exec(
        select(UserReference).where(
            UserReference.user_id == current_user.id,
            UserReference.reference_user_id == payload.reference_user_id,
            UserReference.is_active == False,  # noqa: E712
        )
    ).first()

    if inactive:
        inactive.is_active = True
        inactive.created_at = datetime.now(timezone.utc)
        session.add(inactive)
        session.commit()
        session.refresh(inactive)
        return to_out(session, inactive)

    link = UserReference(
        user_id=current_user.id,
        reference_user_id=payload.reference_user_id,
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )
    session.add(link)
    session.commit()
    session.refresh(link)

    return to_out(session, link)


@router.delete("/{reference_id}")
def delete_reference(
    reference_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    link = session.get(UserReference, reference_id)

    if not link or link.user_id != current_user.id or not link.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Référence introuvable.",
        )

    link.is_active = False
    session.add(link)
    session.commit()

    return {
        "message": "Référence retirée.",
        "id": reference_id,
    }

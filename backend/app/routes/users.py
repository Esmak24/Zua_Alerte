from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.auth import get_current_user
from app.database import get_session
from app.models import Device, DeviceAssignment, User


router = APIRouter(
    prefix="/api/v1",
    tags=["Users"],
)


class UserDeviceResponse(BaseModel):
    user_id: int
    user_full_name: str
    has_device: bool
    gadget_id: Optional[str] = None
    device_internal_id: Optional[int] = None
    device_name: Optional[str] = None
    assignment_id: Optional[int] = None
    message: Optional[str] = None


class PublicUser(BaseModel):
    id: int
    full_name: str
    email: str
    phone: Optional[str] = None


def build_user_device_response(session: Session, user: User) -> UserDeviceResponse:
    assignment = session.exec(
        select(DeviceAssignment).where(
            DeviceAssignment.user_id == user.id,
            DeviceAssignment.is_active == True,  # noqa: E712
        )
    ).first()

    if not assignment:
        return UserDeviceResponse(
            user_id=user.id,
            user_full_name=user.full_name,
            has_device=False,
            message="Aucun gadget associé.",
        )

    device = session.get(Device, assignment.device_id)

    if not device or not device.is_active:
        return UserDeviceResponse(
            user_id=user.id,
            user_full_name=user.full_name,
            has_device=False,
            assignment_id=assignment.id,
            message="Gadget associé introuvable ou inactif.",
        )

    return UserDeviceResponse(
        user_id=user.id,
        user_full_name=user.full_name,
        has_device=True,
        gadget_id=device.device_id,
        device_internal_id=device.id,
        device_name=device.name,
        assignment_id=assignment.id,
        message=None,
    )


@router.get("/users/search", response_model=PublicUser)
def search_user_by_email(
    email: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    normalized = email.strip().lower()

    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email obligatoire.",
        )

    user = session.exec(
        select(User).where(User.email == normalized, User.is_active == True)  # noqa: E712
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable.",
        )

    return PublicUser(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
    )


@router.get("/users/{user_id}/device", response_model=UserDeviceResponse)
def get_user_device(
    user_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    # Le propriétaire vient du JWT ; l'id URL doit correspondre.
    if user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé à ce gadget.",
        )

    return build_user_device_response(session, current_user)

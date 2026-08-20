from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.auth import get_current_user
from app.database import get_session
from app.models import Device, DeviceAssignment, User


router = APIRouter(
    prefix="/api/v1/assignments",
    tags=["Assignments"],
)


class AssignmentCreate(BaseModel):
    # Conservé pour compatibilité front ; ignoré au profit du JWT.
    user_id: Optional[int] = None
    gadget_id: str


class AssignmentResponse(BaseModel):
    message: str
    assignment_id: int
    user_id: int
    user_full_name: str
    gadget_id: str
    device_internal_id: int
    is_active: bool
    assigned_at: datetime
    created: bool


def deactivate_conflicting_assignments(
    session: Session,
    user_id: int,
    device_pk: int,
    keep_assignment_id: Optional[int] = None,
) -> None:
    now = datetime.now(timezone.utc)

    for assignment in session.exec(
        select(DeviceAssignment).where(DeviceAssignment.is_active == True)  # noqa: E712
    ).all():
        if keep_assignment_id and assignment.id == keep_assignment_id:
            continue

        if assignment.user_id == user_id or assignment.device_id == device_pk:
            assignment.is_active = False
            assignment.unassigned_at = now
            session.add(assignment)


def build_assignment_response(
    *,
    message: str,
    assignment: DeviceAssignment,
    user: User,
    device: Device,
    created: bool,
) -> AssignmentResponse:
    return AssignmentResponse(
        message=message,
        assignment_id=assignment.id,
        user_id=user.id,
        user_full_name=user.full_name,
        gadget_id=device.device_id,
        device_internal_id=device.id,
        is_active=assignment.is_active,
        assigned_at=assignment.assigned_at,
        created=created,
    )


def get_active_assignment_for_user(
    session: Session, user_id: int
) -> Optional[DeviceAssignment]:
    return session.exec(
        select(DeviceAssignment).where(
            DeviceAssignment.user_id == user_id,
            DeviceAssignment.is_active == True,  # noqa: E712
        )
    ).first()


@router.post("/demo", response_model=AssignmentResponse)
def assign_demo_device(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """
    MVP démo : associe (ou crée) un gadget personnel GADGET_MVP_{user_id}.
    Ne prend jamais un gadget déjà actif chez un autre utilisateur.
    """
    existing = get_active_assignment_for_user(session, current_user.id)

    if existing:
        device = session.get(Device, existing.device_id)
        if device:
            return build_assignment_response(
                message="Vous avez déjà un gadget associé.",
                assignment=existing,
                user=current_user,
                device=device,
                created=False,
            )

    demo_id = f"GADGET_MVP_{current_user.id}"
    device = session.exec(
        select(Device).where(Device.device_id == demo_id)
    ).first()

    if not device:
        now = datetime.now(timezone.utc)
        device = Device(
            device_id=demo_id,
            name=f"Gadget démo de {current_user.full_name}",
            model="MVP-DEMO",
            status="active",
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        session.add(device)
        session.commit()
        session.refresh(device)
    else:
        foreign = session.exec(
            select(DeviceAssignment).where(
                DeviceAssignment.device_id == device.id,
                DeviceAssignment.is_active == True,  # noqa: E712
                DeviceAssignment.user_id != current_user.id,
            )
        ).first()
        if foreign:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ce gadget de démonstration est déjà utilisé.",
            )

    deactivate_conflicting_assignments(session, current_user.id, device.id)

    assignment = DeviceAssignment(
        user_id=current_user.id,
        device_id=device.id,
        is_active=True,
        assigned_at=datetime.now(timezone.utc),
    )
    session.add(assignment)
    session.commit()
    session.refresh(assignment)

    return build_assignment_response(
        message="Gadget de démonstration associé avec succès.",
        assignment=assignment,
        user=current_user,
        device=device,
        created=True,
    )


@router.post("", response_model=AssignmentResponse)
@router.post("/", response_model=AssignmentResponse, include_in_schema=False)
def create_assignment(
    payload: AssignmentCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    gadget_id = payload.gadget_id.strip()

    if not gadget_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Identifiant du gadget obligatoire.",
        )

    device = session.exec(
        select(Device).where(Device.device_id == gadget_id)
    ).first()

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gadget introuvable.",
        )

    if not device.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce gadget est inactif.",
        )

    foreign = session.exec(
        select(DeviceAssignment).where(
            DeviceAssignment.device_id == device.id,
            DeviceAssignment.is_active == True,  # noqa: E712
            DeviceAssignment.user_id != current_user.id,
        )
    ).first()

    if foreign:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ce gadget est déjà associé à un autre utilisateur.",
        )

    existing = session.exec(
        select(DeviceAssignment).where(
            DeviceAssignment.user_id == current_user.id,
            DeviceAssignment.device_id == device.id,
            DeviceAssignment.is_active == True,  # noqa: E712
        )
    ).first()

    if existing:
        return build_assignment_response(
            message="Gadget déjà associé à cet utilisateur.",
            assignment=existing,
            user=current_user,
            device=device,
            created=False,
        )

    deactivate_conflicting_assignments(session, current_user.id, device.id)

    assignment = DeviceAssignment(
        user_id=current_user.id,
        device_id=device.id,
        is_active=True,
        assigned_at=datetime.now(timezone.utc),
    )
    session.add(assignment)
    session.commit()
    session.refresh(assignment)

    return build_assignment_response(
        message="Gadget associé avec succès.",
        assignment=assignment,
        user=current_user,
        device=device,
        created=True,
    )

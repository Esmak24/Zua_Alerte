from datetime import datetime, timezone
from typing import List, Optional, Set

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.auth import get_current_user
from app.database import get_session
from app.models import (
    Alert,
    Device,
    DeviceAssignment,
    Location,
    Notification,
    NotificationToken,
    User,
    UserReference,
)


router = APIRouter(
    prefix="/api/v1/alerts",
    tags=["Alerts"],
)


class AlertCreate(BaseModel):
    device_id: str = Field(min_length=1)
    type: str = "SOS"
    latitude: float
    longitude: float
    timestamp: datetime
    message: Optional[str] = None


class AlertOut(BaseModel):
    id: int
    device_id: int
    gadget_id: Optional[str] = None
    type: str
    status: str
    latitude: float
    longitude: float
    message: Optional[str] = None
    timestamp: datetime
    received_at: datetime
    triggered_by: Optional[str] = None


class AlertCreateResponse(BaseModel):
    message: str
    alert_id: int
    device_id: str
    type: str
    latitude: float
    longitude: float
    timestamp: datetime
    triggered_by: Optional[str] = None
    notifications_queued: int = 0
    notification_delivery: str = "recorded"


def get_device_owner(session: Session, device_pk: int) -> Optional[User]:
    assignment = session.exec(
        select(DeviceAssignment).where(
            DeviceAssignment.device_id == device_pk,
            DeviceAssignment.is_active == True,  # noqa: E712
        )
    ).first()

    if not assignment:
        return None

    return session.get(User, assignment.user_id)


def alert_to_out(session: Session, alert: Alert) -> AlertOut:
    device = session.get(Device, alert.device_id)
    owner = get_device_owner(session, alert.device_id) if alert.device_id else None

    return AlertOut(
        id=alert.id,
        device_id=alert.device_id,
        gadget_id=device.device_id if device else None,
        type=alert.type,
        status=alert.status,
        latitude=alert.latitude,
        longitude=alert.longitude,
        message=alert.message,
        timestamp=alert.timestamp,
        received_at=alert.received_at,
        triggered_by=owner.full_name if owner else None,
    )


def notify_references_of_sos(
    session: Session,
    owner: User,
    alert: Alert,
    gadget_id: str,
) -> int:
    refs = session.exec(
        select(UserReference).where(
            UserReference.user_id == owner.id,
            UserReference.is_active == True,  # noqa: E712
        )
    ).all()

    title = "Alerte SOS"
    body = (
        f"{owner.full_name} a déclenché une alerte SOS "
        f"({gadget_id}) — lat {alert.latitude}, lon {alert.longitude}."
    )
    now = datetime.now(timezone.utc)
    created_count = 0

    for ref in refs:
        notification = Notification(
            user_id=ref.reference_user_id,
            alert_id=alert.id,
            title=title,
            body=body,
            type="SOS",
            status="recorded",
            created_at=now,
        )
        session.add(notification)
        created_count += 1

        tokens = session.exec(
            select(NotificationToken).where(
                NotificationToken.user_id == ref.reference_user_id,
                NotificationToken.is_active == True,  # noqa: E712
            )
        ).all()

        # MVP : pas d'envoi push réel — statut explicite "recorded".
        if tokens:
            notification.status = "recorded_with_token"
            session.add(notification)

    return created_count


def visible_device_ids_for_user(session: Session, user: User) -> Set[int]:
    device_ids: Set[int] = set()

    own = session.exec(
        select(DeviceAssignment).where(
            DeviceAssignment.user_id == user.id,
            DeviceAssignment.is_active == True,  # noqa: E712
        )
    ).all()
    for assignment in own:
        device_ids.add(assignment.device_id)

    # Alertes des personnes qui m'ont ajouté comme référence.
    inbound = session.exec(
        select(UserReference).where(
            UserReference.reference_user_id == user.id,
            UserReference.is_active == True,  # noqa: E712
        )
    ).all()

    for link in inbound:
        their = session.exec(
            select(DeviceAssignment).where(
                DeviceAssignment.user_id == link.user_id,
                DeviceAssignment.is_active == True,  # noqa: E712
            )
        ).all()
        for assignment in their:
            device_ids.add(assignment.device_id)

    return device_ids


@router.get("", response_model=List[AlertOut])
@router.get("/", response_model=List[AlertOut], include_in_schema=False)
def list_alerts(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    device_ids = visible_device_ids_for_user(session, current_user)

    if not device_ids:
        return []

    alerts = session.exec(
        select(Alert).where(Alert.device_id.in_(device_ids))  # type: ignore[attr-defined]
    ).all()

    return [alert_to_out(session, alert) for alert in alerts]


@router.post("", response_model=AlertCreateResponse)
@router.post("/", response_model=AlertCreateResponse, include_in_schema=False)
def create_alert(
    payload: AlertCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    gadget_id = payload.device_id.strip()

    device = session.exec(
        select(Device).where(Device.device_id == gadget_id)
    ).first()

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gadget introuvable.",
        )

    assignment = session.exec(
        select(DeviceAssignment).where(
            DeviceAssignment.user_id == current_user.id,
            DeviceAssignment.device_id == device.id,
            DeviceAssignment.is_active == True,  # noqa: E712
        )
    ).first()

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ce gadget n'est pas associé à votre compte.",
        )

    alert = Alert(
        device_id=device.id,
        type=payload.type or "SOS",
        status="active",
        latitude=payload.latitude,
        longitude=payload.longitude,
        message=payload.message,
        timestamp=payload.timestamp,
        received_at=datetime.now(timezone.utc),
    )
    session.add(alert)
    session.commit()
    session.refresh(alert)

    location = Location(
        device_id=device.id,
        latitude=alert.latitude,
        longitude=alert.longitude,
        recorded_at=alert.timestamp,
    )
    session.add(location)

    notifications_queued = notify_references_of_sos(
        session, current_user, alert, device.device_id
    )
    session.commit()

    return AlertCreateResponse(
        message="Alerte créée avec succès.",
        alert_id=alert.id,
        device_id=device.device_id,
        type=alert.type,
        latitude=alert.latitude,
        longitude=alert.longitude,
        timestamp=alert.timestamp,
        triggered_by=current_user.full_name,
        notifications_queued=notifications_queued,
        notification_delivery="recorded",
    )
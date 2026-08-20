from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.auth import get_current_user
from app.database import get_session
from app.models import Notification, NotificationToken, User


router = APIRouter(
    prefix="/api/v1",
    tags=["Notifications"],
)


class NotificationTokenCreate(BaseModel):
    token: str = Field(min_length=1)
    platform: str = Field(min_length=1)
    device_name: Optional[str] = None


class NotificationTokenOut(BaseModel):
    id: int
    user_id: int
    token: str
    platform: str
    device_name: Optional[str] = None
    is_active: bool


class NotificationOut(BaseModel):
    id: int
    user_id: int
    alert_id: Optional[int] = None
    title: str
    body: str
    type: str
    status: str
    sent_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    created_at: datetime


@router.post("/notification-tokens", response_model=NotificationTokenOut)
def register_notification_token(
    payload: NotificationTokenCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    existing = session.exec(
        select(NotificationToken).where(NotificationToken.token == payload.token)
    ).first()

    now = datetime.now(timezone.utc)

    if existing:
        existing.user_id = current_user.id
        existing.platform = payload.platform
        existing.device_name = payload.device_name
        existing.is_active = True
        existing.updated_at = now
        session.add(existing)
        session.commit()
        session.refresh(existing)
        row = existing
    else:
        row = NotificationToken(
            user_id=current_user.id,
            token=payload.token,
            platform=payload.platform,
            device_name=payload.device_name,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        session.add(row)
        session.commit()
        session.refresh(row)

    return NotificationTokenOut(
        id=row.id,
        user_id=row.user_id,
        token=row.token,
        platform=row.platform,
        device_name=row.device_name,
        is_active=row.is_active,
    )


@router.get("/notifications", response_model=List[NotificationOut])
def list_notifications(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    rows = session.exec(
        select(Notification).where(Notification.user_id == current_user.id)
    ).all()

    return [
        NotificationOut(
            id=row.id,
            user_id=row.user_id,
            alert_id=row.alert_id,
            title=row.title,
            body=row.body,
            type=row.type,
            status=row.status,
            sent_at=row.sent_at,
            read_at=row.read_at,
            created_at=row.created_at,
        )
        for row in rows
    ]

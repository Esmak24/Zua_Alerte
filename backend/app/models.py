from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


# ==========================================
# USERS
# ==========================================

class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)

    full_name: str
    email: str = Field(index=True, unique=True)
    phone: Optional[str] = None

    password_hash: str

    role: str = Field(default="user")

    is_active: bool = Field(default=True)

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


# ==========================================
# DEVICES
# ==========================================

class Device(SQLModel, table=True):
    __tablename__ = "devices"

    id: Optional[int] = Field(default=None, primary_key=True)

    device_id: str = Field(index=True, unique=True)

    name: Optional[str] = None

    serial_number: Optional[str] = Field(
        default=None,
        unique=True
    )

    model: Optional[str] = None

    status: str = Field(default="active")

    sim_number: Optional[str] = None

    imei: Optional[str] = Field(
        default=None,
        unique=True
    )

    firmware_version: Optional[str] = None

    is_active: bool = Field(default=True)

    last_seen_at: Optional[datetime] = None

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


# ==========================================
# DEVICE ASSIGNMENTS
# ==========================================

class DeviceAssignment(SQLModel, table=True):
    __tablename__ = "device_assignments"

    id: Optional[int] = Field(default=None, primary_key=True)

    user_id: int = Field(index=True)

    device_id: int = Field(index=True)

    assigned_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    unassigned_at: Optional[datetime] = None

    is_active: bool = Field(default=True)


# ==========================================
# ALERTS
# ==========================================

class Alert(SQLModel, table=True):
    __tablename__ = "alerts"

    id: Optional[int] = Field(default=None, primary_key=True)

    device_id: int = Field(index=True)

    type: str = Field(default="SOS", index=True)

    status: str = Field(default="active")

    latitude: float

    longitude: float

    message: Optional[str] = None

    timestamp: datetime

    received_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


# ==========================================
# LOCATIONS
# ==========================================

class Location(SQLModel, table=True):
    __tablename__ = "locations"

    id: Optional[int] = Field(default=None, primary_key=True)

    device_id: int = Field(index=True)

    latitude: float

    longitude: float

    accuracy: Optional[float] = None

    speed: Optional[float] = None

    altitude: Optional[float] = None

    recorded_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


# ==========================================
# EMERGENCY CONTACTS
# ==========================================

class EmergencyContact(SQLModel, table=True):
    __tablename__ = "emergency_contacts"

    id: Optional[int] = Field(default=None, primary_key=True)

    user_id: int = Field(index=True)

    name: str

    phone: str

    email: Optional[str] = None

    relationship: Optional[str] = None

    priority: int = Field(default=1)

    is_active: bool = Field(default=True)

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


# ==========================================
# NOTIFICATIONS
# ==========================================

class Notification(SQLModel, table=True):
    __tablename__ = "notifications"

    id: Optional[int] = Field(default=None, primary_key=True)

    user_id: int = Field(index=True)

    alert_id: Optional[int] = Field(default=None, index=True)

    title: str

    body: str

    type: str = Field(default="SOS")

    status: str = Field(default="pending")

    sent_at: Optional[datetime] = None

    read_at: Optional[datetime] = None

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


# ==========================================
# NOTIFICATION TOKENS
# ==========================================

class NotificationToken(SQLModel, table=True):
    __tablename__ = "notification_tokens"

    id: Optional[int] = Field(default=None, primary_key=True)

    user_id: int = Field(index=True)

    token: str = Field(unique=True)

    platform: str

    device_name: Optional[str] = None

    is_active: bool = Field(default=True)

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


# ==========================================
# DEVICE CREDENTIALS
# ==========================================

class DeviceCredential(SQLModel, table=True):
    __tablename__ = "device_credentials"

    id: Optional[int] = Field(default=None, primary_key=True)

    device_id: int = Field(index=True)

    credential_hash: str

    is_active: bool = Field(default=True)

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    expires_at: Optional[datetime] = None

    last_used_at: Optional[datetime] = None


# ==========================================
# DEVICE TELEMETRY
# ==========================================

class DeviceTelemetry(SQLModel, table=True):
    __tablename__ = "device_telemetry"

    id: Optional[int] = Field(default=None, primary_key=True)

    device_id: int = Field(index=True)

    battery_level: Optional[float] = None

    signal_strength: Optional[float] = None

    latitude: Optional[float] = None

    longitude: Optional[float] = None

    temperature: Optional[float] = None

    recorded_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


# ==========================================
# AUDIT LOGS
# ==========================================

class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_logs"

    id: Optional[int] = Field(default=None, primary_key=True)

    user_id: Optional[int] = Field(
        default=None,
        index=True
    )

    action: str

    entity_type: Optional[str] = None

    entity_id: Optional[int] = None

    ip_address: Optional[str] = None

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
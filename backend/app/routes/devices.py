from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.models import Device


router = APIRouter(
    prefix="/api/v1/devices",
    tags=["Devices"]
)


# ==========================================
# CREATE
# ==========================================

@router.post("/", response_model=Device)
def create_device(
    device: Device,
    session: Session = Depends(get_session)
):
    # Vérifier si le device_id existe déjà
    existing_device = session.exec(
        select(Device).where(
            Device.device_id == device.device_id
        )
    ).first()

    if existing_device:
        raise HTTPException(
            status_code=400,
            detail="Ce gadget existe déjà."
        )

    session.add(device)
    session.commit()
    session.refresh(device)

    return device


# ==========================================
# READ ALL
# ==========================================

@router.get("/", response_model=List[Device])
def get_devices(
    session: Session = Depends(get_session)
):
    devices = session.exec(
        select(Device)
    ).all()

    return devices


# ==========================================
# READ ONE
# ==========================================

@router.get("/{device_id}", response_model=Device)
def get_device(
    device_id: str,
    session: Session = Depends(get_session)
):
    device = session.exec(
        select(Device).where(
            Device.device_id == device_id
        )
    ).first()

    if not device:
        raise HTTPException(
            status_code=404,
            detail="Gadget introuvable."
        )

    return device


# ==========================================
# UPDATE
# ==========================================

@router.put("/{device_id}", response_model=Device)
def update_device(
    device_id: str,
    updated_device: Device,
    session: Session = Depends(get_session)
):
    device = session.exec(
        select(Device).where(
            Device.device_id == device_id
        )
    ).first()

    if not device:
        raise HTTPException(
            status_code=404,
            detail="Gadget introuvable."
        )

    device.name = updated_device.name
    device.serial_number = updated_device.serial_number
    device.model = updated_device.model
    device.status = updated_device.status
    device.sim_number = updated_device.sim_number
    device.imei = updated_device.imei
    device.firmware_version = updated_device.firmware_version
    device.is_active = updated_device.is_active

    session.add(device)
    session.commit()
    session.refresh(device)

    return device


# ==========================================
# DELETE
# ==========================================

@router.delete("/{device_id}")
def delete_device(
    device_id: str,
    session: Session = Depends(get_session)
):
    device = session.exec(
        select(Device).where(
            Device.device_id == device_id
        )
    ).first()

    if not device:
        raise HTTPException(
            status_code=404,
            detail="Gadget introuvable."
        )

    session.delete(device)
    session.commit()

    return {
        "message": "Gadget supprimé avec succès.",
        "device_id": device_id
    }
























































































    
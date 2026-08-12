from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlmodel import SQLModel

from app.database import engine

# Import des modèles
from app import models

# Import des routes
from app.routes.devices import router as devices_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    SQLModel.metadata.create_all(engine)

    yield


app = FastAPI(
    title="Gadget Security API",
    version="1.0.0",
    lifespan=lifespan
)


# Enregistrement de la route Devices
app.include_router(devices_router)


@app.get("/")
def root():
    return {
        "message": "Gadget Security API opérationnelle"
    }
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel

from app.database import engine

# Import des modèles (création des tables)
from app import models

# Import des routes
from app.routes.alerts import router as alerts_router
from app.routes.assignments import router as assignments_router
from app.routes.auth import router as auth_router
from app.routes.devices import router as devices_router
from app.routes.notifications import router as notifications_router
from app.routes.references import router as references_router
from app.routes.users import router as users_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    SQLModel.metadata.create_all(engine)
    yield


app = FastAPI(
    title="Gadget Security API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:19006",
        "http://127.0.0.1:19006",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(assignments_router)
app.include_router(alerts_router)
app.include_router(references_router)
app.include_router(notifications_router)
app.include_router(devices_router)


@app.get("/")
def root():
    return {
        "message": "Gadget Security API opérationnelle"
    }

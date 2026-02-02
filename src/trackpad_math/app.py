import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from trackpad_math import state
from trackpad_math.db import db
from trackpad_math.routers import websocket, data, settings
from contextlib import asynccontextmanager
import threading

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger = logging.getLogger("app")

    # We'll load it in app.py startup or here, but here is safer for instantiation
    if not state.classifier.load():
        logger.warning("Model not found. Predictions will fail until trained.")

    yield
    
    # Shutdown logic goes here if needed

app = FastAPI(title="Trackpad Math", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",    # Dev origin (Vite)
        "tauri://localhost",        # Prod origin (Linux/macOS)
        "https://tauri.localhost", # Prod origin (Windows)
        "http://tauri.localhost", # Prod origin (Windows)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(settings.router)
app.include_router(data.router)
app.include_router(websocket.router)
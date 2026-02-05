from trackpad_math.model import SymbolClassifier
import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from trackpad_math import state
from trackpad_math.db import Database
from trackpad_math.routers import websocket, data, settings
from trackpad_math.socket_manager import ConnectionManager
from contextlib import asynccontextmanager
import threading

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger = logging.getLogger("app")

    db = Database()
    db.init_db()
    app.state.db = db

    app_data_dir = os.environ.get("APP_DATA_DIR")
    if not app_data_dir:
        raise RuntimeError("APP_DATA_DIR environment variable not set. Did you call init_config()?")
    base_model_path = os.path.join(app_data_dir, "model")
    app.state.classifier = SymbolClassifier(model_type="knn", base_path=base_model_path)
    
    # Train model if not already trained (e.g., after seeding)
    if not app.state.classifier.load():
        logger.info("Model not found. Training model.")
        db.seed_if_empty()
        if not data.retrain_model(app.state.db, app.state.classifier):
            logger.error("Failed to train model.")

    app.state.socket_manager = ConnectionManager()

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
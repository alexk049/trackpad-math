import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from trackpad_math.db import Database
from trackpad_math.routers import websocket, data, settings
from trackpad_math.socket_manager import ConnectionManager
from trackpad_math.model import SymbolClassifier
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        logger = logging.getLogger("app")
        logger.debug("Starting lifespan.")
        db = Database()
        db.init_db()
        logger.debug("Database initialized.")
        app.state.db = db

        app_data_dir = os.environ.get("APP_DATA_DIR")
        if not app_data_dir:
            raise RuntimeError("APP_DATA_DIR environment variable not set. Did you call init_config()?")
        base_model_path = os.path.join(app_data_dir, "model")
        app.state.classifier = SymbolClassifier(model_type="knn", base_path=base_model_path)
        if not app.state.classifier.load():
            logger.debug("Model not found. Training model.")
            db.seed_if_empty()
            with db.session_scope() as session:
                if not data.train_model_from_db(session, app.state.classifier):
                    logger.error("Failed to train model.")
        app.state.classifier.warmup()

        app.state.socket_manager = ConnectionManager()
    except Exception as e:
        logger.error(f"Error in startup: {e}")
        raise e

    yield
    
    # Shutdown logic goes here if needed

app = FastAPI(title="Trackpad Math", lifespan=lifespan)

app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",    # Dev origin (Vite)
        "http://127.0.0.1:5173",    # Dev origin (Vite)
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
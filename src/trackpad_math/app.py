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
    # Initialize DB
    db.init_db()
    db.seed_if_empty()

    logger = logging.getLogger("app")

    # We'll load it in app.py startup or here, but here is safer for instantiation
    if not state.classifier.load():
        logger.warning("Model not found. Predictions will fail until trained.")
    
    # Train model if not already trained (e.g., after seeding)
    # Run in a separate thread so we don't block server startup
    if not state.classifier.is_trained:
        def train_background():
            logger.debug("Background: Starting model training.")
            state.train_model_on_db_data()
            logger.debug("Background: Model training complete.")
        
        training_thread = threading.Thread(target=train_background, daemon=True)
        training_thread.start()
    
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
import sys
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import trackpad_math.config
from trackpad_math.db import init_db, seed_db_if_empty
from trackpad_math.routers import websocket, data, settings
from trackpad_math import state
from contextlib import asynccontextmanager
import threading
import uvicorn

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB
    init_db()
    seed_db_if_empty()

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

logger = logging.getLogger("app")

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

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
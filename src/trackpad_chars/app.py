import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from trackpad_chars.db import init_db
from trackpad_chars.routers import websocket, data, settings
from trackpad_chars import state

app = FastAPI(title="Trackpad Chars")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",    # Dev origin (Vite)
        "tauri://localhost",        # Prod origin (Linux/macOS)
        "https://tauri.localhost", # Prod origin (Windows)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize DB
init_db()

# Train model if not already trained (e.g., after seeding)
if not state.classifier.is_trained:
    state.train_model()

# Include Routers
app.include_router(settings.router)
app.include_router(data.router)
app.include_router(websocket.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
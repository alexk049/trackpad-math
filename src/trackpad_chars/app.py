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

# Path to web assets
# WEB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../..", "frontend", "dist"))
# if not os.path.exists(WEB_DIR):
#     print(f"WARNING: Web dir {WEB_DIR} does not exist. Did you run 'npm run build'?")

# Initialize DB
init_db()

# Include Routers
app.include_router(settings.router)
app.include_router(data.router)
app.include_router(websocket.router)

# Mount static files for the frontend (must be last to avoid catching API routes)
# if os.path.exists(WEB_DIR):
#     app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="static")
# else:
#     print(f"WARNING: Web dir {WEB_DIR} not found. Static files will not be served.")

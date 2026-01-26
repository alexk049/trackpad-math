import sys
import threading
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from trackpad_math.db import init_db
from trackpad_math.routers import websocket, data, settings
from trackpad_math import state

app = FastAPI(title="Trackpad Math")

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

def listen_stdin(stop_event):
    """Listens for a shutdown command on stdin."""
    print("Backend: Listening for shutdown signal on stdin...", flush=True)
    try:
        for line in sys.stdin:
            if line.strip() == "shutdown":
                break
        print("Backend: Stdin closed or shutdown received, stopping...", flush=True)
    except Exception as e:
        print(f"Backend: Stdin error: {e}", flush=True)
    finally:
        stop_event.set()


def run_server(host="0.0.0.0", port=8000):
    import uvicorn
    import asyncio

    stop_event = threading.Event()
    
    # Start monitor
    threading.Thread(target=listen_stdin, args=(stop_event,), daemon=True).start()

    config = uvicorn.Config(
        app, 
        host=host, 
        port=port, 
        log_level="info",
        timeout_graceful_shutdown=1
    )
    server = uvicorn.Server(config)

    async def main_loop():
        server_task = asyncio.create_task(server.serve())
        
        while not stop_event.is_set() and not server.should_exit:
            await asyncio.sleep(0.1)  # More responsive poll
        
        print("Backend: Initiating server shutdown...", flush=True)
        server.should_exit = True
        await server_task
        print("Backend: Cleanly exited.", flush=True)

    try:
        asyncio.run(main_loop())
    except Exception as e:
        print(f"Backend: asyncio error: {e}", flush=True)
    finally:
        sys.exit(0)

if __name__ == "__main__":
    try:
        run_server()
    except Exception as e:
        print(f"Backend: Main error: {e}", flush=True)
        sys.exit(1)
import os
import uvicorn
import anyio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from trackpad_chars.db import init_db
from trackpad_chars.routers import websocket, data, settings
from trackpad_chars import state

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    This `lifespan` function defines the application's startup and shutdown lifecycle.
    It utilizes an AnyIO Task Group to manage long-running background services.

    The sequence is:
    1. Startup: `async with anyio.create_task_group() as tg:` starts the Task Group.
                `state.global_task_group = tg` makes this persistent container available
                globally for launching background tasks (like the signal consumer).
    2. Lifetime: `yield` pauses the function, and the application starts serving requests.
    3. Shutdown: The `async with` block closes, which automatically cancels all tasks
                running within `tg` and waits for them to complete gracefully. 
                This ensures a clean shutdown for all persistent services.
    """
    # Initialize global TaskGroup
    async with anyio.create_task_group() as tg:
        state.global_task_group = tg
        yield
    # TaskGroup will close here, waiting for all tasks to complete or cancelling them if needed.
    state.global_task_group = None

app = FastAPI(title="Trackpad Chars", lifespan=lifespan)

# Path to web assets
WEB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../..", "frontend", "dist"))
if not os.path.exists(WEB_DIR):
    print(f"WARNING: Web dir {WEB_DIR} does not exist. Did you run 'npm run build'?")

# Initialize DB
init_db()

# Include Routers
app.include_router(settings.router)
app.include_router(data.router)
app.include_router(websocket.router)

# Mount static files for the frontend (must be last to avoid catching API routes)
app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="static")

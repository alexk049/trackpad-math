import os
import sys
import pathlib
import time
import logging
from logging.handlers import RotatingFileHandler

# --- App Data Directory ---
app_name = "trackpad-math"
home = pathlib.Path.home()

# Determine App Data Directory (Cross-Platform)
# Use env var if set (e.g. by Tauri), otherwise detect
if os.environ.get("APP_DATA_DIR"):
    app_data_dir = pathlib.Path(os.environ["APP_DATA_DIR"])
else:
    if sys.platform == "win32":
        app_data_dir = pathlib.Path(os.environ.get("APPDATA", home / "AppData" / "Roaming")) / app_name
    elif sys.platform == "darwin":
        app_data_dir = home / "Library" / "Application Support" / app_name
    else:
        # Linux and others
        app_data_dir = home / ".local" / "share" / app_name
    app_data_dir.mkdir(parents=True, exist_ok=True)
    os.environ["APP_DATA_DIR"] = str(app_data_dir)

# --- Database ---
if not os.environ.get("DATABASE_URL"):
    db_path = str(os.environ.get("APP_DATA_DIR")) + "/app.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"

# --- General Logging ---
def setup_general_logger():
    logger = logging.getLogger("app")
    if logger.hasHandlers():
        return
    logger.setLevel(logging.DEBUG)
    formatter = logging.Formatter(
        # fmt='[%(asctime)s][%(name)s][%(levelname)s] %(message)s',
        fmt='[%(levelname)s] %(message)s',
        datefmt='%Y-%m-%d][%H:%M:%S'
    )

    stream_handler = logging.StreamHandler(sys.stdout) # Stream Handler (logs to stdout for Tauri sidecar to capture)
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)

# --- App Crash Logging ---
def setup_crash_logger():
    crash_logger = logging.getLogger("app_crash")
    if crash_logger.hasHandlers():
        return
    crash_logger.setLevel(logging.DEBUG)
    formatter = logging.Formatter(
        fmt='[%(asctime)s][%(name)s][%(levelname)s] %(message)s',
        datefmt='%Y-%m-%d][%H:%M:%S'
    )
    app_crash_log_file = app_data_dir / "backend_crash.log"
    crash_file_handler = RotatingFileHandler(app_crash_log_file, maxBytes=1024*1024, backupCount=5)
    crash_file_handler.setFormatter(formatter)
    crash_logger.addHandler(crash_file_handler)

setup_general_logger()
setup_crash_logger()

logger = logging.getLogger("app")
logger.info(f"App Data Directory: {os.environ['APP_DATA_DIR']}")
logger.info(f"Database Path: {os.environ['DATABASE_URL']}")
"""
Entry point for the backend server. This script initializes and runs the Uvicorn server, 
ensuring compatibility with multiprocessing when bundled as an executable.

Keeps application specific code in app.py from including deployment specific code
like freeze_support().
"""
import multiprocessing
import uvicorn
from trackpad_math.app import app

def main():
    # PyInstaller freeze support for multiprocessing
    multiprocessing.freeze_support()
    
    # Ensure app.db is in a writable location
    # When running as an executable, we might be in a read-only temp dir.
    # We should probably set DATABASE_URL to a user data dir if not set,
    # but for now let's assume CWD is writable or DATABASE_URL is set correctly.
    
    print("Starting backend server on port 8000...")
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")

if __name__ == "__main__":
    main()

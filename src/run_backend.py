"""
Entry point for the backend server. This script initializes and runs the Uvicorn server, 
ensuring compatibility with multiprocessing when bundled as an executable.

Keeps application specific code in app.py from including deployment specific code
like freeze_support().
"""
import os
import multiprocessing
import uvicorn

def main():
    # PyInstaller freeze support for multiprocessing
    multiprocessing.freeze_support()
    
    # Ensure app.db is in a writable location
    if not os.environ.get("DATABASE_URL"):
        import sys
        import pathlib
        
        app_name = "trackpad-math"
        home = pathlib.Path.home()
        
        if sys.platform == "win32":
            base_dir = pathlib.Path(os.environ.get("APPDATA", home / "AppData" / "Roaming")) / app_name
        elif sys.platform == "darwin":
            base_dir = home / "Library" / "Application Support" / app_name
        else:
            # Linux and others
            base_dir = home / ".local" / "share" / app_name
            
        base_dir.mkdir(parents=True, exist_ok=True)
        db_path = base_dir / "app.db"
        os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
        print(f"Database path set to: {os.environ['DATABASE_URL']}")

    # Import run_server AFTER setting environment variable
    # This ensures trackpad_math.db correctly identifies the database path
    from trackpad_math.app import run_server
    
    print("Starting backend server on port 8000...")
    run_server(host="127.0.0.1", port=8000)

if __name__ == "__main__":
    main()

"""
Entry point for the backend server. This script initializes and runs the Uvicorn server, 
ensuring compatibility with multiprocessing when bundled as an executable.

Keeps application specific code in app.py from including deployment specific code
like freeze_support().
"""
import os
import sys
import threading
import asyncio
import multiprocessing
import uvicorn

def listen_stdin(on_stop):
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
        on_stop()

async def run_server(app, host="127.0.0.1", port=0):
    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()
    
    def trigger_stop():
        loop.call_soon_threadsafe(stop_event.set)

    threading.Thread(target=listen_stdin, args=(trigger_stop,), daemon=True).start()

    config = uvicorn.Config(
        app, 
        host=host, 
        port=port, 
        log_level="info",
        timeout_graceful_shutdown=1
    )
    server = uvicorn.Server(config)
    
    # We need to start the server to get the port if we used port=0
    server_task = asyncio.create_task(server.serve())
    
    # Wait a bit for the server to actually start and bind to a port
    actual_port = port
    while not server.started and not server_task.done():
        await asyncio.sleep(0.1)
    
    if server.started:
        for s in server.servers:
            for sock in s.sockets:
                actual_port = sock.getsockname()[1]
                break
            break
        print(f"ACTUAL_PORT: {actual_port}", flush=True)

    stop_task = asyncio.create_task(stop_event.wait())
    
    done, _ = await asyncio.wait(
        [stop_task, server_task],
        return_when=asyncio.FIRST_COMPLETED
    )
    
    if stop_task in done and not server.should_exit:
        print("Backend: Initiating server shutdown...", flush=True)
        server.should_exit = True
    
    await server_task
    
    if not stop_task.done():
        stop_task.cancel()

    print("BACKEND_SHUTDOWN_COMPLETE", flush=True)
    print("Backend: Cleanly exited.", flush=True)

def main():
    # PyInstaller freeze support for multiprocessing
    multiprocessing.freeze_support()
    
    # Ensure app.db is in a writable location
    if not os.environ.get("DATABASE_URL"):
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
        os.environ["APP_DATA_DIR"] = str(base_dir)
        print(f"Database path set to: {os.environ['DATABASE_URL']}")
        print(f"App Data path set to: {os.environ['APP_DATA_DIR']}")

    # Import app AFTER setting environment variable
    try:
        from trackpad_math.app import app
        asyncio.run(run_server(app, host="127.0.0.1", port=0))
    except Exception as e:
        error_msg = f"Backend: Critical startup error: {e}"
        print(error_msg, flush=True)
        
        # Try to write to a log file for debugging
        try:
            import traceback
            app_dir = os.environ.get("APP_DATA_DIR")
            if app_dir:
                log_path = os.path.join(app_dir, "backend_startup_error.log")
                with open(log_path, "w") as f:
                    f.write(error_msg + "\n")
                    traceback.print_exc(file=f)
                print(f"Backend: Error log written to {log_path}", flush=True)
        except Exception as log_error:
            print(f"Backend: Failed to write error log: {log_error}", flush=True)
            
        sys.exit(1)


if __name__ == "__main__":
    main()

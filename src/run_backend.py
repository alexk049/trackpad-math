"""
Entry point for the backend server. This script initializes and runs the Uvicorn server, 
ensuring compatibility with multiprocessing when bundled as an executable.

Keeps application specific code in app.py from including deployment specific code
like freeze_support().
"""
import os
import sys
import logging
import threading
import asyncio
import multiprocessing
import uvicorn
import trackpad_math.config

logger = logging.getLogger("app")
crash_logger = logging.getLogger("app_crash")

def listen_stdin(on_stop):
    """Listens for a shutdown command on stdin."""
    logger.info("Listening for shutdown signal on stdin.")
    try:
        for line in sys.stdin:
            if line.strip() == "shutdown":
                logger.debug("Stdin closed or shutdown received, stopping.")
                # print to stdout for tauri to pick up
                print("BACKEND_SHUTDOWN_COMPLETE", flush=True)
                break
    except Exception as e:
        logger.error(f"Stdin error: {e}")
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
    
    logger.debug("Starting server.")
    # We need to start the server to get the port if we used port=0
    server_task = asyncio.create_task(server.serve())
    
    # Wait a bit for the server to actually start and bind to a port
    logger.debug("Waiting for server to start.")
    actual_port = port
    while not server.started and not server_task.done():
        await asyncio.sleep(0.1)
    
    logger.debug(f"Server started on port {actual_port}.")
    if server.started:
        for s in server.servers:
            for sock in s.sockets:
                actual_port = sock.getsockname()[1]
                break
            break
        #print to stdout for tauri to pick up
        print(f"ACTUAL_PORT: {actual_port}", flush=True)

    stop_task = asyncio.create_task(stop_event.wait())
    
    done, _ = await asyncio.wait(
        [stop_task, server_task],
        return_when=asyncio.FIRST_COMPLETED
    )
    
    if stop_task in done and not server.should_exit:
        logger.debug("Main thread received shutdown signal, initiating server shutdown.")
        server.should_exit = True
    
    await server_task
    
    if not stop_task.done():
        stop_task.cancel()

    logger.info("Main thread cleanly exited.")

def main():
    # PyInstaller freeze support for multiprocessing
    multiprocessing.freeze_support()

    # Import and Run App
    try:
        from trackpad_math.app import app
        logger.info("FastAPI app imported successfully.")
        
        asyncio.run(run_server(app, host="127.0.0.1", port=0))
        
    except Exception as e:
        crash_logger.critical(f"Critical startup error: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()

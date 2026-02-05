import os
import sys
import logging
import threading
import asyncio
import multiprocessing
import argparse
import uvicorn
from trackpad_math import config, state
from trackpad_math.db import db

def listen_stdin(on_stop):
    """Listens for a shutdown command on stdin."""
    logger = logging.getLogger("app")
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

async def run_server(app, host="127.0.0.1", port=0, dev_mode=False):
    logger = logging.getLogger("app")

    if not dev_mode:
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
    while not server.started and not server_task.done():
        await asyncio.sleep(0.1)
    
    if server.started:
        actual_port = port
        for s in server.servers:
            for sock in s.sockets:
                actual_port = sock.getsockname()[1]
                break
            break
        
        logger.info(f"Server started on port {actual_port}.")
        if not dev_mode:
            # print to stdout for tauri to pick up
            print(f"ACTUAL_PORT: {actual_port}", flush=True)

    if dev_mode:
        # In dev mode, just wait for the server task to complete (e.g. via Ctrl+C)
        await server_task
    else:
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
    try:
        parser = argparse.ArgumentParser(description="Trackpad Math Backend")
        parser.add_argument("--dev", action="store_true", help="Run in development mode")
        args = parser.parse_args()

        # PyInstaller freeze support for multiprocessing
        multiprocessing.freeze_support()

        # Initialize config first to set up environment variables and logging
        config.init_config()

        # Initialize Database and State
        db.connect()
        db.init_db()
        db.seed_if_empty()
        state.init_state()

        logger = logging.getLogger("app")

        # Train model if not already trained (e.g., after seeding)
        # Run in a separate thread so we don't block server startup
        if not state.classifier.load():
            logger.info("Model not found. Training model.")
            if not state.train_model_on_db_data():
                logger.error("Failed to train model.")

        crash_logger = logging.getLogger("app_crash")

        from trackpad_math.app import app
        logger.info(f"FastAPI app imported successfully. Dev mode: {args.dev}")
        
        host = "127.0.0.1"
        port = 8000 if args.dev else 0
        
        asyncio.run(run_server(app, host=host, port=port, dev_mode=args.dev))
        
    except Exception as e:
        crash_logger.critical(f"Critical startup error: {e}", exc_info=True)
        # Also print to stderr for visible feedback in terminal
        print(f"Critical startup error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()

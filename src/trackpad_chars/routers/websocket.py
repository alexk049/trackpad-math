import asyncio
import json
import anyio
from typing import Optional, List, Dict, Callable, Awaitable
from pydantic import BaseModel
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.concurrency import run_in_threadpool
from trackpad_chars.state import recorder, classifier, current_settings
from trackpad_chars.socket_manager import manager
from trackpad_chars import state

router = APIRouter()

class ToggleResponse(BaseModel):
    status: str
    symbol: Optional[str] = None
    confidence: Optional[float] = None
    candidates: Optional[list] = None
    message: Optional[str] = None
    continue_recording: Optional[bool] = False

@router.websocket("/ws/record")
async def websocket_record(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            message = await websocket.receive_text()
            data = json.loads(message)

            if data.get('action') == 'toggle':
                print("toggle")
                await toggle_recording()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

async def process_recording(strokes, is_done_recording: bool = False):
    if not strokes:
        await manager.broadcast({"status": "idle", "message": "Stopped"})
        return

    if not classifier.is_trained:
        await manager.broadcast({"status": "error", "message": "Model not trained"})
        return

    # Run heavy prediction in threadpool
    predictions = await run_in_threadpool(classifier.predict, strokes)
    
    if not predictions:
         await manager.broadcast({"status": "idle", "message": "No prediction"})
         return
         
    pred, conf = predictions[0]
    candidates = [{"symbol": p[0], "confidence": p[1]} for p in predictions if p[1] > 0 and p[0] != pred]
    
    # Reset cursor for NEXT symbol (blocking subprocess call)
    await run_in_threadpool(recorder.reset_cursor)
    
    response = ToggleResponse(
        status="finished",
        symbol=pred,
        confidence=conf,
        candidates=candidates,
        strokes=strokes,
        continue_recording=not is_done_recording
    )
    await manager.broadcast(response.dict())

async def signal_consumer_task(receiver: anyio.abc.ObjectReceiveStream, 
                               async_handler: Callable[[List[List[Dict[str, float]]]], Awaitable[None]]):
    """
    Asynchronous task that waits on the receiver (the signal) and calls the handler.
    """
    print("Consumer task started, waiting for signals...")
    # This loop blocks until data is transferred from the background thread
    async for data in receiver:
        print("Signal received, processing...")
        # When data arrives, the main thread calls the async handler
        await async_handler(data)

async def toggle_recording():
    """
    Toggle recording state.
    """
    if not recorder.is_recording:
        # Start
        try:
            await run_in_threadpool(recorder.reset_cursor)
            if current_settings.auto_mode:
                # 1. Create the AnyIO communication channel, max_buffer=0 is best for signal-like events
                sender, receiver = anyio.create_memory_object_stream(max_buffer_size=0)
                # 2. Use a Task Group for safe, structured concurrency
                if state.drawing_processor_tg:
                    state.drawing_processor_tg.start_soon(signal_consumer_task, receiver, process_recording)
                else:
                    print("Error: Drawing processor task group not initialized")
                
                recorder.start(auto_mode_config=(current_settings.pause_threshold, sender))
            else:
                recorder.start()

            mode = "auto" if current_settings.auto_mode else "manual"
            await manager.broadcast({"status": "recording", "message": f"Recording started ({mode})"})
        except Exception as e:
            # We can't raise HTTPException in a websocket handler easily to the client, 
            # but we can log or broadcast error.
            print(f"Failed to start recording: {e}")
            await manager.broadcast({"status": "error", "message": str(e)})
    else:
        # Stop (Manual stop even in auto mode)
        print("stop")
        if current_settings.auto_mode:
            _ = recorder.stop()
            strokes = []
            await process_recording(strokes, is_done_recording=False) # in auto mode, recording continues
        else:
            strokes = recorder.stop()
            await process_recording(strokes, is_done_recording=True)


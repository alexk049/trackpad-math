import asyncio
import json
import anyio
from typing import Optional, List, Dict, Callable, Awaitable
from pydantic import BaseModel
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.concurrency import run_in_threadpool
from trackpad_chars.state import classifier, current_settings
from trackpad_chars.socket_manager import manager
from trackpad_chars import state
from trackpad_chars.processing import segment_strokes
from pynput import mouse

router = APIRouter()

class ToggleResponse(BaseModel):
    status: str
    symbol: Optional[str] = None
    confidence: Optional[float] = None
    candidates: Optional[list] = None
    points: Optional[list] = None
    message: Optional[str] = None
    continue_recording: Optional[bool] = False

@router.websocket("/ws/record")
async def websocket_record(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            message = await websocket.receive_text()
            try:
                data = json.loads(message)
            except json.JSONDecodeError:
                print("Failed to decode JSON")
                continue

            action = data.get('action')

            if action == 'set_cursor':
                x = data.get('x')
                y = data.get('y')
                if x is not None and y is not None:
                    # Run blocking cursor move in threadpool
                    await run_in_threadpool(reset_cursor, int(x), int(y))
                    await manager.broadcast({"status": "cursor_reset"})
            
            elif action == 'classify':
                points = data.get('points')
                if points:
                    await process_classification(points)
                else: 
                     # Fallback to strokes for backward compatibility if needed
                     # Actually, if we want to be truly flat, we should flatten strokes or just handle points
                     strokes = data.get('strokes')
                     if strokes:
                        # Flatten strokes back to points if someone sends old format
                        flat_points = []
                        for s in strokes:
                            flat_points.extend(s)
                        await process_classification(flat_points)

    except WebSocketDisconnect:
        manager.disconnect(websocket)

def reset_cursor(x, y):
    try:
        mouse_controller = mouse.Controller()
        mouse_controller.position = (x, y)
    except Exception as e:
        print(f"Warning: Could not reset cursor: {e}")

async def process_classification(points):
    if not classifier.is_trained:
        await manager.broadcast({"status": "error", "message": "Model not trained"})
        return

    # Run heavy prediction in threadpool
    predictions = await run_in_threadpool(classifier.predict, points)
    
    if not predictions:
         await manager.broadcast({"status": "idle", "message": "No prediction"})
         return
         
    pred, conf = predictions[0]
    candidates = [{"symbol": p[0], "confidence": p[1]} for p in predictions if p[1] > 0 and p[0] != pred]
    
    response = ToggleResponse(
        status="finished",
        symbol=pred,
        confidence=conf,
        candidates=candidates,
        points=points,
        continue_recording=False # Client decides whether to continue
    )
    await manager.broadcast(response.dict())


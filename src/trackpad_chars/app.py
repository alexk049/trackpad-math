import os
import time
import asyncio
import json
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict
import uvicorn

from sqlalchemy.orm import Session
from sqlalchemy import func

from trackpad_chars.model import SymbolClassifier
from trackpad_chars.recorder import recorder
from trackpad_chars.db import get_db, Drawing, init_db

app = FastAPI(title="Trackpad Chars")

# Path to web assets
WEB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../..", "frontend", "dist"))
if not os.path.exists(WEB_DIR):
    print(f"WARNING: Web dir {WEB_DIR} does not exist. Did you run 'npm run build'?")


# Initialize DB
init_db()

# Load model globally
classifier = SymbolClassifier(model_type="knn") 
if not classifier.load():
    print("WARNING: Model not found. Predictions will fail until trained.")

# --- WebSocket Manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            await connection.send_json(message)

manager = ConnectionManager()

# --- Models ---

class ToggleResponse(BaseModel):
    status: str
    symbol: Optional[str] = None
    confidence: Optional[float] = None
    candidates: Optional[list] = None
    message: Optional[str] = None

class Settings(BaseModel):
    auto_mode: bool
    pause_threshold: float # seconds

# Global settings state
current_settings = Settings(auto_mode=False, pause_threshold=1.0) 

# --- Routes ---

@app.get("/status")
def get_status():
    return {
        "model_loaded": classifier.is_trained,
        "model_type": classifier.model_type,
        "is_recording": recorder.is_recording
    }

@app.post("/settings")
def update_settings(s: Settings):
    global current_settings
    current_settings = s
    return {"status": "updated", "settings": current_settings}

@app.get("/settings")
def get_settings():
    return current_settings


# WebSocket Endpoint
@app.websocket("/ws/record")
async def websocket_record(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive. Client might send "ping" or "start"/"stop" commands later.
            _ = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

async def processing_loop():
    """Background task to poll recorder and push updates via WebSocket."""
    # print("Starting background recorder loop...") 
    while True:
        await asyncio.sleep(0.05) # Poll frequency
        
        if not recorder.is_recording:
            continue
            
        # Check timeout - simple check, fast
        strokes = recorder.pop_if_timeout(current_settings.pause_threshold)
        
        if strokes:
            # Symbol detected! Process in threadpool to avoid blocking loop
            await process_strokes(strokes)

async def process_strokes(strokes):
    if not classifier.is_trained:
         await manager.broadcast({"status": "error", "message": "Model not trained"})
         return

    # Run heavy prediction in threadpool
    predictions = await run_in_threadpool(classifier.predict, strokes)
    
    if not predictions:
         await manager.broadcast({"status": "idle", "message": "No prediction"})
         return
         
    pred, conf = predictions[0]
    candidates = [{"symbol": p[0], "confidence": p[1]} for p in predictions[:5]]
    
    # Reset cursor for NEXT symbol (blocking subprocess call)
    await run_in_threadpool(recorder.reset_cursor)
    
    await manager.broadcast({
        "status": "finished",
        "symbol": pred,
        "confidence": conf,
        "candidates": candidates,
        "strokes": strokes
    })

@app.on_event("startup")
async def startup_event():
    # Start the background loop
    asyncio.create_task(processing_loop())

@app.get("/record/poll")
def poll_recording():
    """Deprecated: Use WebSocket /ws/record instead."""
    return {"status": "deprecated", "message": "Use WebSocket"}

@app.post("/record/toggle", response_model=ToggleResponse)
async def toggle_recording():
    """
    Toggle recording state.
    """
    if not recorder.is_recording:
        # Start
        try:
            await run_in_threadpool(recorder.reset_cursor)
            recorder.start()
            mode = "auto" if current_settings.auto_mode else "manual"
            # Notify WS clients
            await manager.broadcast({"status": "recording", "message": f"Recording started ({mode})"})
            return {"status": "recording", "message": f"Recording started ({mode})"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to start recording: {e}")
    else:
        # Stop (Manual stop even in auto mode)
        strokes = recorder.stop()
        
        # Process whatever is left
        if not strokes:
            await manager.broadcast({"status": "idle", "message": "Stopped"})
            return {"status": "idle", "message": "Stopped"}
            
        if not classifier.is_trained:
             return {"status": "idle", "message": "Model not trained"}

        # Predict
        predictions = await run_in_threadpool(classifier.predict, strokes)
        if not predictions:
             return {"status": "idle", "message": "No prediction"}
             
        pred, conf = predictions[0]
        candidates = [{"symbol": p[0], "confidence": p[1]} for p in predictions[:5]]
        
        result = {
            "status": "finished",
            "symbol": pred,
            "confidence": conf,
            "candidates": candidates,
            "strokes": strokes
        }
        await manager.broadcast(result)
        return result


# --- Data API ---

@app.get("/api/labels")
def get_labels(db: Session = Depends(get_db)):
    """Get all unique labels and their counts."""
    results = db.query(Drawing.label, func.count(Drawing.id)).group_by(Drawing.label).all()
    data = {r[0]: r[1] for r in results}
    
    # User requested ALL trainable symbols to be present
    all_symbols = [str(i) for i in range(10)] + \
                  [chr(i) for i in range(ord('a'), ord('z')+1)] + \
                  ['summation', 'square root', 'integral'] # Common ones, can expand
    
    final_list = []
    # Merge existing counts
    for sym in all_symbols:
        final_list.append({"label": sym, "count": data.get(sym, 0)})
    
    # Add any others that exist but aren't in our 'all_symbols' list
    for label, count in data.items():
        if label not in all_symbols:
             final_list.append({"label": label, "count": count})
             
    final_list.sort(key=lambda x: x['label'])
    return final_list

@app.get("/api/drawings")
def get_drawings(label: Optional[str] = None, limit: int = 100, db: Session = Depends(get_db)):
    """Get list of drawings, optionally filtered by label."""
    q = db.query(Drawing)
    if label:
        q = q.filter(Drawing.label == label)
    drawings = q.order_by(Drawing.timestamp.desc()).limit(limit).all()
    return drawings

@app.get("/api/drawings/{id}")
def get_drawing(id: str, db: Session = Depends(get_db)):
    d = db.query(Drawing).filter(Drawing.id == id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Drawing not found")
    return d

@app.delete("/api/drawings/{id}")
def delete_drawing(id: str, db: Session = Depends(get_db)):
    d = db.query(Drawing).filter(Drawing.id == id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Drawing not found")
    db.delete(d)
    db.commit()
    return {"status": "deleted"}

class TeachRequest(BaseModel):
    label: str
    strokes: Optional[list] = None # If None, use last recorded strokes

@app.post("/api/teach")
async def teach_symbol(req: TeachRequest, db: Session = Depends(get_db)):
    """
    Save strokes as a specific label and incrementally update the model.
    """
    strokes_to_save = req.strokes
    
    if not strokes_to_save:
         raise HTTPException(status_code=400, detail="No strokes provided")

    new_drawing = Drawing(
        label=req.label,
        strokes=strokes_to_save
    )
    db.add(new_drawing)
    db.commit()
    
    # Incrementally update the model with the new example
    try:
        classifier.add_example(strokes_to_save, req.label)
        model_updated = True
    except Exception as e:
        print(f"Warning: Could not update model incrementally: {e}")
        model_updated = False
    
    return {"status": "saved", "id": str(new_drawing.id), "model_updated": model_updated}

@app.post("/api/retrain")
def retrain_model():
    """Force model reload/retrain from DB."""
    # Not implemented fully yet
    return {"status": "not_implemented_yet"}

# --- Import / Export ---

@app.get("/api/data/export")
def export_data(db: Session = Depends(get_db)):
    """Export all training data as JSON."""
    drawings = db.query(Drawing).all()
    data = []
    for d in drawings:
        data.append({
            "label": d.label,
            "strokes": d.strokes,
            "created_at": d.timestamp.isoformat() if d.timestamp else None
        })
    # Return as download with filename
    return JSONResponse(
        content=data,
        headers={"Content-Disposition": "attachment; filename=training_data.json"}
    )

@app.post("/api/data/import")
async def import_data(file: UploadFile, db: Session = Depends(get_db)):
    """Import training data from JSON file."""
    try:
        content = await file.read()
        data = json.loads(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON file: {e}")
        
    if not isinstance(data, list):
         raise HTTPException(status_code=400, detail="JSON must be a list of drawings")
         
    count = 0
    for item in data:
        if "label" not in item or "strokes" not in item:
            continue
            
        # Basic validation passed
        d = Drawing(
            label=item["label"],
            strokes=item["strokes"]
            # Ignore timestamp on import, let it be now
        )
        db.add(d)
        count += 1
        
    db.commit()
    
    return {"status": "imported", "count": count}

# Mount static files for the frontend
app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="static")


def start():
    """Entry point for uv run"""
    uvicorn.run("trackpad_chars.app:app", host="0.0.0.0", port=8000, reload=True)

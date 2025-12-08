import os
import time
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
import uvicorn

from sqlalchemy.orm import Session
from sqlalchemy import func

from trackpad_chars.model import SymbolClassifier
from trackpad_chars.recorder import recorder
from trackpad_chars.db import get_db, Drawing, init_db
from fastapi import Depends

app = FastAPI(title="Trackpad Chars")

# Path to web assets
WEB_DIR = os.path.join(os.path.dirname(__file__), "web")

# Initialize DB
init_db()

# Load model globally
classifier = SymbolClassifier(model_type="knn") 
if not classifier.load():
    print("WARNING: Model not found. Predictions will fail until trained.")

class ToggleResponse(BaseModel):
    status: str
    symbol: Optional[str] = None
    confidence: Optional[float] = None
    candidates: Optional[list] = None
    message: Optional[str] = None

@app.get("/status")
def get_status():
    return {
        "model_loaded": classifier.is_trained,
        "model_type": classifier.model_type,
        "is_recording": recorder.is_recording
    }


class Settings(BaseModel):
    auto_mode: bool
    pause_threshold: float # seconds

# Global settings state
current_settings = Settings(auto_mode=False, pause_threshold=1.0) 

@app.post("/settings")
def update_settings(s: Settings):
    global current_settings
    current_settings = s
    return {"status": "updated", "settings": current_settings}

@app.get("/record/poll")
def poll_recording():
    """
    Poll to see if auto-recording has finished a symbol.
    """
    if not recorder.is_recording:
        return {"status": "idle"}
        
    # Check timeout
    strokes = recorder.pop_if_timeout(current_settings.pause_threshold)
    
    if strokes:
        # Symbol detected!
        if not classifier.is_trained:
            return {"status": "error", "message": "Model not trained"}
            
        predictions = classifier.predict(strokes)
        if not predictions:
             return {"status": "idle", "message": "No prediction"}
             
        pred, conf = predictions[0]
        candidates = [{"symbol": p[0], "confidence": p[1]} for p in predictions[:5]]
        
        # Reset cursor for NEXT symbol
        recorder.reset_cursor()
        
        return {
            "status": "finished",
            "symbol": pred,
            "confidence": conf,
            "candidates": candidates,
            "strokes": strokes
        }
    
    return {"status": "recording"}

@app.post("/record/toggle", response_model=ToggleResponse)
def toggle_recording():
    """
    Toggle recording state.
    """
    if not recorder.is_recording:
        # Start
        try:
            recorder.reset_cursor()
            recorder.start()
            mode = "auto" if current_settings.auto_mode else "manual"
            return {"status": "recording", "message": f"Recording started ({mode})"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to start recording: {e}")
    else:
        # Stop (Manual stop even in auto mode)
        strokes = recorder.stop()
        
        # In manual mode, we process the strokes.
        # In auto mode, we might just stop. OR process whatever is left.
        # Let's process whatever is left.
        
        if not strokes:
            return {"status": "idle", "message": "Stopped"}
            
        if not classifier.is_trained:
            return {"status": "idle", "message": "Model not trained"}

        # Predict
        predictions = classifier.predict(strokes)
        if not predictions:
             return {"status": "idle", "message": "No prediction"}
             
        pred, conf = predictions[0]
        candidates = [{"symbol": p[0], "confidence": p[1]} for p in predictions[:5]]
        return {
            "status": "finished",
            "symbol": pred,
            "confidence": conf,
            "candidates": candidates,
            "strokes": strokes
        }


# --- Data API ---

@app.get("/api/labels")
def get_labels(db: Session = Depends(get_db)):
    """Get all unique labels and their counts."""
    # Query: SELECT label, COUNT(*) FROM drawings GROUP BY label
    results = db.query(Drawing.label, func.count(Drawing.id)).group_by(Drawing.label).all()
    # Format: [{"label": "A", "count": 10}, ...]
    return [{"label": r[0], "count": r[1]} for r in results]

@app.get("/api/drawings")
def get_drawings(label: Optional[str] = None, db: Session = Depends(get_db)):
    """Get list of drawings, optionally filtered by label."""
    q = db.query(Drawing)
    if label:
        q = q.filter(Drawing.label == label)
    # Return basic info (exclude heavy strokes if list is huge? For now include all)
    drawings = q.order_by(Drawing.timestamp.desc()).limit(100).all()
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
    
    # Reload model if dynamic? For KNN we might want to reload or just let it be lazy.
    # Ideally, we should retrain.
    return {"status": "deleted"}

class TeachRequest(BaseModel):
    label: str
    strokes: Optional[list] = None # If None, use last recorded strokes

@app.post("/api/teach")
def teach_symbol(req: TeachRequest, db: Session = Depends(get_db)):
    """
    Save strokes as a specific label and incrementally update the model.
    If strokes provided, use them. Else use recorder.last_strokes.
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
    # Logic to dump DB to files or train directly from DB
    # straightforward for KNN: just need to rebuild X, y from DB.
    # NOT IMPLEMENTED FULLY here, but placeholder.
    # Ideally: classifier.train_from_db(db_session)
    return {"status": "not_implemented_yet"}

# Mount static files for the frontend
app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="static")


def start():
    """Entry point for uv run"""
    uvicorn.run("trackpad_chars.app:app", host="0.0.0.0", port=8000, reload=True)

import os
import time
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
import uvicorn

from trackpad_chars.model import SymbolClassifier
from trackpad_chars.recorder import recorder

app = FastAPI(title="Trackpad Chars")

# Path to web assets
WEB_DIR = os.path.join(os.path.dirname(__file__), "web")

# Load model globally
classifier = SymbolClassifier(model_type="knn") 
if not classifier.load():
    print("WARNING: Model not found. Predictions will fail until trained.")

class ToggleResponse(BaseModel):
    status: str
    symbol: Optional[str] = None
    confidence: Optional[float] = None
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
        
        # Reset cursor for NEXT symbol
        recorder.reset_cursor()
        
        return {
            "status": "finished",
            "symbol": pred,
            "confidence": conf
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
        return {
            "status": "finished",
            "symbol": pred,
            "confidence": conf
        }

# Mount static files for the frontend
app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="static")

def start():
    """Entry point for uv run"""
    uvicorn.run("trackpad_chars.app:app", host="0.0.0.0", port=8000, reload=True)

from fastapi import APIRouter
from trackpad_chars.state import current_settings, Settings, classifier

router = APIRouter()

@router.get("/api/status")
def get_status():
    return {
        "model_loaded": classifier.is_trained,
        "model_type": classifier.model_type,
    }

@router.post("/api/settings")
def update_settings(s: Settings):
    # Update properties of the global object
    current_settings.auto_mode = s.auto_mode
    current_settings.pause_threshold = s.pause_threshold
    return {"status": "updated", "settings": current_settings}

@router.get("/api/settings")
def get_settings():
    return current_settings

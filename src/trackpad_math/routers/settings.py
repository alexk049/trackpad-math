from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from trackpad_math import state
from trackpad_math.state import Settings
from trackpad_math.db import db, DBSetting

router = APIRouter()

@router.get("/api/status")
def get_status():
    return {
        "model_loaded": state.classifier.is_trained,
        "model_type": state.classifier.model_type,
    }

@router.post("/api/settings")
def update_settings(s: Settings, session: Session = Depends(db.get_db)):
    db_settings = session.query(DBSetting).first()
    if not db_settings:
        db_settings = DBSetting(id=1)
        session.add(db_settings)
    
    db_settings.auto_mode = s.auto_mode
    db_settings.pause_threshold = s.pause_threshold
    db_settings.equation_scroll_x_sensitivity = s.equation_scroll_x_sensitivity
    db_settings.equation_scroll_y_sensitivity = s.equation_scroll_y_sensitivity
    
    session.commit()
    session.refresh(db_settings)
    
    return {"status": "updated", "settings": Settings.model_validate(db_settings)}

@router.get("/api/settings")
def get_settings(session: Session = Depends(db.get_db)):
    db_settings = session.query(DBSetting).first()
    if not db_settings:
        db_settings = DBSetting(id=1)
        session.add(db_settings)
        session.commit()
        session.refresh(db_settings)
        
    return Settings.model_validate(db_settings)

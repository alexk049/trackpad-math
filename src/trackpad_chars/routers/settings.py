from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from trackpad_chars.state import Settings, classifier
from trackpad_chars.db import get_db, DBSetting

router = APIRouter()

@router.get("/api/status")
def get_status():
    return {
        "model_loaded": classifier.is_trained,
        "model_type": classifier.model_type,
    }

@router.post("/api/settings")
def update_settings(s: Settings, db: Session = Depends(get_db)):
    db_settings = db.query(DBSetting).first()
    if not db_settings:
        db_settings = DBSetting(id=1)
        db.add(db_settings)
    
    db_settings.auto_mode = s.auto_mode
    db_settings.pause_threshold = s.pause_threshold
    db_settings.equation_scroll_x_sensitivity = s.equation_scroll_x_sensitivity
    db_settings.equation_scroll_y_sensitivity = s.equation_scroll_y_sensitivity
    
    db.commit()
    db.refresh(db_settings)
    
    return {"status": "updated", "settings": Settings.model_validate(db_settings)}

@router.get("/api/settings")
def get_settings(db: Session = Depends(get_db)):
    db_settings = db.query(DBSetting).first()
    if not db_settings:
        db_settings = DBSetting(id=1)
        db.add(db_settings)
        db.commit()
        db.refresh(db_settings)
        
    return Settings.model_validate(db_settings)

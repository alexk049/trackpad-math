from fastapi import APIRouter
from trackpad_math.state import Settings, DBSession, ClassifierInstance
from trackpad_math.db import DBSetting

router = APIRouter()

@router.get("/api/status")
def get_status(classifier: ClassifierInstance):
    return {
        "model_loaded": classifier.is_trained,
        "model_type": classifier.model_type,
    }

@router.post("/api/settings")
def update_settings(s: Settings, session: DBSession):
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
def get_settings(session: DBSession):
    db_settings = session.query(DBSetting).first()
    if not db_settings:
        db_settings = DBSetting(id=1)
        session.add(db_settings)
        session.flush()
        session.refresh(db_settings)
        
    return Settings.model_validate(db_settings)

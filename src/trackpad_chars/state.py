from pydantic import BaseModel, ConfigDict
from trackpad_chars.model import SymbolClassifier
import anyio
from typing import Optional, List
from trackpad_chars.db import SessionLocal, Drawing

# --- Models ---
class Settings(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    auto_mode: bool = True
    pause_threshold: int = 1000 # milliseconds
    equation_scroll_x_sensitivity: int = 20
    equation_scroll_y_sensitivity: int = 20

# --- Global Components ---

# Classifier Instance
classifier = SymbolClassifier(model_type="knn") 

# We'll load it in app.py startup or here, but here is safer for instantiation
if not classifier.load():
    print("WARNING: Model not found. Predictions will fail until trained.")

# Global Task Group (initialized in app lifespan)
drawing_processor_tg: Optional[anyio.abc.TaskGroup] = None

def train_model():
    """Fetches all drawings from DB and trains the classifier."""
    db = SessionLocal()
    try:
        drawings = db.query(Drawing).all()
        if not drawings:
            print("No drawings found in DB for training.")
            return False
        
        points_list = [d.points for d in drawings]
        labels_list = [d.label for d in drawings]
        
        print(f"Training model with {len(drawings)} examples...")
        classifier.train(points_list, labels_list)
        return True
    finally:
        db.close()

print("state loaded")

import os
from pydantic import BaseModel, ConfigDict
from trackpad_math.model import SymbolClassifier
from trackpad_math.db import SessionLocal, Drawing

# --- Models ---
class Settings(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    auto_mode: bool = True
    pause_threshold: int = 1000 # milliseconds
    equation_scroll_x_sensitivity: int = 20
    equation_scroll_y_sensitivity: int = 20

# --- Global Components ---
 
# Classifier Instance
app_data_dir = os.environ.get("APP_DATA_DIR")
if app_data_dir:
    base_model_path = os.path.join(app_data_dir, "model")
    classifier = SymbolClassifier(model_type="knn", base_path=base_model_path)
else:
    # Default to current directory if not running in bundled mode
    classifier = SymbolClassifier(model_type="knn") 

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

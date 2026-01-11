from pydantic import BaseModel
from trackpad_chars.model import SymbolClassifier
import anyio
from typing import Optional

# --- Models ---
class Settings(BaseModel):
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

print("state loaded")

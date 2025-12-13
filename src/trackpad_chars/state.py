from pydantic import BaseModel
from trackpad_chars.model import SymbolClassifier
from trackpad_chars.recorder import DrawingRecorder

import anyio
from typing import Optional

# --- Models ---
class Settings(BaseModel):
    auto_mode: bool
    pause_threshold: float # seconds

# --- Global Components ---

# Global settings state
current_settings = Settings(auto_mode=True, pause_threshold=0.2) 

# Recorder Instance
recorder = DrawingRecorder()

# Classifier Instance
classifier = SymbolClassifier(model_type="knn") 

# We'll load it in app.py startup or here, but here is safer for instantiation
if not classifier.load():
    print("WARNING: Model not found. Predictions will fail until trained.")

# Global Task Group (initialized in app lifespan)
drawing_processor_tg: Optional[anyio.abc.TaskGroup] = None

print("state loaded")

from pydantic import BaseModel
from trackpad_chars.model import SymbolClassifier
from trackpad_chars.recorder import DrawingRecorder

# --- Models ---
class Settings(BaseModel):
    auto_mode: bool
    pause_threshold: float # seconds

# --- Global Components ---

import anyio
from typing import Optional

# Global settings state
current_settings = Settings(auto_mode=False, pause_threshold=1.0) 

# Recorder Instance
recorder = DrawingRecorder()

# Classifier Instance
classifier = SymbolClassifier(model_type="knn") 
# We'll load it in app.py startup or here, but here is safer for instantiation
if not classifier.load():
    print("WARNING: Model not found. Predictions will fail until trained.")

# Global Task Group (initialized in app lifespan)
global_task_group: Optional[anyio.abc.TaskGroup] = None

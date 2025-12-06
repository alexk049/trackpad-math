import time
import threading
import subprocess
import re
from typing import List, Dict, Optional
from pynput import mouse

class DrawingRecorder:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DrawingRecorder, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self.strokes: List[List[Dict[str, float]]] = []
        self.current_stroke: List[Dict[str, float]] = []
        self.is_recording = False
        self.listener: Optional[mouse.Listener] = None
        self.start_time = 0.0
        self.last_move_time = 0.0
        # Time gap to consider a new stroke (e.3. 0.3s pause)
        self.stroke_gap_threshold = 0.3 
        self._lock = threading.Lock()
        self._initialized = True
        self._resetting = False

    def start(self):
        with self._lock:
            if self.is_recording:
                return
            self.strokes = []
            self.current_stroke = []
            self.is_recording = True
            self.start_time = time.time()
            self.last_move_time = self.start_time
            self._resetting = False
            
            # Non-blocking listener
            self.listener = mouse.Listener(on_move=self._on_move)
            self.listener.start()

    def stop(self) -> List[List[Dict[str, float]]]:
        with self._lock:
            if not self.is_recording:
                return []
            self.is_recording = False
            if self.listener:
                self.listener.stop()
                self.listener = None
            
            # Finish current stroke
            if self.current_stroke:
                self.strokes.append(self.current_stroke)
            
            return self.strokes

    def _on_move(self, x, y):
        if not self.is_recording:
            return
            
        if self._resetting:
            return

        now = time.time()
        t = now - self.start_time
        
        # Check for gap -> new stroke
        # Note: on_move fires very frequently.
        # We need to be careful. If the user stops moving, on_move stops firing.
        # So we can't detect "lift" here easily just by time gap BETWEEN events, 
        # unless we check the gap between this event and the PREVIOUS event.
        
        with self._lock:
            dt = now - self.last_move_time
            if dt > self.stroke_gap_threshold and self.current_stroke:
                self.strokes.append(self.current_stroke)
                self.current_stroke = []
            
            self.current_stroke.append({
                "x": x,
                "y": y,
                "t": t
            })
            self.last_move_time = now

    def reset_cursor(self):
        """
        Reset the cursor position to the middle of the screen, near the top.
        """
        self._resetting = True
        try:
            # Get screen resolution using xrandr
            output = subprocess.check_output('xrandr').decode()
            match = re.search(r'(\d+)x(\d+)\s+.*\*', output)
            
            if match:
                width = int(match.group(1))
                height = int(match.group(2))
                
                # Target: Middle of screen, 15% from top
                target_x = width // 2
                target_y = int(height * 0.15)
                
                # Move cursor
                mouse_controller = mouse.Controller()
                mouse_controller.position = (target_x, target_y)
                
                # Allow time for event to propagate and be ignored
                time.sleep(0.05)
                
        except Exception as e:
            # Fail silently or log if needed, avoiding crash on drawing logic
            print(f"Warning: Could not reset cursor: {e}")
        finally:
            self._resetting = False
            with self._lock:
                self.current_stroke = []
                self.last_move_time = time.time()

    def pop_if_timeout(self, timeout: float) -> Optional[List[List[Dict[str, float]]]]:
        """
        Check if the last movement was longer than 'timeout' seconds ago.
        If yes, and we have recorded strokes, return them and clear the buffer.
        """
        if not self.is_recording:
             return None

        with self._lock:
            # If we haven't even started moving since start(), ignore
            if not self.strokes and not self.current_stroke:
                 return None

            elapsed = time.time() - self.last_move_time
            if elapsed > timeout:
                # Capture current state
                
                # Close current stroke if any
                if self.current_stroke:
                    self.strokes.append(self.current_stroke)
                    self.current_stroke = []
                
                if not self.strokes:
                    return None
                    
                result = self.strokes
                # Reset buffers but KEEP recording
                self.strokes = []
                # Also reset start_time for next char to keep timestamps relative? 
                # Actually, classifier uses relative time or normalized. But keeping t small is good.
                self.start_time = time.time() 
                self.last_move_time = self.start_time
                
                return result
        return None


recorder = DrawingRecorder()

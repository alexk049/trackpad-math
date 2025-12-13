import time
import threading
import subprocess
import re
from typing import List, Dict, Optional, Callable, Tuple, Awaitable, Any
from pynput import mouse
import anyio

class DrawingRecorder:
    def __init__(self):
        self.strokes: List[List[Dict[str, float]]] = []
        self.current_stroke: List[Dict[str, float]] = []
        self.is_recording = False
        self.listener: Optional[mouse.Listener] = None
        self.start_time = 0.0
        self.last_move_time = 0.0
        # Time gap to consider a new stroke (e.3. 0.3s pause)
        self.stroke_gap_threshold = 0.3 
        self._lock = threading.Lock()
        self._resetting = False

        self.auto_mode_active = False
        self.auto_mode_timeout: Optional[float] = None
        self._timeout_timer: Optional[threading.Timer] = None
        
        # AnyIO Signal-Bridge Attribute: Only stores the channel to send data
        self.sender: Optional[anyio.abc.ObjectSendStream] = None

    def start(self, auto_mode_config: Optional[Tuple[float, anyio.abc.ObjectSendStream]] = None):
        """
        Start recording. If `auto_mode_config` is provided, start in auto mode,
        using the provided AnyIO sender as the signal channel.
        """
        if auto_mode_config:
            self.auto_mode_active = True
            self.auto_mode_timeout = auto_mode_config[0]
            self.sender = auto_mode_config[1]
            self.token = anyio.lowlevel.current_token()
        with self._lock:
            self._reset_fields()
            self.listener = mouse.Listener(on_move=self._on_move)
            self.listener.start()

    def stop(self) -> List[List[Dict[str, float]]]:
        with self._lock:
            if self.listener:
                self.listener.stop()
                self.listener = None
            return self._get_collected_data()
    
    def _reset_fields(self):
        if self.is_recording:
            return
        self.strokes = []
        self.current_stroke = []
        self.is_recording = True
        self.start_time = None
        self.last_move_time = self.start_time
        self._resetting = False
            
    def _get_collected_data(self) -> List[List[Dict[str, float]]]:
        if not self.is_recording:
            return []
        self.is_recording = False
        
        if self.current_stroke:
            self.strokes.append(self.current_stroke)
        
        return self.strokes

    def _on_move(self, x, y):
        if not self.is_recording:
            return

        if self._resetting:
            return

        now = time.time()
        if self.start_time is None:
            self.start_time = now
            self.last_move_time = now
        t = now - self.start_time

        with self._lock:
            # Cancel any existing timeout timer
            if self._timeout_timer is not None:
                self._timeout_timer.cancel()
                self._timeout_timer = None

            # Add the current point to the stroke
            self.current_stroke.append({'x': x, 'y': y, 't': t})

            # If in auto mode, schedule a new timeout check
            if self.auto_mode_active and self.auto_mode_timeout is not None:
                # Schedule a function to run after auto_mode_timeout
                self._timeout_timer = threading.Timer(self.auto_mode_timeout, self._handle_auto_mode_timeout)
                self._timeout_timer.start()

            dt = now - self.last_move_time # This dt will always be 0 or very close to 0 due to self.last_move_time = now above.
                                           # The original logic for dt > self.auto_mode_timeout is being moved to _handle_auto_mode_timeout.
            if dt > self.stroke_gap_threshold and self.current_stroke:
                self.strokes.append(self.current_stroke)
                self.current_stroke = []

            self.last_move_time = now

    def _handle_auto_mode_timeout(self):
        """
        Handles the timeout for auto mode. This method is called by a threading.Timer
        when no mouse movement has occurred for the auto_mode_timeout duration.
        """
        with self._lock:
            # Double-check if auto mode is still active and if the timer hasn't been cancelled
            # by a subsequent mouse move (though the timer.cancel() in _on_move should prevent this for active timers)
            if self.auto_mode_active and self.is_recording:
                data = self._get_collected_data()
                self._reset_fields()
                # SIGNAL: Safely schedule the data transfer to the main async loop
                if self.sender:
                    try:
                        # Use AnyIO's thread-safe method to run the sender.send coroutine in the main event loop thread.
                        # pass in event loop token so that non anyio thread knows what event loop to get back to since this handler is not in an anyio managed thread
                        anyio.from_thread.run(self.sender.send, data, token=self.token)
                    except Exception as e:
                        print(f"Error sending signal via AnyIO: {e}")

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

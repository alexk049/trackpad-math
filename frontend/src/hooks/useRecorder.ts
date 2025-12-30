import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '../config';

export interface RecorderState {
    status: 'idle' | 'recording' | 'finished' | 'error' | 'cursor_reset';
    message?: string;
    symbol?: string;
    confidence?: number;
    candidates?: Array<{ symbol: string; confidence: number }>;
    strokes?: any;
    continue_recording?: boolean;
}

interface Point {
    x: number;
    y: number;
    t: number;
}

export function useRecorder() {
    const [state, setState] = useState<RecorderState>({ status: 'idle' });
    const ws = useRef<WebSocket | null>(null);
    const [settings, setSettings] = useState<any>(null);

    const isRecordingRef = useRef(false);
    const ignoreMouseMoveRef = useRef(false);
    const strokesRef = useRef<Point[][]>([]);
    const currentStrokeRef = useRef<Point[]>([]);
    const lastMoveTimeRef = useRef<number>(0);
    const startTimeRef = useRef<number>(0);
    const autoModeTimerRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/settings`)
            .then(res => res.json())
            .then(data => setSettings(data))
            .catch(err => console.error("Failed to fetch settings:", err));
    }, []);

    const sendClassificationRequest = useCallback(() => {
        if (!ws.current) return;

        // Finalize current stroke if exists
        if (currentStrokeRef.current.length > 0) {
            strokesRef.current.push(currentStrokeRef.current);
            currentStrokeRef.current = [];
        }

        const strokes = strokesRef.current;
        if (strokes.length === 0) return;

        console.log("Sending classification request, strokes:", strokes.length);
        ws.current.send(JSON.stringify({
            action: 'classify',
            strokes: strokes
        }));

        // Reset local strokes but keep recording state technically until we decide what to do next
        strokesRef.current = [];
    }, []);

    const startRecordingSequence = useCallback(() => {
        if (!ws.current) return;
        ws.current.send(JSON.stringify({
            action: 'set_cursor',
            x: Math.round(window.screenX + window.innerWidth / 2),
            y: Math.round(window.screenY + window.innerHeight / 2)
        }));
    }, []);

    const beginRecording = useCallback(() => {
        if (!ws.current) return;

        strokesRef.current = [];
        currentStrokeRef.current = [];
        startTimeRef.current = Date.now() / 1000;
        lastMoveTimeRef.current = startTimeRef.current;
        isRecordingRef.current = true;

        setState(prev => ({ ...prev, status: 'recording', message: 'Recording...' }));
    }, []);

    const stopRecording = useCallback(() => {
        if (autoModeTimerRef.current) {
            clearTimeout(autoModeTimerRef.current);
        }
        isRecordingRef.current = false;
        setState(prev => ({ ...prev, status: 'idle', message: 'Stopped' }));

        sendClassificationRequest();
    }, [sendClassificationRequest]);

    const handleAutoModeTimeout = useCallback(() => {
        if (!isRecordingRef.current || ignoreMouseMoveRef.current) return;

        console.log("Auto-mode timeout, classifying...");
        if (autoModeTimerRef.current) {
            console.log("clearing timeout")
            clearTimeout(autoModeTimerRef.current);
        }
        sendClassificationRequest();

    }, [sendClassificationRequest]);


    useEffect(() => {
        // WebSocket Setup
        const wsUrl = API_BASE_URL.replace('http', 'ws') + '/ws/record';
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => console.log('WS Connected');

        ws.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.status === 'cursor_reset') {
                    ignoreMouseMoveRef.current = false;
                    console.log("Cursor reset, beginning recording sequence");
                    beginRecording();
                    return;
                }

                setState(data); // This updates UI

                // Protocol:
                // If we get a "finished" result (classification), check if we are in valid auto-mode state to continue.
                if (data.status === 'finished') {
                    if (settings?.auto_mode) {
                        if (isRecordingRef.current) { // Check if user hasn't manually stopped
                            ignoreMouseMoveRef.current = true;
                            startRecordingSequence();
                        }
                    } else {
                        isRecordingRef.current = false; // Stop recording
                    }
                }

            } catch (e) {
                console.error('Failed to parse WS message', e);
            }
        };

        ws.current.onclose = () => console.log('WS Disconnected');

        return () => {
            ws.current?.close();
        };
    }, [settings, beginRecording]); // Re-bind if settings change? Maybe just read settings from ref or state.


    useEffect(() => {
        const handleLeftClick = () => {
            if (isRecordingRef.current) {
                setState((s) => ({
                    status: 'finished',
                    symbol: '.',
                    confidence: 1,
                    candidates: [],
                    continue_recording: s.continue_recording
                }))
            }
        }
        const handleMouseMove = (e: MouseEvent) => {
            if (!isRecordingRef.current || ignoreMouseMoveRef.current) return;

            const now = Date.now() / 1000;
            const t = now - startTimeRef.current;
            const dt = now - lastMoveTimeRef.current;

            //could also use e.clientX/Y here
            const x = e.screenX;
            const y = e.screenY;

            // Stroke gap logic
            const strokeGap = 0.3; // Hardcoded or similar to python default
            if (dt > strokeGap && currentStrokeRef.current.length > 0) {
                strokesRef.current.push(currentStrokeRef.current);
                currentStrokeRef.current = [];
            }

            currentStrokeRef.current.push({ x, y, t });
            lastMoveTimeRef.current = now;

            // Auto Mode Timeout logic
            if (settings?.auto_mode) {
                if (autoModeTimerRef.current) {
                    clearTimeout(autoModeTimerRef.current);
                }
                const pause = settings.pause_threshold || 1.0;
                autoModeTimerRef.current = setTimeout(handleAutoModeTimeout, pause * 1000);
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('click', handleLeftClick);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('click', handleLeftClick);
            if (autoModeTimerRef.current) clearTimeout(autoModeTimerRef.current);
        };
    }, [settings, handleAutoModeTimeout]);

    const toggleRecording = () => {
        if (isRecordingRef.current) {
            // Stop
            stopRecording();
        } else {
            // Start
            startRecordingSequence();
        }
    };

    return { state, toggleRecording, isRecording: isRecordingRef.current };
}

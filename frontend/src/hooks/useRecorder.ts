import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '../config';

export interface RecorderState {
    status: 'idle' | 'recording' | 'finished' | 'error' | 'cursor_reset';
    message?: string;
    symbol?: string;
    confidence?: number;
    candidates?: Array<{ symbol: string; confidence: number }>;
    points?: Array<{ x: number, y: number, t: number }>;
    continue_recording?: boolean;
}

interface Point {
    x: number;
    y: number;
    t: number;
}

export function segmentStrokes(points: Point[]): Point[][] {
    if (points.length === 0) return [];
    if (points.length === 1) return [points];

    const deltas: number[] = [];
    for (let i = 1; i < points.length; i++) {
        deltas.push(points[i].t - points[i - 1].t);
    }

    if (deltas.length === 0) return [points];

    // Calculate median delta
    const sortedDeltas = [...deltas].sort((a, b) => a - b);
    const mid = Math.floor(sortedDeltas.length / 2);
    const median = sortedDeltas.length % 2 !== 0
        ? sortedDeltas[mid]
        : (sortedDeltas[mid - 1] + sortedDeltas[mid]) / 2;

    const threshold = Math.max(median * 10, 0.15);

    const strokes: Point[][] = [];
    let currentStroke: Point[] = [points[0]];

    for (let i = 1; i < points.length; i++) {
        const dt = points[i].t - points[i - 1].t;
        if (dt > threshold) {
            strokes.push(currentStroke);
            currentStroke = [];
        }
        currentStroke.push(points[i]);
    }
    strokes.push(currentStroke);

    return strokes;
}


export function useRecorder() {
    const [state, setState] = useState<RecorderState>({ status: 'idle' });
    const ws = useRef<WebSocket | null>(null);
    const [settings, setSettings] = useState<any>(null);

    const isRecordingRef = useRef(false);
    const ignoreMouseMoveRef = useRef(false);
    // flattened list of all points in the current recording session
    const pointsRef = useRef<Point[]>([]);

    // We still track lastMoveTime for auto-mode timeout logic (pause detection)
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

        const allPoints = pointsRef.current;
        if (allPoints.length === 0) return;

        console.log(`Sending classification request. Points: ${allPoints.length}`);
        ws.current.send(JSON.stringify({
            action: 'classify',
            points: allPoints
        }));

        // Reset local strokes
        pointsRef.current = [];
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

        pointsRef.current = [];
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
            const relativeT = now - startTimeRef.current;

            //could also use e.clientX/Y here
            const x = e.screenX;
            const y = e.screenY;

            pointsRef.current.push({ x, y, t: relativeT });
            lastMoveTimeRef.current = now;

            // Auto Mode Timeout logic (Pause detection)
            // This is separate from stroke segmentation. This detects when the user has "finished" the character.
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

import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '../config';

export interface Point {
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

    const threshold = Math.max(median * 10, 150);

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

export function useRecorder(manualMode: boolean = false) {
    const [isRecording, setIsRecording] = useState(false);
    const [recordedPoints, setRecordedPoints] = useState<Point[] | null>(null);
    const [settings, setSettings] = useState<any>(null);

    const isAuto = settings?.auto_mode && !manualMode;

    const ws = useRef<WebSocket | null>(null);
    const isRecordingRef = useRef(false);
    const pointsRef = useRef<Point[]>([]);

    const startTimeRef = useRef<number>(0);
    const autoModeTimerRef = useRef<number | undefined>(undefined);
    // Prevent spamming start
    const isStartingRef = useRef(false);
    // Ignore initial cursor jump
    const hasMovedRef = useRef(false);
    const startPosRef = useRef<{ x: number, y: number } | null>(null);

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/settings`)
            .then(res => res.json())
            .then(data => setSettings(data))
            .catch(err => console.error("Failed to fetch settings:", err));
    }, []);

    const startRecordingSequence = useCallback(() => {
        if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
            console.warn("WS not connected, cannot start recording sequence");
            return;
        }
        ws.current.send(JSON.stringify({
            action: 'set_cursor',
            x: Math.round(window.screenX + window.innerWidth / 2),
            y: Math.round(window.screenY + window.innerHeight / 2)
        }));
    }, []);

    const beginRecording = useCallback(() => {
        isStartingRef.current = false;
        pointsRef.current = [];
        startTimeRef.current = Date.now();
        setRecordedPoints(null);
        isRecordingRef.current = true;
        hasMovedRef.current = false;
        startPosRef.current = null;
        setIsRecording(true);
    }, []);

    const stopRecording = useCallback(() => {
        if (autoModeTimerRef.current) {
            clearTimeout(autoModeTimerRef.current);
        }
        isRecordingRef.current = false;
        setIsRecording(false);

        //in auto mode, only set recorded points when the timeout occurs
        if (!isAuto) {
            const finalPoints = [...pointsRef.current];
            setRecordedPoints(finalPoints.length > 0 ? finalPoints : null);
        }

        pointsRef.current = [];
    }, []);

    const handleAutoModeTimeout = useCallback(() => {
        if (!isRecordingRef.current) return;

        const finalPoints = [...pointsRef.current];
        setRecordedPoints(finalPoints.length > 0 ? finalPoints : null);
        startRecordingSequence();
    }, [startRecordingSequence]);

    useEffect(() => {
        const wsUrl = API_BASE_URL.replace('http', 'ws') + '/ws/record';
        ws.current = new WebSocket(wsUrl);

        // ws.current.onopen = () => console.log('Recorder WS Connected');
        ws.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.status === 'cursor_reset') {
                    beginRecording();
                }
            } catch (e) {
                console.error('Failed to parse Recorder WS message', e);
            }
        };
        // ws.current.onclose = () => console.log('Recorder WS Disconnected');

        return () => {
            ws.current?.close();
        };
    }, [beginRecording]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isRecordingRef.current) {
                return;
            }

            const x = e.screenX;
            const y = e.screenY;

            // Ignore initial cursor jitter/jump after programmatic centering
            if (!hasMovedRef.current) {
                if (!startPosRef.current) {
                    // Initialize start position on first move event
                    startPosRef.current = { x, y };
                    return;
                }

                const dx = x - startPosRef.current.x;
                const dy = y - startPosRef.current.y;
                // Only start recording once the user has moved at least 5px
                // This prevents "flicker" points from the OS centering the cursor
                if (dx * dx + dy * dy < 25) {
                    return;
                }

                hasMovedRef.current = true;
                // Retrospectively add the very first point so we don't lose the start of the stroke
                pointsRef.current.push({
                    x: startPosRef.current.x,
                    y: startPosRef.current.y,
                    t: Date.now() - startTimeRef.current
                });
            }

            const now = Date.now();
            const relativeT = now - startTimeRef.current;

            pointsRef.current.push({ x, y, t: relativeT });

            if (isAuto) {
                if (autoModeTimerRef.current) {
                    clearTimeout(autoModeTimerRef.current);
                }
                const pause = settings.pause_threshold || 1000;
                autoModeTimerRef.current = setTimeout(handleAutoModeTimeout, pause);
            }
        };

        const handleMouseDown = (e: MouseEvent) => {
            if (!isRecordingRef.current) {
                return;
            }

            const x = e.screenX;
            const y = e.screenY;
            const now = Date.now();
            const relativeT = now - startTimeRef.current;

            if (!hasMovedRef.current) {
                hasMovedRef.current = true;
            }

            pointsRef.current.push({ x, y, t: relativeT });

            if (isAuto) {
                if (autoModeTimerRef.current) {
                    clearTimeout(autoModeTimerRef.current);
                }
                const pause = settings.pause_threshold || 1000;
                autoModeTimerRef.current = setTimeout(handleAutoModeTimeout, pause);
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mousedown', handleMouseDown);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mousedown', handleMouseDown);
            if (autoModeTimerRef.current) clearTimeout(autoModeTimerRef.current);
        };
    }, [settings, handleAutoModeTimeout, stopRecording]);

    const toggleRecording = useCallback(() => {
        if (isStartingRef.current) return;
        if (isRecordingRef.current) {
            stopRecording();
        } else {
            isStartingRef.current = true;
            startRecordingSequence();
        }
    }, [startRecordingSequence, stopRecording]);

    return { isRecording, recordedPoints, toggleRecording };
}

import { useState, useEffect, useRef } from 'react';

export interface RecorderState {
    status: 'idle' | 'recording' | 'finished' | 'error';
    message?: string;
    symbol?: string;
    confidence?: number;
    candidates?: Array<{ symbol: string; confidence: number }>;
    strokes?: any;
    continue_recording?: boolean;
}

export function useRecorder() {
    const [state, setState] = useState<RecorderState>({ status: 'idle' });
    const ws = useRef<WebSocket | null>(null);

    useEffect(() => {
        // Protocol must match current page protocol (http -> ws, https -> wss)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Use window.location.host to respect proxy port in dev
        const wsUrl = `${protocol}//${window.location.host}/ws/record`;

        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
            console.log('WS Connected');
        };

        ws.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('WS Message:', data);
                setState(data);
            } catch (e) {
                console.error('Failed to parse WS message', e);
            }
        };

        ws.current.onclose = () => {
            console.log('WS Disconnected');
        };

        return () => {
            ws.current?.close();
        };
    }, []);

    const toggleRecording = () => {
        if (ws.current) {
            const message = JSON.stringify({ action: 'toggle' });
            ws.current.send(message);
        } else {
            console.error('WebSocket is not connected');
        }
    };

    return { state, toggleRecording };
}

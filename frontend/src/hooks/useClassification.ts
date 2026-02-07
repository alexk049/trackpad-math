import { useReducer, useEffect, useRef, useCallback } from 'react';
import { getWsUrl } from '../api/config';
import type { ClassificationState, Point } from '../types';

type Action =
    | { type: 'UPDATE'; payload: ClassificationState }
    | { type: 'START_CLASSIFYING' }
    | { type: 'RESET' };

function reducer(state: ClassificationState, action: Action): ClassificationState {
    switch (action.type) {
        case 'UPDATE':
            return action.payload;
        case 'START_CLASSIFYING':
            return { ...state, status: 'classifying' };
        case 'RESET':
            return { status: 'idle' };
        default:
            return state;
    }
}

export function useClassification() {
    const [state, dispatch] = useReducer(reducer, { status: 'idle' });
    const ws = useRef<WebSocket | null>(null);

    useEffect(() => {
        const wsUrl = getWsUrl('/ws/record');
        ws.current = new WebSocket(wsUrl);

        ws.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (['finished', 'error', 'idle'].includes(data.status)) {
                    dispatch({ type: 'UPDATE', payload: data });
                }
            } catch (e) {
                console.error('Failed to parse Classification WS message', e);
            }
        };

        return () => {
            ws.current?.close();
        };
    }, []);

    const classify = useCallback((points: Point[]) => {
        if (points.length === 0) return;

        if (ws.current?.readyState === WebSocket.OPEN) {
            dispatch({ type: 'START_CLASSIFYING' });
            ws.current.send(JSON.stringify({
                action: 'classify',
                points: points
            }));
        } else {
            console.warn('Classification WS not ready');
        }
    }, []);

    const reset = useCallback(() => {
        dispatch({ type: 'RESET' });
    }, []);

    return {
        classificationState: state,
        classify,
        reset
    };
}

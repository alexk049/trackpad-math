import { useReducer, useCallback } from 'react';

// State Types
export type TrainingStep = 'selection' | 'training' | 'completion';

export interface TrainingState {
    step: TrainingStep;
    selectedSymbols: Set<string>;
    trainingQueue: string[];
    currentSymbolIndex: number;
    recordCount: number;
    lastRecording: any[] | null;
    samplesPerSymbol: number;
}

// Action Types
type Action =
    | { type: 'TOGGLE_SYMBOL'; symbol: string }
    | { type: 'TOGGLE_CATEGORY'; symbols: string[]; checked: boolean }
    | { type: 'START_TRAINING' }
    | { type: 'RESTART' }
    | { type: 'SET_LAST_RECORDING'; points: any[] | null }
    | { type: 'NEXT_STEP_RECORDING' }
    | { type: 'FINISH_SESSION' }
    | { type: 'INIT_TRAINING'; symbols: string[] }
    | { type: 'SET_SAMPLES_PER_SYMBOL'; count: number }

const initialState: TrainingState = {
    step: 'selection',
    selectedSymbols: new Set(),
    trainingQueue: [],
    currentSymbolIndex: 0,
    recordCount: 0,
    lastRecording: null,
    samplesPerSymbol: 3,
};

function reducer(state: TrainingState, action: Action): TrainingState {
    switch (action.type) {
        case 'TOGGLE_SYMBOL': {
            const next = new Set(state.selectedSymbols);
            if (next.has(action.symbol)) next.delete(action.symbol);
            else next.add(action.symbol);
            return { ...state, selectedSymbols: next };
        }
        case 'TOGGLE_CATEGORY': {
            const next = new Set(state.selectedSymbols);
            action.symbols.forEach(s => {
                if (action.checked) next.add(s);
                else next.delete(s);
            });
            return { ...state, selectedSymbols: next };
        }
        case 'START_TRAINING': {
            if (state.selectedSymbols.size === 0) return state;
            return {
                ...state,
                step: 'training',
                trainingQueue: Array.from(state.selectedSymbols),
                currentSymbolIndex: 0,
                recordCount: 0,
                lastRecording: null,
            };
        }
        case 'RESTART': {
            return { ...initialState, samplesPerSymbol: state.samplesPerSymbol, selectedSymbols: new Set() };
        }
        case 'SET_LAST_RECORDING': {
            return { ...state, lastRecording: action.points };
        }
        case 'NEXT_STEP_RECORDING': {
            const nextCount = state.recordCount + 1;
            if (nextCount < state.samplesPerSymbol) {
                return { ...state, recordCount: nextCount, lastRecording: null };
            } else {
                // Next symbol?
                const nextIndex = state.currentSymbolIndex + 1;
                if (nextIndex < state.trainingQueue.length) {
                    return {
                        ...state,
                        currentSymbolIndex: nextIndex,
                        recordCount: 0,
                        lastRecording: null
                    };
                } else {
                    return { ...state, step: 'completion' };
                }
            }
        }
        case 'INIT_TRAINING': {
            const selected = new Set(action.symbols);
            if (selected.size === 0) return state;
            return {
                ...state,
                selectedSymbols: selected,
                step: 'training',
                trainingQueue: Array.from(selected),
                currentSymbolIndex: 0,
                recordCount: 0,
                lastRecording: null,
            };
        }
        case 'SET_SAMPLES_PER_SYMBOL': {
            return { ...state, samplesPerSymbol: action.count };
        }
        default:
            return state;
    }
}

export function useTrainingSession() {
    const [state, dispatch] = useReducer(reducer, initialState);

    const toggleSymbol = useCallback((symbol: string) => {
        dispatch({ type: 'TOGGLE_SYMBOL', symbol });
    }, []);

    const toggleCategory = useCallback((symbols: string[], checked: boolean) => {
        dispatch({ type: 'TOGGLE_CATEGORY', symbols, checked });
    }, []);

    const startTraining = useCallback(() => {
        dispatch({ type: 'START_TRAINING' });
    }, []);

    const restart = useCallback(() => {
        dispatch({ type: 'RESTART' });
    }, []);

    const initTraining = useCallback((symbols: string[]) => {
        dispatch({ type: 'INIT_TRAINING', symbols });
    }, []);

    const setLastRecording = useCallback((points: any[] | null) => {
        dispatch({ type: 'SET_LAST_RECORDING', points });
    }, []);

    const advanceProgress = useCallback(() => {
        dispatch({ type: 'NEXT_STEP_RECORDING' });
    }, []);

    const setSamplesPerSymbol = useCallback((count: number) => {
        dispatch({ type: 'SET_SAMPLES_PER_SYMBOL', count });
    }, []);

    // Derived state helpers
    const currentSymbol = state.trainingQueue[state.currentSymbolIndex];
    const isLastSample = state.recordCount === state.samplesPerSymbol - 1 && state.currentSymbolIndex === state.trainingQueue.length - 1;
    const progressLabel = `${state.recordCount + 1}/${state.samplesPerSymbol}`;

    return {
        state,
        toggleSymbol,
        toggleCategory,
        startTraining,
        restart,
        setLastRecording,
        advanceProgress,
        initTraining,
        setSamplesPerSymbol,
        // Helpers
        currentSymbol,
        isLastSample,
        progressLabel
    };
}

import { useReducer, useCallback } from 'react';

// State Types
export type TrainingStep = 'selection' | 'training' | 'completion';

export interface TrainingState {
    step: TrainingStep;
    selectedSymbols: Set<string>;
    trainingQueue: string[];
    currentSymbolIndex: number;
    recordCount: number; // 0, 1, 2
    lastRecording: any[] | null;
}

// Action Types
type Action =
    | { type: 'TOGGLE_SYMBOL'; symbol: string }
    | { type: 'TOGGLE_CATEGORY'; symbols: string[]; checked: boolean }
    | { type: 'START_TRAINING' }
    | { type: 'RESTART' }
    | { type: 'NEXT_RECORDING'; recording: any[] } // Temporary holding for display? No, logic is complex.
    // Simplifying: The hook should expose helpers, but maybe state is enough.
    | { type: 'SET_LAST_RECORDING'; points: any[] | null }
    | { type: 'NEXT_STEP_RECORDING' } // Advance counter/index
    | { type: 'FINISH_SESSION' }
    | { type: 'INIT_TRAINING'; symbols: string[] }

const initialState: TrainingState = {
    step: 'selection',
    selectedSymbols: new Set(),
    trainingQueue: [],
    currentSymbolIndex: 0,
    recordCount: 0,
    lastRecording: null,
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
            return { ...initialState, selectedSymbols: new Set() }; // Or keep selection? User logic was "Train More -> setStep(1), selected empty"
        }
        case 'SET_LAST_RECORDING': {
            return { ...state, lastRecording: action.points };
        }
        case 'NEXT_STEP_RECORDING': {
            // Logic: 0 -> 1 -> 2 -> Next Symbol -> Finish
            const nextCount = state.recordCount + 1;
            if (nextCount < 3) {
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
        // We need a new action type that sets selection AND starts
        dispatch({ type: 'INIT_TRAINING', symbols });
    }, []);

    const setLastRecording = useCallback((points: any[] | null) => {
        dispatch({ type: 'SET_LAST_RECORDING', points });
    }, []);

    // Encapsulate specific "Next" logic that involves API? 
    // The hook should probably just manage state. The Page can call the API.
    // But to update the counter, we need an action.
    const advanceProgress = useCallback(() => {
        dispatch({ type: 'NEXT_STEP_RECORDING' });
    }, []);

    // Derived state helpers
    const currentSymbol = state.trainingQueue[state.currentSymbolIndex];
    const isLastSample = state.recordCount === 2 && state.currentSymbolIndex === state.trainingQueue.length - 1;
    const progressLabel = `${state.recordCount + 1}/3`;

    return {
        state,
        toggleSymbol,
        toggleCategory,
        startTraining,
        restart,
        setLastRecording,
        advanceProgress,
        initTraining,
        // Helpers
        currentSymbol,
        isLastSample,
        progressLabel
    };
}

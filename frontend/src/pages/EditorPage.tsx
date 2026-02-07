import { useEffect, useState, useRef } from 'react';
import { apiClient } from '../api/client';
import { Box, Container } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { MathInput } from '../components/editor/MathInput';
import { RecordingOverlay } from '../components/editor/RecordingOverlay';
import { EditorControls } from '../components/editor/EditorControls';
import { useRecorder } from '../hooks/useRecorder';
import { useClassification } from '../hooks/useClassification';
import { useMathInput } from '../hooks/useMathInput';
import { useWheelNavigation } from '../hooks/useWheelNavigation';
import { useSettings } from '../hooks/useSettings';
import { useMantineColorScheme } from '@mantine/core';
import type { SymbolDefinition } from '../types';

export default function EditorPage() {
    const { colorScheme } = useMantineColorScheme();
    const [latex, setLatex] = useState(() => localStorage.getItem('equation_latex') || '');
    const [symbols, setSymbols] = useState<SymbolDefinition[]>([]);

    // Hooks
    const { settings } = useSettings();
    const {
        isRecording,
        recordedPoints,
        toggleRecording,
        resetRecording,
        isPaused,
        setIsPaused
    } = useRecorder();

    const {
        classificationState,
        classify,
        reset: resetClassification
    } = useClassification();

    const { mfRef, insertSymbol, focus } = useMathInput(symbols);

    useWheelNavigation(mfRef, settings);

    const [mvkVisible, setMvkVisible] = useState(true);
    const [mathKeyboardContainer, setMathKeyboardContainer] = useState<HTMLDivElement | null>(null);
    const mostRecentPoints = useRef<any>(null); // To store points for retraining

    // Initial Data Fetch
    useEffect(() => {
        apiClient<SymbolDefinition[]>('/api/labels')
            .then((data) => setSymbols(data))
            .catch((err: any) => console.error('Error fetching symbols:', err));
    }, []);

    // Persist Latex
    useEffect(() => {
        localStorage.setItem('equation_latex', latex);
    }, [latex]);

    // Manage UI State based on recording
    useEffect(() => {
        if (isRecording) {
            focus();
            setMvkVisible(false);
        } else {
            setMvkVisible(true);
        }
    }, [isRecording, focus]);

    // Handle Classification
    useEffect(() => {
        if (recordedPoints && recordedPoints.length > 0) {
            mostRecentPoints.current = recordedPoints;
            classify(recordedPoints);
        }
    }, [recordedPoints, classify]);

    // Handle Classification Result
    useEffect(() => {
        if (classificationState.status === 'finished' && classificationState.symbol) {
            const success = insertSymbol(classificationState.symbol);
            if (!success) {
                notifications.show({
                    title: 'Error',
                    message: 'Unknown symbol',
                    color: 'red'
                });
            }
        }
    }, [classificationState, insertSymbol]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                e.preventDefault();
                toggleRecording();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [toggleRecording]);

    // Cleanup recording on unload
    useEffect(() => {
        const handleUnload = () => {
            if (isRecording) {
                toggleRecording();
            }
        };
        window.addEventListener('beforeunload', handleUnload);
        document.addEventListener('visibilitychange', handleUnload);
        return () => {
            window.removeEventListener('beforeunload', handleUnload);
            document.removeEventListener('visibilitychange', handleUnload);
        };
    }, [isRecording, toggleRecording]);

    // Global Overflow fix (legacy)
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    // Handlers
    const handleSuggestionClick = (sym: string) => {
        mfRef.current?.executeCommand(['deleteBackward']);
        insertSymbol(sym);
    };

    const handleConfirmRetrain = async (symbol: string) => {
        if (!mostRecentPoints.current) {
            notifications.show({ title: 'Error', message: 'No point data available to learn from.', color: 'red' });
            return;
        }

        try {
            await apiClient('/api/teach', {
                method: 'POST',
                body: JSON.stringify({
                    label: symbol,
                    points: mostRecentPoints.current
                })
            });

            notifications.show({ title: 'Success', message: `Learned symbol: ${symbol}`, color: 'green' });
            resetClassification();
            resetRecording();
        } catch (e: any) {
            console.error(e);
            notifications.show({ title: 'Error', message: e.message || 'Failed to learn', color: 'red' });
        }
    };

    return (
        <Container size="md">
            <Box py="sm">
                <MathInput
                    ref={mfRef}
                    value={latex}
                    onChange={setLatex}
                    container={mathKeyboardContainer as HTMLElement}
                    mvkVisible={mvkVisible}
                />
            </Box>

            <RecordingOverlay
                visible={isRecording}
                onStop={toggleRecording}
                onPause={setIsPaused}
                candidates={classificationState.candidates || []}
                onSelectSuggestion={handleSuggestionClick}
                onConfirmSuggestion={handleConfirmRetrain}
            />

            <EditorControls
                isPaused={isPaused}
                isRecording={isRecording}
                onToggleRecording={toggleRecording}
            />

            <div
                id="math-keyboard-container"
                ref={setMathKeyboardContainer}
                className={colorScheme === 'dark' ? 'dark-mode' : ''}
            />
        </Container>
    );
}

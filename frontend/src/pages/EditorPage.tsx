import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../config';
import { Box, Button, Center, Container, Text, Notification } from '@mantine/core';
import { IconMicrophone } from '@tabler/icons-react';
import { MathInput } from '../components/MathInput';
import { useRecorder, type Point } from '../hooks/useRecorder';
import { RecordingOverlay } from '../components/RecordingOverlay';
import { useMantineColorScheme } from '@mantine/core';

export interface ClassificationState {
    status: 'idle' | 'classifying' | 'finished' | 'error';
    symbol?: string;
    confidence?: number;
    candidates?: Array<{ symbol: string; confidence: number }>;
    message?: string;
}

export default function EditorPage() {
    const { colorScheme } = useMantineColorScheme();
    const mfRef = useRef<any>(null);
    const [latex, setLatex] = useState(() => localStorage.getItem('equation_latex') || '');
    const { isRecording, recordedPoints, toggleRecording, resetRecording, isPaused, setIsPaused } = useRecorder();
    const [classificationState, setClassificationState] = useState<ClassificationState>({ status: 'idle' });
    const classificationWs = useRef<WebSocket | null>(null);
    const mostRecentPoints = useRef<Point[] | null>(null);
    const wheelAccumulatorX = useRef(0);
    const wheelAccumulatorY = useRef(0);
    const lastWheelTime = useRef(0);
    const lastWheelAxis = useRef<'x' | 'y' | null>(null);
    const [settings, setSettings] = useState<any>(null);
    const [mvkVisible, setMvkVisible] = useState(true);

    const [mathKeyboardContainer, setMathKeyboardContainer] = useState<HTMLDivElement | null>(null);
    const [notification, setNotification] = useState<{ title: string, message: string, color: string } | null>(null);

    const handleFocus = () => {
        if (mfRef.current && document.activeElement !== mfRef.current) {
            mfRef.current.focus();
        }
    };

    useEffect(() => {
        if (isRecording) {
            handleFocus();
            setMvkVisible(false);
        } else {
            setMvkVisible(true);
        }
    }, [isRecording]);

    useEffect(() => {
        fetch(`${API_BASE_URL()}/api/settings`)
            .then(res => res.json())
            .then(data => setSettings(data))
            .catch(err => console.error("Failed to fetch settings:", err));
    }, []);

    useEffect(() => {
        localStorage.setItem('equation_latex', latex);
    }, [latex]);

    // Classification WebSocket Setup
    useEffect(() => {
        const wsUrl = API_BASE_URL().replace('http', 'ws') + '/ws/record';
        classificationWs.current = new WebSocket(wsUrl);

        classificationWs.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.status === 'finished' || data.status === 'error' || data.status === 'idle') {
                    setClassificationState(data);
                }
            } catch (e) {
                console.error('Failed to parse Classification WS message', e);
            }
        };

        return () => {
            classificationWs.current?.close();
        };
    }, []);

    // Trigger classification when points change and save them for retraining
    useEffect(() => {
        if (recordedPoints && recordedPoints.length > 0) {
            mostRecentPoints.current = recordedPoints;

            if (classificationWs.current?.readyState === WebSocket.OPEN) {
                setClassificationState({ status: 'classifying' });
                classificationWs.current.send(JSON.stringify({
                    action: 'classify',
                    points: recordedPoints
                }));
            }
        }
    }, [recordedPoints]);

    const insertSymbol = (symbol: string) => {
        if (symbol === '/') {
            mfRef.current?.executeCommand(['insert', '\\frac{#@}{#?}']);
        } else if (symbol === 'square root') {
            mfRef.current?.executeCommand(['insert', '\\sqrt{#@}']);
        } else if (symbol === 'integral') {
            mfRef.current?.executeCommand(['insert', '\\int_{#?}^{#?} #@']);
        } else if (symbol === 'summation') {
            mfRef.current?.executeCommand(['insert', '\\sum_{#?}^{#?} #@']);
        } else if (symbol === 'plus minus') {
            mfRef.current?.executeCommand(['insert', '\\pm']);
        } else if (symbol === '^') {
            mfRef.current?.executeCommand(['insert', '^{#?}']);
        } else {
            mfRef.current?.executeCommand(['insert', symbol]);
        }
    };

    useEffect(() => {
        if (classificationState.status === 'finished' && classificationState.symbol) {
            insertSymbol(classificationState.symbol);
        }

    }, [classificationState]);

    // Wheel listener for cursor navigation, and focus on math field
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (document.activeElement !== mfRef.current) {
                return;
            }

            //prevent default for page scroll
            e.preventDefault();

            const now = Date.now();
            if (now - lastWheelTime.current > 150) {
                wheelAccumulatorX.current = 0;
                wheelAccumulatorY.current = 0;
                lastWheelAxis.current = null;
            }
            lastWheelTime.current = now;

            let dx = e.deltaX;
            let dy = e.deltaY;

            if (e.shiftKey && dx === 0) {
                dx = dy;
                dy = 0;
            }

            const thresholdX = settings?.equation_scroll_x_sensitivity ? 400 / settings.equation_scroll_x_sensitivity : 20;
            const thresholdY = settings?.equation_scroll_y_sensitivity ? 400 / settings.equation_scroll_y_sensitivity : 20;

            if (mfRef.current) {
                if (Math.abs(dx) > Math.abs(dy)) {
                    // X axis dominant
                    if (lastWheelAxis.current !== 'x') {
                        wheelAccumulatorX.current = 0;
                        wheelAccumulatorY.current = 0;
                        lastWheelAxis.current = 'x';
                    }
                    wheelAccumulatorX.current += dx;
                    const steps = Math.floor(Math.abs(wheelAccumulatorX.current) / thresholdX);
                    if (steps > 0) {
                        const direction = Math.sign(wheelAccumulatorX.current);
                        for (let i = 0; i < steps; i++) {
                            mfRef.current.executeCommand(direction > 0 ? 'moveToNextChar' : 'moveToPreviousChar');
                        }
                        wheelAccumulatorX.current -= steps * thresholdX * direction;
                    }
                } else if (Math.abs(dy) > Math.abs(dx)) {
                    // Y axis dominant
                    if (lastWheelAxis.current !== 'y') {
                        wheelAccumulatorX.current = 0;
                        wheelAccumulatorY.current = 0;
                        lastWheelAxis.current = 'y';
                    }
                    wheelAccumulatorY.current += dy;
                    const steps = Math.floor(Math.abs(wheelAccumulatorY.current) / thresholdY);
                    if (steps > 0) {
                        const direction = Math.sign(wheelAccumulatorY.current);
                        for (let i = 0; i < steps; i++) {
                            mfRef.current.executeCommand(direction > 0 ? 'moveDown' : 'moveUp');
                        }
                        wheelAccumulatorY.current -= steps * thresholdY * direction;
                    }
                }
            }
        };

        //focus the input when the component mounts
        handleFocus();
        window.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            window.removeEventListener('wheel', handleWheel);
        };
    }, [settings]);

    // Use effect to clean up recording on page unload/visibility change
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

    // Keyboard shortcut for recording
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // if (e.code === 'Space' && document.activeElement?.tagName !== 'MATH-FIELD') {
            if (e.code === 'Space') {
                e.preventDefault();
                toggleRecording();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [toggleRecording]);

    const handleSuggestionClick = (sym: string) => {
        mfRef.current?.executeCommand(['deleteBackward']);
        insertSymbol(sym);
    };

    const handleConfirmRetrain = async (symbol: string) => {
        if (!mostRecentPoints.current) {
            setNotification({ title: 'Error', message: 'No point data available to learn from.', color: 'red' });
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL()}/api/teach`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    label: symbol,
                    points: mostRecentPoints.current
                })
            });
            const data = await res.json();
            if (res.ok) {
                setNotification({ title: 'Success', message: `Learned symbol: ${symbol}`, color: 'green' });
                setClassificationState({ status: 'idle' });
                resetRecording();
            } else {
                setNotification({ title: 'Error', message: data.detail || 'Failed to learn', color: 'red' });
            }
        } catch (e) {
            setNotification({ title: 'Error', message: 'Network error', color: 'red' });
        }

        // Hide notification after 3s
        setTimeout(() => setNotification(null), 3000);
    };

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    return (
        <Container size="md">
            {notification && (
                <Notification
                    title={notification.title}
                    color={notification.color}
                    onClose={() => setNotification(null)}
                    style={{ position: 'fixed', top: 70, right: 20, zIndex: 1000 }}
                >
                    {notification.message}
                </Notification>
            )}

            <Box py="sm">
                <MathInput ref={mfRef} value={latex} onChange={setLatex} container={mathKeyboardContainer as HTMLElement} mvkVisible={mvkVisible} />
            </Box>

            <RecordingOverlay
                visible={isRecording}
                onStop={toggleRecording}
                onPause={setIsPaused}
                candidates={classificationState.candidates || []}
                onSelectSuggestion={handleSuggestionClick}
                onConfirmSuggestion={handleConfirmRetrain}
            />

            <Center my="sm" h={60} style={{ textAlign: 'center' }}>
                {isPaused ? (
                    <Text c="yellow" size="sm" fs="italic">Paused</Text>
                ) : isRecording ? (
                    <Text c="red" size="sm" fs="italic">Recording... (Space to stop)</Text>
                ) : (
                    <Button
                        size="xl"
                        color="blue"
                        leftSection={<IconMicrophone />}
                        onClick={toggleRecording}
                        variant="light"
                    >
                        Start Drawing (Space)
                    </Button>
                )}
            </Center>

            <div id="math-keyboard-container" ref={setMathKeyboardContainer} className={colorScheme === 'dark' ? 'dark-mode' : ''} />

        </Container>
    );
}

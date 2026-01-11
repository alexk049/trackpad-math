import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../config';
import { Box, Button, Center, Container, Text, Notification } from '@mantine/core';
import { IconMicrophone } from '@tabler/icons-react';
import { MathInput } from '../components/MathInput';
import { useRecorder, type Point } from '../hooks/useRecorder';
import { SuggestionsBox } from '../components/SuggestionsBox';
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
    const [latex, setLatex] = useState('');
    const { isRecording, recordedPoints, toggleRecording } = useRecorder();
    const [classificationState, setClassificationState] = useState<ClassificationState>({ status: 'idle' });
    const classificationWs = useRef<WebSocket | null>(null);
    const mostRecentPoints = useRef<Point[] | null>(null);
    const wheelAccumulatorX = useRef(0);
    const wheelAccumulatorY = useRef(0);
    const lastWheelTime = useRef(0);
    const lastWheelAxis = useRef<'x' | 'y' | null>(null);
    const [settings, setSettings] = useState<any>(null);

    const [mathKeyboardContainer, setMathKeyboardContainer] = useState<HTMLDivElement | null>(null);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [notification, setNotification] = useState<{ title: string, message: string, color: string } | null>(null);

    const handleFocus = () => {
        if (mfRef.current && document.activeElement !== mfRef.current) {
            mfRef.current.focus();
        }
    };

    if (isRecording) {
        handleFocus();
    }

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/settings`)
            .then(res => res.json())
            .then(data => setSettings(data))
            .catch(err => console.error("Failed to fetch settings:", err));
    }, []);

    // Classification WebSocket Setup
    useEffect(() => {
        const wsUrl = API_BASE_URL.replace('http', 'ws') + '/ws/record';
        classificationWs.current = new WebSocket(wsUrl);

        classificationWs.current.onopen = () => console.log('Classification WS Connected');
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
        classificationWs.current.onclose = () => console.log('Classification WS Disconnected');

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

    useEffect(() => {
        if (classificationState.status !== 'finished' || !classificationState.symbol) {
            return;
        }

        // insert symbol
        if (classificationState.symbol === '/') {
            mfRef.current?.executeCommand(['insert', '\\frac{#@}{#?}']);
        } else if (classificationState.symbol === 'square root') {
            mfRef.current?.executeCommand(['insert', '\\sqrt{#@}']);
        } else if (classificationState.symbol === 'integral') {
            mfRef.current?.executeCommand(['insert', '\\int_{#?}^{#?} #@']);
        } else if (classificationState.symbol === 'summation') {
            mfRef.current?.executeCommand(['insert', '\\sum_{#?}^{#?} #@']);
        } else {
            mfRef.current?.executeCommand(['insert', classificationState.symbol]);
        }

        // update suggestions
        if (classificationState.candidates && classificationState.candidates.length > 0) {
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
        }

        // // Auto-restart recording if in auto mode
        // if (settings?.auto_mode) {
        //     toggleRecording();
        // }
    }, [classificationState, settings, toggleRecording]);

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
        mfRef.current?.executeCommand(['insert', sym]);
    };

    const handleConfirmRetrain = async (symbol: string) => {
        if (!mostRecentPoints.current) {
            setNotification({ title: 'Error', message: 'No point data available to learn from.', color: 'red' });
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/teach`, {
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
                setShowSuggestions(false); // Hide after successful learn
            } else {
                setNotification({ title: 'Error', message: data.detail || 'Failed to learn', color: 'red' });
            }
        } catch (e) {
            setNotification({ title: 'Error', message: 'Network error', color: 'red' });
        }

        // Hide notification after 3s
        setTimeout(() => setNotification(null), 3000);
    };

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
                <MathInput ref={mfRef} value={latex} onChange={setLatex} container={mathKeyboardContainer as HTMLElement} />
            </Box>

            {/* Suggestions */}
            <SuggestionsBox
                candidates={classificationState.candidates || []}
                onSelect={handleSuggestionClick}
                onConfirmRetrain={handleConfirmRetrain}
                onClose={() => setShowSuggestions(false)}
                visible={showSuggestions}
            />

            <Center my="sm">
                <Button
                    size="xl"
                    color={isRecording ? 'red' : 'blue'}
                    leftSection={<IconMicrophone />}
                    onClick={toggleRecording}
                    variant={isRecording ? 'filled' : 'light'}
                    style={{
                        transition: 'all 0.2s',
                        transform: isRecording ? 'scale(1.1)' : 'scale(1)',
                        boxShadow: isRecording ? '0 0 20px rgba(255, 0, 0, 0.5)' : 'none'
                    }}
                >
                    {isRecording ? 'Recording... (Space)' : 'Start Drawing (Space)'}
                </Button>
            </Center>

            <Box h={40} style={{ textAlign: 'center' }}>
                {isRecording && (
                    <Text c="red" size="sm" fs="italic">Hold still to finish...</Text>
                )}
                {/* {state.status === 'finished' && (
                    <Text size="xl" fw={700} c="blue">
                        Detected: {state.symbol} <Text span size="sm" c="dimmed">({(state.confidence || 0).toFixed(2)})</Text>
                    </Text>
                )}
                {state.status === 'idle' && state.message && (
                    <Text c="dimmed" size="sm">{state.message}</Text>
                )} */}
            </Box>


            <div id="math-keyboard-container" ref={setMathKeyboardContainer} className={colorScheme === 'dark' ? 'dark-mode' : ''} />

        </Container>
    );
}

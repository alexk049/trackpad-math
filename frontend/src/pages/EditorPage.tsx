import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../config';
import { Box, Button, Center, Container, Text, Notification } from '@mantine/core';
import { IconMicrophone } from '@tabler/icons-react';
import { MathInput } from '../components/MathInput';
import { useRecorder, type RecorderState } from '../hooks/useRecorder';
import { SuggestionsBox } from '../components/SuggestionsBox';
import { useMantineColorScheme } from '@mantine/core';

export default function EditorPage() {
    const { colorScheme } = useMantineColorScheme();
    const mfRef = useRef<any>(null);
    const [latex, setLatex] = useState('');
    const { state, toggleRecording } = useRecorder();
    const mostRecentState = useRef<RecorderState | undefined>(undefined);
    const [mathKeyboardContainer, setMathKeyboardContainer] = useState<HTMLDivElement | null>(null);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [notification, setNotification] = useState<{ title: string, message: string, color: string } | null>(null);
    const isRecording = state.status === 'recording' || state.continue_recording;

    const handleFocus = () => {
        if (mfRef.current && document.activeElement !== mfRef.current) {
            mfRef.current.focus();
        }
    };

    if (isRecording) {
        handleFocus();
    }

    useEffect(() => {
        if (state.status !== 'finished') {
            return;
        }
        // insert symbol
        if (state.symbol === '/') {
            //https://mathlive.io/mathfield/guides/virtual-keyboard/#placeholder-tokens
            mfRef.current?.executeCommand(['insert', '\\frac{#@}{#?}']);
        } else {
            mfRef.current?.executeCommand(['insert', state.symbol]);
        }

        // update suggestions, if necessary
        mostRecentState.current = state
        if (state.candidates && state.candidates.length > 0) {
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
        }
    }, [state]);

    // Wheel listener for cursor navigation, and focus on math field
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (document.activeElement !== mfRef.current) {
                return;
            }

            //prevent default for page scroll might be annoying if content overflows.
            e.preventDefault();

            let dx = e.deltaX;
            let dy = e.deltaY;

            if (e.shiftKey && dx === 0) {
                dx = dy;
                dy = 0;
            }

            // Hardcoded sensitivity for now or fetch from settings context if we had one
            // Default 10 from original
            const sensitivity = 10;
            const threshold = Math.max(0.5, 40 / sensitivity);

            if (mfRef.current) {
                if (Math.abs(dx) > Math.abs(dy)) {
                    if (dx < -threshold) {
                        mfRef.current.executeCommand('moveToPreviousChar');
                    } else if (dx > threshold) {
                        mfRef.current.executeCommand('moveToNextChar');
                    }
                } else {
                    if (dy < -threshold) {
                        mfRef.current.executeCommand('moveUp');
                    } else if (dy > threshold) {
                        mfRef.current.executeCommand('moveDown');
                    }
                }
            }
        };

        //focus the input when the component mounts
        handleFocus();

        window.addEventListener('wheel', handleWheel, { passive: false });
        // document.addEventListener('click', handleFocus);

        return () => {
            // document.removeEventListener('click', handleFocus);
            window.removeEventListener('wheel', handleWheel);
        };
    }, []);

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
        console.log(mostRecentState.current?.strokes);
        if (!mostRecentState.current?.strokes) {
            setNotification({ title: 'Error', message: 'No stroke data available to learn from.', color: 'red' });
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/teach`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    label: symbol,
                    strokes: mostRecentState.current?.strokes
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

            <Box py="xl">
                <MathInput ref={mfRef} value={latex} onChange={setLatex} container={mathKeyboardContainer as HTMLElement} />
            </Box>

            {/* Suggestions */}
            <SuggestionsBox
                candidates={mostRecentState.current?.candidates || []}
                onSelect={handleSuggestionClick}
                onConfirmRetrain={handleConfirmRetrain}
                onClose={() => setShowSuggestions(false)}
                visible={showSuggestions}
            />

            <Center my="lg">
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
                {state.status === 'finished' && (
                    <Text size="xl" fw={700} c="blue">
                        Detected: {state.symbol} <Text span size="sm" c="dimmed">({(state.confidence || 0).toFixed(2)})</Text>
                    </Text>
                )}
                {state.status === 'idle' && state.message && (
                    <Text c="dimmed" size="sm">{state.message}</Text>
                )}
            </Box>


            <div id="math-keyboard-container" ref={setMathKeyboardContainer} className={colorScheme === 'dark' ? 'dark-mode' : ''} />

        </Container>
    );
}

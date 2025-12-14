import { useEffect, useRef, useState } from 'react';
import { ActionIcon, AppShell, Box, Button, Center, Chip, Container, Group, Text, Title } from '@mantine/core';
import { IconSettings, IconMicrophone } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { MathInput } from '../components/MathInput';
import { useRecorder } from '../hooks/useRecorder';

export default function EditorPage() {
    const navigate = useNavigate();
    const mfRef = useRef<any>(null);
    const [latex, setLatex] = useState('');
    const { state, toggleRecording } = useRecorder();
    const mostRecentCandidates = useRef<{ symbol: string; confidence: number }[] | undefined>(undefined);

    const isRecording = state.status === 'recording' || state.continue_recording;

    // Wheel listener for cursor navigation
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            // Don't intercept if scrolling another element
            // But here we listen on window as per original logic

            // Original logic checks if settings modal is visible. 
            // In React router, checking path is cleaner, but let's assume if we are on this page, we listen.
            // However, prevent default for page scroll might be annoying if content overflows.
            // But the original app prevented default on window.

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

        window.addEventListener('wheel', handleWheel, { passive: false });
        return () => window.removeEventListener('wheel', handleWheel);
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

        // Cleanup function to remove listeners
        return () => {
            window.removeEventListener('beforeunload', handleUnload);
            document.removeEventListener('visibilitychange', handleUnload);
        };
    }, [isRecording, toggleRecording]);

    // Keyboard shortcut for recording
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.code === 'Space' && document.activeElement?.tagName !== 'MATH-FIELD') {
                e.preventDefault();
                toggleRecording();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [toggleRecording]);

    // Insert symbol when detected
    useEffect(() => {
        if (state.candidates && state.candidates.length > 0 || state.status === 'finished') {
            mostRecentCandidates.current = state.candidates;
        }
        if (state.status === 'finished' && state.symbol) {
            mfRef.current?.executeCommand(['insert', state.symbol]);
        }
    }, [state]);

    const handleSuggestionClick = (sym: string) => {
        mfRef.current?.executeCommand(['insert', sym]);
    };

    return (
        <AppShell header={{ height: 60 }} padding="md">
            <AppShell.Header>
                <Group h="100%" px="md" justify="space-between">
                    <Title order={3}>TrackpadChars</Title>
                    <ActionIcon variant="subtle" size="lg" onClick={() => navigate('/settings/training')}>
                        <IconSettings />
                    </ActionIcon>
                </Group>
            </AppShell.Header>

            <AppShell.Main>
                <Container size="md">
                    <Box py="xl">
                        <MathInput ref={mfRef} value={latex} onChange={setLatex} />
                    </Box>

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

                    {/* Suggestions */}
                    {mostRecentCandidates.current && mostRecentCandidates.current.length > 0 && (
                        <Box mt="md" p="md" style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 8 }}>
                            <Text size="sm" mb="xs" c="dimmed">Did you mean something else?</Text>
                            <Group gap="xs">
                                {mostRecentCandidates.current.map((c) => (
                                    <Chip
                                        key={c.symbol}
                                        onClick={() => handleSuggestionClick(c.symbol)}
                                        variant="light"
                                    >
                                        {c.symbol} <Text span size="xs" c="dimmed">({c.confidence.toFixed(2)})</Text>
                                    </Chip>
                                ))}
                            </Group>
                        </Box>
                    )}

                </Container>
            </AppShell.Main>
        </AppShell>
    );
}

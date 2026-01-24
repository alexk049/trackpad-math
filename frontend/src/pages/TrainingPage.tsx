import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Container, Title, Accordion, Checkbox, Button, Group, Text, Stack, Card, Center } from '@mantine/core';
import { API_BASE_URL } from '../config';
import { IconRefresh, IconCheck, IconPlayerRecord } from '@tabler/icons-react';
import { useRecorder } from '../hooks/useRecorder';

// --- Types ---
interface SymbolItem {
    symbol: string;
    description: string;
    latex: string;
}

interface Category {
    name: string;
    items: SymbolItem[];
}

import { StrokeCanvas } from '../components/StrokeCanvas';

// --- Main Page ---

export default function TrainingPage() {
    const [searchParams] = useSearchParams();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [categories, setCategories] = useState<Category[]>([]);

    // Step 1 State
    const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(new Set());

    // Step 2 State
    const [trainingQueue, setTrainingQueue] = useState<string[]>([]);
    const [currentSymbolIndex, setCurrentSymbolIndex] = useState(0);
    const [recordCount, setRecordCount] = useState(0); // 0, 1, 2 (target 3)

    // Recording
    const { isRecording, recordedPoints, toggleRecording, stopRecording } = useRecorder(true);
    const [lastRecording, setLastRecording] = useState<any[] | null>(null);

    // Fetch categories
    useEffect(() => {
        fetch(`${API_BASE_URL}/api/symbols/categorized`)
            .then(res => res.json())
            .then(setCategories)
            .catch(err => console.error("Failed to fetch symbols", err));
    }, []);

    // Handle initial symbol from URL
    useEffect(() => {
        const symbol = searchParams.get('symbol');
        if (symbol) {
            setTrainingQueue([symbol]);
            setStep(2);
        }
    }, [searchParams]);

    // Watch for recording finish
    useEffect(() => {
        if (recordedPoints && recordedPoints.length > 0) {
            setLastRecording(recordedPoints);
        }
    }, [recordedPoints]);

    // Space bar handler for recording
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && step === 2) {
                e.preventDefault();
                toggleRecording();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [toggleRecording, step]);

    // Step 1: Selection Logic
    const toggleSymbol = (sym: string) => {
        const next = new Set(selectedSymbols);
        if (next.has(sym)) next.delete(sym);
        else next.add(sym);
        setSelectedSymbols(next);
    };

    const toggleCategory = (cat: Category, checked: boolean) => {
        const next = new Set(selectedSymbols);
        cat.items?.forEach(item => {
            if (checked) next.add(item.symbol);
            else next.delete(item.symbol);
        });
        setSelectedSymbols(next);
    };

    const startTraining = () => {
        if (selectedSymbols.size === 0) return;
        setTrainingQueue(Array.from(selectedSymbols));
        setCurrentSymbolIndex(0);
        setRecordCount(0);
        setStep(2);
        setLastRecording(null);
    };

    // Step 2: Training Logic
    const currentSymbol = trainingQueue[currentSymbolIndex];

    const handleRedraw = () => {
        setLastRecording(null);
        toggleRecording();
    };

    const handleNextRecording = async () => {
        if (!lastRecording) return;

        // Save the recording
        try {
            await fetch(`${API_BASE_URL}/api/teach`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: currentSymbol, points: lastRecording })
            });
        } catch (e) {
            console.error("Failed to save", e);
            // Optionally handle error
        }

        setLastRecording(null);

        if (recordCount < 2) {
            setRecordCount(c => c + 1);
            toggleRecording();
        } else {
            // Finished 3 for this symbol
            if (currentSymbolIndex < trainingQueue.length - 1) {
                setCurrentSymbolIndex(i => i + 1);
                setRecordCount(0);
            } else {
                setStep(3);
            }
        }
    };

    // --- Render ---

    if (step === 1) {
        return (
            <Container size="sm" py="xl">
                <Title mb="lg">Select Symbols to Train</Title>
                <Stack>
                    <Button
                        size="lg"
                        onClick={startTraining}
                        disabled={selectedSymbols.size === 0}
                        mt="xl"
                        fullWidth
                    >
                        Start Training ({selectedSymbols.size} symbols)
                    </Button>

                    <Accordion multiple variant="separated">
                        {categories.map((cat) => {
                            const allSelected = cat.items?.every(s => selectedSymbols.has(s.symbol)) ?? false;
                            const someSelected = cat.items?.some(s => selectedSymbols.has(s.symbol)) ?? false;

                            return (
                                <Accordion.Item key={cat.name} value={cat.name}>
                                    <Accordion.Control>
                                        <Group justify="space-between" pr="md">
                                            <Text fw={500}>{cat.name}</Text>
                                            <Checkbox
                                                checked={allSelected}
                                                indeterminate={someSelected && !allSelected}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleCategory(cat, !allSelected);
                                                }}
                                                readOnly
                                            />
                                        </Group>
                                    </Accordion.Control>
                                    <Accordion.Panel>
                                        <Group gap="md">
                                            {cat.items?.map(item => (
                                                <Checkbox
                                                    key={item.symbol}
                                                    label={
                                                        <div style={{ lineHeight: 1.2 }}>
                                                            <Group gap="xs" align="center">
                                                                <Text size="sm">{item.symbol}</Text>
                                                            </Group>
                                                            <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                                                                {item.description}
                                                            </Text>
                                                        </div>
                                                    }
                                                    checked={selectedSymbols.has(item.symbol)}
                                                    onChange={() => toggleSymbol(item.symbol)}
                                                    style={{ width: 'calc(33% - 16px)', alignItems: 'flex-start' }}
                                                />
                                            ))}
                                        </Group>
                                    </Accordion.Panel>
                                </Accordion.Item>
                            );
                        })}
                    </Accordion>
                </Stack>
            </Container>
        );
    }

    if (step === 2) {
        return (
            <Center h="80vh">
                <Stack align="center" gap="xl">
                    <Title order={2}>
                        Draw "{currentSymbol}" ({recordCount + 1}/3)
                    </Title>

                    {lastRecording ? (
                        <StrokeCanvas points={lastRecording} />
                    ) : (
                        <Card withBorder p={50} style={{ borderStyle: 'dashed' }}>
                            <Text c="dimmed">Waiting for recording...</Text>
                        </Card>
                    )}

                    <Text size="lg" c="dimmed">
                        {isRecording ? "Released to stop..." : "Press Space or 'Record' to start"}
                    </Text>
                    {!lastRecording && !isRecording && (
                        <Button
                            size="xl"
                            color="blue"
                            leftSection={<IconPlayerRecord />}
                            onClick={toggleRecording}
                            style={{ pointerEvents: 'all', width: 200 }}
                        >
                            Record
                        </Button>
                    )}
                    {lastRecording && (
                        <Group>
                            <Button
                                size="xl"
                                variant="default"
                                leftSection={<IconRefresh />}
                                onClick={handleRedraw}
                                style={{ pointerEvents: 'all' }}
                            >
                                Redraw
                            </Button>
                            <Button
                                size="xl"
                                color="green"
                                leftSection={<IconCheck />}
                                onClick={handleNextRecording}
                                style={{ pointerEvents: 'all' }}
                            >
                                Next
                            </Button>
                        </Group>
                    )}
                </Stack>
            </Center>
        );
    }

    if (step === 3) {
        return (
            <Container size="sm" py="xl" style={{ textAlign: 'center', marginTop: 100 }}>
                <IconCheck size={100} color="green" style={{ marginBottom: 20 }} />
                <Title order={1} mb="md">Training Complete!</Title>
                <Text size="lg" mb="xl">You have successfully trained {trainingQueue.length} symbols.</Text>
                <Button size="lg" onClick={() => setStep(1)}>Train More</Button>
            </Container>
        );
    }

    return null;
}

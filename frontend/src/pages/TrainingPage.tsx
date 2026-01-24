import { useEffect, useState, useRef } from 'react';
import { Container, Title, Accordion, Checkbox, Button, Group, Text, Stack, Card, Center } from '@mantine/core';
import { API_BASE_URL } from '../config';
import { IconPlayerStop, IconRefresh, IconCheck, IconPlayerRecord } from '@tabler/icons-react';
import { useRecorder, segmentStrokes } from '../hooks/useRecorder';

// --- Types ---
interface SymbolItem {
    symbol: string;
    description: string;
}

interface Category {
    name: string;
    items: SymbolItem[];
}

// --- Components ---

function CanvasPreview({ points }: { points: any[] }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current || !points) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        // Background
        ctx.fillStyle = "transparent";
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        if (points.length === 0) return;

        ctx.strokeStyle = '#228be6';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Calculate bounds to center/scale
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        points.forEach(pt => {
            if (pt.x < minX) minX = pt.x;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.y > maxY) maxY = pt.y;
        });

        const strokes = segmentStrokes(points);
        const width = maxX - minX || 1;
        const height = maxY - minY || 1;
        const scale = Math.min(250 / width, 250 / height) * 0.8; // 0.8 padding
        const offsetX = (300 - width * scale) / 2;
        const offsetY = (300 - height * scale) / 2;

        strokes.forEach(stroke => {
            if (stroke.length === 0) return;
            ctx.beginPath();
            if (stroke.length === 1) {
                const x = (stroke[0].x - minX) * scale + offsetX;
                const y = (stroke[0].y - minY) * scale + offsetY;
                ctx.arc(x, y, ctx.lineWidth * 1.2, 0, Math.PI * 2);
                ctx.fillStyle = ctx.strokeStyle;
                ctx.fill();
            } else {
                ctx.moveTo((stroke[0].x - minX) * scale + offsetX, (stroke[0].y - minY) * scale + offsetY);
                for (let i = 1; i < stroke.length; i++) {
                    ctx.lineTo((stroke[i].x - minX) * scale + offsetX, (stroke[i].y - minY) * scale + offsetY);
                }
                ctx.stroke();
            }
        });

    }, [points]);

    return (
        <Center style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 8, padding: 20 }}>
            <canvas ref={canvasRef} width={300} height={300} />
        </Center>
    );
}

// --- Main Page ---

export default function TrainingPage() {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [categories, setCategories] = useState<Category[]>([]);

    // Step 1 State
    const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(new Set());

    // Step 2 State
    const [trainingQueue, setTrainingQueue] = useState<string[]>([]);
    const [currentSymbolIndex, setCurrentSymbolIndex] = useState(0);
    const [recordCount, setRecordCount] = useState(0); // 0, 1, 2 (target 3)

    // Recording
    const { isRecording, recordedPoints, toggleRecording } = useRecorder(true);
    const [lastRecording, setLastRecording] = useState<any[] | null>(null);

    // Fetch categories
    useEffect(() => {
        fetch(`${API_BASE_URL}/api/symbols/categorized`)
            .then(res => res.json())
            .then(setCategories)
            .catch(err => console.error("Failed to fetch symbols", err));
    }, []);

    // Watch for recording finish
    useEffect(() => {
        if (recordedPoints && recordedPoints.length > 0) {
            setLastRecording(recordedPoints);
        }
    }, [recordedPoints]);

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
        // We need to re-record. 
        // If recording was active, it stopped when we got points.
        // User clicks "Redraw", we clear the preview.
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
                                                            <Text size="sm">{item.description}</Text>
                                                            <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                                                                {item.symbol}
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

                    <Button
                        size="lg"
                        onClick={startTraining}
                        disabled={selectedSymbols.size === 0}
                        mt="xl"
                        fullWidth
                    >
                        Start Training ({selectedSymbols.size} symbols)
                    </Button>
                </Stack>
            </Container>
        );
    }

    if (step === 2) {
        return (
            <div style={{ position: 'relative', height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <Title order={2} mb="xl">
                    Draw "{currentSymbol}" ({recordCount + 1}/3)
                </Title>

                {/* Main Content Area */}
                <Stack align="center" gap="xl">
                    {lastRecording ? (
                        <CanvasPreview points={lastRecording} />
                    ) : (
                        <Card withBorder p={50} style={{ borderStyle: 'dashed' }}>
                            <Text c="dimmed">Waiting for recording...</Text>
                        </Card>
                    )}

                    <Text size="lg" c="dimmed">
                        {isRecording ? "Released to stop..." : "Press Space or 'Record' to start"}
                    </Text>
                </Stack>

                {/* Overlay Controls */}
                <div style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: 40,
                    display: 'flex',
                    justifyContent: 'space-between',
                    pointerEvents: 'none' // Allow clicking through if needed, but buttons need pointerEvents: all
                }}>
                    <Button
                        size="xl"
                        color={isRecording ? "red" : "blue"}
                        leftSection={isRecording ? <IconPlayerStop /> : <IconPlayerRecord />}
                        onClick={toggleRecording}
                        style={{ pointerEvents: 'all', width: 200 }}
                    >
                        {isRecording ? "Stop Recording" : "Record"}
                    </Button>

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
                </div>
            </div>
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

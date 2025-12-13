import { useEffect, useRef, useState } from 'react';
import { Table, Button, Group, Title, FileButton, Modal, Text, ScrollArea, Card, Center, useMantineColorScheme, ActionIcon } from '@mantine/core';
import { IconUpload, IconDownload, IconSchool, IconEye } from '@tabler/icons-react';
import { useRecorder } from '../../hooks/useRecorder';

interface LabelData {
    label: string;
    count: number;
}

interface Drawing {
    id: string;
    label: string;
    timestamp: string;
    strokes: Array<Array<{ x: number, y: number, t: number }>>;
}

export default function TrainingPage() {
    const [data, setData] = useState<LabelData[]>([]);
    const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
    const [showDataViewer, setShowDataViewer] = useState(false);

    // Data Viewer State
    const [drawings, setDrawings] = useState<Drawing[]>([]);
    const [selectedDrawing, setSelectedDrawing] = useState<Drawing | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { colorScheme } = useMantineColorScheme();

    // Teach State
    const [teachModalOpen, setTeachModalOpen] = useState(false);
    const { state: recorderState, toggleRecording } = useRecorder();

    const fetchLabels = async () => {
        const res = await fetch('/api/labels');
        const json = await res.json();
        setData(json);
    };

    const fetchDrawings = async () => {
        if (!selectedLabel) return;
        // Assuming API supports filtering or we fetch all and filter
        // For efficiency in a real app better to filter on backend, but here we might just fetch all if no filter
        // Attempt to pass label param
        const res = await fetch(`/api/drawings?limit=1000`);
        const json: Drawing[] = await res.json();
        // Client side filter for now as we don't know if backend supports it
        const filtered = json.filter(d => d.label === selectedLabel);
        setDrawings(filtered);
    };

    useEffect(() => {
        fetchLabels();
    }, []);

    useEffect(() => {
        if (showDataViewer && selectedLabel) {
            fetchDrawings();
            setSelectedDrawing(null);
        }
    }, [showDataViewer, selectedLabel]);

    // Data Viewing Canvas Logic
    useEffect(() => {
        if (!selectedDrawing || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        // Theme aware background
        const isDark = colorScheme === 'dark';
        ctx.fillStyle = isDark ? '#1A1B1E' : '#fff';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        ctx.strokeStyle = '#228be6'; // Blue
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        selectedDrawing.strokes.forEach(stroke => {
            stroke.forEach(pt => {
                if (pt.x < minX) minX = pt.x;
                if (pt.x > maxX) maxX = pt.x;
                if (pt.y < minY) minY = pt.y;
                if (pt.y > maxY) maxY = pt.y;
            });
        });

        const width = maxX - minX || 1;
        const height = maxY - minY || 1;
        const scale = Math.min(250 / width, 250 / height);
        const offsetX = (300 - width * scale) / 2;
        const offsetY = (300 - height * scale) / 2;

        selectedDrawing.strokes.forEach(stroke => {
            if (stroke.length === 0) return;
            ctx.beginPath();
            ctx.moveTo(
                (stroke[0].x - minX) * scale + offsetX,
                (stroke[0].y - minY) * scale + offsetY
            );
            for (let i = 1; i < stroke.length; i++) {
                ctx.lineTo(
                    (stroke[i].x - minX) * scale + offsetX,
                    (stroke[i].y - minY) * scale + offsetY
                );
            }
            ctx.stroke();
        });
    }, [selectedDrawing, colorScheme]);


    // --- Import / Export ---
    const handleImport = async (file: File | null) => {
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        await fetch('/api/data/import', { method: 'POST', body: formData });
        fetchLabels();
    };

    const handleExport = () => {
        window.location.href = '/api/data/export';
    };

    // --- Teach Logic ---
    useEffect(() => {
        if (teachModalOpen && selectedLabel && recorderState.status === 'finished' && recorderState.strokes) {
            saveStrokes(selectedLabel, recorderState.strokes);
        }
    }, [recorderState, teachModalOpen, selectedLabel]);

    const saveStrokes = async (label: string, strokes: any) => {
        try {
            await fetch('/api/teach', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label, strokes })
            });
            fetchLabels();
        } catch (e) {
            console.error(e);
        }
    };

    // Space key handler for Teach Modal
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // Only toggle if modal is open!
            if (teachModalOpen && e.code === 'Space') {
                e.preventDefault();
                e.stopPropagation();
                toggleRecording();
            }
        };
        // Use capture to ensure we get it before modal's restrictive focus trapping might interfere
        window.addEventListener('keydown', handler, true);
        return () => window.removeEventListener('keydown', handler, true);
    }, [teachModalOpen, toggleRecording]);


    const rows = data.map((item) => {
        const isSelected = selectedLabel === item.label;
        return (
            <Table.Tr
                key={item.label}
                onClick={() => {
                    if (isSelected) {
                        // Deselect? checking requirements "allow single rows to be selected"
                        // Maybe toggle? for now let's allow changing selection
                        // If we click again, maybe keep selected.
                        // If we click another, change.
                    }
                    setSelectedLabel(item.label);
                    // Hide data viewer when changing labels? Or keep open and refresh?
                    // User says: "When a row is selected... two buttons appear... teach and view... view button will unhide data viewer"
                    // This implies data viewer hides by default or when selection changes?
                    // I will keep it open if it was already open, but refresh data.
                }}
                bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}
                style={{ cursor: 'pointer' }}
            >
                <Table.Td style={{ fontFamily: 'monospace', fontSize: '1.2em' }}>{item.label}</Table.Td>
                <Table.Td>{item.count}</Table.Td>
            </Table.Tr>
        );
    });

    return (
        <div style={{ padding: 20 }}>
            <Group justify="space-between" mb="lg" align="center">
                <Title order={2}>Training Data</Title>
                <Group>
                    {selectedLabel && (
                        <Group gap="xs" mr="xl">
                            <Button
                                onClick={() => setTeachModalOpen(true)}
                                leftSection={<IconSchool size={16} />}
                            >
                                Teach
                            </Button>
                            <Button
                                onClick={() => setShowDataViewer(true)}
                                variant={showDataViewer ? "filled" : "outline"}
                                leftSection={<IconEye size={16} />}
                            >
                                View
                            </Button>
                        </Group>
                    )}

                    <FileButton onChange={handleImport} accept="application/json">
                        {(props) => <Button {...props} leftSection={<IconUpload size={16} />} variant="default">Import</Button>}
                    </FileButton>
                    <Button onClick={handleExport} leftSection={<IconDownload size={16} />} variant="default">Export</Button>
                </Group>
            </Group>

            <Group align="flex-start" wrap="nowrap">
                {/* Main Table */}
                <div style={{ flex: 1, minWidth: 300 }}>
                    <ScrollArea h={600}>
                        <Table stickyHeader striped highlightOnHover>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Symbol</Table.Th>
                                    <Table.Th>Count</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>{rows}</Table.Tbody>
                        </Table>
                    </ScrollArea>
                </div>

                {/* Data Viewer Side Panel */}
                {showDataViewer && selectedLabel && (
                    <Card withBorder style={{ width: 450, height: 600, display: 'flex', flexDirection: 'column' }} p="md">
                        <Group justify="space-between" mb="md">
                            <Title order={4}>Data: {selectedLabel}</Title>
                            <ActionIcon onClick={() => setShowDataViewer(false)} variant="subtle" color="gray">X</ActionIcon>
                        </Group>

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {/* Preview */}
                            <Center style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 4, padding: 4 }}>
                                <canvas ref={canvasRef} width={300} height={300} />
                            </Center>
                            {selectedDrawing && (
                                <Button color="red" variant="subtle" size="xs" onClick={async () => {
                                    if (!confirm('Delete?')) return;
                                    await fetch(`/api/drawings/${selectedDrawing.id}`, { method: 'DELETE' });
                                    fetchDrawings();
                                    fetchLabels(); // Update counts
                                    setSelectedDrawing(null);
                                }}>
                                    Delete Selected
                                </Button>
                            )}

                            {/* List */}
                            <Text size="sm" fw={500} mt="auto">Samples:</Text>
                            <ScrollArea style={{ flex: 1, borderTop: '1px solid var(--mantine-color-default-border)' }}>
                                <Table striped highlightOnHover withTableBorder={false} verticalSpacing="xs">
                                    <Table.Thead>
                                        <Table.Tr>
                                            <Table.Th>Timestamp</Table.Th>
                                            <Table.Th style={{ width: 40 }}></Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {drawings.map(d => (
                                            <Table.Tr
                                                key={d.id}
                                                onClick={() => setSelectedDrawing(d)}
                                                bg={selectedDrawing?.id === d.id ? 'var(--mantine-color-blue-light)' : undefined}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <Table.Td>{new Date(d.timestamp).toLocaleString()}</Table.Td>
                                                <Table.Td>
                                                    {/* Maybe specific delete button or just select? */}
                                                </Table.Td>
                                            </Table.Tr>
                                        ))}
                                    </Table.Tbody>
                                </Table>
                            </ScrollArea>
                        </div>
                    </Card>
                )}
            </Group>

            {/* Teach Modal */}
            <Modal
                opened={teachModalOpen}
                onClose={() => setTeachModalOpen(false)}
                title={`Teaching Symbol: ${selectedLabel}`}
                centered
            >
                <div style={{ textAlign: 'center', padding: 20 }}>
                    <Text mb="md">
                        Press <b>Space</b> or click below to start recording.
                        Draw the symbol <b>{selectedLabel}</b> on your trackpad.
                    </Text>

                    <Button
                        size="xl"
                        color={recorderState.status === 'recording' ? 'red' : 'blue'}
                        onClick={toggleRecording}
                    >
                        {recorderState.status === 'recording' ? 'Stop Recording' : 'Start Recording'}
                    </Button>

                    {recorderState.status === 'finished' && (
                        <Text c="green" mt="md" fw={700}>Recorded!</Text>
                    )}
                </div>
            </Modal>
        </div>
    );
}

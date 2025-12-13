import { useEffect, useRef, useState } from 'react';
import { Table, Button, Group, Title, Card, Text, Center, ScrollArea } from '@mantine/core';


interface Drawing {
    id: string;
    label: string;
    timestamp: string;
    strokes: Array<Array<{ x: number, y: number, t: number }>>;
}

export default function DataViewerPage() {
    const [drawings, setDrawings] = useState<Drawing[]>([]);
    const [selected, setSelected] = useState<Drawing | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const fetchDrawings = async () => {
        // limit 100 for now
        const res = await fetch('/api/drawings?limit=100');
        const json = await res.json();
        setDrawings(json);
    };

    useEffect(() => { fetchDrawings(); }, []);

    useEffect(() => {
        if (!selected || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.fillStyle = '#1A1B1E'; // Dark bg
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            ctx.fillStyle = '#fff';
        }
        ctx.fillRect(0, 0, 400, 400);

        ctx.strokeStyle = '#228be6'; // Blue
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Drawings are normalized? Or raw? 
        // If raw, we need to map to canvas. 
        // Assuming raw pixels from trackpad? Trackpad coords are usually screen coords.
        // We might need to handle scaling.
        // For now, let's just draw raw and see. Or center/scale.

        // Simple auto-scale
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        selected.strokes.forEach(stroke => {
            stroke.forEach(pt => {
                if (pt.x < minX) minX = pt.x;
                if (pt.x > maxX) maxX = pt.x;
                if (pt.y < minY) minY = pt.y;
                if (pt.y > maxY) maxY = pt.y;
            });
        });

        const width = maxX - minX || 1;
        const height = maxY - minY || 1;
        const scale = Math.min(300 / width, 300 / height); // Keep margin
        const offsetX = (400 - width * scale) / 2;
        const offsetY = (400 - height * scale) / 2;

        selected.strokes.forEach(stroke => {
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

    }, [selected]);

    return (
        <div style={{ padding: 20 }}>
            <Title order={2} mb="lg">Data Viewer</Title>
            <Group align="flex-start">
                <ScrollArea h={600} style={{ flex: 1 }}>
                    <Table striped highlightOnHover>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Label</Table.Th>
                                <Table.Th>Available Actions</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {drawings.map(d => (
                                <Table.Tr
                                    key={d.id}
                                    onClick={() => setSelected(d)}
                                    style={{ cursor: 'pointer', backgroundColor: selected?.id === d.id ? 'var(--mantine-color-blue-light)' : undefined }}
                                >
                                    <Table.Td>{d.label}</Table.Td>
                                    <Table.Td>
                                        <Text size="xs">{new Date(d.timestamp).toLocaleString()}</Text>
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                </ScrollArea>

                <Card shadow="sm" padding="lg" radius="md" withBorder w={400}>
                    <Text fw={500} size="lg" mb="sm" ta="center">
                        {selected ? `Drawing: ${selected.label}` : 'Select a drawing'}
                    </Text>
                    <Center>
                        <canvas ref={canvasRef} width={400} height={400} style={{ border: '1px solid #ccc', borderRadius: 4 }} />
                    </Center>
                    {selected && (
                        <Group justify="center" mt="md">
                            <Button color="red" variant="subtle" onClick={async () => {
                                if (!confirm('Delete?')) return;
                                await fetch(`/api/drawings/${selected.id}`, { method: 'DELETE' });
                                fetchDrawings();
                                setSelected(null);
                            }}>
                                Delete
                            </Button>
                        </Group>
                    )}
                </Card>
            </Group>
        </div>
    );
}

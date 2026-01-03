import { ActionIcon, Button, Card, Center, Group, ScrollArea, Table, Title } from '@mantine/core';
import { IconSchool } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { segmentStrokes } from '../hooks/useRecorder';

export interface Drawing {
    id: string;
    label: string;
    timestamp: string;
    points: Array<{ x: number, y: number, t: number }>;
}

interface DataViewerProps {
    label: string;
    drawings: Drawing[];
    onClose: () => void;
    onDeleteDrawings: (ids: string[]) => void;
    onTeach: () => void;
}

export function DataViewer({ label, drawings, onClose, onDeleteDrawings, onTeach }: DataViewerProps) {
    // Keep track of all selected IDs
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    // Keep track of the "primary" selected drawing for visualization
    const [focusedDrawing, setFocusedDrawing] = useState<Drawing | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Auto-select first drawing when drawings change or label changes
    useEffect(() => {
        if (drawings.length > 0) {
            setFocusedDrawing(drawings[0]);
            setSelectedIds(new Set([drawings[0].id]));
        } else {
            setFocusedDrawing(null);
            setSelectedIds(new Set());
        }
    }, [drawings, label]);

    // Canvas Logic
    useEffect(() => {
        if (!focusedDrawing || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        // Theme aware background
        ctx.fillStyle = "transparent";
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        ctx.strokeStyle = '#228be6'; // Blue
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        focusedDrawing.points.forEach(pt => {
            if (pt.x < minX) minX = pt.x;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.y > maxY) maxY = pt.y;
        });

        const strokes = segmentStrokes(focusedDrawing.points);

        const width = maxX - minX || 1;
        const height = maxY - minY || 1;
        const scale = Math.min(250 / width, 250 / height);
        const offsetX = (300 - width * scale) / 2;
        const offsetY = (300 - height * scale) / 2;

        strokes.forEach(stroke => {
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
    }, [focusedDrawing]);

    const handleRowClick = (d: Drawing, e: React.MouseEvent) => {
        const newSelectedIds = new Set(selectedIds);

        if (e.ctrlKey || e.metaKey) {
            // Toggle
            if (newSelectedIds.has(d.id)) {
                newSelectedIds.delete(d.id);
            } else {
                newSelectedIds.add(d.id);
                setFocusedDrawing(d); // Focus the newly selected one
            }
        } else if (e.shiftKey && focusedDrawing) {
            // Range select logic (simple version)
            const lastIndex = drawings.findIndex(draw => draw.id === focusedDrawing.id);
            const currentIndex = drawings.findIndex(draw => draw.id === d.id);
            const start = Math.min(lastIndex, currentIndex);
            const end = Math.max(lastIndex, currentIndex);

            newSelectedIds.clear();
            for (let i = start; i <= end; i++) {
                newSelectedIds.add(drawings[i].id);
            }
            setFocusedDrawing(d);
        } else {
            // Simple click
            newSelectedIds.clear();
            newSelectedIds.add(d.id);
            setFocusedDrawing(d);
        }

        setSelectedIds(newSelectedIds);
    };

    return (
        <Card withBorder style={{ width: 450, height: '100%', display: 'flex', flexDirection: 'column' }} p="md">
            <Group justify="space-between" mb="md">
                <Title order={4}>Data: {label}</Title>
                <div style={{ flex: 1 }}></div> {/* Spacer */}
                <ActionIcon onClick={onClose} variant="subtle" color="gray">X</ActionIcon>
            </Group>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>
                {/* Preview */}
                <Center style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 4, padding: 4 }}>
                    <canvas ref={canvasRef} width={300} height={300} />
                </Center>

                <Group justify="space-between">
                    <Button
                        onClick={onTeach}
                        leftSection={<IconSchool size={16} />}
                        size="xs"
                        variant="light"
                    >
                        Teach More
                    </Button>

                    {selectedIds.size > 0 && (
                        <Button color="red" variant="subtle" size="xs" onClick={() => {
                            if (!confirm(`Delete ${selectedIds.size} selected items?`)) return;
                            onDeleteDrawings(Array.from(selectedIds));
                        }}>
                            Delete Selected {selectedIds.size > 1 ? `(${selectedIds.size})` : ''}
                        </Button>
                    )}
                </Group>

                {/* List */}
                <ScrollArea style={{ flex: 1, borderTop: '1px solid var(--mantine-color-default-border)' }}>
                    <Table striped highlightOnHover stickyHeader withTableBorder={false} verticalSpacing="xs" style={{ userSelect: 'none' }}>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Samples</Table.Th>
                                <Table.Th style={{ width: 40 }}></Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {drawings.map(d => (
                                <Table.Tr
                                    key={d.id}
                                    onMouseDown={(e) => {
                                        if (e.shiftKey) {
                                            e.preventDefault();
                                        }
                                    }}
                                    onClick={(e) => handleRowClick(d, e)}
                                    // Highlight if in selected set. 
                                    // Maybe different color for focused? 
                                    // For now just standard highlight for all selected.
                                    bg={selectedIds.has(d.id) ? 'var(--mantine-color-blue-light)' : undefined}
                                    style={{ cursor: 'pointer', userSelect: 'none' }}
                                >
                                    <Table.Td>{new Date(d.timestamp).toLocaleString()}</Table.Td>
                                    <Table.Td>
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                </ScrollArea>
            </div>
        </Card>
    );
}

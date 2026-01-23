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
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        if (!focusedDrawing) {
            return;
        }

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

        const drawArrowhead = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number = 8) => {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-size, -size * 0.6);
            ctx.lineTo(-size, size * 0.6);
            ctx.closePath();
            ctx.fillStyle = ctx.strokeStyle;
            ctx.fill();
            ctx.restore();
        };

        strokes.forEach(stroke => {
            if (stroke.length === 0) return;

            // Draw the line (or a dot if only one point)
            if (stroke.length === 1) {
                const x = (stroke[0].x - minX) * scale + offsetX;
                const y = (stroke[0].y - minY) * scale + offsetY;
                ctx.beginPath();
                ctx.arc(x, y, ctx.lineWidth * 1.2, 0, Math.PI * 2);
                ctx.fillStyle = '#fab005'; // Orange for dots
                ctx.fill();
            } else {
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

                // Draw arrowheads along the path
                let distanceSinceLastArrow = 15; // Start with a small offset
                const arrowSpacing = 40; // Pixels between arrows

                for (let i = 1; i < stroke.length; i++) {
                    const x1 = (stroke[i - 1].x - minX) * scale + offsetX;
                    const y1 = (stroke[i - 1].y - minY) * scale + offsetY;
                    const x2 = (stroke[i].x - minX) * scale + offsetX;
                    const y2 = (stroke[i].y - minY) * scale + offsetY;

                    const dx = x2 - x1;
                    const dy = y2 - y1;
                    const segmentLen = Math.sqrt(dx * dx + dy * dy);

                    if (segmentLen === 0) continue;

                    distanceSinceLastArrow += segmentLen;

                    if (distanceSinceLastArrow >= arrowSpacing) {
                        const angle = Math.atan2(dy, dx);
                        drawArrowhead(ctx, x2, y2, angle);
                        distanceSinceLastArrow = 0;
                    }
                }

                // Always ensure an arrow at the end of the stroke if it's long enough
                const last = stroke[stroke.length - 1];
                const prev = stroke[stroke.length - 2];
                const x1 = (prev.x - minX) * scale + offsetX;
                const y1 = (prev.y - minY) * scale + offsetY;
                const x2 = (last.x - minX) * scale + offsetX;
                const y2 = (last.y - minY) * scale + offsetY;
                const angle = Math.atan2(y2 - y1, x2 - x1);
                drawArrowhead(ctx, x2, y2, angle);
            }
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

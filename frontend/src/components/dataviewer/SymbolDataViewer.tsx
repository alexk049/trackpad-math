import { Button, Group, ScrollArea, Table, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconSchool } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { StrokeCanvas } from '../StrokeCanvas';

export interface Drawing {
    id: string;
    label: string;
    timestamp: string;
    points: Array<{ x: number, y: number, t: number }>;
}

interface DataViewerProps {
    label: string;
    drawings: Drawing[];
    onDeleteDrawings: (ids: string[]) => void;
    onTeach: () => void;
}

export function SymbolDataViewer({ label, drawings, onDeleteDrawings, onTeach }: DataViewerProps) {
    // Keep track of all selected IDs
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    // Keep track of the "primary" selected drawing for visualization
    const [focusedDrawing, setFocusedDrawing] = useState<Drawing | null>(null);

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
        <Group align="flex-start" wrap="nowrap">
            <div style={{ width: 300, flexShrink: 0 }}>
                {focusedDrawing && (
                    <StrokeCanvas points={focusedDrawing.points} />
                )}
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Text size="sm" fw={500}>Symbol: {label}</Text>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>

                    <Button
                        onClick={onTeach}
                        leftSection={<IconSchool size={16} />}
                        size="xs"
                        variant="light"
                        fullWidth
                    >
                        Train this symbol
                    </Button>

                    {selectedIds.size > 0 && (
                        <Button color="red" variant="subtle" size="xs" fullWidth onClick={() => {
                            modals.openConfirmModal({
                                title: 'Confirm Deletion',
                                children: (
                                    <Text size="sm">
                                        Delete {selectedIds.size} selected items?
                                    </Text>
                                ),
                                labels: { confirm: 'Delete', cancel: 'Cancel' },
                                confirmProps: { color: 'red' },
                                onConfirm: () => onDeleteDrawings(Array.from(selectedIds)),
                            });
                        }}>
                            Delete Selected {selectedIds.size > 1 ? `(${selectedIds.size})` : ''}
                        </Button>
                    )}
                </div>
                {drawings.length === 0 ? (
                    <Text c="dimmed">No drawings found for this symbol</Text>
                ) : (
                    <ScrollArea h={200} style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
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
                                        bg={selectedIds.has(d.id) ? 'var(--mantine-color-blue-light)' : undefined}
                                        style={{ cursor: 'pointer', userSelect: 'none' }}
                                    >
                                        <Table.Td>{new Date(d.timestamp).toLocaleString()}</Table.Td>
                                        <Table.Td></Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </ScrollArea>
                )}
            </div>


        </Group>
    );
}

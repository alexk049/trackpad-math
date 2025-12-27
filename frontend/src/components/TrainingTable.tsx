import { ScrollArea, Table, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useState } from 'react';

export interface LabelData {
    label: string;
    count: number;
}

interface TrainingTableProps {
    data: LabelData[];
    selectedLabel: string | null;
    onSelect: (label: string) => void;
}

export function TrainingTable({ data, selectedLabel, onSelect }: TrainingTableProps) {
    const [filter, setFilter] = useState('');

    const filteredData = data.filter(item =>
        item.label.toLowerCase().includes(filter.toLowerCase())
    );

    const rows = filteredData.map((item) => {
        const isSelected = selectedLabel === item.label;
        return (
            <Table.Tr
                key={item.label}
                onClick={(e) => {
                    e.stopPropagation(); // Prevent potentially triggering the click-outside handler if we put it on the container
                    onSelect(item.label);
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
        <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <TextInput
                placeholder="Filter symbols..."
                mb="md"
                leftSection={<IconSearch size={16} />}
                value={filter}
                onChange={(event) => setFilter(event.currentTarget.value)}
            />

            <ScrollArea style={{ flex: 1 }} mb="xs"> {/* Reduced bottom margin by using only mb="xs" or not adding one if not needed. User wanted "smaller bottom margin". */}
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
    );
}

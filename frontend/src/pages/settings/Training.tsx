import { useEffect, useState } from 'react';
import { Table, Button, Group, Title, FileButton, Modal, Text, ScrollArea } from '@mantine/core';
import { IconUpload, IconDownload, IconSchool } from '@tabler/icons-react';
import { useRecorder } from '../../hooks/useRecorder';


interface LabelData {
    label: string;
    count: number;
}

export default function TrainingPage() {
    const [data, setData] = useState<LabelData[]>([]);
    const [teachLabel, setTeachLabel] = useState<string | null>(null);
    const { state: recorderState, toggleRecording } = useRecorder();

    const fetchLabels = async () => {
        const res = await fetch('/api/labels');
        const json = await res.json();
        setData(json);
    };

    useEffect(() => {
        fetchLabels();
    }, []);

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
    // When recorder finishes in teach mode, save the strokes
    useEffect(() => {
        if (teachLabel && recorderState.status === 'finished' && recorderState.strokes) {
            saveStrokes(teachLabel, recorderState.strokes);
        }
    }, [recorderState, teachLabel]);

    const saveStrokes = async (label: string, strokes: any) => {
        try {
            await fetch('/api/teach', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label, strokes })
            });
            // Don't close immediately, maybe let user teach multiple times?
            // Or flash success?
            fetchLabels(); // Update counts
        } catch (e) {
            console.error(e);
        }
    };

    const rows = data.map((item) => (
        <Table.Tr key={item.label}>
            <Table.Td style={{ fontFamily: 'monospace', fontSize: '1.2em' }}>{item.label}</Table.Td>
            <Table.Td>{item.count}</Table.Td>
            <Table.Td>
                <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconSchool size={14} />}
                    onClick={() => setTeachLabel(item.label)}
                >
                    Teach
                </Button>
            </Table.Td>
        </Table.Tr>
    ));

    return (
        <div style={{ padding: 20 }}>
            <Group justify="space-between" mb="lg">
                <Title order={2}>Training Data</Title>
                <Group>
                    <FileButton onChange={handleImport} accept="application/json">
                        {(props) => <Button {...props} leftSection={<IconUpload size={16} />} variant="default">Import</Button>}
                    </FileButton>
                    <Button onClick={handleExport} leftSection={<IconDownload size={16} />} variant="default">Export</Button>
                </Group>
            </Group>

            <ScrollArea h={600}>
                <Table stickyHeader>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>Symbol</Table.Th>
                            <Table.Th>Count</Table.Th>
                            <Table.Th>Actions</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>{rows}</Table.Tbody>
                </Table>
            </ScrollArea>

            {/* Teach Modal */}
            <Modal
                opened={!!teachLabel}
                onClose={() => setTeachLabel(null)}
                title={`Teaching Symbol: ${teachLabel}`}
                centered
            >
                <div style={{ textAlign: 'center', padding: 20 }}>
                    <Text mb="md">
                        Press <b>Space</b> or click below to start recording.
                        Draw the symbol <b>{teachLabel}</b> on your trackpad.
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

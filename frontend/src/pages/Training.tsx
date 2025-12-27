import { useEffect, useState } from 'react';
import { Button, Group, Title, FileButton, Container } from '@mantine/core';
import { IconUpload, IconDownload } from '@tabler/icons-react';
import type { LabelData } from '../components/TrainingTable';
import type { Drawing } from '../components/DataViewer';
import { TrainingTable } from '../components/TrainingTable';
import { DataViewer } from '../components/DataViewer';
import { TeachModal } from '../components/TeachModal';

export default function TrainingPage() {
    const [data, setData] = useState<LabelData[]>([]);
    const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
    const [showDataViewer, setShowDataViewer] = useState(false);

    // Data Viewer State
    const [drawings, setDrawings] = useState<Drawing[]>([]);

    // Teach State
    const [teachModalOpen, setTeachModalOpen] = useState(false);


    const fetchLabels = async () => {
        const res = await fetch('/api/labels');
        const json = await res.json();
        setData(json);
    };

    const fetchDrawings = async (label: string) => {
        // Fetchings all and filtering client side as per original logic for now
        // Ideally backend supports filtering
        const res = await fetch(`/api/drawings?limit=1000`);
        const json: Drawing[] = await res.json();
        const filtered = json.filter(d => d.label === label);
        setDrawings(filtered);
    };

    useEffect(() => {
        fetchLabels();
    }, []);

    const handleSelectLabel = (label: string) => {
        setDrawings([]);
        setSelectedLabel(label);
        setShowDataViewer(true);
        fetchDrawings(label);
    };

    const handleDeleteDrawings = async (ids: string[]) => {
        await Promise.all(ids.map(id => fetch(`/api/drawings/${id}`, { method: 'DELETE' })));
        if (selectedLabel) {
            fetchDrawings(selectedLabel);
            fetchLabels(); // Update counts
        }
    };

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

    const saveStrokes = async (label: string, strokes: any) => {
        try {
            await fetch('/api/teach', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label, strokes })
            });
            fetchLabels();
            if (showDataViewer && selectedLabel === label) {
                fetchDrawings(label);
            }
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <Container size="xl" onClick={() => setShowDataViewer(false)} h="calc(100vh - 100px)" style={{ display: 'flex', flexDirection: 'column' }} py="md">
            <Group justify="space-between" mb="lg" align="center" onClick={(e) => e.stopPropagation()}>
                <Title order={2}>Training Data</Title>
                <Group>
                    <FileButton onChange={handleImport} accept="application/json">
                        {(props) => <Button {...props} leftSection={<IconUpload size={16} />} variant="default">Import</Button>}
                    </FileButton>
                    <Button onClick={handleExport} leftSection={<IconDownload size={16} />} variant="default">Export</Button>
                </Group>
            </Group>

            <Group align="stretch" wrap="nowrap" style={{ flex: 1, minHeight: 0 }}>
                {/* Main Table */}
                <div onClick={(e) => e.stopPropagation()} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <TrainingTable
                        data={data}
                        selectedLabel={selectedLabel}
                        onSelect={handleSelectLabel}
                    />
                </div>

                {/* Data Viewer Side Panel */}
                {showDataViewer && selectedLabel && (
                    <div onClick={(e) => e.stopPropagation()} style={{ height: '100%' }}>
                        <DataViewer
                            label={selectedLabel}
                            drawings={drawings}
                            onClose={() => setShowDataViewer(false)}
                            onDeleteDrawings={handleDeleteDrawings}
                            onTeach={() => setTeachModalOpen(true)}
                        />
                    </div>
                )}
            </Group>

            <TeachModal
                opened={teachModalOpen}
                onClose={() => setTeachModalOpen(false)}
                label={selectedLabel}
                onSave={saveStrokes}
            />
        </Container>
    );
}

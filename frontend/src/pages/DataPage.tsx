import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { Group, Title, Container } from '@mantine/core';
import type { LabelData } from '../components/TrainingTable';
import type { Drawing } from '../components/DataViewer';
import { TrainingTable } from '../components/TrainingTable';
import { DataViewer } from '../components/DataViewer';
import { TeachModal } from '../components/TeachModal';

export default function DataPage() {
    const [data, setData] = useState<LabelData[]>([]);
    const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
    const [showDataViewer, setShowDataViewer] = useState(false);
    const navigate = useNavigate();

    // Data Viewer State
    const [drawings, setDrawings] = useState<Drawing[]>([]);

    // Teach State
    const [teachModalOpen, setTeachModalOpen] = useState(false);


    const fetchLabels = async () => {
        const res = await fetch(`${API_BASE_URL()}/api/labels`);
        const json = await res.json();
        setData(json);
    };

    const fetchDrawings = async (label: string) => {
        // Fetchings all and filtering client side as per original logic for now
        // Ideally backend supports filtering
        const res = await fetch(`${API_BASE_URL()}/api/drawings?limit=1000`);
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
        await Promise.all(ids.map(id => fetch(`${API_BASE_URL()}/api/drawings/${id}`, { method: 'DELETE' })));
        if (selectedLabel) {
            fetchDrawings(selectedLabel);
            fetchLabels(); // Update counts
        }
    };

    const savePoints = useCallback(async (label: string, points: any) => {
        try {
            await fetch(`${API_BASE_URL()}/api/teach`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label, points })
            });
            fetchLabels();
            if (showDataViewer && selectedLabel === label) {
                fetchDrawings(label);
            }
        } catch (e) {
            console.error(e);
        }
    }, [showDataViewer, selectedLabel]);

    return (
        <Container size="xl" h="calc(100vh - 100px)" style={{ display: 'flex', flexDirection: 'column' }} py="md">
            <Group justify="space-between" mb="lg" align="center" onClick={(e) => e.stopPropagation()}>
                <Title order={2}>Data</Title>
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
                            onTeach={() => navigate(`/training?symbol=${encodeURIComponent(selectedLabel)}`)}
                        />
                    </div>
                )}
            </Group>

            <TeachModal
                opened={teachModalOpen}
                onClose={() => setTeachModalOpen(false)}
                label={selectedLabel}
                onSave={savePoints}
            />
        </Container>
    );
}

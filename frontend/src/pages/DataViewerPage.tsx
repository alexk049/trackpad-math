import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { Group, Title, Container } from '@mantine/core';
import type { LabelData } from '../components/dataviewer/SymbolTable'
import type { Drawing } from '../components/dataviewer/SymbolDataViewer';
import { SymbolTable } from '../components/dataviewer/SymbolTable';
import { SymbolDataViewer } from '../components/dataviewer/SymbolDataViewer';

export default function DataPage() {
    const [data, setData] = useState<LabelData[]>([]);
    const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
    const [showDataViewer, setShowDataViewer] = useState(false);
    const navigate = useNavigate();

    // Data Viewer State
    const [drawings, setDrawings] = useState<Drawing[]>([]);

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

    return (
        <Container size="xl" h="calc(100vh - 100px)" style={{ display: 'flex', flexDirection: 'column' }} py="md">
            <Group justify="space-between" mb="lg" align="center" onClick={(e) => e.stopPropagation()}>
                <Title order={2}>Data</Title>
            </Group>

            <Group align="stretch" wrap="nowrap" style={{ flex: 1, minHeight: 0 }}>
                {/* Main Table */}
                <div onClick={(e) => e.stopPropagation()} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <SymbolTable
                        data={data}
                        selectedLabel={selectedLabel}
                        onSelect={handleSelectLabel}
                    />
                </div>

                {/* Data Viewer Side Panel */}
                {showDataViewer && selectedLabel && (
                    <div onClick={(e) => e.stopPropagation()} style={{ height: '100%' }}>
                        <SymbolDataViewer
                            label={selectedLabel}
                            drawings={drawings}
                            onClose={() => setShowDataViewer(false)}
                            onDeleteDrawings={handleDeleteDrawings}
                            onTeach={() => navigate(`/training?symbol=${encodeURIComponent(selectedLabel)}`)}
                        />
                    </div>
                )}
            </Group>
        </Container>
    );
}

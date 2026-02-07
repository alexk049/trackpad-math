import { Group, Title, Container, Loader, Center } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useDataViewer } from '../hooks/useDataViewer';
import { SymbolTable } from '../components/dataviewer/SymbolTable';
import { SymbolDataViewer } from '../components/dataviewer/SymbolDataViewer';

export default function DataPage() {
    const {
        labels,
        drawings,
        selectedLabel,
        loading,
        error: _error, // Handle error UI if desired
        selectLabel,
        deleteDrawings
    } = useDataViewer();

    const navigate = useNavigate();

    return (
        <Container size="xl" h="calc(100vh - 100px)" style={{ display: 'flex', flexDirection: 'column' }} py="md">
            <Group justify="space-between" mb="lg" align="center" onClick={(e) => e.stopPropagation()}>
                <Title order={2}>Data</Title>
            </Group>

            <Group align="stretch" wrap="nowrap" style={{ flex: 1, minHeight: 0 }}>
                {/* Main Table */}
                <div onClick={(e) => e.stopPropagation()} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <SymbolTable
                        data={labels}
                        selectedLabel={selectedLabel}
                        onSelect={selectLabel}
                    />
                </div>

                {/* Data Viewer Side Panel */}
                {selectedLabel && (
                    <div onClick={(e) => e.stopPropagation()} style={{ height: '100%' }}>
                        {loading && drawings.length === 0 ? (
                            <Center h="100%"><Loader /></Center>
                        ) : (
                            <SymbolDataViewer
                                label={selectedLabel}
                                drawings={drawings}
                                onClose={() => selectLabel('')} // Or just deselect
                                onDeleteDrawings={deleteDrawings}
                                onTeach={() => navigate(`/training?symbol=${encodeURIComponent(selectedLabel)}`)}
                            />
                        )}
                    </div>
                )}
            </Group>
        </Container>
    );
}

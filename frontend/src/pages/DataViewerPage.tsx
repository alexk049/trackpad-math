import { Group, Title, Container, Loader, Center, Accordion, TextInput, Text, Badge, Box } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useDataViewer } from '../hooks/useDataViewer';
import { SymbolDataViewer } from '../components/dataviewer/SymbolDataViewer';
import { IconSearch } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

export default function DataPage() {
    const {
        labels,
        drawings,
        selectedLabel,
        loading,
        error: _error,
        selectLabel,
        deleteDrawings
    } = useDataViewer();

    const navigate = useNavigate();
    const [filter, setFilter] = useState('');

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        window.scrollTo(0, 0);
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    const filteredLabels = labels.filter(item =>
        item.label.toLowerCase().includes(filter.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(filter.toLowerCase())) ||
        (item.latex && item.latex.toLowerCase().includes(filter.toLowerCase()))
    );

    return (
        <Container size="md" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }} py="md">
            <Group justify="space-between" mb="lg" align="center">
                <Title order={2}>Data</Title>
                <TextInput
                    placeholder="Search symbols..."
                    leftSection={<IconSearch size={16} />}
                    value={filter}
                    onChange={(event) => setFilter(event.currentTarget.value)}
                    style={{ width: 300 }}
                />
            </Group>

            <Box style={{ flex: 1, overflow: 'auto' }}>
                <Accordion
                    value={selectedLabel}
                    onChange={(val) => selectLabel(val || '')}
                    variant="contained"
                >
                    {filteredLabels.map((item) => (
                        <Accordion.Item key={item.label + item.description} value={item.label}>
                            <Accordion.Control>
                                <Group justify="space-between" wrap="nowrap">
                                    <Group gap="sm">
                                        <Text fw={700} size="lg" style={{ fontFamily: 'monospace' }}>{item.label}</Text>
                                        <Text size="sm" c="dimmed">{item.description}</Text>
                                    </Group>
                                    <Badge variant="light" color={item.count === 0 ? 'yellow' : 'blue'}>{item.count} samples</Badge>
                                </Group>
                            </Accordion.Control>
                            <Accordion.Panel>
                                {selectedLabel === item.label && (
                                    <>
                                        {loading && drawings.length === 0 ? (
                                            <Center py="xl"><Loader /></Center>
                                        ) : (
                                            <SymbolDataViewer
                                                label={item.label}
                                                drawings={drawings}
                                                onDeleteDrawings={deleteDrawings}
                                                onTeach={() => navigate(`/training?symbol=${encodeURIComponent(item.label)}`)}
                                            />
                                        )}
                                    </>
                                )}
                            </Accordion.Panel>
                        </Accordion.Item>
                    ))}
                </Accordion>

                {filteredLabels.length === 0 && (
                    <Center h={200}>
                        <Text c="dimmed">No symbols found matching "{filter}"</Text>
                    </Center>
                )}
            </Box>
        </Container>
    );
}

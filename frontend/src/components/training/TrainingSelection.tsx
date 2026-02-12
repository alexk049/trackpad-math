import { Container, Title, Stack, Button, Accordion, Group, Text, Checkbox, Center, Loader } from '@mantine/core';
import type { Category } from '../../types';

interface TrainingSelectionProps {
    categories: Category[];
    selectedSymbols: Set<string>;
    onToggleSymbol: (symbol: string) => void;
    onToggleCategory: (symbols: string[], checked: boolean) => void;
    onStart: () => void;
}

export function TrainingSelection({
    categories,
    selectedSymbols,
    onToggleSymbol,
    onToggleCategory,
    onStart
}: TrainingSelectionProps) {
    return (
        <Container size="sm" py="xl">
            <Title mb="lg">Select Symbols to Train</Title>
            <Stack>
                <Button
                    size="lg"
                    onClick={onStart}
                    disabled={selectedSymbols.size === 0}
                    mt="xl"
                    fullWidth
                >
                    Start Training ({selectedSymbols.size} symbols)
                </Button>

                <Accordion multiple variant="separated">
                    {categories.map((cat) => {
                        const allSelected = cat.items?.every(s => selectedSymbols.has(s.symbol)) ?? false;
                        const someSelected = cat.items?.some(s => selectedSymbols.has(s.symbol)) ?? false;

                        return (
                            <Accordion.Item key={cat.name} value={cat.name}>
                                <Accordion.Control>
                                    <Group justify="space-between" pr="md">
                                        <Text fw={500}>{cat.name}</Text>
                                        <Checkbox
                                            checked={allSelected}
                                            indeterminate={someSelected && !allSelected}
                                            disabled={!cat.items || cat.items.length === 0}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (cat.items && cat.items.length > 0) {
                                                    onToggleCategory(cat.items.map(i => i.symbol), !allSelected);
                                                }
                                            }}
                                            readOnly
                                        />
                                    </Group>
                                </Accordion.Control>
                                <Accordion.Panel>
                                    <Group gap="md">
                                        {!cat.items || cat.items.length === 0 ? (
                                            <Center w="100%" py="sm">
                                                <Loader size="sm" variant="dots" />
                                            </Center>
                                        ) : (
                                            cat.items.map(item => (
                                                <Checkbox
                                                    key={item.symbol + item.description}
                                                    label={
                                                        <div style={{ lineHeight: 1.2 }}>
                                                            <Group gap="xs" align="center">
                                                                <Text size="sm">{item.symbol}</Text>
                                                            </Group>
                                                            <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                                                                {item.description}
                                                            </Text>
                                                        </div>
                                                    }
                                                    checked={selectedSymbols.has(item.symbol)}
                                                    onChange={() => onToggleSymbol(item.symbol)}
                                                    style={{ width: 'calc(33% - 16px)', alignItems: 'flex-start' }}
                                                />
                                            ))
                                        )}
                                    </Group>
                                </Accordion.Panel>
                            </Accordion.Item>
                        );
                    })}
                </Accordion>
            </Stack>
        </Container>
    );
}

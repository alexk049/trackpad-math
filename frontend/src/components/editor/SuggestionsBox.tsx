import { ActionIcon, Box, Button, Chip, Group, Select, Text } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../api/config';

interface SuggestionsBoxProps {
    candidates: { symbol: string; confidence: number }[];
    onSelect: (symbol: string) => void;
    onConfirmRetrain: (symbol: string) => void;
    onClose: () => void;
    visible: boolean;
}

export function SuggestionsBox({ candidates, onSelect, onConfirmRetrain, onClose, visible }: SuggestionsBoxProps) {
    const [isOtherActive, setIsOtherActive] = useState(false);
    const [allSymbols, setAllSymbols] = useState<string[]>([]);
    const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
    const [confirming, setConfirming] = useState(false);

    useEffect(() => {
        if (isOtherActive && allSymbols.length === 0) {
            fetch(`${API_BASE_URL()}/api/labels`)
                .then(res => res.json())
                .then(data => {
                    const sorted = data.map((d: any) => d.label).sort();
                    const filtered = sorted.filter((label: string) => !candidates.some(c => c.symbol === label));
                    setAllSymbols(filtered);
                })
                .catch(err => console.error("Failed to fetch labels", err));
        }
    }, [isOtherActive]);

    useEffect(() => {
        if (!visible) {
            setSelectedSymbol(null);
            setIsOtherActive(false);
        }
    }, [visible]);

    const handleChipClick = (symbol: string) => {
        setIsOtherActive(false);
        setSelectedSymbol(symbol);
        onSelect(symbol);
    };

    const handleOtherClick = () => {
        setIsOtherActive(true);
    };

    const handleOtherSelect = (value: string | null) => {
        if (value) {
            setSelectedSymbol(value);
            onSelect(value);
        }
    };

    const handleConfirm = () => {
        if (selectedSymbol) {
            setConfirming(true);
            onConfirmRetrain(selectedSymbol);
            // Reset state slightly after to allow for success message or close
            setTimeout(() => setConfirming(false), 1000);
        }
    };

    if (!visible) return null;

    return (
        <Box
            p="md" >
            <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                style={{ position: 'absolute', top: 5, right: 5 }}
                onClick={onClose}
            >
                <IconX size={16} />
            </ActionIcon>

            <Text size="sm" mb="xs" c="dimmed">Did you mean something else?</Text>

            <Group gap="xs" align="center">
                {candidates.map((c) => (
                    <Chip
                        key={c.symbol}
                        onClick={() => handleChipClick(c.symbol)}
                        checked={selectedSymbol === c.symbol}
                        variant="light"
                    >
                        {c.symbol} <Text span size="xs" c="dimmed">({c.confidence.toFixed(2)})</Text>
                    </Chip>
                ))}

                {isOtherActive ? (
                    <Select
                        placeholder="Select symbol"
                        data={allSymbols}
                        searchable
                        size="xs"
                        onChange={handleOtherSelect}
                        value={selectedSymbol}
                        style={{ width: 120 }}
                        autoFocus
                    />
                ) : (
                    <Chip onClick={handleOtherClick} variant="light" checked={isOtherActive}>Other</Chip>
                )}

                {selectedSymbol && (
                    <Button
                        size="xs"
                        variant="filled"
                        color="green"
                        leftSection={<IconCheck size={14} />}
                        onClick={handleConfirm}
                        loading={confirming}
                    >
                        Confirm & Learn
                    </Button>
                )}
            </Group>
        </Box>
    );
}

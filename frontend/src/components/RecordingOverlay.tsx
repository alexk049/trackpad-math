import { useEffect, useState } from 'react';
import { Box, Button, useMantineColorScheme } from '@mantine/core';
import { IconPlayerStop } from '@tabler/icons-react';
import { SuggestionsBox } from './SuggestionsBox';

interface RecordingOverlayProps {
    visible: boolean;
    onStop: () => void;
    onPause: (paused: boolean) => void;
    candidates: { symbol: string; confidence: number }[];
    onSelectSuggestion: (symbol: string) => void;
    onConfirmSuggestion: (symbol: string) => void;
}

export function RecordingOverlay({
    visible,
    onStop,
    onPause,
    candidates,
    onSelectSuggestion,
    onConfirmSuggestion,
}: RecordingOverlayProps) {
    const { colorScheme } = useMantineColorScheme();
    const isDark = colorScheme === 'dark';
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        if (candidates.length > 0) {
            setShowSuggestions(true);
        }
    }, [candidates]);

    useEffect(() => {
        if (!visible) {
            setShowSuggestions(false);
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <Box
            className={isDark ? 'dark-mode' : ''}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(0, 0, 0, 0.4)',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                padding: 40,
                opacity: visible ? 1 : 0,
                pointerEvents: visible ? 'all' : 'none',
                transition: 'opacity 0.2s ease',
                visibility: visible ? 'visible' : 'hidden'
            }}
        >
            <Box
                style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'flex-end',
                    gap: 20,
                    width: '100%',
                    pointerEvents: 'all'
                }}
                onMouseEnter={() => onPause(true)}
                onMouseLeave={() => onPause(false)}
            >
                {showSuggestions && (
                    <Box style={{
                        background: 'var(--card-bg)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow)',
                        border: '1px solid var(--card-border)',
                        backdropFilter: 'blur(8px)',
                        minWidth: 400
                    }}>
                        <SuggestionsBox
                            candidates={candidates}
                            onSelect={onSelectSuggestion}
                            onConfirmRetrain={onConfirmSuggestion}
                            onClose={() => setShowSuggestions(false)}
                            visible={showSuggestions}
                        />
                    </Box>
                )}

                <Button
                    color="red"
                    size="lg"
                    leftSection={<IconPlayerStop size={20} />}
                    onClick={(e) => {
                        e.stopPropagation();
                        onStop();
                    }}
                    style={{
                        boxShadow: '0 0 20px rgba(255, 0, 0, 0.3)',
                        borderRadius: 'var(--radius-md)'
                    }}
                >
                    Stop Recording
                </Button>
            </Box>
        </Box>
    );
}

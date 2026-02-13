import { Center, Text, Button, Tooltip } from '@mantine/core';
import { IconPencil } from '@tabler/icons-react';
import classes from './EditorControls.module.css';

interface EditorControlsProps {
    isPaused: boolean;
    isRecording: boolean;
    onToggleRecording: () => void;
}

export function EditorControls({ isPaused, isRecording, onToggleRecording }: EditorControlsProps) {
    return (
        <Center my="sm" h={60} style={{ textAlign: 'center' }}>
            {isPaused ? (
                <Text c="yellow" size="sm" fs="italic">Paused</Text>
            ) : isRecording ? (
                <Text c="red" size="sm" fs="italic">Recording... (Space to stop)</Text>
            ) : (
                <Tooltip
                    label="Use your trackpad to draw any mathematical symbol"
                    position="top"
                    withArrow
                    openDelay={1000}
                >
                    <Button
                        size="xl"
                        className={classes.magicButton}
                        leftSection={<IconPencil size={20} />}
                        onClick={onToggleRecording}
                    >
                        Draw Symbols
                    </Button>
                </Tooltip>
            )}
        </Center>
    );
}

import { Center, Text, Button } from '@mantine/core';
import { IconMicrophone } from '@tabler/icons-react';

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
                <Button
                    size="xl"
                    color="blue"
                    leftSection={<IconMicrophone />}
                    onClick={onToggleRecording}
                    variant="light"
                >
                    Start Drawing (Space)
                </Button>
            )}
        </Center>
    );
}

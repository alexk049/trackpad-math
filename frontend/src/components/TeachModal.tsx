import { Modal, Text, Button } from '@mantine/core';
import { useRecorder } from '../hooks/useRecorder';
import { useEffect } from 'react';

interface TeachModalProps {
    opened: boolean;
    onClose: () => void;
    label: string | null;
    onSave: (label: string, strokes: any) => void;
}

export function TeachModal({ opened, onClose, label, onSave }: TeachModalProps) {
    const { state: recorderState, toggleRecording } = useRecorder();

    // Teach Logic
    useEffect(() => {
        if (opened && label && recorderState.status === 'finished' && recorderState.strokes) {
            onSave(label, recorderState.strokes);
        }
    }, [recorderState, opened, label, onSave]);

    // Space key handler for Teach Modal
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // Only toggle if modal is open!
            if (opened && e.code === 'Space') {
                e.preventDefault();
                e.stopPropagation();
                toggleRecording();
            }
        };
        // Use capture to ensure we get it before modal's restrictive focus trapping might interfere
        window.addEventListener('keydown', handler, true);
        return () => window.removeEventListener('keydown', handler, true);
    }, [opened, toggleRecording]);

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={`Teaching Symbol: ${label}`}
            centered
        >
            <div style={{ textAlign: 'center', padding: 20 }}>
                <Text mb="md">
                    Press <b>Space</b> or click below to start recording.
                    Draw the symbol <b>{label}</b> on your trackpad.
                </Text>

                <Button
                    size="xl"
                    color={recorderState.status === 'recording' ? 'red' : 'blue'}
                    onClick={toggleRecording}
                >
                    {recorderState.status === 'recording' ? 'Stop Recording' : 'Start Recording'}
                </Button>

                {recorderState.status === 'finished' && (
                    <Text c="green" mt="md" fw={700}>Recorded!</Text>
                )}
            </div>
        </Modal>
    );
}

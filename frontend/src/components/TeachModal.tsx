import { Modal, Text, Button } from '@mantine/core';
import { useRecorder } from '../hooks/useRecorder';
import { useEffect, useRef } from 'react';

interface TeachModalProps {
    opened: boolean;
    onClose: () => void;
    label: string | null;
    onSave: (label: string, points: any) => void;
}

export function TeachModal({ opened, onClose, label, onSave }: TeachModalProps) {
    const { isRecording, recordedPoints, toggleRecording } = useRecorder();
    const lastProcessedPointsRef = useRef<any>(null);
    const hasRecorded = !!recordedPoints;

    // Teach Logic
    useEffect(() => {
        if (opened && label && recordedPoints && recordedPoints.length > 0) {
            if (recordedPoints !== lastProcessedPointsRef.current) {
                lastProcessedPointsRef.current = recordedPoints;
                onSave(label, recordedPoints);
            }
        }
    }, [recordedPoints, opened, label, onSave]);

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
                    color={isRecording ? 'red' : 'blue'}
                    onClick={toggleRecording}
                >
                    {isRecording ? 'Stop Recording' : 'Start Recording'}
                </Button>

                {hasRecorded && (
                    <Text c="green" mt="md" fw={700}>Recorded!</Text>
                )}
            </div>
        </Modal>
    );
}

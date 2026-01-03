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
    const { isRecording, recordedPoints, toggleRecording } = useRecorder(true);
    const lastProcessedPointsRef = useRef<any>(null);
    const hasRecorded = !!recordedPoints;

    // Reset last processed when opened/label changes
    useEffect(() => {
        if (opened) {
            lastProcessedPointsRef.current = null;
        }
    }, [opened, label]);

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
            if (opened && e.code === 'Space') {
                e.preventDefault();
                e.stopPropagation();
                toggleRecording();
            }
        };
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
                    fullWidth
                    mb="md"
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

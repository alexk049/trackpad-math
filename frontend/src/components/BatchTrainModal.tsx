import { Modal, Text, Button } from '@mantine/core';
import { useRecorder } from '../hooks/useRecorder';
import { useEffect, useRef, useState } from 'react';

interface BatchTrainModalProps {
    opened: boolean;
    onClose: () => void;
    labels: string[];
    onSave: (label: string, points: any) => void;
}

export function BatchTrainModal({ opened, onClose, labels, onSave }: BatchTrainModalProps) {
    const { isRecording, recordedPoints, toggleRecording } = useRecorder(true);
    const lastProcessedPointsRef = useRef<any>(null);
    const [currentIndex, setCurrentIndex] = useState(0);

    const currentLabel = labels[currentIndex];
    const hasRecorded = !!recordedPoints;

    // Reset index when opened
    useEffect(() => {
        if (opened) {
            setCurrentIndex(0);
            lastProcessedPointsRef.current = null;
        }
    }, [opened]);

    // Batch logic
    useEffect(() => {
        if (opened && currentLabel && recordedPoints && recordedPoints.length > 0) {
            if (recordedPoints !== lastProcessedPointsRef.current) {
                lastProcessedPointsRef.current = recordedPoints;
                onSave(currentLabel, recordedPoints);

                // Move to next after a delay
                setTimeout(() => {
                    if (currentIndex < labels.length - 1) {
                        setCurrentIndex((idx) => idx + 1);
                    } else {
                        onClose();
                    }
                }, 800);
            }
        }
    }, [recordedPoints, opened, currentLabel, onSave, currentIndex, labels, onClose]);

    // Space key handler
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

    const handleSkip = () => {
        if (currentIndex < labels.length - 1) {
            setCurrentIndex((idx) => idx + 1);
        } else {
            onClose();
        }
    };

    if (!opened) return null;

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={`Batch Training (${currentIndex + 1} / ${labels.length})`}
            centered
        >
            <div style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ marginBottom: 20 }}>
                    <Text>
                        Draw the symbol <b style={{ fontSize: '1.5em' }}>{currentLabel}</b> on your trackpad.
                    </Text>
                    <Text size="sm" c="dimmed" mt="xs">
                        Press <b>Space</b> or click below to start/stop.
                    </Text>
                </div>

                <Button
                    size="xl"
                    color={isRecording ? 'red' : 'blue'}
                    onClick={toggleRecording}
                    fullWidth
                    mb="md"
                >
                    {isRecording ? 'Stop Recording' : 'Start Recording'}
                </Button>

                <Button variant="subtle" color="gray" onClick={handleSkip}>
                    Skip Symbol
                </Button>

                {hasRecorded && (
                    <Text c="green" mt="md" fw={700}>
                        Recorded! Moving to next...
                    </Text>
                )}
            </div>
        </Modal>
    );
}

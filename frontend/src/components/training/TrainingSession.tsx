import { Center, Stack, Title, Card, Text, Button, Group } from '@mantine/core';
import { IconPlayerRecord, IconRefresh, IconCheck } from '@tabler/icons-react';
import { StrokeCanvas } from '../StrokeCanvas';

interface TrainingSessionProps {
    symbol: string;
    progressLabel: string;
    isRecorderRecording: boolean;
    lastRecording: any[] | null;
    isLastSample: boolean;
    onStartRecording: () => void;
    onRedraw: () => void;
    onNext: () => void;
}

export function TrainingSession({
    symbol,
    progressLabel,
    isRecorderRecording,
    lastRecording,
    isLastSample,
    onStartRecording,
    onRedraw,
    onNext
}: TrainingSessionProps) {
    return (
        <Center h="80vh">
            <Stack align="center" gap="xl">
                <Title order={2}>
                    Draw "{symbol}" ({progressLabel})
                </Title>

                {lastRecording ? (
                    <StrokeCanvas points={lastRecording} />
                ) : (
                    <Card withBorder p={50} style={{ borderStyle: 'dashed' }}>
                        <Text c="dimmed">Waiting for recording...</Text>
                    </Card>
                )}

                <Text size="lg" c="dimmed" style={{ visibility: (isLastSample && lastRecording !== null && !isRecorderRecording) ? 'hidden' : 'visible' }}>
                    {isRecorderRecording ? "Press Space to stop" : `Press Space or ${lastRecording !== null ? "'Next' to continue training" : "'Start' to start training"}`}
                </Text>

                {!lastRecording && !isRecorderRecording && (
                    <Button
                        size="xl"
                        color="blue"
                        leftSection={<IconPlayerRecord />}
                        onClick={onStartRecording}
                        style={{ pointerEvents: 'all', width: 200 }}
                    >
                        Start
                    </Button>
                )}

                {lastRecording && (
                    <Group>
                        <Button
                            size="xl"
                            variant="default"
                            leftSection={<IconRefresh />}
                            onClick={onRedraw}
                            style={{ pointerEvents: 'all' }}
                        >
                            Redraw
                        </Button>
                        <Button
                            size="xl"
                            color="green"
                            leftSection={<IconCheck />}
                            onClick={onNext}
                            style={{ pointerEvents: 'all' }}
                        >
                            {isLastSample ? "Finish" : "Next"}
                        </Button>
                    </Group>
                )}
            </Stack>
        </Center>
    );
}

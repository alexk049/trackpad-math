import { Container, Title, Text, Button } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';

interface TrainingCompletionProps {
    count: number;
    onTrainMore: () => void;
    onGoToEditor: () => void;
}

export function TrainingCompletion({ count, onTrainMore, onGoToEditor }: TrainingCompletionProps) {
    return (
        <Container size="sm" py="xl" style={{ textAlign: 'center', marginTop: 100 }}>
            <IconCheck size={100} color="green" style={{ marginBottom: 20 }} />
            <Title order={1} mb="md">Training Complete!</Title>
            <Text size="lg" mb="xl">
                You have successfully trained {count} symbol{count === 1 ? '' : 's'}.
            </Text>
            <Button size="lg" mr="md" variant="outline" onClick={onTrainMore}>Train More</Button>
            <Button size="lg" ml="md" onClick={onGoToEditor}>Go to Editor</Button>
        </Container>
    );
}

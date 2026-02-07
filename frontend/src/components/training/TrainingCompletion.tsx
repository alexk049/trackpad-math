import { Container, Title, Text, Button } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';

interface TrainingCompletionProps {
    count: number;
    onTrainMore: () => void;
}

export function TrainingCompletion({ count, onTrainMore }: TrainingCompletionProps) {
    return (
        <Container size="sm" py="xl" style={{ textAlign: 'center', marginTop: 100 }}>
            <IconCheck size={100} color="green" style={{ marginBottom: 20 }} />
            <Title order={1} mb="md">Training Complete!</Title>
            <Text size="lg" mb="xl">
                You have successfully trained {count} symbol{count === 1 ? '' : 's'}.
            </Text>
            <Button size="lg" onClick={onTrainMore}>Train More</Button>
        </Container>
    );
}

import { Center, Stack, Text, Loader, Title, Button, Group } from '@mantine/core';
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react';

interface LoadingPageProps {
    statusMessage?: string;
    errorMessage?: string;
    onRetry?: () => void;
}

export default function LoadingPage({ statusMessage, errorMessage, onRetry }: LoadingPageProps) {
    return (
        <Center h="100vh" style={{ background: 'var(--bg-gradient-start)' }}>
            <Stack align="center" gap="xl" style={{ maxWidth: 400, width: '90%' }}>
                {!errorMessage ? (
                    <>
                        <Loader size="xl" color="indigo" type="dots" />
                        <Stack align="center" gap="xs">
                            <Title order={2} style={{ color: 'var(--text-main)' }}>
                                Trackpad Math
                            </Title>
                            <Text c="dimmed" size="sm" ta="center">
                                {statusMessage || 'Initializing application engine...'}
                            </Text>
                        </Stack>
                    </>
                ) : (
                    <>
                        <Stack align="center" gap="sm">
                            <Group gap="xs" c="red.7">
                                <IconAlertCircle size={28} />
                                <Title order={3} mt={5}>Failed to Initialize</Title>
                            </Group>
                            <Text size="sm" ta="center" c="dimmed">
                                {errorMessage}
                            </Text>
                        </Stack>
                        <Button
                            leftSection={<IconRefresh size={14} />}
                            color="indigo"
                            onClick={onRetry}
                        >
                            Try Again
                        </Button>
                    </>
                )}
            </Stack>
        </Center>
    );
}

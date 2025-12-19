import { AppShell, Group, Title, ActionIcon, NavLink, Button, Text } from '@mantine/core';
import { IconSettings, IconSchool } from '@tabler/icons-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';


export default function MainLayout() {
    const navigate = useNavigate();
    const location = useLocation();

    // Check if we are in a settings route to determine if we show the navbar
    const isSettings = location.pathname.startsWith('/settings');

    const isActive = (path: string) => location.pathname.includes(path);

    return (
        <AppShell
            header={{ height: 60 }}
            navbar={isSettings ? { width: 250, breakpoint: 'sm' } : undefined}
            padding="md"
        >
            <AppShell.Header>
                <Group h="100%" px="md" justify="space-between">
                    <Title order={3}>TrackpadChars</Title>
                    <ActionIcon variant="subtle" size="lg" onClick={() => navigate('/settings/options')}>
                        <IconSettings />
                    </ActionIcon>
                </Group>
            </AppShell.Header>

            {isSettings && (
                <AppShell.Navbar p="md">
                    <NavLink
                        label="Options"
                        leftSection={<IconSettings size="1rem" stroke={1.5} />}
                        active={isActive('options')}
                        onClick={() => navigate('/settings/options')}
                    />
                    <NavLink
                        label="Training"
                        leftSection={<IconSchool size="1rem" stroke={1.5} />}
                        active={isActive('training')}
                        onClick={() => navigate('/settings/training')}
                    />
                    <Button
                        variant="light"
                        leftSection={<IconSchool size="1rem" />}
                        mt="auto"
                        onClick={() => navigate('/')}
                        fullWidth
                    >
                        Back to Editor
                    </Button>
                </AppShell.Navbar>
            )}

            <AppShell.Main>
                <Outlet />
            </AppShell.Main>
        </AppShell>
    );
}

import { AppShell, NavLink, Button } from '@mantine/core';
import { IconSettings, IconSchool } from '@tabler/icons-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

export default function SettingsLayout() {
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path: string) => location.pathname.includes(path);

    return (
        <AppShell
            navbar={{ width: 250, breakpoint: 'sm' }}
            padding="md"
        >
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

            <AppShell.Main>
                <Outlet />
            </AppShell.Main>
        </AppShell>
    );
}

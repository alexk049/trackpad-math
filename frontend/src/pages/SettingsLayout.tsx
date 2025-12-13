import { AppShell, NavLink } from '@mantine/core';
import { IconSettings, IconEye, IconSchool, IconDatabase } from '@tabler/icons-react';
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
                    label="Appearance"
                    leftSection={<IconEye size="1rem" stroke={1.5} />}
                    active={isActive('appearance')}
                    onClick={() => navigate('/settings/appearance')}
                />
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
                <NavLink
                    label="Data Viewer"
                    leftSection={<IconDatabase size="1rem" stroke={1.5} />}
                    active={isActive('dataviewer')}
                    onClick={() => navigate('/settings/dataviewer')}
                />
                <NavLink
                    label="Back to Editor"
                    variant="subtle"
                    mt="auto"
                    onClick={() => navigate('/')}
                />
            </AppShell.Navbar>

            <AppShell.Main>
                <Outlet />
            </AppShell.Main>
        </AppShell>
    );
}

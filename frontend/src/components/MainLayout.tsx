import { AppShell, Group, Title, NavLink, Burger, useMantineTheme } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { IconSettings, IconSchool, IconPencil, IconDatabase, IconInfoCircle } from '@tabler/icons-react';
import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';


export default function MainLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [opened, { toggle, close }] = useDisclosure(false);
    const theme = useMantineTheme();
    const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);

    const isActive = (path: string) => location.pathname.includes(path);

    useEffect(() => {
        if (isMobile) {
            close();
        }
    }, [location.pathname, close]);

    useEffect(() => {
        if (isMobile && opened) {
            window.mathVirtualKeyboard.hide();
        } else if (isMobile && !opened) {
            window.mathVirtualKeyboard.show();
        }
    }, [isMobile, opened]);

    return (
        <AppShell
            header={{ height: 60 }}
            padding="md"
            aside={{
                width: 250,
                breakpoint: 'sm',
                collapsed: { mobile: !opened, desktop: !opened },
            }}
        >
            <AppShell.Header>
                <Group h="100%" px="md" justify="space-between">
                    <Title order={3}>Trackpad Math</Title>
                    <Burger
                        mt={0}
                        opened={opened}
                        onClick={toggle}
                        size="sm"
                    />
                </Group>
            </AppShell.Header>

            <AppShell.Aside p="md">
                <NavLink
                    label="Editor"
                    leftSection={<IconPencil size="1rem" stroke={1.5} />}
                    active={isActive('editor')}
                    onClick={() => navigate('/editor')}
                />
                <NavLink
                    label="Options"
                    leftSection={<IconSettings size="1rem" stroke={1.5} />}
                    active={isActive('options')}
                    onClick={() => navigate('/options')}
                />
                <NavLink
                    label="Training"
                    leftSection={<IconSchool size="1rem" stroke={1.5} />}
                    active={isActive('training')}
                    onClick={() => navigate('/training')}
                />
                <NavLink
                    label="Data"
                    leftSection={<IconDatabase size="1rem" stroke={1.5} />}
                    active={isActive('data')}
                    onClick={() => navigate('/data')}
                />
                <NavLink
                    label="About"
                    leftSection={<IconInfoCircle size="1rem" stroke={1.5} />}
                    active={isActive('about')}
                    onClick={() => navigate('/about')}
                />
            </AppShell.Aside>

            <AppShell.Main>
                <Outlet />
            </AppShell.Main>
        </AppShell>
    );
}

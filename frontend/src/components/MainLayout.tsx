import { AppShell, Group, Title, Burger, useMantineTheme, Menu } from '@mantine/core';
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

    // Close menu when clicking or focusing anywhere outside the menu/burger
    // This uses window-level capture to jump ahead of component-level event blocking
    useEffect(() => {
        if (!opened) return;

        const handleInteraction = (event: Event) => {
            const path = event.composedPath();

            // We check if the interaction is with the Menu content or the Burger button
            const isInsideUI = path.some(el => {
                if (!(el instanceof HTMLElement)) return false;
                return (
                    el.closest('.mantine-Menu-dropdown') ||
                    el.closest('.mantine-Burger-root')
                );
            });

            if (!isInsideUI) {
                // Use close directly
                close();
            }
        };

        window.addEventListener('pointerdown', handleInteraction, { capture: true });
        window.addEventListener('focusin', handleInteraction, { capture: true });

        return () => {
            window.removeEventListener('pointerdown', handleInteraction, { capture: true });
            window.removeEventListener('focusin', handleInteraction, { capture: true });
        };
    }, [opened, close]);

    return (
        <AppShell
            header={{ height: 60 }}
            padding="md"
        >
            <AppShell.Header>
                <Group h="100%" px="md" justify="space-between">
                    <Title order={3}>Trackpad Math</Title>
                    <Menu
                        shadow="md"
                        width={200}
                        opened={opened}
                        position="bottom-end"
                        transitionProps={{ transition: 'pop-top-right', duration: 150 }}
                    >
                        <Menu.Target>
                            <Burger
                                opened={opened}
                                onClick={toggle}
                                size="sm"
                            />
                        </Menu.Target>

                        <Menu.Dropdown>
                            <Menu.Label>Navigation</Menu.Label>
                            <Menu.Item
                                leftSection={<IconPencil size="1rem" stroke={1.5} />}
                                color={isActive('editor') ? theme.primaryColor : undefined}
                                onClick={() => { navigate('/editor'); close(); }}
                            >
                                Editor
                            </Menu.Item>
                            <Menu.Item
                                leftSection={<IconSchool size="1rem" stroke={1.5} />}
                                color={isActive('training') ? theme.primaryColor : undefined}
                                onClick={() => { navigate('/training'); close(); }}
                            >
                                Training
                            </Menu.Item>
                            <Menu.Item
                                leftSection={<IconDatabase size="1rem" stroke={1.5} />}
                                color={isActive('data') ? theme.primaryColor : undefined}
                                onClick={() => { navigate('/data'); close(); }}
                            >
                                Data
                            </Menu.Item>
                            <Menu.Divider />
                            <Menu.Item
                                leftSection={<IconSettings size="1rem" stroke={1.5} />}
                                color={isActive('options') ? theme.primaryColor : undefined}
                                onClick={() => { navigate('/options'); close(); }}
                            >
                                Options
                            </Menu.Item>
                            <Menu.Item
                                leftSection={<IconInfoCircle size="1rem" stroke={1.5} />}
                                color={isActive('about') ? theme.primaryColor : undefined}
                                onClick={() => { navigate('/about'); close(); }}
                            >
                                About
                            </Menu.Item>
                        </Menu.Dropdown>
                    </Menu>
                </Group>
            </AppShell.Header>

            <AppShell.Main>
                <Outlet />
            </AppShell.Main>
        </AppShell>
    );
}

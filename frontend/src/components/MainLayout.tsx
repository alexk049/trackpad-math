import { AppShell, Group, Title, Burger, useMantineTheme, Menu, ActionIcon, Tooltip } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { IconSettings, IconGrain, IconPencil, IconDatabase, IconInfoCircle, IconDownload } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { check, Update } from '@tauri-apps/plugin-updater';
import { invoke } from '@tauri-apps/api/core';
import { modals } from '@mantine/modals';


export default function MainLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [opened, { toggle, close }] = useDisclosure(false);
    const theme = useMantineTheme();
    const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);

    // Update State
    const [update, setUpdate] = useState<Update | null>(null);
    const [downloading, setDownloading] = useState(false);

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

    // Update Check Logic
    useEffect(() => {
        const checkForUpdates = async () => {
            try {
                const updateResult = await check();
                if (updateResult) {
                    setUpdate(updateResult);
                }
            } catch (error) {
                console.error("Update check failed:", error);
            }
        };

        if (import.meta.env.PROD) {
            checkForUpdates();
            const interval = setInterval(checkForUpdates, 24 * 60 * 60 * 1000); // 24 hours

            return () => clearInterval(interval);
        }
    }, []);

    const startUpdate = async () => {
        if (!update) return;

        setDownloading(true);
        try {
            await update.downloadAndInstall();

            modals.openConfirmModal({
                title: 'Update Ready',
                children: 'The update has been downloaded. Restart the application to apply changes?',
                labels: { confirm: 'Restart', cancel: 'Later' },
                onConfirm: () => invoke('relaunch'),
            });
        } catch (error) {
            console.error("Update failed:", error);
            modals.open({
                title: 'Update Failed',
                children: `Failed to install update: ${error}`
            });
        } finally {
            setDownloading(false);
        }
    };


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
                    <Group>
                        {update && (
                            <Tooltip label={`Update to ${update.version}`}>
                                <ActionIcon
                                    onClick={startUpdate}
                                    loading={downloading}
                                    variant="light"
                                    color="blue"
                                    size="lg"
                                >
                                    {!downloading && <IconDownload size={20} />}
                                </ActionIcon>
                            </Tooltip>
                        )}
                        <Menu
                            shadow="md"
                            width={200}
                            opened={opened}
                            position="bottom-end"
                            transitionProps={{ transition: 'pop-top-right', duration: 150 }}
                            styles={{
                                itemLabel: { paddingTop: '5px' }
                            }}
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
                                    leftSection={<IconPencil size={16} stroke={1.5} />}
                                    color={isActive('editor') ? theme.primaryColor : undefined}
                                    onClick={() => { navigate('/editor'); close(); }}
                                >
                                    Editor
                                </Menu.Item>
                                <Menu.Item
                                    leftSection={<IconGrain size={16} stroke={1.5} />}
                                    color={isActive('training') ? theme.primaryColor : undefined}
                                    onClick={() => { navigate('/training'); close(); }}
                                >
                                    Training
                                </Menu.Item>
                                <Menu.Item
                                    leftSection={<IconDatabase size={16} stroke={1.5} />}
                                    color={isActive('data') ? theme.primaryColor : undefined}
                                    onClick={() => { navigate('/data'); close(); }}
                                >
                                    Data
                                </Menu.Item>
                                <Menu.Divider />
                                <Menu.Item
                                    leftSection={<IconSettings size={16} stroke={1.5} />}
                                    color={isActive('options') ? theme.primaryColor : undefined}
                                    onClick={() => { navigate('/options'); close(); }}
                                >
                                    Options
                                </Menu.Item>
                                <Menu.Item
                                    leftSection={<IconInfoCircle size={16} stroke={1.5} />}
                                    color={isActive('about') ? theme.primaryColor : undefined}
                                    onClick={() => { navigate('/about'); close(); }}
                                >
                                    About
                                </Menu.Item>
                            </Menu.Dropdown>
                        </Menu>
                    </Group>
                </Group>
            </AppShell.Header>

            <AppShell.Main>
                <Outlet />
            </AppShell.Main>
        </AppShell>
    );
}

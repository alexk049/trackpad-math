import { useEffect, useState } from 'react';
import { Title, Switch, Slider, Text, Stack, Card, Group, SegmentedControl, useMantineColorScheme, Container, Button, FileButton, Center, Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconUpload, IconDownload, IconTrash } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { apiClient } from '../api/client';
import { getApiBaseUrl } from '../api/config'; // Need URL string for direct link
import { useSettings } from '../hooks/useSettings';

interface DesktopSettings {
    minimizeToTray: boolean;
}

export default function OptionsPage() {
    // App Settings
    const { settings, loading, updateSettings } = useSettings();

    // Desktop Settings
    const [desktopSettings, setDesktopSettings] = useState<DesktopSettings>({
        minimizeToTray: true,
    });

    const { colorScheme, setColorScheme } = useMantineColorScheme();

    // Fetch Desktop Config
    useEffect(() => {
        invoke('get_config')
            .then((res: any) => setDesktopSettings(res))
            .catch(err => console.error("Failed to load desktop config", err));
    }, []);

    const updateDesktop = async (newSettings: Partial<DesktopSettings>) => {
        const s = { ...desktopSettings, ...newSettings };
        setDesktopSettings(s);
        await invoke('set_config', { config: s });
    };

    // Data Handlers
    const handleImport = async (file: File | null) => {
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        try {
            await apiClient('/api/data/import', { method: 'POST', body: formData });
            notifications.show({ title: 'Success', message: 'Data imported successfully', color: 'green' });
        } catch (e: any) {
            notifications.show({ title: 'Error', message: e.message || 'Failed to import data', color: 'red' });
        }
    };

    const handleExport = () => {
        // Direct link is fine for download, or use blob download via fetch if auth needed later.
        window.location.href = `${getApiBaseUrl()}/api/data/export`;
        notifications.show({ title: 'Success', message: 'Exported to Downloads folder', color: 'green' });
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete ALL training data? This cannot be undone.')) return;
        try {
            await apiClient('/api/data/reset', { method: 'DELETE' });
            notifications.show({ title: 'Success', message: 'All data deleted', color: 'green' });
        } catch (e: any) {
            notifications.show({ title: 'Error', message: e.message || 'Failed to delete data', color: 'red' });
        }
    };

    if (loading || !settings) {
        return <Center h="50vh"><Loader /></Center>;
    }

    return (
        <Container size="xl">
            <Title order={2} mb="lg">Options</Title>

            <Stack gap="lg">
                <Card withBorder>
                    <Text fw={500} mb="xs">Appearance</Text>
                    <Group justify="space-between">
                        <Text size="sm">Color Scheme</Text>
                        <SegmentedControl
                            value={colorScheme}
                            onChange={(value: any) => setColorScheme(value)}
                            data={[
                                { label: 'Light', value: 'light' },
                                { label: 'Dark', value: 'dark' },
                                { label: 'Auto', value: 'auto' },
                            ]}
                        />
                    </Group>
                </Card>

                <Card withBorder>
                    <Group justify="space-between">
                        <div>
                            <Text fw={500}>Minimize to Tray</Text>
                            <Text size="sm" c="dimmed">Keep the app running in the background when closed</Text>
                        </div>
                        <Switch
                            checked={desktopSettings.minimizeToTray}
                            onChange={(e) => updateDesktop({ minimizeToTray: e.currentTarget.checked })}
                        />
                    </Group>
                </Card>

                <Card withBorder>
                    <Group justify="space-between">
                        <div>
                            <Text fw={500}>Auto Draw Mode</Text>
                            <Text size="sm" c="dimmed">Automatically detect symbols when you stop drawing</Text>
                        </div>
                        <Switch
                            checked={settings.auto_mode}
                            onChange={(e) => updateSettings({ auto_mode: e.currentTarget.checked })}
                        />
                    </Group>
                </Card>

                <Card withBorder>
                    <Text fw={500} mb="xs">Pause Threshold</Text>
                    <Text size="sm" c="dimmed" mb="md">Time to wait before processing a stroke (ms)</Text>
                    <Slider
                        min={200} max={3000} step={50}
                        value={settings.pause_threshold}
                        defaultValue={settings.pause_threshold}
                        onChangeEnd={(val) => updateSettings({ pause_threshold: val })}
                        label={(val) => `${val}ms`}
                    />
                </Card>

                <Card withBorder>
                    <Text fw={500} mb="xs">Equation Scroll X Sensitivity</Text>
                    <Text size="sm" c="dimmed" mb="md">How fast the cursor moves horizontally when scrolling</Text>
                    <Slider
                        min={1} max={100} step={1}
                        defaultValue={settings.equation_scroll_x_sensitivity}
                        onChangeEnd={(val) => updateSettings({ equation_scroll_x_sensitivity: val })}
                    />
                </Card>

                <Card withBorder>
                    <Text fw={500} mb="xs">Equation Scroll Y Sensitivity</Text>
                    <Text size="sm" c="dimmed" mb="md">How fast the cursor moves vertically when scrolling</Text>
                    <Slider
                        min={1} max={100} step={1}
                        defaultValue={settings.equation_scroll_y_sensitivity}
                        onChangeEnd={(val) => updateSettings({ equation_scroll_y_sensitivity: val })}
                    />
                </Card>

                <Card withBorder>
                    <Text fw={500} mb="xs">Data Management</Text>
                    <Text size="sm" c="dimmed" mb="md">Manage your training data.</Text>
                    <Group>
                        <FileButton onChange={handleImport} accept="application/json">
                            {(props) => <Button {...props} leftSection={<IconUpload size={16} />} variant="default">Import Data</Button>}
                        </FileButton>
                        <Button onClick={handleExport} leftSection={<IconDownload size={16} />} variant="default">Export Data</Button>
                        <Button onClick={handleDelete} leftSection={<IconTrash size={16} />} color="red" variant="filled">Delete All Data</Button>
                    </Group>
                </Card>
            </Stack>
        </Container>
    );
}

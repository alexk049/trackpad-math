import { useEffect, useState } from 'react';
import { Title, Switch, Slider, Text, Stack, Card, Group, SegmentedControl, useMantineColorScheme, Container, Button, FileButton } from '@mantine/core';
import { IconUpload, IconDownload, IconTrash } from '@tabler/icons-react';
import { API_BASE_URL } from '../config';
import { invoke } from '@tauri-apps/api/core';

export default function OptionsPage() {
    const [settings, setSettings] = useState({
        auto_mode: false,
        pause_threshold: 1000,
        equation_scroll_x_sensitivity: 20,
        equation_scroll_y_sensitivity: 20
    });
    const [desktopSettings, setDesktopSettings] = useState({
        minimizeToTray: true,
    });
    const { colorScheme, setColorScheme } = useMantineColorScheme();

    useEffect(() => {
        fetch(`${API_BASE_URL()}/api/settings`).then((res) => res.json()).then(setSettings);
        invoke('get_config').then((res: any) => setDesktopSettings(res));
    }, []);

    const update = async (newSettings: any) => {
        const s = { ...settings, ...newSettings };
        setSettings(s);
        await fetch(`${API_BASE_URL()}/api/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(s),
        });
    };

    const updateDesktop = async (newSettings: any) => {
        const s = { ...desktopSettings, ...newSettings };
        setDesktopSettings(s);
        await invoke('set_config', { config: s });
    };

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
                            onChange={(e) => update({ auto_mode: e.currentTarget.checked })}
                        />
                    </Group>
                </Card>

                <Card withBorder>
                    <Text fw={500} mb="xs">Pause Threshold</Text>
                    <Text size="sm" c="dimmed" mb="md">Time to wait before processing a stroke (ms)</Text>
                    <Slider
                        min={200} max={3000} step={50}
                        value={settings.pause_threshold}
                        onChange={(val) => setSettings({ ...settings, pause_threshold: val })}
                        onChangeEnd={(val) => update({ pause_threshold: val })}
                        label={(val) => `${val}ms`}
                    />
                </Card>

                <Card withBorder>
                    <Text fw={500} mb="xs">Equation Scroll X Sensitivity</Text>
                    <Text size="sm" c="dimmed" mb="md">How fast the cursor moves horizontally when scrolling</Text>
                    <Slider
                        min={1} max={100} step={1}
                        value={settings.equation_scroll_x_sensitivity}
                        onChange={(val) => setSettings({ ...settings, equation_scroll_x_sensitivity: val })}
                        onChangeEnd={(val) => update({ equation_scroll_x_sensitivity: val })}
                    />
                </Card>

                <Card withBorder>
                    <Text fw={500} mb="xs">Equation Scroll Y Sensitivity</Text>
                    <Text size="sm" c="dimmed" mb="md">How fast the cursor moves vertically when scrolling</Text>
                    <Slider
                        min={1} max={100} step={1}
                        value={settings.equation_scroll_y_sensitivity}
                        onChange={(val) => setSettings({ ...settings, equation_scroll_y_sensitivity: val })}
                        onChangeEnd={(val) => update({ equation_scroll_y_sensitivity: val })}
                    />
                </Card>

                <Card withBorder>
                    <Text fw={500} mb="xs">Data Management</Text>
                    <Text size="sm" c="dimmed" mb="md">Manage your training data.</Text>
                    <Group>
                        <FileButton onChange={async (file) => {
                            if (!file) return;
                            const formData = new FormData();
                            formData.append('file', file);
                            await fetch(`${API_BASE_URL()}/api/data/import`, { method: 'POST', body: formData });
                        }} accept="application/json">
                            {(props) => <Button {...props} leftSection={<IconUpload size={16} />} variant="default">Import Data</Button>}
                        </FileButton>
                        <Button onClick={() => window.location.href = `${API_BASE_URL()}/api/data/export`} leftSection={<IconDownload size={16} />} variant="default">Export Data</Button>
                        <Button onClick={async () => {
                            if (!confirm('Are you sure you want to delete ALL training data? This cannot be undone.')) return;
                            await fetch(`${API_BASE_URL()}/api/data/reset`, { method: 'DELETE' });
                        }} leftSection={<IconTrash size={16} />} color="red" variant="filled">Delete All Data</Button>
                    </Group>
                </Card>
            </Stack>
        </Container>
    );
}

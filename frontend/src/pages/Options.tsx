import { useEffect, useState } from 'react';
import { Title, Switch, Slider, Text, Stack, Card, Group, SegmentedControl, useMantineColorScheme, Container } from '@mantine/core';
import { API_BASE_URL } from '../config';

export default function OptionsPage() {
    const [settings, setSettings] = useState({
        auto_mode: false,
        pause_threshold: 1000,
        equation_scroll_x_sensitivity: 20,
        equation_scroll_y_sensitivity: 20
    });
    const { colorScheme, setColorScheme } = useMantineColorScheme();

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/settings`).then((res) => res.json()).then(setSettings);
    }, []);

    const update = async (newSettings: any) => {
        const s = { ...settings, ...newSettings };
        setSettings(s);
        await fetch(`${API_BASE_URL}/api/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(s),
        });
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
            </Stack>
        </Container>
    );
}

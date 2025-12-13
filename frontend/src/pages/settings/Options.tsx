import { useEffect, useState } from 'react';
import { Title, Switch, Slider, Text, Stack, Card } from '@mantine/core';

export default function OptionsPage() {
    const [settings, setSettings] = useState({ auto_mode: false, pause_threshold: 1.0 });

    useEffect(() => {
        fetch('/settings').then((res) => res.json()).then(setSettings);
    }, []);

    const update = async (newSettings: any) => {
        const s = { ...settings, ...newSettings };
        setSettings(s);
        await fetch('/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(s),
        });
    };

    return (
        <div style={{ padding: 20 }}>
            <Title order={2} mb="lg">Options</Title>

            <Stack gap="lg">
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
                    <Text size="sm" c="dimmed" mb="md">Time to wait before processing a stroke (seconds)</Text>
                    <Slider
                        min={0.2} max={3.0} step={0.1}
                        value={settings.pause_threshold}
                        onChangeEnd={(val) => update({ pause_threshold: val })}
                        label={(val) => `${val}s`}
                    />
                </Card>
            </Stack>
        </div>
    );
}

// Helper needed for Group 
import { Group } from '@mantine/core';

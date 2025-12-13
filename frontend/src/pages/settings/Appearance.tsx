import { Container, SegmentedControl, Text, Title, useMantineColorScheme } from '@mantine/core';

export default function AppearancePage() {
    const { colorScheme, setColorScheme } = useMantineColorScheme();

    return (
        <Container p="md">
            <Title order={2} mb="lg">Appearance</Title>

            <Text mb="xs">Color Scheme</Text>
            <SegmentedControl
                value={colorScheme}
                onChange={(value: any) => setColorScheme(value)}
                data={[
                    { label: 'Light', value: 'light' },
                    { label: 'Dark', value: 'dark' },
                    { label: 'Auto', value: 'auto' },
                ]}
            />
        </Container>
    );
}

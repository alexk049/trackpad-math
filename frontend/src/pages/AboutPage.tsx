import { Container, Title, Text, Paper, Stack, Group, ThemeIcon, rem, Box, SimpleGrid } from '@mantine/core';
import { IconInfoCircle, IconLink, IconBulb, IconDeviceLaptop, IconArrowRight, IconKeyboard, IconCheck } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';

export default function AboutPage() {
    const [version, setVersion] = useState<string>('Loading...');

    useEffect(() => {
        getVersion().then(setVersion).catch(() => setVersion('Unknown'));
    }, []);

    return (
        <Container size="md" py="xl">
            <Stack gap="xl">
                <Box>
                    <Group align="center" mb="xs">
                        <ThemeIcon size={32} radius="md" variant="light" color="blue">
                            <IconInfoCircle style={{ width: rem(24), height: rem(24) }} />
                        </ThemeIcon>
                        <Title order={2}>About Trackpad Math</Title>
                    </Group>
                    <Text c="dimmed" size="lg" mb="md">
                        Version {version}
                    </Text>
                    <Text size="md" style={{ lineHeight: 1.6 }}>
                        Trackpad Math is a desktop application that turns your laptop trackpad into a powerful mathematical input device.
                        No tablet to digitally handwrite your math equations? No problem!
                        By leveraging real-time <strong>Machine Learning (KNN)</strong>, it recognizes your handwriting as you draw, providing instant LaTeX
                        conversion for complex symbols and equations. All this is done locally on your device.
                    </Text>
                </Box>

                <Stack gap="lg">
                    <Group align="center">
                        <ThemeIcon size={32} radius="md" variant="light" color="yellow">
                            <IconBulb style={{ width: rem(20), height: rem(20) }} />
                        </ThemeIcon>
                        <Title order={2}>Usage Tips</Title>
                    </Group>

                    <Stack gap="md">
                        <Paper withBorder p="md" radius="md">
                            <Group align="flex-start" wrap="nowrap">
                                <ThemeIcon color="blue" variant="light" mt={3}>
                                    <IconDeviceLaptop size={18} />
                                </ThemeIcon>
                                <Box>
                                    <Text fw={600} mb={4}>Recording Pause</Text>
                                    <Text size="sm">
                                        When hovering over the bottom part of the app while recording, recording will pause allowing you to select a correction or stop recording.
                                    </Text>
                                </Box>
                            </Group>
                        </Paper>

                        <Paper withBorder p="md" radius="md">
                            <Group align="flex-start" wrap="nowrap">
                                <ThemeIcon color="green" variant="light" mt={3}>
                                    <IconCheck size={18} />
                                </ThemeIcon>
                                <Box>
                                    <Text fw={600} mb={4}>Training Symbols</Text>
                                    <Text size="sm">
                                        Differentiate what symbols look like when you train. For example, draw <code>x</code>'s with some curl to distinguish them from other similar marks.
                                    </Text>
                                </Box>
                            </Group>
                        </Paper>

                        <Paper withBorder p="md" radius="md">
                            <Group align="flex-start" wrap="nowrap">
                                <ThemeIcon color="grape" variant="light" mt={3}>
                                    <IconArrowRight size={18} />
                                </ThemeIcon>
                                <Box>
                                    <Text fw={600} mb={4}>Navigation</Text>
                                    <Text size="sm">
                                        Scrolling left/right/up/down helps you navigate through the equation and move the cursor precisely.
                                    </Text>
                                </Box>
                            </Group>
                        </Paper>

                        <Paper withBorder p="md" radius="md">
                            <Group align="flex-start" wrap="nowrap">
                                <ThemeIcon color="orange" variant="light" mt={3}>
                                    <IconKeyboard size={18} />
                                </ThemeIcon>
                                <Box>
                                    <Text fw={600} mb={4}>Subscripts & Superscripts</Text>
                                    <Text size="sm">
                                        Holding <strong>Shift</strong> makes you input into the <strong>superscript</strong>.
                                        Holding <strong>Ctrl</strong> makes you input into the <strong>subscript</strong>.
                                    </Text>
                                </Box>
                            </Group>
                        </Paper>
                    </Stack>
                </Stack>

                <Stack gap="sm">
                    <Title order={3}>Resources</Title>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                        <Paper
                            withBorder
                            p="md"
                            radius="md"
                            component="a"
                            href="https://github.com/alexk049/trackpad-math"
                            target="_blank"
                            style={{
                                textDecoration: 'none',
                                color: 'inherit',
                                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                cursor: 'pointer'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = 'var(--mantine-shadow-sm)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            <Group wrap="nowrap">
                                <ThemeIcon size={34} radius="md" variant="light" color="blue">
                                    <IconLink size={20} />
                                </ThemeIcon>
                                <div>
                                    <Text fw={500} size="sm">GitHub Repository</Text>
                                    <Text size="xs" c="dimmed">View source code and contribute</Text>
                                </div>
                            </Group>
                        </Paper>

                        <Paper
                            withBorder
                            p="md"
                            radius="md"
                            component="a"
                            href="https://github.com/alexk049/trackpad-math/blob/main/LICENSE"
                            target="_blank"
                            style={{
                                textDecoration: 'none',
                                color: 'inherit',
                                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                cursor: 'pointer'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = 'var(--mantine-shadow-sm)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            <Group wrap="nowrap">
                                <ThemeIcon size={34} radius="md" variant="light" color="teal">
                                    <IconLink size={20} />
                                </ThemeIcon>
                                <div>
                                    <Text fw={500} size="sm">MIT License</Text>
                                    <Text size="xs" c="dimmed">Open source license details</Text>
                                </div>
                            </Group>
                        </Paper>
                    </SimpleGrid>
                </Stack>

            </Stack>
        </Container>
    );
}

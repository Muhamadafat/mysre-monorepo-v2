'use client';

import {
  Container,
  Flex,
  Group,
  Box,
  Text,
  useMantineColorScheme,
  Image,
  ActionIcon,
  ThemeIcon,
} from '@mantine/core';
import { IconNetwork, IconMoon } from '@tabler/icons-react';

interface DashboardHeaderProps {
  sidebarOpened: boolean;
  onToggleSidebar: () => void;
  mounted: boolean;
}

export function DashboardHeader({
  sidebarOpened,
  onToggleSidebar,
  mounted,
}: DashboardHeaderProps) {
  const { colorScheme } = useMantineColorScheme();
  const dark = mounted ? colorScheme === 'dark' : false;

  if (!mounted) {
    return (
      <Container fluid h="100%" px="xl">
        <Flex h="100%" justify="space-between" align="center">
          <Group gap="xs">
            <Box>
              <Box style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <Box style={{ overflow: 'hidden', height: 44 }}>
                  <Image
                    src="/images/logoSRE_IDE.png"
                    alt="My-SRE Logo"
                    width={160}
                    height={50}
                    fit="contain"
                    className="notranslate"
                    style={{
                      alignSelf: 'flex-start',
                      display: 'block',
                    }}
                  />
                </Box>
                <Text
                  size="9px"
                  fw={500}
                  className="notranslate"
                  translate="no"
                  suppressHydrationWarning
                  style={{
                    letterSpacing: '0.03em',
                    color: '#64748b', // Default light color for SSR
                    transition: 'color 0.3s ease',
                    lineHeight: 1,
                    paddingLeft: 2,
                  }}
                >
                  Smart Research Environment [SRE]
                </Text>
              </Box>
            </Box>
          </Group>
          <Group gap="sm"></Group>
        </Flex>
      </Container>
    );
  }

  return (
    <>
      <Container fluid h="100%" px="xl">
        <Flex h="100%" justify="space-between" align="center">
          <Group gap="xs">
            {/* <ThemeIcon variant="gradient" gradient={{ from: "blue", to: "cyan", deg: 45 }} size="lg" radius="md">
              <IconNetwork size={20} />
            </ThemeIcon> */}
            <Box>
              {/* <Text fw={800} size="xl" variant="gradient" gradient={{ from: "blue", to: "cyan", deg: 45 }}>
                mySRE
              </Text>
              <Text size="xs" c="dimmed">
                Knowledge Visualization Platform
              </Text> */}
              <Box style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {/* Logo image — hanya tampilkan bagian "IDE Riset", crop subtitle yang ada di PNG */}
                <Box style={{ overflow: 'hidden', height: 44 }}>
                  <Image
                    src="/images/logoSRE_IDE.png"
                    alt="My-SRE Logo"
                    width={160}
                    height={50}
                    fit="contain"
                    className="notranslate"
                    style={{
                      alignSelf: 'flex-start',
                      display: 'block',
                    }}
                  />
                </Box>
                {/* Subtitle "Smart Research Environment (SRE)" — dirender sebagai teks terpisah */}
                <Text
                  size="9px"
                  fw={500}
                  className="notranslate"
                  translate="no"
                  suppressHydrationWarning
                  style={{
                    letterSpacing: '0.03em',
                    color: dark ? '#7dd3fc' : '#64748b',
                    transition: 'color 0.3s ease',
                    lineHeight: 1,
                    paddingLeft: 2,
                  }}
                >
                  Smart Research Environment [SRE]
                </Text>
              </Box>
            </Box>
          </Group>

          <Group gap="sm"></Group>
        </Flex>
      </Container>
    </>
  );
}

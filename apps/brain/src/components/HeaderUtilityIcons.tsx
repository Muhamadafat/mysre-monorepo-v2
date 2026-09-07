'use client';

import { useState, useEffect } from 'react';
import {
  Group,
  Stack,
  ActionIcon,
  Tooltip,
  Menu,
  Avatar,
  Text,
} from '@mantine/core';
import {
  IconSettings,
  IconSun,
  IconMoon,
  IconUser,
  IconLogout,
  IconHelp,
  IconPlayerStop,
  IconPlayerRecord,
} from '@tabler/icons-react';
import { useMantineColorScheme } from '@mantine/core';
import { HelpGuideModal } from './HelpGuideModal';
import { useWebGazer } from './context/WebGazerContext';

interface HeaderUtilityIconsProps {
  mounted: boolean;
  orientation?: 'horizontal' | 'vertical';
}

export function HeaderUtilityIcons({ mounted, orientation = 'horizontal' }: HeaderUtilityIconsProps) {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const dark = mounted ? colorScheme === 'dark' : false;

  const [userData, setUserData] = useState<{ name: string; email: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [helpModalOpened, setHelpModalOpened] = useState(false);

  const { isSessionActive, startSession, stopSession } = useWebGazer();

  useEffect(() => {
    if (!mounted) return;

    const fetchUserData = async () => {
      try {
        const response = await fetch('/api/user/profile');
        if (response.ok) {
          const data = await response.json();
          setUserData({
            name: data.user?.name || 'Unknown User',
            email: data.user?.email || 'No email',
          });
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [mounted]);

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/signout', { method: 'POST' });

      if (response.ok) {
        setUserData(null);
        const loginUrl = `${process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://main.lvh.me:3000'}/signin`;
        window.location.href = loginUrl;
      } else {
        console.error('Logout API failed');
      }
    } catch (error) {
      console.error('Logout failed:', error);
      setIsLoading(false);
    }
  };

  const Container = orientation === 'vertical' ? Stack : Group;

  return (
    <>
      <Container gap="sm" align="center">
        <Tooltip
          label={isSessionActive ? 'Hentikan Sesi (Lacak & Rekam)' : 'Mulai Sesi (Lacak & Rekam)'}
          position={orientation === 'vertical' ? 'right' : 'bottom'}
          withArrow
        >
          <ActionIcon
            variant={isSessionActive ? 'filled' : 'light'}
            color={isSessionActive ? 'red' : 'teal'}
            onClick={isSessionActive ? stopSession : startSession}
            size="lg"
            radius="md"
          >
            {isSessionActive ? <IconPlayerStop size={18} /> : <IconPlayerRecord size={18} />}
          </ActionIcon>
        </Tooltip>

        <Tooltip label="Panduan Penggunaan" position={orientation === 'vertical' ? 'right' : 'bottom'} withArrow>
          <ActionIcon
            variant="gradient"
            gradient={{ from: 'blue', to: 'cyan', deg: 45 }}
            onClick={() => setHelpModalOpened(true)}
            size="lg"
            radius="md"
          >
            <IconHelp size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label={dark ? 'Light mode' : 'Dark mode'} position={orientation === 'vertical' ? 'right' : 'bottom'}>
          <ActionIcon variant="light" color={dark ? 'yellow' : 'blue'} onClick={toggleColorScheme} size="lg" radius="md">
            {dark ? <IconSun size={18} /> : <IconMoon size={18} />}
          </ActionIcon>
        </Tooltip>

        <Tooltip label="Settings" position={orientation === 'vertical' ? 'right' : 'bottom'}>
          <ActionIcon variant="light" color="gray" size="lg" radius="md">
            <IconSettings size={18} />
          </ActionIcon>
        </Tooltip>

        <Menu shadow="lg" width={220} position={orientation === 'vertical' ? 'right-end' : 'bottom-end'} offset={10}>
          <Menu.Target>
            <ActionIcon variant="light" size="lg" radius="xl">
              <Avatar
                size="sm"
                radius="xl"
                variant="gradient"
                gradient={{ from: 'blue', to: 'cyan', deg: 45 }}
                style={{ cursor: 'pointer' }}
              >
                {isLoading ? '...' : userData?.name?.charAt(0).toUpperCase() || <IconUser size={16} />}
              </Avatar>
            </ActionIcon>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Label>
              <Group gap="xs">
                <Avatar size="xs" color="blue">
                  {userData?.name?.charAt(0).toUpperCase() || 'U'}
                </Avatar>
                <Text size="sm">Signed in as</Text>
              </Group>
            </Menu.Label>

            <Menu.Item>
              <Text size="sm" fw={600}>
                {isLoading ? 'Loading...' : userData?.name || 'Unknown User'}
              </Text>
              <Text size="xs" c="dimmed">
                {isLoading ? 'Loading...' : userData?.email || 'No email'}
              </Text>
            </Menu.Item>

            <Menu.Divider />

            <Menu.Item leftSection={<IconLogout size={16} />} color="red" onClick={handleLogout} disabled={isLoading}>
              Sign out
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Container>

      <HelpGuideModal opened={helpModalOpened} onClose={() => setHelpModalOpened(false)} />
    </>
  );
}

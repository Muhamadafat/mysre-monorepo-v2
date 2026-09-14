'use client';

import type React from 'react';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  AppShell,
  Group,
  Text,
  UnstyledButton,
  Burger,
  Image,
  Stack,
  Avatar,
  Menu,
  ActionIcon,
  Tooltip,
  Badge,
  Divider,
  Box,
} from '@mantine/core';
import {
  IconDashboard,
  IconUsers,
  IconFileText,
  IconPencil,
  IconBulb,
  IconReportAnalytics,
  IconReceipt,
  IconCoin,
  IconChevronRight,
  IconBell,
  IconLogout,
  IconSettings,
  IconUser,
  IconCurrencyDollar,
  IconClipboardList,
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { createAuthHandshakeUrl, createClient } from '@sre-monorepo/lib';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  token_balance?: number;
  avatar_url?: string;
}

interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: User;
}

interface NavLinkProps {
  icon: React.ReactNode;
  label: string;
  href: string;
  active?: boolean;
  onClick?: () => void;
  badge?: string | number;
  badgeColor?: string;
}

function NavLink({
  icon,
  label,
  href,
  active,
  onClick,
  badge,
  badgeColor = 'blue',
}: NavLinkProps) {
  return (
    <UnstyledButton
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        padding: '12px 16px',
        borderRadius: '8px',
        marginBottom: '6px',
        textDecoration: 'none',
        backgroundColor: active ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
        color: active ? '#4c6ef5' : '#495057',
        fontWeight: active ? 600 : 500,
        borderLeft: active ? '4px solid #4c6ef5' : '4px solid transparent',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.03)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <Group gap="md" style={{ flex: 1 }}>
        <Box style={{ color: active ? '#4c6ef5' : '#868e96' }}>{icon}</Box>
        <Text size="sm" style={{ flex: 1, letterSpacing: '0.3px' }}>
          {label}
        </Text>
        {badge && (
          <Badge size="xs" color={badgeColor} variant={active ? "filled" : "light"} ml="auto">
            {badge}
          </Badge>
        )}
      </Group>
      <IconChevronRight size={14} opacity={active ? 0.8 : 0.4} style={{ marginLeft: 8 }} />
    </UnstyledButton>
  );
}

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const [opened, { toggle, close }] = useDisclosure();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const sessionRef = useRef<AuthTokens | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) return;

      sessionRef.current = session
        ? {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }
        : null;
    };

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      sessionRef.current = session
        ? {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }
        : null;
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Check if user is admin
  const isAdmin = () => user?.role === 'ADMIN';

  // Navigation links - different for admin vs user
  const getNavLinks = () => {
    if (isAdmin()) {
      // Admin navigation (existing)
      return [
        {
          icon: <IconDashboard size={20} />,
          label: 'Dashboard',
          href: '/dashboard',
        },
        {
          icon: <IconUsers size={20} />,
          label: 'Pengguna',
          href: '/dashboard/users',
        },
        {
          icon: <IconFileText size={20} />,
          label: 'List Artikel',
          href: '/dashboard/articles',
        },
        {
          icon: <IconClipboardList size={20} />,
          label: 'Assignment',
          href: '/dashboard/assignments',
          badge: 'NEW',
          badgeColor: 'red',
        },
        {
          icon: <IconPencil size={20} />,
          label: 'Project Writer',
          href:
            process.env.NEXT_PUBLIC_WRITER_APP_URL ||
            'https://writer.mysrepanel.web.id',
        },
        {
          icon: <IconBulb size={20} />,
          label: 'Project Brainstorm',
          href:
            process.env.NEXT_PUBLIC_BRAIN_APP_URL ||
            'https://brain.mysrepanel.web.id',
        },
        {
          icon: <IconReportAnalytics size={20} />,
          label: 'Learning Analytics',
          href: '/dashboard/analytics',
        },
        {
          icon: <IconReceipt size={20} />,
          label: 'Billing & Tokens',
          href: '/dashboard/billing',
          badge: 'NEW',
          badgeColor: 'green',
        },
      ];
    } else {
      // User/Student navigation
      return [
        {
          icon: <IconDashboard size={20} />,
          label: 'Dashboard',
          href: '/dashboard',
        },
        {
          icon: <IconClipboardList size={20} />,
          label: 'Tugas Saya',
          href: '/dashboard/assignments',
          badge: 'BARU',
          badgeColor: 'blue',
        },
        {
          icon: <IconBulb size={20} />,
          label: 'Brainstorming',
          href:
            process.env.NEXT_PUBLIC_BRAIN_APP_URL ||
            'https://brain.mysrepanel.web.id',
          badge: 'AI',
          badgeColor: 'violet',
        },
        {
          icon: <IconPencil size={20} />,
          label: 'Writer',
          href:
            process.env.NEXT_PUBLIC_WRITER_APP_URL ||
            'https://writer.mysrepanel.web.id',
        },
        {
          icon: <IconReportAnalytics size={20} />,
          label: 'Analitik Saya',
          href: '/dashboard/analytics',
        },
      ];
    }
  };

  const navLinks = getNavLinks();

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/signout', {
        method: 'POST',
      });
      if (res.ok) {
        console.log('Berhasil logout');
        const loginUrl = `${
          process.env.NEXT_PUBLIC_MAIN_APP_URL ||
          'https://mysrepanel.web.id'
        }/signin`;
        window.location.href = loginUrl;
      } else {
        console.error('Tidak berhasil logout');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleAppTransition = async (targetAppUrl: string, newWindow: Window | null) => {
    if (!newWindow) {
      console.warn('Popup blocked, falling back to current tab');
    }

    try {
      console.info('[profile sidebar] app transition start', {
        targetAppUrl,
        popupOpened: Boolean(newWindow),
      });

      const cachedSession = sessionRef.current;
      const session = cachedSession
        ? {
            access_token: cachedSession.access_token,
            refresh_token: cachedSession.refresh_token,
          }
        : (
            await supabase.auth.getSession()
          ).data.session;

      if (!session) {
        console.warn('[profile sidebar] session missing, falling back to target app');
        if (newWindow) {
          newWindow.location.replace(targetAppUrl);
        } else {
          window.location.href = targetAppUrl;
        }
        return;
      }

      const handshakeUrl = createAuthHandshakeUrl(
        targetAppUrl,
        session.access_token,
        session.refresh_token,
        '/'
      );

      console.info('[profile sidebar] handshake url prepared', {
        targetAppUrl,
        popupOpened: Boolean(newWindow),
      });

      if (newWindow) {
        newWindow.location.replace(handshakeUrl);
      } else {
        window.location.href = handshakeUrl;
      }
    } catch (error) {
      console.error('Handshake failed:', error);
      if (newWindow) {
        newWindow.location.replace(targetAppUrl);
      } else {
        window.location.href = targetAppUrl;
      }
    }
  };

  const handleNavClick = (href: string) => {
    console.info('[profile sidebar] nav click received', {
      href,
      isExternal: href.startsWith('http'),
    });

    if (href.startsWith('http')) {
      const newWindow = window.open('about:blank', '_blank');
      console.info('[profile sidebar] popup attempt', {
        href,
        popupOpened: Boolean(newWindow),
      });
      handleAppTransition(href, newWindow);
    } else {
      router.push(href);
    }
    close();
  };

  return (
    <AppShell
      header={{ height: 70 }}
      navbar={{
        width: 300,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
            />
            <Group gap="sm" style={{ display: 'flex', alignItems: 'center' }}>
              <Image
                src="/images/logoSRE_Profile.png"
                alt="MySRE Logo"
                height={45}
                width="auto"
                fit="contain"
                fallbackSrc="/logo-mysre-fallback.png"
              />
            </Group>
          </Group>
          <Group>
            {/* Token Balance Indicator (untuk user) */}
            {/* {!isAdmin() && user && (
              <Tooltip label="Token Balance">
                <ActionIcon variant="light" size="lg" color="green">
                  <Group gap="xs">
                    <IconCoin size={16} />
                    <span style={{ fontSize: "12px", fontWeight: 600 }}>
                      {user.token_balance?.toLocaleString() || "0"}
                    </span>
                  </Group>
                </ActionIcon>
              </Tooltip>
            )} */}
            {/* Revenue Indicator (untuk admin) */}
            {isAdmin() && (
              <Tooltip label="Monthly Revenue">
                <ActionIcon variant="light" size="lg" color="green">
                  <Group gap="xs">
                    <IconCurrencyDollar size={16} />
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>
                      $2.4K
                    </span>
                  </Group>
                </ActionIcon>
              </Tooltip>
            )}
            {/* <Tooltip label="Notifikasi">
              <ActionIcon variant="light" size="lg">
                <IconBell size={20} />
              </ActionIcon>
            </Tooltip> */}
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <UnstyledButton>
                  <Group gap="sm">
                    <Avatar
                      src={user?.avatar_url}
                      alt={user?.name}
                      size="sm"
                      color="blue"
                    >
                      {user?.name?.charAt(0)}
                    </Avatar>
                    <Stack gap={0}>
                      <Text size="sm" fw={500}>
                        {user?.name}
                      </Text>
                      <Text size="xs" c="gray.6">
                        {user?.role === 'ADMIN' ? 'Administrator' : 'Mahasiswa'}
                      </Text>
                    </Stack>
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Akun</Menu.Label>
                <Menu.Item
                  leftSection={<IconUser size={14} />}
                  onClick={() => router.push('/dashboard/profile')}
                >
                  Profil Saya
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconSettings size={14} />}
                  onClick={() => router.push('/dashboard/settings')}
                >
                  Pengaturan
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  color="red"
                  leftSection={<IconLogout size={14} />}
                  onClick={handleLogout}
                >
                  Keluar
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md" style={{ display: 'flex', flexDirection: 'column' }}>
        <style>{`
          @keyframes floatChar {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
          }
          .sidebar-char { animation: floatChar 3s ease-in-out infinite; }
        `}</style>

        <Stack gap="xs" style={{ flex: 1 }}>
          <Text size="xs" fw={700} c="gray.6" tt="uppercase" mb="sm">
            {isAdmin() ? 'Menu Admin' : 'Menu Siswa'}
          </Text>
          {navLinks.map((link) => (
            <NavLink
              key={link.href}
              icon={link.icon}
              label={link.label}
              href={link.href}
              active={pathname === link.href}
              onClick={() => handleNavClick(link.href)}
              badge={link.badge}
              badgeColor={link.badgeColor}
            />
          ))}
          <Divider my="md" />
          <Text size="xs" fw={700} c="gray.6" tt="uppercase" mb="sm">
            Sistem Informasi
          </Text>
          <Box p="sm" bg="gray.0" style={{ borderRadius: '8px' }}>
            <Text size="xs" c="gray.6" mb="xs">
              Peran: {user?.role === 'ADMIN' ? 'Administrator' : 'Siswa'}
            </Text>
            <Group gap="xs">
              <Box w={8} h={8} bg="green" style={{ borderRadius: '50%' }} />
              <Text size="xs" fw={500}>
                Online
              </Text>
            </Group>
          </Box>
        </Stack>

        {/* ── Character + Quote ── */}
        <Stack gap={0} align="center" pt="md" pb="xs">
          {/* Male researcher character */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/animasi%20tampilan%20dasbord%20(laki-laki).png"
            alt="Karakter Peneliti"
            className="sidebar-char"
            style={{
              width: 190,
              height: 190,
              objectFit: 'contain',
              objectPosition: 'bottom',
              filter: 'drop-shadow(0 8px 20px rgba(99,102,241,0.15))',
            }}
          />

          {/* Quote card */}
          <Box
            style={{
              background: 'linear-gradient(135deg, #fff 0%, #f8f0ff 100%)',
              border: '1px solid rgba(139,92,246,0.2)',
              borderRadius: 14,
              padding: '14px 16px',
              width: '100%',
              boxShadow: '0 4px 16px rgba(139,92,246,0.08)',
            }}
          >
            <Text
              size="xl"
              style={{ color: '#845ef7', fontWeight: 700, lineHeight: 1 }}
              mb={4}
            >
              ❝
            </Text>
            <Text
              size="sm"
              fw={600}
              style={{ color: '#3730a3', lineHeight: 1.5 }}
            >
              Riset hari ini,
              <br />
              berdampak untuk
              <br />
              masa depan.
            </Text>
            <Group justify="flex-end" mt={10}>
              <Box
                style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #e040fb 0%, #7c3aed 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <span style={{ color: 'white', fontSize: 12 }}>♥</span>
              </Box>
            </Group>
          </Box>
        </Stack>
      </AppShell.Navbar>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}

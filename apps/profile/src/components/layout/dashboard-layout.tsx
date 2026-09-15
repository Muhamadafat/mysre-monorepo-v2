"use client"

import type React from "react"
import { usePathname, useRouter } from "next/navigation"
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
} from "@mantine/core"
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
} from "@tabler/icons-react"
import { useDisclosure } from "@mantine/hooks"

interface User {
  id: string
  email: string
  name: string
  role: "USER" | "ADMIN"
  token_balance?: number
  avatar_url?: string
}

interface DashboardLayoutProps {
  children: React.ReactNode
  user: User
}

interface NavLinkProps {
  icon: React.ReactNode
  label: string
  href: string
  active?: boolean
  onClick?: () => void
  badge?: string | number
  badgeColor?: string
}

function NavLink({ icon, label, href, active, onClick, badge, badgeColor = "blue" }: NavLinkProps) {
  return (
    <UnstyledButton
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        padding: "12px 16px",
        borderRadius: "8px",
        marginBottom: "6px",
        textDecoration: "none",
        backgroundColor: active ? "rgba(102, 126, 234, 0.1)" : "transparent",
        color: active ? "#4c6ef5" : "#495057",
        fontWeight: active ? 600 : 500,
        borderLeft: active ? "4px solid #4c6ef5" : "4px solid transparent",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.03)"
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = "transparent"
      }}
    >
      <Group gap="md" style={{ flex: 1 }}>
        <Box style={{ color: active ? "#4c6ef5" : "#868e96" }}>{icon}</Box>
        <Text size="sm" style={{ flex: 1, letterSpacing: "0.3px" }}>
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
  )
}

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const [opened, { toggle, close }] = useDisclosure()
  const pathname = usePathname()
  const router = useRouter()

  // Check if user is admin
  const isAdmin = () => user?.role === "ADMIN"

  const WRITER_APP_URL = process.env.NEXT_PUBLIC_WRITER_APP_URL || "http://writer.lvh.me:3003"
  const BRAIN_APP_URL = process.env.NEXT_PUBLIC_BRAIN_APP_URL || "http://brain.lvh.me:3001"

  // Navigation links - different for admin vs user
  const getNavLinks = () => {
    if (isAdmin()) {
      // Admin navigation (existing)
      return [
        {
          icon: <IconDashboard size={20} />,
          label: "Dashboard",
          href: "/dashboard",
        },
        {
          icon: <IconUsers size={20} />,
          label: "Pengguna",
          href: "/dashboard/users",
        },
        {
          icon: <IconFileText size={20} />,
          label: "List Artikel",
          href: "/dashboard/articles",
        },
        {
          icon: <IconClipboardList size={20} />,
          label: "Assignment",
          href: "/dashboard/assignments",
          badge: "NEW",
          badgeColor: "red",
        },
        {
          icon: <IconPencil size={20} />,
          label: "Project Writer",
          href: WRITER_APP_URL,
        },
        {
          icon: <IconBulb size={20} />,
          label: "Project Brainstorm",
          href: BRAIN_APP_URL,
        },
        {
          icon: <IconReportAnalytics size={20} />,
          label: "Learning Analytics",
          href: "/dashboard/analytics",
        },
        {
          icon: <IconReceipt size={20} />,
          label: "Billing & Tokens",
          href: "/dashboard/billing",
          badge: "NEW",
          badgeColor: "green",
        },
      ]
    } else {
      // User/Student navigation
      return [
        {
          icon: <IconDashboard size={20} />,
          label: "Dashboard",
          href: "/dashboard",
        },
        {
          icon: <IconClipboardList size={20} />,
          label: "Tugas Saya",
          href: "/dashboard/assignments",
          badge: "BARU",
          badgeColor: "blue",
        },
        {
          icon: <IconBulb size={20} />,
          label: "Brainstorming",
          href: BRAIN_APP_URL,
          badge: "AI",
          badgeColor: "violet",
        },
        {
          icon: <IconPencil size={20} />,
          label: "Writer",
          href: WRITER_APP_URL,
        },
        {
          icon: <IconReportAnalytics size={20} />,
          label: "Analitik Saya",
          href: "/dashboard/analytics",
        },
      ]
    }
  }

  const navLinks = getNavLinks()

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/signout", {
        method: "POST",
      })
      if (res.ok) {
        console.log("Berhasil logout")
        const loginUrl = `${process.env.NEXT_PUBLIC_MAIN_APP_URL || "http://main.lvh.me:3000"}/signin`
        window.location.href = loginUrl
      } else {
        console.error("Tidak berhasil logout")
      }
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  const handleNavClick = (href: string) => {
    // Other apps share the session cookie via the .lvh.me domain, so cross-app
    // navigation is a plain link — no token handshake needed.
    if (href.startsWith("http")) {
      window.open(href, "_blank")
    } else {
      router.push(href)
    }
    close()
  }

  return (
    <AppShell
      header={{ height: 70 }}
      navbar={{
        width: 300,
        breakpoint: "sm",
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Group gap="sm" style={{ display: "flex", alignItems: "center" }}>
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
            {/* Revenue Indicator (untuk admin) */}
            {isAdmin() && (
              <Tooltip label="Monthly Revenue">
                <ActionIcon variant="light" size="lg" color="green">
                  <Group gap="xs">
                    <IconCurrencyDollar size={16} />
                    <span style={{ fontSize: "12px", fontWeight: 600 }}>$2.4K</span>
                  </Group>
                </ActionIcon>
              </Tooltip>
            )}
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <UnstyledButton>
                  <Group gap="sm">
                    <Avatar src={user?.avatar_url} alt={user?.name} size="sm" color="blue">
                      {user?.name?.charAt(0)}
                    </Avatar>
                    <Stack gap={0}>
                      <Text size="sm" fw={500}>
                        {user?.name}
                      </Text>
                      <Text size="xs" c="gray.6">
                        {user?.role === "ADMIN" ? "Administrator" : "Mahasiswa"}
                      </Text>
                    </Stack>
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Akun</Menu.Label>
                <Menu.Item leftSection={<IconUser size={14} />} onClick={() => router.push("/dashboard/profile")}>
                  Profil Saya
                </Menu.Item>
                <Menu.Item leftSection={<IconSettings size={14} />} onClick={() => router.push("/dashboard/settings")}>
                  Pengaturan
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" leftSection={<IconLogout size={14} />} onClick={handleLogout}>
                  Keluar
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md" style={{ display: "flex", flexDirection: "column" }}>
        <style>{`
          @keyframes floatChar {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
          }
          .sidebar-char { animation: floatChar 3s ease-in-out infinite; }
        `}</style>

        <Stack gap="xs" style={{ flex: 1 }}>
          <Text size="xs" fw={700} c="gray.6" tt="uppercase" mb="sm">
            {isAdmin() ? "Menu Admin" : "Menu Siswa"}
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
          <Box p="sm" bg="gray.0" style={{ borderRadius: "8px" }}>
            <Text size="xs" c="gray.6" mb="xs">
              Peran: {user?.role === "ADMIN" ? "Administrator" : "Siswa"}
            </Text>
            <Group gap="xs">
              <Box w={8} h={8} bg="green" style={{ borderRadius: "50%" }} />
              <Text size="xs" fw={500}>
                Online
              </Text>
            </Group>
          </Box>
        </Stack>

        {/* ── Character + Quote ── */}
        <Stack gap={0} align="center" pt="md" pb="xs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/animasi%20tampilan%20dasbord%20(laki-laki).png"
            alt="Karakter Peneliti"
            className="sidebar-char"
            style={{
              width: 190,
              height: 190,
              objectFit: "contain",
              objectPosition: "bottom",
              filter: "drop-shadow(0 8px 20px rgba(99,102,241,0.15))",
            }}
          />

          <Box
            style={{
              background: "linear-gradient(135deg, #fff 0%, #f8f0ff 100%)",
              border: "1px solid rgba(139,92,246,0.2)",
              borderRadius: 14,
              padding: "14px 16px",
              width: "100%",
              boxShadow: "0 4px 16px rgba(139,92,246,0.08)",
            }}
          >
            <Text size="xl" style={{ color: "#845ef7", fontWeight: 700, lineHeight: 1 }} mb={4}>
              ❝
            </Text>
            <Text size="sm" fw={600} style={{ color: "#3730a3", lineHeight: 1.5 }}>
              Riset hari ini,
              <br />
              berdampak untuk
              <br />
              masa depan.
            </Text>
            <Group justify="flex-end" mt={10}>
              <Box
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #e040fb 0%, #7c3aed 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ color: "white", fontSize: 12 }}>♥</span>
              </Box>
            </Group>
          </Box>
        </Stack>
      </AppShell.Navbar>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  )
}

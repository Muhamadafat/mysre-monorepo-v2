"use client"

import {
  Container,
  Flex,
  Group,
  Box,
  Text,
  ActionIcon,
  Burger,
  ThemeIcon,
  Image
} from "@mantine/core"
import { IconNetwork, IconMoon } from "@tabler/icons-react"
import { HeaderUtilityIcons } from "./HeaderUtilityIcons"

interface DashboardHeaderProps {
  sidebarOpened: boolean
  onToggleSidebar: () => void
  mounted: boolean
  /** When false, the utility icon cluster (session, help, dark mode, settings,
   * avatar) is hidden from the header — used when those icons are shown in a
   * permanent rail instead (see DashboardNavbar `railMode`). */
  showUtilityIcons?: boolean
}

export function DashboardHeader({ sidebarOpened, onToggleSidebar, mounted, showUtilityIcons = true }: DashboardHeaderProps) {

  if (!mounted) {
    return (
      <Container fluid h="100%" px="xl">
        <Flex h="100%" justify="space-between" align="center">
          <Group gap="md">
            <Burger opened={false} onClick={() => {}} size="sm" />
            <Group gap="xs">
              <ThemeIcon variant="gradient" gradient={{ from: "blue", to: "cyan", deg: 45 }} size="lg" radius="md">
                <IconNetwork size={20} />
              </ThemeIcon>
              <Box>
                <Text fw={800} size="xl" variant="gradient" gradient={{ from: "blue", to: "cyan", deg: 45 }}>
                  mySRE
                </Text>
                <Text size="xs" c="dimmed">
                  Knowledge Visualization Platform
                </Text>
              </Box>
            </Group>
          </Group>
          <Group gap="sm">
            <ActionIcon variant="light" color="blue" size="lg" radius="md" disabled>
              <IconMoon size={18} />
            </ActionIcon>
          </Group>
        </Flex>
      </Container>
    )
  }

  return (
    <>
    <Container fluid h="100%" px="xl">
      <Flex h="100%" justify="space-between" align="center">
        <Group gap="md">
          <Burger opened={sidebarOpened} onClick={onToggleSidebar} size="sm" />
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
              <Image
                src='/images/logoSRE_IDE.png'
                alt="My-SRE Logo"
                width={160}
                height={50}
                fit="contain"
                style={{ alignSelf: "flex-start" }}
              />
            </Box>
          </Group>
        </Group>

        {showUtilityIcons && (
          <Group gap="sm">
            <HeaderUtilityIcons mounted={mounted} orientation="horizontal" />
          </Group>
        )}
      </Flex>
    </Container>
    </>
  )
}

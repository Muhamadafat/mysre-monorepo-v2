"use client"
import {
  AppShell,
  Burger,
  Button,
  Container,
  Group,
  UnstyledButton,
  Image,
  Box
} from "@mantine/core"
import { useDisclosure } from "@mantine/hooks"
import { IconArrowRight } from "@tabler/icons-react"
import Link from "next/link"
export function Header() {
  const [opened, { toggle }] = useDisclosure(false)

  const navItems = [
    { label: "Fitur", href: "#features" },
    { label: "Cara Kerja", href: "#how-it-works" },
    { label: "Testimoni", href: "#testimonials" },
    { label: "Harga", href: "#pricing" },
    { label: "Pertanyaan Umum", href: "#faq" },
  ]

  return (
    <AppShell.Header>
      <Container size="xl" h="100%">
        <Group justify="space-between" h="100%">
          {/* Logo */}
          <Group gap="xs">
            <Box>
                <Image
                src='/webp/logoSRE.webp'
                alt="My-SRE Dashboard"
                height={40}
                radius="xs"
                // className={classes.heroImage}
                />
            </Box>
          </Group>

          {/* Desktop Navigation */}
          <Group gap="xl" visibleFrom="md">
            {navItems.map((item) => (
              <UnstyledButton
                key={item.label}
                component={Link}
                href={item.href}
                c="dimmed"
                fw={500}
                style={{ textDecoration: "none" }}
                className="hover:text-blue-600 transition-colors"
              >
                {item.label}
              </UnstyledButton>
            ))}
          </Group>

          {/* Desktop Actions */}
          <Group gap="md" visibleFrom="md">
            <Button variant="subtle" component={Link} href="/signin">
              Masuk
            </Button>
            <Button component={Link} href="/signup" rightSection={<IconArrowRight size={16} />}>
              Mulai Sekarang
            </Button>
          </Group>

          {/* Mobile Menu */}
          <Group gap="md" hiddenFrom="md">
            <Burger opened={opened} onClick={toggle} size="sm" />
          </Group>
        </Group>
      </Container>
    </AppShell.Header>
  )
}

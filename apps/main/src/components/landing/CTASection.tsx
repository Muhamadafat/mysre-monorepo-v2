'use client';

import {
  Container,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Box,
  ThemeIcon,
  Grid,
  Image,
  Card,
  Flex,
  Badge,
} from '@mantine/core';
import { IconArrowRight, IconCheck, IconHelp } from '@tabler/icons-react';
import classes from './CTASection.module.css';

export function CTASection() {
  return (
    <Box
      className={classes.cta}
      style={{
        backgroundImage: "url('/images/cta-bg.png')",
      }}
    >
      <Container size="xl" pt={80} pb={80}>
        <Grid align="center" gap={60}>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Stack align="flex-start" gap="lg">
              <Badge
                variant="filled"
                color="rgba(255, 255, 255, 0.2)"
                c="white"
                radius="xl"
                size="lg"
                leftSection={<IconHelp size={16} />}
                className={classes.ctaBadge}
                style={{
                  backdropFilter: 'blur(10px)',
                  padding: '0 16px',
                  height: '32px',
                }}
              >
                PERTANYAAN UMUM
              </Badge>

              <Title
                order={2}
                size="3.5rem"
                fw={700}
                c="white"
                style={{ lineHeight: 1.2 }}
              >
                Siap Mengubah{' '}
                <span style={{ color: '#FFD43B' }}>
                  Proses Penelitian Anda?
                </span>
              </Title>

              <Text size="lg" c="white" opacity={0.9} maw={600}>
                Bergabunglah dengan ribuan peneliti yang telah merevolusi alur
                kerja mereka dengan bantuan penulisan bertenaga AI dan pemetaan
                pengetahuan visual.
              </Text>

              <Group gap="md" mt="sm">
                <Button
                  size="md"
                  variant="white"
                  c="blue.7"
                  radius="xl"
                  rightSection={<IconArrowRight size={18} />}
                >
                  Mulai Uji Coba Gratis
                </Button>
                <Button
                  size="md"
                  variant="outline"
                  c="white"
                  radius="xl"
                  style={{ borderColor: 'rgba(255,255,255,0.5)' }}
                >
                  Jadwalkan Demo
                </Button>
              </Group>

              <Group gap="lg" mt="md">
                <Group gap="xs">
                  <ThemeIcon size="sm" variant="transparent" color="white">
                    <IconCheck size={16} stroke={3} />
                  </ThemeIcon>
                  <Text size="sm" c="white" fw={500}>
                    Uji coba gratis 14 hari
                  </Text>
                </Group>
                <Group gap="xs">
                  <ThemeIcon size="sm" variant="transparent" color="white">
                    <IconCheck size={16} stroke={3} />
                  </ThemeIcon>
                  <Text size="sm" c="white" fw={500}>
                    Tidak perlu kartu kredit
                  </Text>
                </Group>
                <Group gap="xs">
                  <ThemeIcon size="sm" variant="transparent" color="white">
                    <IconCheck size={16} stroke={3} />
                  </ThemeIcon>
                  <Text size="sm" c="white" fw={500}>
                    Batalkan kapan saja
                  </Text>
                </Group>
              </Group>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
            <Image
              src="/images/cta-animasi.png"
              alt="Animasi Peneliti"
              fit="contain"
              w="110%"
              className={classes.ctaImage}
            />
          </Grid.Col>
        </Grid>

        {/* Kolaborasi Inovasi Section */}
        <Card radius="xl" padding="xl" mt={80} bg="white" shadow="md">
          <Stack align="center" gap="xl">
            {/* Judul */}
            <Group w="100%" wrap="nowrap" align="center">
              <Box style={{ flex: 1, height: 1, backgroundColor: 'var(--mantine-color-gray-3)' }} />
              <Box style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--mantine-color-blue-7)' }} />
              <Title order={3} size="h2" fw={700} ta="center" c="dark.9" px="md">
                Kolaborasi Inovasi dari berbagai kalangan
              </Title>
              <Box style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--mantine-color-blue-7)' }} />
              <Box style={{ flex: 1, height: 1, backgroundColor: 'var(--mantine-color-gray-3)' }} />
            </Group>

            {/* Semua logo dalam SATU BARIS, ukuran sama rata */}
            <Flex w="100%" align="center" justify="center" gap={0} wrap="wrap" style={{ rowGap: 24 }}>

              {/* Grup 1: Diprakarsai oleh */}
              <Stack align="center" gap={12} px={28} py={8}>
                <Text fw={600} size="xs" c="dimmed" tt="uppercase" style={{ letterSpacing: 1 }}>Diprakarsai oleh</Text>
                <Flex gap={20} align="center" justify="center">
                  <Box style={{ width: 88, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Image src="/images/brin.jpg" alt="BRIN" h={72} w={88} fit="contain" className={classes.logoImage} />
                  </Box>
                  <Box style={{ width: 88, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Image src="/webp/ub.webp" alt="Universitas Brawijaya" h={72} w={88} fit="contain" className={classes.logoImage} />
                  </Box>
                </Flex>
              </Stack>

              {/* Divider */}
              <Box style={{ width: 1, height: 88, backgroundColor: 'var(--mantine-color-gray-3)', flexShrink: 0, alignSelf: 'center' }} />

              {/* Grup 2: Didanai oleh */}
              <Stack align="center" gap={12} px={28} py={8}>
                <Text fw={600} size="xs" c="dimmed" tt="uppercase" style={{ letterSpacing: 1 }}>Didanai oleh</Text>
                <Box style={{ width: 140, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Image src="/images/lpdp.png" alt="LPDP" h={72} w={140} fit="contain" className={classes.logoImage} />
                </Box>
              </Stack>

              {/* Divider */}
              <Box style={{ width: 1, height: 88, backgroundColor: 'var(--mantine-color-gray-3)', flexShrink: 0, alignSelf: 'center' }} />

              {/* Grup 3: Didukung oleh */}
              <Stack align="center" gap={12} px={28} py={8}>
                <Text fw={600} size="xs" c="dimmed" tt="uppercase" style={{ letterSpacing: 1 }}>Didukung oleh</Text>
                <Flex gap={20} align="center" justify="center">
                  <Box style={{ width: 88, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Image src="/webp/unpas.webp" alt="Universitas Pasundan" h={72} w={88} fit="contain" className={classes.logoImage} />
                  </Box>
                  <Box style={{ width: 88, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Image src="/webp/uin.webp" alt="UIN Sultan Maulana Hasanuddin" h={72} w={88} fit="contain" className={classes.logoImage} />
                  </Box>
                  <Box style={{ width: 88, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Image src="/images/telu.png" alt="Telkom University" h={72} w={88} fit="contain" className={classes.logoImage} />
                  </Box>
                </Flex>
              </Stack>

            </Flex>
          </Stack>
        </Card>
      </Container>
    </Box>
  );
}

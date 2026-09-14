"use client"

import { Container, Title, Text, Button, Group, Stack, Badge, Image, Box, ThemeIcon, Grid } from "@mantine/core"
import { IconCheck, IconArrowRight, IconBolt } from "@tabler/icons-react"
import classes from "./HeroSection.module.css"
import { useRouter } from "next/navigation"

export function HeroSection() {
  const router = useRouter();

  return (
    <Box className={classes.hero}>
      <Container size="xl" py={{ base: 80, md: 120 }}>
        <Grid gutter="xl" align="center">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Stack align="flex-start" gap="xl">
              <Badge 
                size="lg" 
                variant="light" 
                color="blue" 
                radius="xl"
                leftSection={<IconBolt size={14} style={{ color: '#FFD700', fill: '#FFD700' }} />}
                style={{ padding: '0 16px', fontWeight: 600 }}
              >
                AKSES AWAL - COBA SEKARANG!
              </Badge>

              <Title order={1} size="3.5rem" fw={900} className={classes.title} maw={800} ta="left" lh={1.1}>
                Desain Draft Penelitian Anda dengan <Text component="span" c="blue" inherit>Tools Bertenaga AI</Text>
              </Title>

              <Text size="xl" className={classes.descriptionText} maw={600} ta="left">
                Sederhanakan proses penelitian Anda dengan bantuan penulisan cerdas dan pemetaan pengetahuan visual. 
                Dari pembuatan draft hingga manajemen sitasi, kami siap membantu Anda.
              </Text>

              <Group gap="md">
                <Button size="lg" rightSection={<IconArrowRight size={18} />} 
                  onClick={() => router.push('/signup')}
                  radius="md"
                >
                  Mulai Sekarang
                </Button>
                <Button size="lg" variant="default" onClick={() => router.push('/signin')} radius="md" style={{ backgroundColor: 'transparent' }}>
                  Masuk
                </Button>
              </Group>

              <Group gap="xl" mt="md">
                <Group gap="xs">
                  <ThemeIcon size="sm" variant="filled" color="green" radius="xl">
                    <IconCheck size={12} stroke={3} />
                  </ThemeIcon>
                  <Text size="sm" fw={500} className={classes.featureText}>
                    Akses langsung
                  </Text>
                </Group>
                <Group gap="xs">
                  <ThemeIcon size="sm" variant="filled" color="green" radius="xl">
                    <IconCheck size={12} stroke={3} />
                  </ThemeIcon>
                  <Text size="sm" fw={500} className={classes.featureText}>
                    Fitur lengkap
                  </Text>
                </Group>
                <Group gap="xs">
                  <ThemeIcon size="sm" variant="filled" color="green" radius="xl">
                    <IconCheck size={12} stroke={3} />
                  </ThemeIcon>
                  <Text size="sm" fw={500} className={classes.featureText}>
                    Penggunaan fleksibel
                  </Text>
                </Group>
              </Group>
            </Stack>
          </Grid.Col>
          
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Box pos="relative" style={{ transform: 'scale(1.15)', transformOrigin: 'center right' }}>
              <Image
                src='/hero-animation.png'
                alt="Riset AI Animation"
                className={classes.heroAnimation}
                w="100%"
                fit="contain"
              />
            </Box>
          </Grid.Col>
        </Grid>
      </Container>
    </Box>
  )
}

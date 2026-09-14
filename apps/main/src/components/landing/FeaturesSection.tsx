"use client"

import { Container, Title, Text, SimpleGrid, Card, Group, Stack, Badge, Box, Image, Grid } from "@mantine/core"
import {
  IconPencil,
  IconQuote,
  IconFileText,
  IconNetwork,
  IconChartBar,
  IconMessageChatbot,
  IconSparkles
} from "@tabler/icons-react"
import classes from "./FeaturesSection.module.css"

const features = [
  {
    icon: IconPencil,
    title: "Penulis Cerdas",
    description: "AI canggih membantu Anda menulis, meringkas, dan memformat dengan kualitas akademik tinggi.",
    color: "blue",
    iconBg: "var(--mantine-color-blue-0)",
    iconColor: "var(--mantine-color-blue-6)",
  },
  {
    icon: IconQuote,
    title: "Manajemen Sitasi",
    description: "Kelola referensi, kutip otomatis, dan buat daftar pustaka dengan berbagai gaya sitasi.",
    color: "green",
    iconBg: "var(--mantine-color-green-0)",
    iconColor: "var(--mantine-color-green-6)",
  },
  {
    icon: IconFileText,
    title: "Daftar Referensi",
    description: "Temukan jurnal, artikel, dan sumber relevan untuk memperkaya penelitian Anda.",
    color: "orange",
    iconBg: "var(--mantine-color-orange-0)",
    iconColor: "var(--mantine-color-orange-6)",
  },
  {
    icon: IconNetwork,
    title: "Peta Pengetahuan",
    description: "Visualisasikan hubungan konsep dan temukan insight melalui peta interaktif.",
    color: "grape",
    iconBg: "var(--mantine-color-grape-0)",
    iconColor: "var(--mantine-color-grape-6)",
  },
  {
    icon: IconChartBar,
    title: "Grafik Interaktif",
    description: "Ubah data dan konsep kompleks menjadi visual yang mudah dipahami.",
    color: "blue",
    iconBg: "var(--mantine-color-blue-0)",
    iconColor: "var(--mantine-color-blue-6)",
  },
  {
    icon: IconMessageChatbot,
    title: "Asisten Chat AI",
    description: "Tanya, diskusi, dan dapatkan jawaban instan tentang topik penelitian Anda.",
    color: "pink",
    iconBg: "var(--mantine-color-pink-0)",
    iconColor: "var(--mantine-color-pink-6)",
  },
]

export function FeaturesSection() {
  return (
    <Box id="features" py={{ base: 80, md: 120 }} className={classes.features}>
      <Container size="xl">
        <Grid gap={60} align="center" mb={60}>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Stack align="flex-start" gap="xl">
              <Badge 
                size="lg" 
                variant="light" 
                color="indigo" 
                radius="xl"
                leftSection={<IconSparkles size={14} style={{ color: '#FFD700', fill: '#FFD700' }} />}
                style={{ padding: '0 16px', fontWeight: 600 }}
              >
                FITUR
              </Badge>
              <Title order={2} size="3rem" fw={800} className={classes.title} lh={1.2}>
                Semua yang Anda Butuhkan untuk <Text component="span" c="blue" inherit>Penelitian Unggul</Text>
              </Title>
              <Text size="xl" c="dimmed" maw={600}>
                Platform komprehensif kami menggabungkan alat penelitian cerdas dengan manajemen pengetahuan visual 
                untuk merevolusi alur kerja penelitian Anda.
              </Text>
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Box pos="relative">
              <Image
                src='/animasi-fitur.png'
                alt="Fitur Animasi"
                w="100%"
                fit="contain"
                className={classes.featureAnimation}
              />
            </Box>
          </Grid.Col>
        </Grid>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="xl">
          {features.map((feature, index) => (
            <Card key={index} padding="xl" radius="lg" className={classes.featureCard}>
              <Group align="flex-start" wrap="nowrap" gap="md">
                <Box className={classes.iconWrapper} style={{ backgroundColor: feature.iconBg }}>
                  <feature.icon size={28} color={feature.iconColor} stroke={2} />
                </Box>
                <Stack gap="xs">
                  <Text size="lg" fw={700} c="blue.7">
                    {feature.title}
                  </Text>
                  <Text c="dimmed" size="sm" lh={1.6}>
                    {feature.description}
                  </Text>
                </Stack>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  )
}

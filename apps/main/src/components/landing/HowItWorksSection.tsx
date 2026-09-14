"use client"

import {
  Container,
  Title,
  Text,
  Timeline,
  ThemeIcon,
  Stack,
  Badge,
  Box,
  Group,
  Card,
  Image,
  Grid
} from "@mantine/core"
import { IconUpload, IconNetwork, IconPencil, IconDownload, IconSparkles } from "@tabler/icons-react"
import classes from "./HowItWorksSection.module.css"

const steps = [
  {
    icon: IconUpload,
    title: "Unggah Penelitian Anda",
    description:
      "Impor artikel, proposal, makalah, dan dokumen ke dalam platform AI kami akan menganalisis dan mengkategorikannya secara otomatis.",
    color: "blue",
    iconBg: "var(--mantine-color-blue-0)",
    iconColor: "var(--mantine-color-blue-6)",
  },
  {
    icon: IconNetwork,
    title: "Bangun Peta Pengetahuan",
    description:
      "Saksikan artikel-artikel Anda diubah menjadi grafik pengetahuan interaktif yang mengungkap koneksi dan hubungan antar konsep.",
    color: "grape",
    iconBg: "var(--mantine-color-grape-0)",
    iconColor: "var(--mantine-color-grape-6)",
  },
  {
    icon: IconPencil,
    title: "Tulis dengan Bantuan AI",
    description:
      "Gunakan penulis cerdas kami untuk menyusun draft penelitian dengan saran AI, digest otomatis, dan manajemen referensi real-time.",
    color: "green",
    iconBg: "var(--mantine-color-green-0)",
    iconColor: "var(--mantine-color-green-6)",
  },
  {
    icon: IconDownload,
    title: "Unduh & Bagikan",
    description:
      "Unduh draft yang sudah selesai dalam berbagai format dan bagikan peta pengetahuan Anda dengan tim kolaborasi.",
    color: "orange",
    iconBg: "var(--mantine-color-orange-0)",
    iconColor: "var(--mantine-color-orange-6)",
  },
]

export function HowItWorksSection() {
  return (
    <Box id="how-it-works" py={{ base: 80, md: 120 }} className={classes.howItWorks}>
      <Container size="xl">
        <Grid gutter={60} align="center">
          
          {/* Bagian Kiri: Teks dan Gambar Animasi */}
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Stack align="flex-start" gap="xl">
              <Badge 
                size="lg" 
                variant="light" 
                color="indigo" 
                radius="xl"
                leftSection={<IconSparkles size={14} style={{ color: '#FFD700', fill: '#FFD700' }} />}
                style={{ padding: '0 16px', fontWeight: 600 }}
              >
                CARA KERJA
              </Badge>
              <Title order={2} size="3rem" fw={800} className={classes.title} lh={1.2}>
                Dari Penelitian ke Draft dalam <Text component="span" c="blue" inherit>4 Langkah</Text> Sederhana
              </Title>
              <Text size="xl" c="dimmed" maw={600}>
                Alur kerja yang efisien membantu Anda mengubah penelitian yang tersebar menjadi draft akademik yang koheren 
                dan terstruktur dengan baik secara efisien.
              </Text>
              <Box pos="relative" w="100%" mt="xl" style={{ transform: 'scale(1.35)', transformOrigin: 'top center' }}>
                <Image
                  src='/animasi-carakerja-v2.png'
                  alt="Cara Kerja Animasi"
                  className={classes.animationImage}
                  w="100%"
                  fit="contain"
                />
              </Box>
            </Stack>
          </Grid.Col>

          {/* Bagian Kanan: Timeline */}
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Box pl={{ base: 0, md: 40 }}>
              <Timeline active={4} bulletSize={48} lineWidth={2} color="blue">
                {steps.map((step, index) => (
                  <Timeline.Item
                    key={index}
                    bullet={
                      <ThemeIcon size={48} radius="xl" color={step.color}>
                        <Text size="lg" fw={700} c="white">
                          0{index + 1}
                        </Text>
                      </ThemeIcon>
                    }
                  >
                    <Card shadow="sm" padding="xl" radius="lg" className={classes.stepCard} ml="md" mb="xl">
                      <Group align="flex-start" wrap="nowrap" gap="md">
                        <Box className={classes.iconWrapper} style={{ backgroundColor: step.iconBg }}>
                          <step.icon size={24} color={step.iconColor} stroke={2} />
                        </Box>
                        <Stack gap="xs">
                          <Title order={3} size="xl" fw={700} c="dark.9">
                            {step.title}
                          </Title>
                          <Text c="dimmed" size="md" lh={1.6}>
                            {step.description}
                          </Text>
                        </Stack>
                      </Group>
                    </Card>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Box>
          </Grid.Col>
          
        </Grid>
      </Container>
    </Box>
  )
}

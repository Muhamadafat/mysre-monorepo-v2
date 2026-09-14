"use client"

import {
  Container,
  Title,
  Text,
  SimpleGrid,
  Card,
  Button,
  List,
  ThemeIcon,
  Stack,
  Badge,
  Box,
  Group,
  Grid
} from "@mantine/core"
import { IconCheck, IconX, IconSparkles } from "@tabler/icons-react"
import { useState } from "react"
import classes from "./PricingSection.module.css"
import { WalkingPiggy } from "./WalkingPiggy"

const plans = {
  monthly: [
    {
      name: "Tulis",
      price: "Rp 0",
      period: "/bulan",
      description: "Sempurna untuk penulisan akademik individu",
      features: [
        { text: "Tulis draft artikel unlimited", included: true },
        { text: "Lihat dan kelola artikel", included: true },
        { text: "Daftar artikel terorganisir", included: true },
        { text: "Manajemen referensi otomatis", included: true },
        { text: "Annotasi dasar", included: true },
        { text: "Export PDF & Word", included: true },
        { text: "Dukungan email", included: true },
        { text: "Visualisasi artikel", included: false },
        { text: "Chat AI dengan dokumen", included: false },
        { text: "Kolaborasi tim", included: false },
      ],
      cta: "Mulai Uji Coba Gratis",
      popular: false,
    },
    {
      name: "Tulis-Ide",
      price: "Rp 0",
      period: "/bulan",
      description: "Ideal untuk peneliti aktif dengan kebutuhan visual",
      features: [
        { text: "Semua fitur Tulis", included: true },
        { text: "Visualisasi peta artikel", included: true },
        { text: "Grafik hubungan konsep", included: true },
        { text: "Chat AI dengan koleksi artikel", included: true },
        { text: "Annotasi lanjutan dengan highlight", included: true },
        { text: "Mind mapping otomatis", included: true },
        { text: "Export dalam semua format", included: true },
        { text: "Dukungan prioritas", included: true },
        { text: "Kolaborasi tim (hingga 3 orang)", included: false },
        { text: "Integrasi custom", included: false },
      ],
      cta: "Mulai Uji Coba Gratis",
      popular: true,
    },
    {
      name: "Kolaboratif",
      price: "Rp 0",
      period: "/bulan",
      description: "Untuk tim peneliti dan institusi",
      features: [
        { text: "Semua fitur Tulis-Ide", included: true },
        { text: "Kolaborasi tim unlimited", included: true },
        { text: "Co-writing real-time", included: true },
        { text: "Berbagi workspace", included: true },
        { text: "Komentar dan review kolaboratif", included: true },
        { text: "Version control artikel", included: true },
        { text: "Manajemen hak akses", included: true },
        { text: "Dashboard admin tim", included: true },
        { text: "Backup otomatis cloud", included: true },
        { text: "Dukungan 24/7", included: true },
      ],
      cta: "Hubungi Tim Penjualan",
      popular: false,
    },
  ],
  yearly: [
    {
      name: "Tulis",
      price: "Rp 0",
      period: "/bulan",
      description: "Sempurna untuk penulisan akademik individu",
      features: [
        { text: "Tulis draft artikel unlimited", included: true },
        { text: "Lihat dan kelola artikel", included: true },
        { text: "Daftar artikel terorganisir", included: true },
        { text: "Manajemen referensi otomatis", included: true },
        { text: "Annotasi dasar", included: true },
        { text: "Export PDF & Word", included: true },
        { text: "Dukungan email", included: true },
        { text: "Visualisasi artikel", included: false },
        { text: "Chat AI dengan dokumen", included: false },
        { text: "Kolaborasi tim", included: false },
      ],
      cta: "Mulai Uji Coba Gratis",
      popular: false,
    },
    {
      name: "Tulis-Ide",
      price: "Rp 0",
      period: "/bulan",
      description: "Ideal untuk peneliti aktif dengan kebutuhan visual",
      features: [
        { text: "Semua fitur Tulis", included: true },
        { text: "Visualisasi peta artikel", included: true },
        { text: "Grafik hubungan konsep", included: true },
        { text: "Chat AI dengan koleksi artikel", included: true },
        { text: "Annotasi lanjutan dengan highlight", included: true },
        { text: "Mind mapping otomatis", included: true },
        { text: "Export dalam semua format", included: true },
        { text: "Dukungan prioritas", included: true },
        { text: "Kolaborasi tim (hingga 3 orang)", included: false },
        { text: "Integrasi custom", included: false },
      ],
      cta: "Mulai Uji Coba Gratis",
      popular: true,
    },
    {
      name: "Kolaboratif",
      price: "Rp 0",
      period: "/bulan",
      description: "Untuk tim peneliti dan institusi",
      features: [
        { text: "Semua fitur Tulis-Ide", included: true },
        { text: "Kolaborasi tim unlimited", included: true },
        { text: "Co-writing real-time", included: true },
        { text: "Berbagi workspace", included: true },
        { text: "Komentar dan review kolaboratif", included: true },
        { text: "Version control artikel", included: true },
        { text: "Manajemen hak akses", included: true },
        { text: "Dashboard admin tim", included: true },
        { text: "Backup otomatis cloud", included: true },
        { text: "Dukungan 24/7", included: true },
      ],
      cta: "Hubungi Tim Penjualan",
      popular: false,
    },
  ],
}

export function PricingSection() {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly")

  return (
    <Box id="pricing" py={{ base: 80, md: 100 }} className={classes.pricing}>
      <Container size="xl">
        <Grid gap={40} align="center" mb={60}>
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Stack align="flex-start" gap="md">
              <Badge 
                variant="light" 
                color="violet" 
                radius="xl"
                size="lg"
                leftSection={<IconSparkles size={14} />}
                style={{ padding: '4px 16px', fontWeight: 600, letterSpacing: '0.5px' }}
              >
                HARGA
              </Badge>
              <Title order={2} size="3.2rem" fw={800} className={classes.title} lh={1.1}>
                Harga Sederhana<br/>dan <Text component="span" c="violet.5" inherit>Transparan</Text>
              </Title>
              <Text size="lg" c="dimmed" maw={450} lh={1.6} mt="xs">
                Pilih paket yang sesuai dengan kebutuhan penelitian Anda. Semua paket termasuk uji coba gratis 14 hari.
              </Text>
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Box pos="relative" w="100%">
              <WalkingPiggy />
            </Box>
          </Grid.Col>
        </Grid>

        <Group justify="center" mb={50}>
          <Box className={classes.toggleWrapper}>
            <button 
              className={`${classes.toggleButton} ${billingPeriod === 'monthly' ? classes.toggleActive : ''}`}
              onClick={() => setBillingPeriod('monthly')}
            >
              Bulanan
            </button>
            <button 
              className={`${classes.toggleButton} ${billingPeriod === 'yearly' ? classes.toggleActive : ''}`}
              onClick={() => setBillingPeriod('yearly')}
            >
              Tahunan
              <Badge size="sm" variant="filled" color="green.6" ml="xs" radius="xl" style={{ fontWeight: 700, padding: '0 8px' }}>
                HEMAT 20%
              </Badge>
            </button>
          </Box>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="xl">
          {plans[billingPeriod].map((plan, index) => (
            <Card
              key={index}
              padding="xl"
              radius="lg"
              className={classes.pricingCard}
              style={{
                borderColor: plan.popular ? "#2563EB" : "transparent",
                borderWidth: plan.popular ? 2 : 1,
                borderStyle: 'solid',
                transform: plan.popular ? 'scale(1.03)' : 'none',
                zIndex: plan.popular ? 2 : 1,
              }}
            >
              <Stack gap="xl" h="100%">
                <Stack gap="sm" ta="center" pos="relative">
                  {plan.popular && (
                    <Badge 
                      size="md" 
                      variant="filled" 
                      color="blue.6" 
                      style={{ 
                        position: 'absolute', 
                        top: -40, 
                        left: '50%', 
                        transform: 'translateX(-50%)', 
                        borderRadius: '20px',
                        padding: '6px 16px',
                        height: 'auto',
                        fontWeight: 700
                      }}
                    >
                      PALING POPULER
                    </Badge>
                  )}

                  <Title order={3} size="h4" fw={700} mt={plan.popular ? "sm" : 0} c="dark.9">
                    {plan.name}
                  </Title>
                  <Group gap={4} justify="center" align="flex-end" mt={4}>
                    <Text size="3.5rem" fw={800} c="blue.6" lh={1}>
                      {plan.price}
                    </Text>
                    <Text c="dimmed" size="md" pb={8} fw={500}>{plan.period}</Text>
                  </Group>
                  <Text size="sm" c="dimmed" mt={4} h={40}>
                    {plan.description}
                  </Text>
                </Stack>

                <List spacing="sm" size="sm" center mt="md" style={{ flexGrow: 1 }}>
                  {plan.features.map((feature, featureIndex) => (
                    <List.Item
                      key={featureIndex}
                      icon={
                        feature.included ? (
                          <ThemeIcon size={20} variant="light" color="green.1" radius="xl" style={{ backgroundColor: '#ecfdf5' }}>
                            <IconCheck size={14} stroke={4} color="#10b981" />
                          </ThemeIcon>
                        ) : (
                          <ThemeIcon size={20} variant="light" color="red.1" radius="xl" style={{ backgroundColor: '#fef2f2' }}>
                            <IconX size={14} stroke={4} color="#ef4444" />
                          </ThemeIcon>
                        )
                      }
                    >
                      <Text c={feature.included ? "dark.8" : "dimmed"} size="sm" fw={500}>{feature.text}</Text>
                    </List.Item>
                  ))}
                </List>

                <Button 
                  variant={plan.popular ? "filled" : "outline"} 
                  color="blue.6"
                  size="md" 
                  radius="md" 
                  fullWidth 
                  mt="xl"
                  fw={600}
                  style={{
                    backgroundColor: plan.popular ? '#2563EB' : 'transparent',
                    borderColor: plan.popular ? 'transparent' : '#2563EB',
                    color: plan.popular ? 'white' : '#2563EB'
                  }}
                >
                  {plan.cta}
                </Button>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  )
}

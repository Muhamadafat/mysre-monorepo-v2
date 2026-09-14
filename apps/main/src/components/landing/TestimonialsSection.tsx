"use client"

import { Container, Title, Text, SimpleGrid, Card, Group, Stack, Badge, Box, Rating, Avatar, Grid, Image } from "@mantine/core";
import { IconSparkles } from '@tabler/icons-react'
import classes from "./TestimonialsSection.module.css"

const testimonials = [
  {
    name: "Rio Nurtantyana S.Pd., M.Pd., M.Sc., Ph.D.",
    role: "Peneliti, BRIN",
    avatar: "RN",
    rating: 5,
    content:
      "Platform ini sangat membantu dan mudah digunakan. Hasil penelitian saya jadi lebih terstruktur dan efisien!",
  },
  {
    name: "M. Luthfi Zahran",
    role: "Mahasiswa, Universitas Brawijaya",
    avatar: "LZ",
    rating: 5,
    content:
      "Asisten penulisan AI-nya luar biasa membantu. Saya jadi lebih fokus ke analisis tanpa pusing mengurus sitasi.",
  },
  {
    name: "Rangga Yuda Saputra",
    role: "Mahasiswa, Undip",
    avatar: "RY",
    rating: 5,
    content:
      "Saya sudah menggunakan My-SRE untuk banyak penelitian kolaboratif. Kemampuan integrasi dan visualisasi datanya sangat keren!",
  },
]

// Awan-awan latar belakang
const CLOUDS = [
  { top: '10%', left: '8%',   size: 36, delay: '0s',   dur: '4s'   },
  { top: '20%', left: '78%',  size: 28, delay: '1s',   dur: '5s'   },
  { top: '60%', left: '5%',   size: 32, delay: '0.5s', dur: '3.5s' },
  { top: '75%', left: '82%',  size: 24, delay: '2s',   dur: '4.5s' },
  { top: '45%', left: '92%',  size: 20, delay: '1.5s', dur: '6s'   },
  { top: '85%', left: '40%',  size: 30, delay: '0.8s', dur: '5.5s' },
]

export function TestimonialsSection() {
  return (
    <Box id="testimonials" py={{ base: 80, md: 120 }} className={classes.testimonials}>

      {/* ========== LAYER DEKORASI LUAR ANGKASA ========== */}

      {/* Awan-awan melayang */}
      {CLOUDS.map((c, i) => (
        <Box
          key={i}
          pos="absolute"
          style={{
            top: c.top,
            left: c.left,
            fontSize: c.size,
            animation: `cloudDrift ${c.dur} ${c.delay} ease-in-out infinite`,
            pointerEvents: 'none',
            zIndex: 0,
            userSelect: 'none',
            opacity: 0.55,
          }}
        >
          ☁️
        </Box>
      ))}

      {/* ===== PESAWAT UTAMA — Terbang dari kiri ke kanan ===== */}
      <Box
        pos="absolute"
        style={{
          bottom: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 1,
          overflow: 'hidden',
        }}
      >
        {/* Pesawat 1 — besar, terbang kiri → kanan, hidung menghadap KANAN */}
        <Box
          pos="absolute"
          style={{
            top: '22%',
            left: 0,
            animation: 'planeFlyMain 10s linear infinite',
            pointerEvents: 'none',
          }}
        >
          <Box pos="relative" style={{ display: 'inline-flex', alignItems: 'center' }}>
            {/* Contrail di belakang (kiri pesawat) */}
            <Box
              style={{
                display: 'flex',
                flexDirection: 'row-reverse',
                gap: 4,
                alignItems: 'center',
                marginRight: 2,
              }}
            >
              {[6, 14, 24, 36, 48, 60].map((size, i) => (
                <Box
                  key={i}
                  style={{
                    width: size,
                    height: Math.max(4, size * 0.3),
                    borderRadius: 99,
                    background: `rgba(219, 234, 254, ${0.7 - i * 0.1})`,
                    animation: `trailFade ${0.5 + i * 0.1}s ${(i * 0.06).toFixed(2)}s ease-out infinite`,
                    flexShrink: 0,
                  }}
                />
              ))}
            </Box>

            {/* Pesawat 1 menghadap kanan (default emoji ✈️) */}
            <Box
              style={{
                fontSize: 72,
                lineHeight: 1,
                userSelect: 'none',
                filter: 'drop-shadow(0 6px 20px rgba(59, 130, 246, 0.55))',
                animation: 'planePitch1 3s ease-in-out infinite',
              }}
            >
              ✈️
            </Box>
          </Box>
        </Box>

        {/* Pesawat 2 — lebih kecil, terbang kanan → kiri, hidung menghadap KIRI */}
        <Box
          pos="absolute"
          style={{
            top: '62%',
            right: 0,
            animation: 'planeFlyReverse 14s 5s linear infinite',
            pointerEvents: 'none',
          }}
        >
          <Box pos="relative" style={{ display: 'inline-flex', alignItems: 'center', flexDirection: 'row-reverse' }}>
            {/* Pesawat menghadap kiri (scaleX -1) */}
            <Box
              style={{
                fontSize: 44,
                lineHeight: 1,
                userSelect: 'none',
                transform: 'scaleX(-1)',
                filter: 'drop-shadow(0 4px 12px rgba(59, 130, 246, 0.5))',
                animation: 'planePitch2 3.5s ease-in-out infinite',
              }}
            >
              ✈️
            </Box>

            {/* Contrail di belakang pesawat 2 (di sebelah kanan karena terbang ke kiri) */}
            <Box
              style={{
                display: 'flex',
                flexDirection: 'row',
                gap: 3,
                alignItems: 'center',
                marginLeft: 2,
              }}
            >
              {[6, 10, 16, 24, 32, 42].map((size, i) => (
                <Box
                  key={i}
                  style={{
                    width: size,
                    height: Math.max(3, size * 0.3),
                    borderRadius: 99,
                    background: `rgba(196, 181, 253, ${0.65 - i * 0.09})`,
                    animation: `trailFade ${0.5 + i * 0.1}s ${(i * 0.06).toFixed(2)}s ease-out infinite`,
                    flexShrink: 0,
                  }}
                />
              ))}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Awan tambahan dekoratif */}
      <Box
        pos="absolute"
        style={{
          top: '5%',
          left: '35%',
          fontSize: 48,
          animation: 'cloudDrift 7s 1.2s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex: 0,
          opacity: 0.4,
          userSelect: 'none',
        }}
      >
        ☁️
      </Box>

      {/* ===== KONTEN SECTION ===== */}
      <Container size="xl" style={{ position: 'relative', zIndex: 2 }}>
        <Grid gap={60} align="center" mb={80}>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Stack align="flex-start" gap="xl">
              <Badge 
                size="lg" 
                variant="light" 
                color="grape" 
                radius="xl"
                leftSection={<IconSparkles size={14} style={{ color: '#9c27b0', fill: '#9c27b0' }} />}
                style={{ padding: '0 16px', fontWeight: 600 }}
              >
                TESTIMONI
              </Badge>
              <Title order={2} size="3rem" fw={800} className={classes.title} lh={1.2}>
                Dipercaya oleh <Text component="span" c="blue" inherit>Peneliti &amp; Mahasiswa</Text>
              </Title>
              <Text size="xl" c="dimmed" maw={600}>
                Bergabunglah dengan ribuan peneliti, akademisi, dan mahasiswa yang telah mentransformasi alur kerja penelitian mereka dengan My-SRE.
              </Text>
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }} pos="relative">
            <Image 
              src="/images/testimoni-animasi.png" 
              alt="Testimoni Animation" 
              w="100%"
              maw={500}
              mx="auto"
              style={{
                objectFit: 'contain',
              }}
            />
          </Grid.Col>
        </Grid>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="xl">
          {testimonials.map((testimonial, index) => (
            <Card key={index} padding="xl" radius="xl" className={classes.testimonialCard}>
              <Stack justify="space-between" h="100%" gap="xl">
                <Stack gap="lg">
                  <Rating value={testimonial.rating} readOnly size="md" color="yellow.5" />
                  <Text size="lg" fw={500} c="dark.8" lh={1.6}>
                    &quot;{testimonial.content}&quot;
                  </Text>
                </Stack>
                <Group gap="md" mt="md">
                  <Avatar color="blue.1" c="blue.7" radius="xl" size="md">{testimonial.avatar}</Avatar>
                  <Stack gap={2}>
                    <Text fw={700} size="sm" c="dark.9">
                      {testimonial.name}
                    </Text>
                    <Text c="dimmed" size="xs">
                      {testimonial.role}
                    </Text>
                  </Stack>
                </Group>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      </Container>

      {/* Keyframes inline untuk pesawat */}
      <style>{`
        /* Pesawat 1: kiri → kanan, sedikit bergelombang naik turun */
        @keyframes planeFlyMain {
          0%   { transform: translate(-160px, 0px)  scale(0.7); opacity: 0; }
          5%   { opacity: 1; }
          25%  { transform: translate(20vw, -14px)  scale(0.95); opacity: 1; }
          50%  { transform: translate(48vw,  8px)   scale(1.0);  opacity: 1; }
          75%  { transform: translate(74vw, -10px)  scale(0.95); opacity: 1; }
          95%  { opacity: 1; }
          100% { transform: translate(115vw, 2px)   scale(0.7); opacity: 0; }
        }

        /* Pesawat 2: kanan → kiri (mulai dari kanan, bergerak ke kiri) */
        @keyframes planeFlyReverse {
          0%   { transform: translate(0px,  0px)     scale(0.6); opacity: 0; }
          6%   { opacity: 0.85; }
          25%  { transform: translate(-22vw, 12px)   scale(0.8);  opacity: 0.85; }
          55%  { transform: translate(-52vw, -8px)   scale(0.85); opacity: 0.85; }
          90%  { opacity: 0.85; }
          100% { transform: translate(-110vw, 4px)   scale(0.6); opacity: 0; }
        }

        /* Pitch pesawat 1 (terbang kanan): hanya naik-turun, TIDAK pakai rotate */
        @keyframes planePitch1 {
          0%, 100% { transform: translateY(0px); }
          30%      { transform: translateY(-6px); }
          70%      { transform: translateY(5px); }
        }

        /* Pitch pesawat 2 (terbang kiri): hanya naik-turun, scaleX(-1) tetap dari parent */
        @keyframes planePitch2 {
          0%, 100% { transform: scaleX(-1) translateY(0px); }
          30%      { transform: scaleX(-1) translateY(-6px); }
          70%      { transform: scaleX(-1) translateY(5px); }
        }

        @keyframes trailFade {
          0%   { opacity: 0.8; }
          100% { opacity: 0.03; }
        }

        @keyframes cloudDrift {
          0%, 100% { transform: translateY(0px)  scale(1);    opacity: 0.55; }
          50%      { transform: translateY(-8px) scale(1.05); opacity: 0.75; }
        }
      `}</style>
    </Box>
  )
}


"use client"

import { Container, Title, Text, Accordion, Stack, Badge, Box, Grid, Image, Group } from "@mantine/core"

const faqs = [
  {
    question: "Bagaimana cara kerja asisten AI untuk menulis?",
    answer:
      "Asisten AI kami menganalisis konteks penelitian Anda dan memberikan saran cerdas untuk struktur, konten, dan kutipan. Sistem ini belajar dari gaya penulisan dan domain penelitian Anda untuk memberikan bantuan yang semakin personal.",
  },
  {
    question: "Bisakah saya mengimpor perpustakaan penelitian yang sudah ada?",
    answer:
      "Tentu saja! Anda dapat mengimpor artikel penelitian dari berbagai sumber termasuk file PDF, tautan DOI, dan pengelola referensi populer seperti Zotero, Mendeley, dan EndNote. Sistem kami akan secara otomatis mengekstrak metadata dan membangun grafik pengetahuan Anda.",
  },
  {
    question: "Bagaimana cara kerja visualisasi Brain?",
    answer:
      "Brain menciptakan grafik pengetahuan interaktif di mana setiap artikel menjadi sebuah node, dan koneksi (edge) terbentuk berdasarkan konsep yang sama, kutipan, dan hubungan semantik. Anda dapat menjelajahi koneksi ini secara visual dan berdiskusi dengan AI tentang koleksi penelitian Anda.",
  },
  {
    question: "Format kutipan apa saja yang didukung?",
    answer:
      "Kami mendukung semua format kutipan utama termasuk APA, MLA, Chicago, Harvard, IEEE, dan banyak lagi. Paket Professional dan Enterprise juga memungkinkan pembuatan format kutipan khusus.",
  },
  {
    question: "Apakah data penelitian saya aman?",
    answer:
      "Tentu saja. Kami menggunakan enkripsi tingkat enterprise untuk semua data dalam transit dan saat disimpan. Data penelitian Anda tidak pernah dibagikan kepada pihak ketiga, dan Anda mempertahankan kepemilikan penuh atas konten Anda. Kami mematuhi GDPR dan mengikuti protokol perlindungan data yang ketat.",
  },
  {
    question: "Bisakah saya berkolaborasi dengan tim saya?",
    answer:
      "Ya! Paket Professional dan Enterprise menyediakan fitur kolaborasi tim. Anda dapat berbagi grafik pengetahuan, menulis draft bersama, dan mengelola akses tim ke berbagai proyek penelitian.",
  },
  {
    question: "Format ekspor apa saja yang tersedia?",
    answer:
      "Anda dapat mengekspor draft dalam berbagai format termasuk PDF, Word (DOCX), LaTeX, HTML, dan teks biasa. Daftar referensi dapat diekspor dalam berbagai format kutipan atau sebagai file BibTeX.",
  },
  {
    question: "Bagaimana cara kerja uji coba gratis?",
    answer:
      "Uji coba gratis 14 hari kami memberikan Anda akses penuh ke semua fitur dari paket yang Anda pilih. Tidak perlu kartu kredit untuk memulai, dan Anda dapat membatalkan kapan saja selama periode uji coba tanpa kewajiban apapun.",
  },
]

export function FAQSection() {
  return (
    <Box 
      id="faq" 
      pt={{ base: 30, md: 40 }}
      pb={{ base: 30, md: 40 }}
      pos="relative"
      style={{
        backgroundImage: 'url(/images/faq-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        overflow: 'hidden'
      }}
    >
      <Container size="lg" pos="relative" style={{ zIndex: 1 }}>
        <Grid gutter={40} align="flex-start">
          {/* Left Column */}
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Box pos="relative" h="100%">
              <Stack gap="md" pos="relative" style={{ zIndex: 3 }}>
                <Group>
                  <Badge 
                    size="lg" 
                    variant="light" 
                    color="violet" 
                    radius="xl"
                    style={{ textTransform: 'none' }}
                    leftSection={<Text fw={700} span>?</Text>}
                  >
                    PERTANYAAN UMUM
                  </Badge>
                </Group>
                
                <Title order={2} size="2rem" fw={800} lh={1.2}>
                  <Text span inherit c="dark">Pertanyaan yang </Text>
                  <br />
                  <Text span inherit c="violet">Sering Diajukan</Text>
                </Title>
                
                <Text size="sm" c="dimmed" maw={380} mb={10} lh={1.5}>
                  Temukan jawaban untuk pertanyaan umum tentang ResearchCraft dan bagaimana aplikasi ini dapat membantu menyederhanakan alur kerja penelitian Anda.
                </Text>
              </Stack>
              
              <Image 
                src="/images/faq-boy.png" 
                alt="FAQ Illustration" 
                w="100%"
                maw={220}
                mt={10}
                style={{
                  position: 'relative',
                  zIndex: 2,
                  objectFit: 'contain',
                }}
              />
            </Box>
          </Grid.Col>
          
          {/* Right Column */}
          <Grid.Col span={{ base: 12, md: 7 }} pos="relative">
            <Box
              bg="white"
              p={{ base: 12, sm: 20 }}
              pos="relative"
              style={{
                borderRadius: 16,
                boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
                zIndex: 3
              }}
            >
              <Accordion
                variant="separated"
                radius="sm"
                styles={{
                  item: {
                    backgroundColor: '#F8F9FA',
                    border: '1px solid #E9ECEF',
                    marginBottom: '8px',
                  },
                  control: {
                    padding: '8px 12px',
                  },
                  content: {
                    padding: '0 12px 10px 12px'
                  }
                }}
              >
                {faqs.map((faq, index) => (
                  <Accordion.Item key={index} value={index.toString()}>
                    <Accordion.Control>
                      <Text fw={500} size="13px" c="dark.8">{faq.question}</Text>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Text size="12px" c="dimmed" lh={1.5}>{faq.answer}</Text>
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            </Box>
            
            <Image 
              src="/images/faq-clipboard.png" 
              alt="Clipboard Illustration" 
              w={150}
              pos="absolute"
              bottom={-20}
              right={-20}
              style={{ zIndex: 4 }}
              visibleFrom="sm"
            />
          </Grid.Col>
        </Grid>
      </Container>
    </Box>
  )
}
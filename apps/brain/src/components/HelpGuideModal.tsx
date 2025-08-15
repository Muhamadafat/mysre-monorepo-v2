"use client"

import {
  Modal,
  Box,
  Text,
  Group,
  Stack,
  Card,
  ThemeIcon,
  Button,
  Stepper,
  Badge,
  Paper,
  Container,
  Image,
  Divider,
  ActionIcon,
  Tooltip,
  useMantineColorScheme,
  useMantineTheme
} from "@mantine/core"
import {
  IconUpload,
  IconCircleDot,
  IconMessage,
  IconArrowRight,
  IconCheck,
  IconX,
  IconInfoCircle,
  IconLighter,
  IconClick,
  IconMessageQuestion,
  IconFileUpload,
  IconNetwork,
  IconChevronRight
} from "@tabler/icons-react"
import { useState } from "react"

interface HelpGuideModalProps {
  opened: boolean
  onClose: () => void
}

export function HelpGuideModal({ opened, onClose }: HelpGuideModalProps) {
  const [activeStep, setActiveStep] = useState(0)
  const { colorScheme } = useMantineColorScheme()
  const theme = useMantineTheme()
  const dark = colorScheme === "dark"

  const steps = [
    {
      label: "Upload Artikel",
      icon: IconFileUpload,
      color: "blue",
      title: "Langkah 1: Upload Dokumen PDF",
      description: "Mulai dengan mengupload artikel penelitian dalam format PDF",
      content: (
        <Stack gap="md">
          <Card padding="lg" radius="md" withBorder>
            <Group gap="md" align="flex-start">
              <Box
                style={{
                  width: 200,
                  height: 120,
                  backgroundColor: dark ? theme.colors.dark[6] : theme.colors.gray[1],
                  borderRadius: theme.radius.md,
                  border: `2px dashed ${theme.colors.blue[5]}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative"
                }}
              >
                <Stack align="center" gap="xs">
                  <ThemeIcon size="lg" variant="light" color="blue">
                    <IconUpload size={24} />
                  </ThemeIcon>
                  <Text size="sm" c="dimmed" ta="center">
                    Klik tombol Upload
                  </Text>
                </Stack>
                
                {/* Animated arrow pointing to upload button */}
                <Box
                  style={{
                    position: "absolute",
                    top: -30,
                    right: -20,
                    animation: "bounce 1s infinite"
                  }}
                >
                  <ActionIcon variant="filled" color="orange" size="sm" radius="xl">
                    <IconArrowRight size={12} />
                  </ActionIcon>
                </Box>
              </Box>
              
              <Stack gap="sm" style={{ flex: 1 }}>
                <Group gap="xs">
                  <ThemeIcon size="sm" color="green" variant="light">
                    <IconCheck size={14} />
                  </ThemeIcon>
                  <Text size="sm" fw={500}>Pilih file PDF artikel penelitian</Text>
                </Group>
                <Group gap="xs">
                  <ThemeIcon size="sm" color="green" variant="light">
                    <IconCheck size={14} />
                  </ThemeIcon>
                  <Text size="sm" fw={500}>Sistem akan menganalisis dan membuat visualisasi</Text>
                </Group>
                <Group gap="xs">
                  <ThemeIcon size="sm" color="green" variant="light">
                    <IconCheck size={14} />
                  </ThemeIcon>
                  <Text size="sm" fw={500}>Nodes akan muncul di peta konsep</Text>
                </Group>
              </Stack>
            </Group>
          </Card>

          <Paper p="md" radius="md" style={{ backgroundColor: dark ? theme.colors.blue[9] : theme.colors.blue[0] }}>
            <Group gap="xs">
              <ThemeIcon size="sm" color="blue" variant="light">
                <IconInfoCircle size={14} />
              </ThemeIcon>
              <Text size="sm" c="blue">
                <strong>Tips:</strong> Pastikan PDF dapat dibaca dan berisi teks (bukan hasil scan gambar)
              </Text>
            </Group>
          </Paper>
        </Stack>
      )
    },
    {
      label: "Pilih Node",
      icon: IconClick,
      color: "green",
      title: "Langkah 2: Klik Node untuk Konteks",
      description: "Pilih node di visualisasi untuk memberikan konteks pada AI Assistant",
      content: (
        <Stack gap="md">
          <Card padding="lg" radius="md" withBorder>
            <Group gap="md" align="flex-start">
              <Box
                style={{
                  width: 200,
                  height: 120,
                  backgroundColor: dark ? theme.colors.dark[6] : theme.colors.gray[1],
                  borderRadius: theme.radius.md,
                  border: `1px solid ${dark ? theme.colors.dark[4] : theme.colors.gray[3]}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  overflow: "hidden"
                }}
              >
                {/* Simulated graph nodes */}
                <Box
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    backgroundColor: theme.colors.blue[5],
                    position: "absolute",
                    top: 20,
                    left: 40,
                    cursor: "pointer",
                    animation: "pulse 1.5s infinite",
                    boxShadow: `0 0 20px ${theme.colors.blue[4]}`
                  }}
                />
                <Box
                  style={{
                    width: 25,
                    height: 25,
                    borderRadius: "50%",
                    backgroundColor: theme.colors.green[5],
                    position: "absolute",
                    top: 60,
                    right: 30,
                    cursor: "pointer"
                  }}
                />
                <Box
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    backgroundColor: theme.colors.orange[5],
                    position: "absolute",
                    bottom: 20,
                    left: 80,
                    cursor: "pointer"
                  }}
                />
                
                {/* Click indicator */}
                <Box
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 30,
                    animation: "bounce 1s infinite"
                  }}
                >
                  <ActionIcon variant="filled" color="yellow" size="xs" radius="xl">
                    <IconClick size={10} />
                  </ActionIcon>
                </Box>
              </Box>
              
              <Stack gap="sm" style={{ flex: 1 }}>
                <Badge variant="gradient" gradient={{ from: "blue", to: "cyan" }} size="lg">
                  PENTING!
                </Badge>
                <Text size="sm" fw={600} c="blue">
                  Klik node di peta konsep untuk:
                </Text>
                <Group gap="xs">
                  <ThemeIcon size="sm" color="green" variant="light">
                    <IconCheck size={14} />
                  </ThemeIcon>
                  <Text size="sm">Memberikan konteks pada AI Assistant</Text>
                </Group>
                <Group gap="xs">
                  <ThemeIcon size="sm" color="green" variant="light">
                    <IconCheck size={14} />
                  </ThemeIcon>
                  <Text size="sm">Node terpilih akan muncul di chat input</Text>
                </Group>
                <Group gap="xs">
                  <ThemeIcon size="sm" color="green" variant="light">
                    <IconCheck size={14} />
                  </ThemeIcon>
                  <Text size="sm">AI dapat memberikan jawaban yang lebih relevan</Text>
                </Group>
              </Stack>
            </Group>
          </Card>

          <Paper p="md" radius="md" style={{ backgroundColor: dark ? theme.colors.red[9] : theme.colors.red[0] }}>
            <Group gap="xs">
              <ThemeIcon size="sm" color="red" variant="light">
                <IconX size={14} />
              </ThemeIcon>
              <Text size="sm" c="red">
                <strong>Catatan:</strong> Tanpa memilih node, AI Assistant tidak memiliki konteks spesifik untuk menjawab pertanyaan Anda
              </Text>
            </Group>
          </Paper>
        </Stack>
      )
    },
    {
      label: "Chat & Analisis",
      icon: IconMessageQuestion,
      color: "orange",
      title: "Langkah 3: Mulai Bertanya",
      description: "Setelah node terpilih, Anda dapat mulai berdiskusi dengan AI Assistant",
      content: (
        <Stack gap="md">
          <Card padding="lg" radius="md" withBorder>
            <Stack gap="md">
              {/* Chat simulation */}
              <Box
                style={{
                  backgroundColor: dark ? theme.colors.dark[6] : theme.colors.gray[0],
                  borderRadius: theme.radius.md,
                  padding: theme.spacing.md,
                  border: `1px solid ${dark ? theme.colors.dark[4] : theme.colors.gray[3]}`
                }}
              >
                <Stack gap="sm">
                  {/* Selected node indicator */}
                  <Paper p="xs" radius="sm" style={{ backgroundColor: theme.colors.blue[0] }}>
                    <Group gap="xs">
                      <ThemeIcon size="xs" color="blue" variant="light">
                        <IconCircleDot size={12} />
                      </ThemeIcon>
                      <Text size="xs" c="blue" fw={500}>
                        Node terpilih: "Machine Learning Applications"
                      </Text>
                    </Group>
                  </Paper>
                  
                  {/* Chat input simulation */}
                  <Box
                    style={{
                      padding: theme.spacing.sm,
                      border: `2px solid ${theme.colors.blue[5]}`,
                      borderRadius: theme.radius.md,
                      backgroundColor: "white",
                      position: "relative"
                    }}
                  >
                    <Text size="sm" c="dimmed">
                      Jelaskan lebih detail tentang aplikasi machine learning...
                    </Text>
                    
                    {/* Typing indicator */}
                    <Box
                      style={{
                        position: "absolute",
                        right: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        animation: "pulse 1s infinite"
                      }}
                    >
                      <ActionIcon size="sm" color="blue" variant="light">
                        <IconMessage size={12} />
                      </ActionIcon>
                    </Box>
                  </Box>
                </Stack>
              </Box>
              
              <Divider />
              
              <Stack gap="sm">
                <Text size="sm" fw={600} c="green">
                  Contoh pertanyaan yang bisa Anda ajukan:
                </Text>
                <Group gap="xs">
                  <ThemeIcon size="sm" color="blue" variant="light">
                    <IconChevronRight size={14} />
                  </ThemeIcon>
                  <Text size="sm">"Jelaskan konsep ini lebih detail"</Text>
                </Group>
                <Group gap="xs">
                  <ThemeIcon size="sm" color="blue" variant="light">
                    <IconChevronRight size={14} />
                  </ThemeIcon>
                  <Text size="sm">"Bagaimana hubungannya dengan konsep lain?"</Text>
                </Group>
                <Group gap="xs">
                  <ThemeIcon size="sm" color="blue" variant="light">
                    <IconChevronRight size={14} />
                  </ThemeIcon>
                  <Text size="sm">"Berikan contoh penerapan praktis"</Text>
                </Group>
              </Stack>
            </Stack>
          </Card>

          <Paper p="md" radius="md" style={{ backgroundColor: dark ? theme.colors.yellow[9] : theme.colors.yellow[0] }}>
            <Group gap="xs">
              <ThemeIcon size="sm" color="yellow" variant="light">
                <IconLighter size={14} />
              </ThemeIcon>
              <Text size="sm" c="yellow.7">
                <strong>Tips:</strong> Semakin spesifik pertanyaan Anda, semakin detail dan relevan jawaban AI Assistant
              </Text>
            </Group>
          </Paper>
        </Stack>
      )
    }
  ]

  const currentStep = steps[activeStep]

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <ThemeIcon variant="gradient" gradient={{ from: "blue", to: "cyan" }} size="lg">
            <IconInfoCircle size={20} />
          </ThemeIcon>
          <Box>
            <Text size="lg" fw={700}>Panduan Penggunaan mySRE</Text>
            <Text size="sm" c="dimmed">Pelajari cara menggunakan platform dengan efektif</Text>
          </Box>
        </Group>
      }
      size="xl"
      centered
      radius="lg"
      styles={{
        body: {
          maxHeight: "70vh",
          overflow: "auto"
        }
      }}
    >
      <Container size="lg" px={0}>
        <Stack gap="xl">
          {/* Progress Stepper */}
          <Stepper
            active={activeStep}
            onStepClick={setActiveStep}
            size="sm"
            radius="md"
            styles={{
              step: {
                cursor: "pointer"
              },
              stepIcon: {
                borderWidth: 2
              }
            }}
          >
            {steps.map((step, index) => (
              <Stepper.Step
                key={index}
                label={step.label}
                icon={<step.icon size={16} />}
                color={step.color}
                completedIcon={<IconCheck size={16} />}
              />
            ))}
          </Stepper>

          {/* Step Content */}
          <Card padding="xl" radius="lg" withBorder>
            <Stack gap="lg">
              <Group gap="md">
                <ThemeIcon
                  size="xl"
                  variant="gradient"
                  gradient={{ from: currentStep.color, to: currentStep.color, deg: 45 }}
                  radius="lg"
                >
                  <currentStep.icon size={24} />
                </ThemeIcon>
                <Box>
                  <Text size="xl" fw={700} c={currentStep.color}>
                    {currentStep.title}
                  </Text>
                  <Text size="md" c="dimmed">
                    {currentStep.description}
                  </Text>
                </Box>
              </Group>

              <Divider />

              <Box>{currentStep.content}</Box>
            </Stack>
          </Card>

          {/* Navigation Buttons */}
          <Group justify="space-between">
            <Button
              variant="light"
              color="gray"
              leftSection={<IconArrowRight size={16} style={{ transform: "rotate(180deg)" }} />}
              onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
              disabled={activeStep === 0}
            >
              Sebelumnya
            </Button>

            <Group gap="sm">
              {activeStep < steps.length - 1 ? (
                <Button
                  variant="filled"
                  color={currentStep.color}
                  rightSection={<IconArrowRight size={16} />}
                  onClick={() => setActiveStep(Math.min(steps.length - 1, activeStep + 1))}
                >
                  Selanjutnya
                </Button>
              ) : (
                <Button
                  variant="gradient"
                  gradient={{ from: "blue", to: "cyan" }}
                  rightSection={<IconCheck size={16} />}
                  onClick={onClose}
                >
                  Mulai Menggunakan
                </Button>
              )}
            </Group>
          </Group>
        </Stack>
      </Container>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { 
            opacity: 1; 
            transform: scale(1);
          }
          50% { 
            opacity: 0.7; 
            transform: scale(1.1);
          }
        }

        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-10px);
          }
          60% {
            transform: translateY(-5px);
          }
        }
      `}</style>
    </Modal>
  )
}
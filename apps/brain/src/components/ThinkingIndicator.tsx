'use client';

import { Box, Card, Group, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconCheck, IconSparkles } from '@tabler/icons-react';

import type { ChatMilestone } from '@/store/useChatStore';

interface ThinkingIndicatorProps {
  milestones: ChatMilestone[];
  isDark: boolean;
  accentColor: string;
  borderColor: string;
  mutedColor: string;
  surfaceStart: string;
  surfaceEnd: string;
}

const THINKING_STEPS = [
  {
    step: 'router',
    label: 'Membaca dokumen terpilih',
  },
  {
    step: 'retrieval',
    label: 'Mengambil konteks relevan',
  },
  {
    step: 'compressor',
    label: 'Menyusun jawaban berbasis dokumen',
  },
] as const;

export default function ThinkingIndicator({
  milestones,
  isDark,
  accentColor,
  borderColor,
  mutedColor,
  surfaceStart,
  surfaceEnd,
}: ThinkingIndicatorProps) {
  const completedSteps = new Set(milestones.map((milestone) => milestone.step));
  const activeStepIndex = THINKING_STEPS.findIndex(
    (item) => !completedSteps.has(item.step)
  );

  return (
    <Card
      shadow="sm"
      radius={9}
      withBorder
      style={{
        alignSelf: 'flex-start',
        maxWidth: '85%',
        padding: '16px 18px',
        border: `1px solid ${borderColor}`,
        background: `linear-gradient(135deg, ${surfaceStart} 0%, ${surfaceEnd} 100%)`,
      }}
    >
      <Group gap="sm" mb="md" align="center" justify="space-between">
        <Group gap="sm" align="center">
          <ThemeIcon
            size="sm"
            radius="xl"
            variant="light"
            color="violet"
            style={{
              background: isDark ? '#3b1d67' : '#f3e8ff',
              border: `1px solid ${isDark ? '#7c3aed' : '#d8b4fe'}`,
              color: accentColor,
            }}
          >
            <IconSparkles size={14} />
          </ThemeIcon>
          <Text size="sm" fw={600} c={isDark ? '#f1f3f5' : '#343a40'}>
            Sedang berpikir...
          </Text>
        </Group>

        <Group gap={5} wrap="nowrap">
          {[0, 1, 2].map((index) => (
            <Box
              key={`thinking-dot-${index}`}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: accentColor,
                opacity: 0.9,
                animation: `soft-bob 1.2s ease-in-out ${index * 0.15}s infinite`,
              }}
            />
          ))}
        </Group>
      </Group>

      <Stack gap="sm">
        {THINKING_STEPS.map((item, index) => {
          const isDone = completedSteps.has(item.step);
          const isActive = !isDone && index === (activeStepIndex === -1 ? 0 : activeStepIndex);

          return (
            <Group
              key={item.step}
              gap="sm"
              align="center"
              wrap="nowrap"
            >
              <Box
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: `1.5px solid ${accentColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isDone ? accentColor : 'transparent',
                  boxShadow: isActive
                    ? `0 0 0 4px ${isDark ? 'rgba(139,92,246,0.16)' : 'rgba(139,92,246,0.12)'}`
                    : 'none',
                  flexShrink: 0,
                  transition: 'all 0.2s ease',
                }}
              >
                {isDone ? (
                  <IconCheck size={11} color="white" stroke={2.5} />
                ) : (
                  <Box
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: isActive ? accentColor : 'transparent',
                    }}
                  />
                )}
              </Box>

              <Text
                size="sm"
                fw={isActive ? 600 : 500}
                c={
                  isDone || isActive
                    ? isDark
                      ? '#f1f3f5'
                      : '#343a40'
                    : mutedColor
                }
                style={{ lineHeight: 1.45 }}
              >
                {item.label}
              </Text>
            </Group>
          );
        })}
      </Stack>

      <style jsx>{`
        @keyframes soft-bob {
          0%,
          100% {
            transform: translateY(0);
            opacity: 0.55;
          }
          50% {
            transform: translateY(-4px);
            opacity: 1;
          }
        }
      `}</style>
    </Card>
  );
}

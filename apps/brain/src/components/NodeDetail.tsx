/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import {
  Accordion,
  Paper,
  Text,
  Group,
  Badge,
  ThemeIcon,
  Box,
  Stack,
} from '@mantine/core';
import { ExtendedNode } from '@/types';
import {
  IconArticle,
  IconTarget,
  IconMath,
  IconHistory,
  IconArrowForward,
  IconFileAlert,
} from '@tabler/icons-react';

interface NodeDetailProps {
  node: ExtendedNode | null;
  onClose: () => void;
  trackPdfView?: (pdfName: string, action: 'open' | 'close') => void;
  trackModalInteraction?: (modalType: string, action: 'open' | 'close') => void;
  session?: any;
  projectId?: any;
}

const attributeIcons = {
  goal: <IconTarget size={16} />,
  method: <IconMath size={16} />,
  background: <IconHistory size={16} />,
  future: <IconArrowForward size={16} />,
  gaps: <IconFileAlert size={16} />,
};

const attributeColors = {
  goal: 'orange',
  method: 'green',
  background: 'blue',
  future: 'violet',
  gaps: 'red',
};

export const handleAnalytics = async (analyticsData: any) => {
  // try {
  //   await fetch('/api/annotation', {
  //     method: 'POST',
  //     headers: {'Content-Type': 'application/json'},
  //     body: JSON.stringify({
  //       ...analyticsData,
  //       userId: 'current_user_id',
  //       projectId: 'uniqueSessionId',
  //     }),
  //   });
  // } catch (error) {
  //   console.error(error);
  // }
  console.log('📊 Analytics: analyticsData');
};

export default function NodeDetail({
  node,
  onClose,
  trackPdfView,
  trackModalInteraction,
  session,
}: NodeDetailProps) {
  if (!node) {
    return null;
  }

  return (
    <Stack gap="lg">
      {/* Title Section */}
      <Paper p="md" radius="md" withBorder>
        <Group justify="space-between" mb="xs">
          <Badge size="lg" variant="dot" color="blue">
            Artikel Penelitian
          </Badge>
          <ThemeIcon size="lg" variant="light" color="blue" radius="md">
            <IconArticle size={20} />
          </ThemeIcon>
        </Group>
        <Text size="lg" fw={500} style={{ wordBreak: 'break-word' }}>
          {node.title || node.label}
        </Text>
      </Paper>

      {/* Attributes Section - Accordion buka/tutup */}
      <Accordion
        multiple
        defaultValue={['goal']}
        variant="separated"
        radius="md"
        styles={{
          item: {
            border: '1px solid var(--mantine-color-default-border)',
          },
          control: {
            paddingTop: 10,
            paddingBottom: 10,
          },
          label: {
            fontWeight: 500,
            fontSize: 14,
          },
        }}
      >
        {/* Tujuan */}
        <Accordion.Item value="goal">
          <Accordion.Control
            icon={
              <ThemeIcon
                size="sm"
                variant="light"
                color={attributeColors.goal}
                radius="sm"
              >
                {attributeIcons.goal}
              </ThemeIcon>
            }
          >
            Tujuan
          </Accordion.Control>
          <Accordion.Panel>
            <Text
              size="sm"
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.7,
                color: 'var(--mantine-color-dimmed)',
              }}
            >
              {node.attributes?.objective || '-'}
            </Text>
          </Accordion.Panel>
        </Accordion.Item>

        {/* Metodologi */}
        <Accordion.Item value="method">
          <Accordion.Control
            icon={
              <ThemeIcon
                size="sm"
                variant="light"
                color={attributeColors.method}
                radius="sm"
              >
                {attributeIcons.method}
              </ThemeIcon>
            }
          >
            Metodologi
          </Accordion.Control>
          <Accordion.Panel>
            <Text
              size="sm"
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.7,
                color: 'var(--mantine-color-dimmed)',
              }}
            >
              {node.attributes?.methodology || '-'}
            </Text>
          </Accordion.Panel>
        </Accordion.Item>

        {/* Latar Belakang */}
        <Accordion.Item value="background">
          <Accordion.Control
            icon={
              <ThemeIcon
                size="sm"
                variant="light"
                color={attributeColors.background}
                radius="sm"
              >
                {attributeIcons.background}
              </ThemeIcon>
            }
          >
            Latar Belakang
          </Accordion.Control>
          <Accordion.Panel>
            <Text
              size="sm"
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.7,
                color: 'var(--mantine-color-dimmed)',
              }}
            >
              {node.attributes?.background || '-'}
            </Text>
          </Accordion.Panel>
        </Accordion.Item>

        {/* Penelitian Lanjutan */}
        <Accordion.Item value="future">
          <Accordion.Control
            icon={
              <ThemeIcon
                size="sm"
                variant="light"
                color={attributeColors.future}
                radius="sm"
              >
                {attributeIcons.future}
              </ThemeIcon>
            }
          >
            Penelitian Lanjutan
          </Accordion.Control>
          <Accordion.Panel>
            <Text
              size="sm"
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.7,
                color: 'var(--mantine-color-dimmed)',
              }}
            >
              {node.attributes?.futurework || '-'}
            </Text>
          </Accordion.Panel>
        </Accordion.Item>

        {/* Kesenjangan */}
        <Accordion.Item value="gaps">
          <Accordion.Control
            icon={
              <ThemeIcon
                size="sm"
                variant="light"
                color={attributeColors.gaps}
                radius="sm"
              >
                {attributeIcons.gaps}
              </ThemeIcon>
            }
          >
            Kesenjangan
          </Accordion.Control>
          <Accordion.Panel>
            <Text
              size="sm"
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.7,
                color: 'var(--mantine-color-dimmed)',
              }}
            >
              {node.attributes?.gap || '-'}
            </Text>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}

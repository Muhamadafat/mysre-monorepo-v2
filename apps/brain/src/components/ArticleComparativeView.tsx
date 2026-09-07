'use client';

import { Box, Card, Group, ScrollArea, Stack, Text, ThemeIcon, Tooltip, Badge } from '@mantine/core';
import {
  IconArticle,
  IconTarget,
  IconMath,
  IconHistory,
  IconArrowForward,
  IconFileAlert,
} from '@tabler/icons-react';
import { ExtendedNode } from '../types';

interface ArticleComparativeViewProps {
  nodes: ExtendedNode[];
  activeArticles: string[];
}

const attributes: {
  key: keyof ExtendedNode;
  label: string;
  icon: typeof IconTarget;
  color: string;
}[] = [
  { key: 'att_goal', label: 'Tujuan', icon: IconTarget, color: 'orange' },
  { key: 'att_method', label: 'Metodologi', icon: IconMath, color: 'green' },
  { key: 'att_background', label: 'Latar Belakang', icon: IconHistory, color: 'blue' },
  { key: 'att_future', label: 'Penelitian Lanjut', icon: IconArrowForward, color: 'violet' },
  { key: 'att_gaps', label: 'Kesenjangan', icon: IconFileAlert, color: 'red' },
];

export default function ArticleComparativeView({ nodes, activeArticles }: ArticleComparativeViewProps) {
  const filteredNodes = activeArticles.length === 0 ? nodes : nodes.filter((node) => activeArticles.includes(String(node.id)));

  if (filteredNodes.length === 0) {
    return (
      <Box style={{ width: '100%', height: '340px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Stack align="center" gap="md">
          <ThemeIcon variant="light" color="gray" size="xl">
            <IconArticle size={32} />
          </ThemeIcon>
          <Text size="lg" fw={500} c="dimmed">Tidak ada artikel yang dipilih</Text>
          <Text size="sm" c="dimmed" ta="center">Pilih artikel dari filter di atas untuk membandingkan</Text>
        </Stack>
      </Box>
    );
  }

  return (
    <ScrollArea style={{ height: '340px' }} type="auto">
      <Group align="stretch" wrap="nowrap" gap="md" p="md">
        {filteredNodes.map((node) => (
          <Card key={node.id} withBorder radius="md" p="md" style={{ minWidth: 280, flexShrink: 0 }}>
            <Stack gap="sm">
              <Box>
                <Badge variant="dot" color="blue" size="sm" mb={4}>
                  ID: {node.id}
                </Badge>
                <Text size="sm" fw={600} lineClamp={2}>
                  {node.title || node.label || `Artikel ${node.id}`}
                </Text>
              </Box>

              {attributes.map(({ key, label, icon: Icon, color }) => (
                <Box key={String(key)}>
                  <Group gap={6} mb={4}>
                    <ThemeIcon size="sm" variant="light" color={color}>
                      <Icon size={14} />
                    </ThemeIcon>
                    <Text size="xs" fw={600} c="dimmed" tt="uppercase">{label}</Text>
                  </Group>
                  <Tooltip label={(node[key] as string) || '-'} multiline w={260} disabled={!node[key]}>
                    <Text size="xs" lineClamp={4} style={{ whiteSpace: 'pre-wrap' }}>
                      {(node[key] as string) || '-'}
                    </Text>
                  </Tooltip>
                </Box>
              ))}
            </Stack>
          </Card>
        ))}
      </Group>
    </ScrollArea>
  );
}

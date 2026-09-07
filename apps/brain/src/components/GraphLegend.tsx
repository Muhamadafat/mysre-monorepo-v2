'use client';

import { Box, Paper, Stack, Text, Group } from '@mantine/core';
import { relationColors, getRelationDisplayName } from '@/utils/relations';

const colorHex: Record<string, string> = {
  blue: '#228be6',
  green: '#40c057',
  orange: '#fd7e14',
  purple: '#7950f2',
  yellow: '#fab005',
  red: '#fa5252',
  gray: '#868e96',
};

export default function GraphLegend() {
  return (
    <Paper
      shadow="sm"
      radius="md"
      withBorder
      p="sm"
      style={{
        position: 'absolute',
        right: 12,
        bottom: 12,
        zIndex: 1,
        minWidth: 170,
        backgroundColor: 'rgba(255,255,255,0.95)',
      }}
    >
      <Text size="xs" fw={700} tt="uppercase" mb="xs" c="dimmed">
        Informasi Relasi
      </Text>
      <Stack gap={6}>
        {Object.entries(relationColors).map(([relation, color]) => (
          <Group key={relation} gap="xs" wrap="nowrap">
            <Box
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: colorHex[color] || color,
                flexShrink: 0,
              }}
            />
            <Text size="xs">{getRelationDisplayName(relation)}</Text>
          </Group>
        ))}
      </Stack>
    </Paper>
  );
}

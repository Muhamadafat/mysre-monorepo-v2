'use client';

import { useMemo, useState } from 'react';
import {
  Paper,
  Group,
  Text,
  ActionIcon,
  TextInput,
  Stack,
  ScrollArea,
  Box,
  Badge,
  Button,
  Tooltip,
  Collapse,
} from '@mantine/core';
import {
  IconX,
  IconSearch,
  IconEye,
  IconTrash,
  IconFilter,
  IconUpload,
  IconChevronDown,
  IconChevronUp,
} from '@tabler/icons-react';
import { ExtendedNode } from '@/types';
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

interface AnalysisControlsPanelProps {
  nodes: ExtendedNode[];
  activeArticles: string[];
  onArticleSelectionChange: (ids: string[]) => void;
  showRelationFilters: boolean;
  activeRelations: string[];
  onRelationChange: (relation: string, checked: boolean) => void;
  onUploadClick: () => void;
  onViewArticle?: (node: ExtendedNode) => void;
  onDeleteArticle?: (nodeId: string) => void;
  opened: boolean;
  onClose: () => void;
}

export default function AnalysisControlsPanel({
  nodes,
  activeArticles,
  onArticleSelectionChange,
  showRelationFilters,
  activeRelations,
  onRelationChange,
  onUploadClick,
  onViewArticle,
  onDeleteArticle,
  opened,
  onClose,
}: AnalysisControlsPanelProps) {
  const [search, setSearch] = useState('');

  const filteredArticles = useMemo(() => {
    if (!search.trim()) return nodes;
    const q = search.trim().toLowerCase();
    return nodes.filter((node) => {
      const title = node.title || node.label || '';
      return title.toLowerCase().includes(q);
    });
  }, [nodes, search]);

  const toggleArticle = (id: string) => {
    if (activeArticles.includes(id)) {
      onArticleSelectionChange(activeArticles.filter((a) => a !== id));
    } else {
      onArticleSelectionChange([...activeArticles, id]);
    }
  };

  return (
    <Paper withBorder radius="md" p="md" mb="md">
      <Group justify="space-between" mb={opened ? 'sm' : 0}>
        <Text size="sm" fw={700} tt="uppercase">
          Analysis Controls
        </Text>
        <ActionIcon variant="subtle" color="gray" size="sm" onClick={onClose}>
          {opened ? <IconX size={16} /> : <IconChevronDown size={16} />}
        </ActionIcon>
      </Group>

      <Collapse expanded={opened}>
        <Stack gap="sm">
          <Text size="xs" fw={600} c="dimmed">
            Pilih Artikel
          </Text>
          <TextInput
            placeholder="Cari artikel..."
            leftSection={<IconSearch size={14} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            size="sm"
            radius="md"
          />

          <ScrollArea.Autosize mah={220}>
            <Stack gap={6}>
              {filteredArticles.length === 0 && (
                <Text size="xs" c="dimmed" ta="center" py="sm">
                  Belum ada artikel
                </Text>
              )}
              {filteredArticles.map((node) => {
                const id = String(node.id);
                const isSelected = activeArticles.includes(id);
                return (
                  <Box
                    key={id}
                    onClick={() => toggleArticle(id)}
                    style={{
                      cursor: 'pointer',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: `1px solid ${isSelected ? '#228be6' : '#e9ecef'}`,
                      backgroundColor: isSelected ? '#e7f5ff' : 'transparent',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Group justify="space-between" wrap="nowrap" gap="xs">
                      <Text size="sm" fw={500} truncate style={{ flex: 1 }}>
                        {node.title || node.label || `Artikel ${node.id}`}
                      </Text>
                      <Group gap={4} wrap="nowrap">
                        {onViewArticle && (
                          <Tooltip label="Lihat detail">
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="blue"
                              onClick={(e) => {
                                e.stopPropagation();
                                onViewArticle(node);
                              }}
                            >
                              <IconEye size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        {onDeleteArticle && (
                          <Tooltip label="Hapus artikel">
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="red"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteArticle(id);
                              }}
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    </Group>
                  </Box>
                );
              })}
            </Stack>
          </ScrollArea.Autosize>

          {showRelationFilters && (
            <Box>
              <Group gap="xs" mb="xs">
                <IconFilter size={14} />
                <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                  Filter Chips
                </Text>
              </Group>
              <Group gap="xs">
                {Object.entries(relationColors).map(([relation, color]) => {
                  const active = activeRelations.includes(relation);
                  return (
                    <Badge
                      key={relation}
                      variant={active ? 'filled' : 'outline'}
                      color={color}
                      radius="xl"
                      size="md"
                      tt="none"
                      leftSection={
                        <Box
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            backgroundColor: active ? 'white' : colorHex[color] || color,
                          }}
                        />
                      }
                      style={{ cursor: 'pointer' }}
                      onClick={() => onRelationChange(relation, !active)}
                    >
                      {getRelationDisplayName(relation)}
                    </Badge>
                  );
                })}
              </Group>
            </Box>
          )}

          <Button
            color="green"
            radius="md"
            fullWidth
            leftSection={<IconUpload size={16} />}
            onClick={onUploadClick}
          >
            Upload File
          </Button>
        </Stack>
      </Collapse>
    </Paper>
  );
}

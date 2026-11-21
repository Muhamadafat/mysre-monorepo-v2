'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { VoiceCommandResult } from './PlateEditor';
import {
  Modal,
  ScrollArea,
  Text,
  Stack,
  Group,
  Badge,
  ActionIcon,
  Box,
  Timeline,
  Card,
  Button,
  Divider,
  TextInput,
  Tooltip,
} from '@mantine/core';
import {
  IconHistory,
  IconMath,
  IconEdit,
  IconDeviceFloppy,
  IconTrash,
  IconDownload,
  IconSearch,
  IconClock,
  IconUser,
  IconCheck,
  IconX,
  IconRefresh,
  IconPencil,
  IconTerminal2,
} from '@tabler/icons-react';

// Loaded only when a recording filter is picked (pulls in the audio player).
const RecordingHistory = dynamic(() => import('./voice/RecordingHistory'), {
  ssr: false,
});

/** Filters that list voice recordings instead of activities. */
const RECORDING_FILTERS: Record<string, 'menulis' | 'perintah'> = {
  'rec-menulis': 'menulis',
  'rec-perintah': 'perintah',
};

const FILTERS: { value: string; label: string; icon: React.ReactNode; color?: string }[] = [
  { value: 'all', label: 'Semua', icon: null },
  { value: 'formula', label: 'Rumus', icon: <IconMath size={16} /> },
  { value: 'edit', label: 'Edit', icon: <IconEdit size={16} /> },
  { value: 'save', label: 'Simpan', icon: <IconDeviceFloppy size={16} /> },
  { value: 'transform', label: 'Transform', icon: <IconRefresh size={16} /> },
  { value: 'rec-menulis', label: 'Rekaman Mode Menulis', icon: <IconPencil size={16} />, color: 'cyan' },
  { value: 'rec-perintah', label: 'Rekaman Mode Perintah', icon: <IconTerminal2 size={16} />, color: 'indigo' },
];

export interface ActivityLogEntry {
  id: string;
  timestamp: Date;
  type: 'formula' | 'edit' | 'save' | 'delete' | 'export' | 'transform';
  title: string;
  description: string;
  details?: {
    formula?: string;
    result?: string;
    wordCount?: number;
    oldValue?: string;
    newValue?: string;
  };
  status: 'success' | 'error' | 'pending';
  user?: string;
}

interface ActivityLogProps {
  opened: boolean;
  onClose: () => void;
  activities: ActivityLogEntry[];
  onClearAll?: () => void;
  onExport?: () => void;
  /** Runs a saved voice command in the editor ("Jalankan" in Rekaman Mode Perintah). */
  onRunVoiceCommand?: (name: string, args: Record<string, unknown>) => Promise<VoiceCommandResult>;
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'formula':
      return <IconMath size={16} />;
    case 'edit':
      return <IconEdit size={16} />;
    case 'save':
      return <IconDeviceFloppy size={16} />;
    case 'delete':
      return <IconTrash size={16} />;
    case 'export':
      return <IconDownload size={16} />;
    case 'transform':
      return <IconRefresh size={16} />;
    default:
      return <IconHistory size={16} />;
  }
};

const getActivityColor = (type: string, status: string) => {
  if (status === 'error') return 'red';
  if (status === 'pending') return 'yellow';

  switch (type) {
    case 'formula':
      return 'blue';
    case 'edit':
      return 'cyan';
    case 'save':
      return 'green';
    case 'delete':
      return 'red';
    case 'export':
      return 'violet';
    case 'transform':
      return 'orange';
    default:
      return 'gray';
  }
};

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const formatDate = (date: Date) => {
  return date.toLocaleDateString('id-ID', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const ActivityLog: React.FC<ActivityLogProps> = ({
  opened,
  onClose,
  activities,
  onClearAll,
  onExport,
  onRunVoiceCommand,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filteredActivities, setFilteredActivities] = useState(activities);
  const recordingMode = RECORDING_FILTERS[filterType];

  // Filter activities based on search and type
  useEffect(() => {
    let filtered = activities;

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (activity) =>
          activity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          activity.description
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          activity.details?.formula
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          activity.details?.result
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase())
      );
    }

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter((activity) => activity.type === filterType);
    }

    setFilteredActivities(filtered);
  }, [activities, searchQuery, filterType]);

  // Group activities by date
  const groupedActivities = filteredActivities.reduce(
    (groups, activity) => {
      const date = formatDate(activity.timestamp);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(activity);
      return groups;
    },
    {} as Record<string, ActivityLogEntry[]>
  );

  const totalActivities = activities.length;
  const todayActivities = activities.filter(
    (a) => formatDate(a.timestamp) === formatDate(new Date())
  ).length;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <IconHistory size={20} />
          <Text fw={600}>Riwayat Aktivitas</Text>
          <Badge variant="light" color="blue" size="sm">
            {totalActivities} total
          </Badge>
        </Group>
      }
      size="lg"
      centered
    >
      <Stack gap="md">
        {/* Header Stats */}
        <Group justify="space-between">
          <Group gap="md">
            <Card withBorder p="xs" radius="md">
              <Group gap="xs">
                <IconClock size={16} color="#0066cc" />
                <Text size="sm" fw={500}>
                  Hari ini: {todayActivities}
                </Text>
              </Group>
            </Card>
            <Card withBorder p="xs" radius="md">
              <Group gap="xs">
                <IconHistory size={16} color="#666" />
                <Text size="sm" fw={500}>
                  Total: {totalActivities}
                </Text>
              </Group>
            </Card>
          </Group>
          <Group gap="xs">
            {onExport && (
              <Tooltip label="Export aktivitas ke file untuk backup atau review">
                <ActionIcon variant="light" color="violet" onClick={onExport}>
                  <IconDownload size={16} />
                </ActionIcon>
              </Tooltip>
            )}
            {onClearAll && (
              <Tooltip label="Hapus semua riwayat aktivitas (tidak bisa dibatalkan)">
                <ActionIcon variant="light" color="red" onClick={onClearAll}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </Group>

        <Divider />

        {/* Search and Filter */}
        <Stack gap="xs">
          <TextInput
            placeholder={
              recordingMode
                ? 'Cari di transkrip rekaman...'
                : 'Cari berdasarkan judul, deskripsi, atau tipe aktivitas...'
            }
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
          />
          <Group gap="xs">
            {FILTERS.map((filter) => (
              <Button
                key={filter.value}
                variant={filterType === filter.value ? 'filled' : 'light'}
                color={filter.color}
                size="xs"
                radius="xl"
                onClick={() => setFilterType(filter.value)}
                leftSection={filter.icon}
              >
                {filter.label}
              </Button>
            ))}
          </Group>
        </Stack>

        {/* Activity Timeline / voice recordings */}
        <ScrollArea h={400}>
          {recordingMode ? (
            <RecordingHistory mode={recordingMode} search={searchQuery} onRunCommand={onRunVoiceCommand} />
          ) : Object.keys(groupedActivities).length === 0 ? (
            <Box p="xl" style={{ textAlign: 'center' }}>
              <IconHistory size={48} color="#ccc" />
              <Text size="lg" c="dimmed" mt="md">
                {searchQuery
                  ? 'Tidak ada aktivitas yang cocok'
                  : 'Belum ada aktivitas'}
              </Text>
              <Text size="sm" c="dimmed">
                {searchQuery
                  ? 'Coba ubah kata kunci pencarian'
                  : 'Aktivitas akan muncul di sini'}
              </Text>
            </Box>
          ) : (
            Object.entries(groupedActivities).map(([date, dayActivities]) => (
              <Box key={date} mb="xl">
                <Text fw={600} size="sm" c="dimmed" mb="md">
                  {date}
                </Text>
                <Timeline
                  active={dayActivities.length}
                  bulletSize={24}
                  lineWidth={2}
                >
                  {dayActivities.map((activity) => (
                    <Timeline.Item
                      key={activity.id}
                      bullet={getActivityIcon(activity.type)}
                      title={
                        <Group gap="xs" mb="xs">
                          <Text fw={500} size="sm">
                            {activity.title}
                          </Text>
                          <Badge
                            variant="light"
                            color={getActivityColor(
                              activity.type,
                              activity.status
                            )}
                            size="xs"
                          >
                            {activity.type === 'formula'
                              ? 'Rumus'
                              : activity.type === 'edit'
                                ? 'Edit'
                                : activity.type === 'save'
                                  ? 'Simpan'
                                  : activity.type === 'delete'
                                    ? 'Hapus'
                                    : activity.type === 'export'
                                      ? 'Export'
                                      : activity.type === 'transform'
                                        ? 'Transform'
                                        : activity.type}
                          </Badge>
                          {activity.status === 'success' && (
                            <IconCheck size={14} color="green" />
                          )}
                          {activity.status === 'error' && (
                            <IconX size={14} color="red" />
                          )}
                        </Group>
                      }
                    >
                      <Text size="xs" c="dimmed" mb="xs">
                        {formatTime(activity.timestamp)}
                        {activity.user && ` • ${activity.user}`}
                      </Text>

                      <Text size="sm" mb="xs">
                        {activity.description}
                      </Text>

                      {activity.details && (
                        <Card withBorder p="xs" mb="xs" bg="gray.0">
                          <Stack gap="xs">
                            {activity.details.formula && (
                              <Group gap="xs">
                                <Text size="xs" fw={500} c="dimmed">
                                  Rumus:
                                </Text>
                                <Text size="xs" ff="monospace" c="blue">
                                  {activity.details.formula}
                                </Text>
                              </Group>
                            )}
                            {activity.details.result && (
                              <Group gap="xs">
                                <Text size="xs" fw={500} c="dimmed">
                                  Hasil:
                                </Text>
                                <Text size="xs" fw={600} c="green">
                                  {activity.details.result}
                                </Text>
                              </Group>
                            )}
                            {activity.details.wordCount && (
                              <Group gap="xs">
                                <Text size="xs" fw={500} c="dimmed">
                                  Jumlah kata:
                                </Text>
                                <Text size="xs">
                                  {activity.details.wordCount}
                                </Text>
                              </Group>
                            )}
                            {activity.details.oldValue &&
                              activity.details.newValue && (
                                <Stack gap="xs">
                                  <Group gap="xs">
                                    <Text size="xs" fw={500} c="dimmed">
                                      Dari:
                                    </Text>
                                    <Text size="xs" c="red">
                                      {activity.details.oldValue}
                                    </Text>
                                  </Group>
                                  <Group gap="xs">
                                    <Text size="xs" fw={500} c="dimmed">
                                      Ke:
                                    </Text>
                                    <Text size="xs" c="green">
                                      {activity.details.newValue}
                                    </Text>
                                  </Group>
                                </Stack>
                              )}
                          </Stack>
                        </Card>
                      )}
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Box>
            ))
          )}
        </ScrollArea>
      </Stack>
    </Modal>
  );
};

export default ActivityLog;

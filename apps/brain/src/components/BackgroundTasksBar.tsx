'use client';

import { useEffect, useState } from 'react';
import { Paper, Group, Text, ThemeIcon, Loader, Stack, Collapse, ActionIcon } from '@mantine/core';
import {
  IconUpload,
  IconFileText,
  IconNetwork,
  IconDatabase,
  IconBolt,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconListDetails,
} from '@tabler/icons-react';

interface BackgroundTasksBarProps {
  uploadId: string | null;
  uploading: boolean;
  fileName?: string | null;
  onComplete?: () => void;
}

const STAGES: Record<string, { title: string; description: string; icon: typeof IconUpload }> = {
  uploading_file: { title: 'Upload File', description: 'Mengirim file ke cloud storage...', icon: IconUpload },
  saving_database: { title: 'Simpan Database', description: 'Membuat record artikel baru...', icon: IconDatabase },
  ai_processing: { title: 'Analisis AI', description: 'Mengekstraksi intisari ilmiah (AI)...', icon: IconFileText },
  generating_nodes: { title: 'Membuat Node', description: 'Menghasilkan representasi dokumen...', icon: IconBolt },
  generating_edges: { title: 'Mencari Koneksi', description: 'Menganalisis hubungan dengan dokumen lain...', icon: IconNetwork },
  completed: { title: 'Selesai', description: 'Proses upload berhasil!', icon: IconCheck },
};

export default function BackgroundTasksBar({ uploadId, uploading, fileName, onComplete }: BackgroundTasksBarProps) {
  const [stageKey, setStageKey] = useState('uploading_file');
  const [progress, setProgress] = useState(0);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!uploading || !uploadId) {
      setStageKey('uploading_file');
      setProgress(0);
      return;
    }

    const eventSource = new EventSource(`/api/upload-progress?uploadId=${uploadId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'progress':
            setStageKey(data.stage || data.message || 'uploading_file');
            setProgress(data.progress || data.percentage || 0);
            break;
          case 'complete':
            setStageKey('completed');
            setProgress(100);
            setTimeout(() => onComplete?.(), 800);
            break;
        }
      } catch (error) {
        console.error('Error parsing background task progress:', error);
      }
    };

    return () => eventSource.close();
  }, [uploadId, uploading, onComplete]);

  if (!uploading || !uploadId) return null;

  const stage = STAGES[stageKey] || STAGES.uploading_file;
  const StageIcon = stage.icon;

  return (
    <Paper withBorder radius="md" p="sm" mb="md">
      <Group justify="space-between" onClick={() => setExpanded((e) => !e)} style={{ cursor: 'pointer' }}>
        <Group gap="xs">
          <ThemeIcon variant="light" color="blue" size="sm" radius="xl">
            <IconListDetails size={14} />
          </ThemeIcon>
          <Text size="sm" fw={600}>Background Tasks (1)</Text>
        </Group>
        <ActionIcon variant="subtle" color="gray" size="sm">
          {expanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        </ActionIcon>
      </Group>

      <Collapse expanded={expanded}>
        <Group gap="sm" mt="xs" wrap="nowrap">
          <ThemeIcon
            variant="light"
            color={stageKey === 'completed' ? 'green' : 'blue'}
            size="lg"
            radius="xl"
          >
            {stageKey === 'completed' ? <IconCheck size={16} /> : <Loader size={14} color="blue" />}
          </ThemeIcon>
          <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
            <Text size="sm" fw={500} truncate>
              {fileName || 'Dokumen'}
            </Text>
            <Group gap={4} wrap="nowrap">
              <StageIcon size={12} />
              <Text size="xs" c="dimmed" truncate>
                {stage.description}
              </Text>
            </Group>
          </Stack>
          <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
            {Math.round(progress)}%
          </Text>
        </Group>
      </Collapse>
    </Paper>
  );
}

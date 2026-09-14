import React, { useEffect } from 'react';
import {
  Paper,
  Group,
  Text,
  RingProgress,
  ActionIcon,
  Stack,
  Collapse,
  ThemeIcon,
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronUp,
  IconCheck,
  IconX,
  IconFileText,
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { UploadJob } from '@/store/useUploadStore';

interface ProgressItemProps {
  job: UploadJob;
  onDismiss: (id: string) => void;
}

export function ProgressItem({ job, onDismiss }: ProgressItemProps) {
  const [opened, { toggle }] = useDisclosure(false);

  // Keep completed upload jobs visible long enough for the follow-up
  // indexing / ghost-worker handoff to appear in the same panel.
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (job.status === 'COMPLETED') {
      timeoutId = setTimeout(() => {
        onDismiss(job.id);
      }, 60000);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [job.status, job.id, onDismiss]);
  const isCompleted = job.status === 'COMPLETED';
  const isFailed = job.status === 'FAILED';
  const isProcessing =
    job.status === 'PROCESSING' ||
    job.status === 'UPLOADING' ||
    job.status === 'INITIALIZING';

  const getProgressColor = () => {
    if (isCompleted) return 'teal';
    if (isFailed) return 'red';
    return 'indigo';
  };

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      INITIALIZING: 'Menyiapkan Ruang Analisis',
      STORING_BINARY: 'Mengamankan Dokumen di Cloud',
      PARSING_PDF: 'Mempelajari Struktur Literatur',
      AI_EXTRACTION: 'Mengekstraksi Intisari Ilmiah (AI)',
      EMBEDDING_PILLARS: 'Membangun Memori Semantik',
      FINALIZING_GRAPH: 'Menjalin Relasi antar Pengetahuan',
      INDEXING_VECTORS: 'Mempersiapkan dokumen untuk chatbot...',
      COMPLETED: 'Tesis Terintegrasi ke Jaringan',
      FAILED: 'Gagal',
    };
    return labels[stage] || stage;
  };

  return (
    <Paper
      className="progressItemPaper"
      shadow="xs"
      p="sm"
      radius="md"
      withBorder
    >
      <Group justify="space-between" align="center" wrap="nowrap">
        <Group wrap="nowrap" gap="sm">
          {isCompleted ? (
            <ThemeIcon color="teal" size={38} radius="xl" variant="light">
              <IconCheck size={20} />
            </ThemeIcon>
          ) : isFailed ? (
            <ThemeIcon color="red" size={38} radius="xl" variant="light">
              <IconX size={20} />
            </ThemeIcon>
          ) : (
            <RingProgress
              size={38}
              thickness={4}
              roundCaps
              sections={[{ value: job.progress, color: getProgressColor() }]}
              label={
                <Text size="xs" ta="center" fw={700}>
                  {Math.round(job.progress)}
                </Text>
              }
            />
          )}

          <Stack gap={0} style={{ overflow: 'hidden', maxWidth: 180 }}>
            <Text size="sm" fw={600} truncate title={job.filename}>
              {job.filename}
            </Text>
            <Text
              size="xs"
              c="dimmed"
              truncate
              className={isProcessing ? 'streamingDots' : ''}
            >
              {getStageLabel(job.stage)}
            </Text>
          </Stack>
        </Group>

        <Group gap="xs" wrap="nowrap">
          <ActionIcon variant="subtle" color="gray" onClick={toggle} size="sm">
            {opened ? (
              <IconChevronUp size={16} />
            ) : (
              <IconChevronDown size={16} />
            )}
          </ActionIcon>
          {(isCompleted || isFailed) && (
            <ActionIcon
              variant="subtle"
              color="red"
              onClick={() => onDismiss(job.id)}
              size="sm"
            >
              <IconX size={16} />
            </ActionIcon>
          )}
        </Group>
      </Group>

      <Collapse in={opened}>
        <Text size="xs" c="dimmed" mt="xs" style={{ whiteSpace: 'pre-wrap' }}>
          {job.message || 'Memproses dokumen...'}
          {job.error && (
            <Text span c="red" display="block" mt={4}>
              {job.error}
            </Text>
          )}
        </Text>
      </Collapse>
    </Paper>
  );
}

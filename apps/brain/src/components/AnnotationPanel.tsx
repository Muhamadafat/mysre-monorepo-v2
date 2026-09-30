// src/components/AnnotationPanel.tsx
'use client';

import {
  Box,
  Text,
  Group,
  ThemeIcon,
  Badge,
  Card,
  Divider,
  Button,
  LoadingOverlay,
  Modal,
  ActionIcon,
  useMantineColorScheme,
  useMantineTheme,
  Menu,
  Tooltip,
  Stack,
  Paper,
  Transition,
  UnstyledButton,
  Tabs,
} from '@mantine/core';
import {
  IconArticleFilled,
  IconEye,
  IconSquareRoundedX,
  IconHistory,
  IconFile,
  IconCalendar,
  IconNotes,
  IconChevronLeft,
  IconHighlight,
  IconDots,
  IconBookmark,
  IconQuote,
  IconTrash,
  IconExternalLink,
  IconNote,
  IconNotebook,
  IconSparkles,
  IconArrowUp,
  IconStar,
  IconShare,
} from '@tabler/icons-react';
import { useParams } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { notifications } from '@mantine/notifications';
import { useHover } from '@mantine/hooks';
import WebViewer from './WebViewerDynamic';
import { handleAnalytics } from './NodeDetail';
import { modals } from '@mantine/modals';

interface Annotation {
  id: string;
  articleId: string;
  page: number;
  highlightedText: string;
  comment: string;
  semanticTag?: string;
  createdAt: string;
  article: {
    id: string;
    title: string;
    filePath: string;
  };
}

export default function AnnotationPanel({
  sessionId,
  session,
  refreshKey,
  defaultTab = 'files',
}: {
  sessionId?: string;
  session?: string;
  refreshKey?: number;
  defaultTab?: 'files' | 'analysis';
}) {
  const { id: currentSessionId } = useParams();
  const effectiveSessionId = sessionId || currentSessionId;

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPDF, setSelectedPDF] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(defaultTab);

  const { colorScheme } = useMantineColorScheme();
  const theme = useMantineTheme();
  const isDark = colorScheme === 'dark';

  // Update activeTab when defaultTab prop changes
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // Filter annotations based on type
  const fileNotes = useMemo(
    () => annotations.filter((a) => a.page > 0),
    [annotations]
  );
  const analysisNotes = useMemo(
    () => annotations.filter((a) => a.page === 0),
    [annotations]
  );

  const displayNotes = activeTab === 'files' ? fileNotes : analysisNotes;

  const fetchAnnotations = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/annotation?sessionId=${effectiveSessionId}`
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.warn('Annotation fetch non-ok:', res.status, errData);
        // Silently set empty – user might not be logged in yet or session loading
        setAnnotations([]);
        return;
      }
      const data = await res.json();
      setAnnotations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching annotations:', error);
      notifications.show({
        title: 'Error',
        message: 'Gagal memuat daftar anotasi',
        color: 'red',
        position: 'top-right',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnotations();
  }, [effectiveSessionId, refreshKey]);

  const beforeDeleteAnnotation = async (id: string, title: string) => {
    modals.openConfirmModal({
      title: (
        <Text size="lg" fw={600} c="red">
          🗑️ Konfirmasi Hapus Anotasi
        </Text>
      ),
      children: (
        <Box>
          <Text size="sm" mb="md">
            Apakah Anda yakin ingin menghapus anotasi berikut?
          </Text>
          <Box
            p="md"
            style={{
              backgroundColor: isDark
                ? theme.colors.dark[5]
                : theme.colors.gray[0],
              borderRadius: theme.radius.md,
              border: `1px solid ${isDark ? theme.colors.red[8] : theme.colors.red[2]}`,
            }}
          >
            <Text fw={600} size="sm" mb="xs">
              {title}
            </Text>
            <Text size="xs" c="dimmed">
              ID: {id}
            </Text>
          </Box>
          <Text size="sm" c="red" fw={500} mt="md">
            ⚠️ Tindakan ini tidak dapat dibatalkan!
          </Text>
        </Box>
      ),
      labels: {
        confirm: 'Ya, Hapus Anotasi',
        cancel: 'Batal',
      },
      confirmProps: {
        color: 'red',
        size: 'md',
        leftSection: <IconSquareRoundedX size={16} />,
      },
      cancelProps: {
        variant: 'outline',
        size: 'md',
      },
      size: 'md',
      centered: true,
      onConfirm: async () => {
        await handleDeleteAnnotation(id);
      },
    });
  };

  const handleDeleteAnnotation = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/annotation/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        notifications.show({
          title: 'Berhasil',
          message: 'Anotasi berhasil dihapus',
          color: 'green',
          position: 'top-right',
        });
        await fetchAnnotations();
      } else {
        throw new Error('Gagal menghapus anotasi');
      }
    } catch (error) {
      console.error('Delete error:', error);
      notifications.show({
        title: 'Gagal',
        message: 'Gagal menghapus anotasi',
        color: 'red',
        position: 'top-right',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const NoteCard = ({
    annotation,
    index,
  }: {
    annotation: Annotation;
    index: number;
  }) => {
    const { hovered, ref } = useHover();
    const isExpanded = expandedCard === annotation.id;
    const [menuOpened, setMenuOpened] = useState(false);

    const isAnalysis = annotation.page === 0;

    return (
      <Paper
        ref={ref}
        mb="sm"
        p="md"
        radius="lg"
        style={{
          position: 'relative',
          background: isDark
            ? isAnalysis
              ? 'rgba(99, 102, 241, 0.05)'
              : theme.colors.dark[6]
            : isAnalysis
              ? 'rgba(99, 102, 241, 0.02)'
              : theme.colors.gray[0],
          border: `1px solid ${
            isAnalysis
              ? isDark
                ? 'rgba(99, 102, 241, 0.3)'
                : 'rgba(99, 102, 241, 0.2)'
              : isDark
                ? theme.colors.dark[4]
                : theme.colors.gray[2]
          }`,
          transition: 'all 0.3s ease',
          transform:
            hovered || menuOpened ? 'translateY(-2px)' : 'translateY(0)',
          boxShadow:
            hovered || menuOpened
              ? `0 8px 25px ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.1)'}`
              : `0 2px 8px ${isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)'}`,
          cursor: 'pointer',
        }}
        onClick={() => {
          if (!menuOpened) {
            setExpandedCard(isExpanded ? null : annotation.id);
          }
        }}
      >
        {/* Numbering Style from Diagram Step 10 */}
        <Group justify="space-between" mb="xs">
          <Group gap={6}>
            <Text
              size="xs"
              fw={800}
              style={{
                color: '#ef4444',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              Catatan #{index + 1}
            </Text>
            {annotation.semanticTag && (
              <Text
                size="xs"
                fw={600}
                style={{
                  color: isDark ? '#a5b4fc' : '#4f46e5',
                  backgroundColor: isDark
                    ? 'rgba(99, 102, 241, 0.15)'
                    : 'rgba(99, 102, 241, 0.08)',
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontSize: 10,
                }}
              >
                {(() => {
                  if (annotation.semanticTag.includes('boundingRect')) {
                    return '[Highlight Teks]';
                  }
                  const prefix = annotation.semanticTag.startsWith('Relasi:')
                    ? ''
                    : 'Tab: ';
                  return `[${prefix}${annotation.semanticTag}]`;
                })()}
              </Text>
            )}
          </Group>

          <Group gap={4}>
            <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>
              {new Date(annotation.createdAt).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
              })}
            </Text>
          </Group>
        </Group>

        {/* Main Content */}
        <Stack gap="xs">
          {/* Section Teks (Highlight) atau Hasil Analisis (AI) */}
          <Box>
            <Text
              size="sm"
              style={{
                lineHeight: 1.5,
                color: isDark ? theme.colors.gray[2] : theme.colors.gray[8],
                display: '-webkit-box',
                WebkitLineClamp: isExpanded ? 'none' : 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {isAnalysis
                ? annotation.highlightedText
                : `"${annotation.highlightedText}"`}
            </Text>
          </Box>

          {/* Note Section (Catatan Anda) - Sekarang tampil di dua-duanya sesuai foto */}
          {annotation.comment && (
            <Box
              p="xs"
              mt={4}
              style={{
                backgroundColor: isDark
                  ? 'rgba(0,0,0,0.3)'
                  : 'rgba(0,0,0,0.03)',
                borderRadius: 8,
                borderLeft: `3px solid ${theme.colors.blue[5]}`,
              }}
            >
              <Text
                size="xs"
                c="dimmed"
                mb={2}
                fw={700}
                style={{ fontSize: 10, opacity: 0.8 }}
              >
                Catatan Anda:
              </Text>
              <Text
                size="sm"
                fw={700}
                style={{
                  lineHeight: 1.5,
                  color: isDark ? '#f8fafc' : '#1e293b',
                }}
              >
                {annotation.comment}
              </Text>
            </Box>
          )}
        </Stack>

        {/* Action Menu */}
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          <Menu position="bottom-end" withArrow shadow="lg">
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={(e) => e.stopPropagation()}
                style={{ opacity: hovered ? 1 : 0, transition: 'opacity 0.2s' }}
              >
                <IconDots size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconEye size={16} />}
                onClick={(e) => {
                  setSelectedPDF(`${annotation.article.filePath}`);
                  setOpened(true);
                }}
              >
                Lihat Artikel
              </Menu.Item>

              <Menu.Item
                leftSection={<IconExternalLink size={16} />}
                onClick={(e) => {
                  setExpandedCard(
                    expandedCard === annotation.id ? null : annotation.id
                  );
                }}
              >
                {isExpanded ? 'Tutup Detail' : 'Lihat Detail'}
              </Menu.Item>

              <Menu.Divider />
              <Menu.Item
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={(e) => {
                  beforeDeleteAnnotation(
                    annotation.id,
                    annotation.highlightedText
                  );
                }}
                disabled={deletingId === annotation.id}
              >
                Hapus Anotasi
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>

        {/* Expanded Details */}
        <Transition mounted={isExpanded} transition="slide-down" duration={300}>
          {(styles) => (
            <Box
              style={{
                ...styles,
                borderTop: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[3]}`,
                marginTop: theme.spacing.md,
                paddingTop: theme.spacing.md,
              }}
            >
              <Group gap="md">
                <Box style={{ flex: 1 }}>
                  <Text size="xs" c="dimmed" mb="xs">
                    Detail Artikel
                  </Text>
                  <Text size="sm" fw={500}>
                    {annotation.article.title}
                  </Text>
                  <Text size="xs" c="dimmed" mt="xs">
                    Dibuat:{' '}
                    {new Date(annotation.createdAt).toLocaleDateString(
                      'id-ID',
                      {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }
                    )}
                  </Text>
                </Box>
              </Group>
            </Box>
          )}
        </Transition>
      </Paper>
    );
  };

  return (
    <Box
      style={{
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <LoadingOverlay visible={loading} />

      {/* Minimal Header */}
      <Box p="md" pb="xs" style={{ flexShrink: 0 }}>
        <Group justify="space-between" mb="xs">
          <Group gap="sm">
            <ThemeIcon
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan', deg: 45 }}
              size="lg"
              radius="xl"
            >
              <IconBookmark size={20} />
            </ThemeIcon>
            <Box>
              <Text size="lg" fw={700} c={isDark ? 'white' : 'dark'}>
                Catatan Saya
              </Text>
              <Text size="xs" c="dimmed">
                {annotations.length} anotasi tersimpan
              </Text>
            </Box>
          </Group>
        </Group>

        <Box
          mt="md"
          style={{
            backgroundColor: isDark
              ? 'rgba(255, 255, 255, 0.05)'
              : 'rgba(0, 0, 0, 0.03)',
            borderRadius: 12,
            padding: 4,
            display: 'flex',
            gap: 4,
          }}
        >
          <Box
            onClick={() => setActiveTab('files')}
            style={{
              flex: 1,
              padding: '8px 16px',
              borderRadius: 8,
              backgroundColor:
                activeTab === 'files'
                  ? isDark
                    ? 'rgba(59, 130, 246, 0.2)'
                    : '#e0e7ff'
                  : 'transparent',
              color:
                activeTab === 'files'
                  ? isDark
                    ? '#60a5fa'
                    : '#3730a3'
                  : isDark
                    ? '#9ca3af'
                    : '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s ease',
            }}
          >
            <IconFile size={16} stroke={2} />
            <Text size="sm" fw={600}>
              File
            </Text>
            <Badge
              size="xs"
              variant="filled"
              color={activeTab === 'files' ? 'blue' : 'gray'}
            >
              {fileNotes.length}
            </Badge>
          </Box>
          <Box
            onClick={() => setActiveTab('analysis')}
            style={{
              flex: 1,
              padding: '8px 16px',
              borderRadius: 8,
              backgroundColor:
                activeTab === 'analysis'
                  ? isDark
                    ? 'rgba(59, 130, 246, 0.2)'
                    : '#e0e7ff'
                  : 'transparent',
              color:
                activeTab === 'analysis'
                  ? isDark
                    ? '#60a5fa'
                    : '#3730a3'
                  : isDark
                    ? '#9ca3af'
                    : '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s ease',
            }}
          >
            <IconSparkles size={16} stroke={2} />
            <Text size="sm" fw={600}>
              Analisis
            </Text>
            <Badge
              size="xs"
              variant="filled"
              color={activeTab === 'analysis' ? 'blue' : 'gray'}
            >
              {analysisNotes.length}
            </Badge>
          </Box>
        </Box>
      </Box>

      {/* Notes List */}
      <Box
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {displayNotes.length === 0 ? (
          <Box
            style={{
              textAlign: 'center',
              padding: '4rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: theme.spacing.md,
            }}
          >
            <ThemeIcon
              variant="light"
              color="blue"
              size={80}
              radius="xl"
              style={{
                background: isDark
                  ? `linear-gradient(135deg, ${theme.colors.blue[9]} 0%, ${theme.colors.cyan[9]} 100%)`
                  : `linear-gradient(135deg, ${theme.colors.blue[1]} 0%, ${theme.colors.cyan[1]} 100%)`,
              }}
            >
              <IconNotes size={40} />
            </ThemeIcon>
            <Box>
              <Text size="lg" fw={500} c={isDark ? 'gray.3' : 'gray.7'} mb="xs">
                {activeTab === 'files'
                  ? 'Belum ada catatan file'
                  : 'Belum ada hasil analisis'}
              </Text>
              <Text
                size="sm"
                c="dimmed"
                maw={300}
                mx="auto"
                style={{ lineHeight: 1.5 }}
              >
                {activeTab === 'files'
                  ? 'Mulai highlight dan buat catatan pada artikel untuk melihat koleksi catatan Anda di sini'
                  : 'Gunakan fitur Analisis Komparatif dan simpan hasilnya untuk melihatnya di sini'}
              </Text>
            </Box>
          </Box>
        ) : (
          <Stack gap="xs">
            {displayNotes.map((annotation, idx) => (
              <NoteCard
                key={annotation.id}
                annotation={annotation}
                index={idx}
              />
            ))}
          </Stack>
        )}
      </Box>

      {/* Modal unchanged */}
      <Modal
        opened={opened}
        onClose={() => {
          setOpened(false);
          setSelectedPDF(null);
        }}
        title="Lihat Artikel"
        size="90%"
        padding="sm"
        centered
        overlayProps={{ blur: 3 }}
        styles={{
          content: {
            height: '90vh',
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            position: 'relative',
          },
          body: {
            flex: 1,
            overflow: 'hidden',
            padding: 0,
            position: 'relative',
          },
        }}
      >
        {selectedPDF && (
          <div style={{ height: '100%', position: 'relative' }}>
            <WebViewer
              fileUrl={selectedPDF}
              onAnalytics={handleAnalytics}
              session={session}
              onSave={() => {
                fetchAnnotations();
                notifications.show({
                  title: '✅ Catatan Tersimpan',
                  message: 'Anotasi baru telah ditambahkan ke koleksi Anda.',
                  color: 'green',
                  position: 'top-right',
                });
              }}
            />
          </div>
        )}
      </Modal>
    </Box>
  );
}

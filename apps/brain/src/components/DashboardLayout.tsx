/* eslint-disable @typescript-eslint/no-explicit-any */
// components/DashboardLayout.tsx
'use client';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import {
  AppShell,
  AppShellHeader,
  AppShellNavbar,
  AppShellMain,
  Modal,
  Stack,
  TextInput,
  Textarea,
  Box,
  Text,
  ColorPicker,
  Button,
  Group,
  rem,
} from '@mantine/core';
import { DashboardHeader } from './DashboardHeader';
import { DashboardNavbar } from './DashboardNavbar';
import { ActivityBar, ACTIVITY_BAR_WIDTH } from './ActivityBar';
import { usePathname, useRouter } from 'next/navigation';
import { eventBus } from '@sre-monorepo/lib';

interface ProjectItem {
  id: string;
  title: string;
  description?: string;
  coverColor: string;
  lastActivity: string;
  active: boolean;
}

interface DashboardLayoutProps {
  children: ReactNode;
  sidebarOpened: boolean;
  onToggleSidebar: () => void;
  mounted: boolean;
  onSessionCreated?: () => void;
  // Props yang dilempar dari halaman project agar ActivityBar bisa switch panel
  activeFeature?: string;
  onFeatureSelect?: (featureId: string) => void;
  projectId?: string;
}

export function DashboardLayout({
  children,
  sidebarOpened,
  onToggleSidebar,
  mounted,
  onSessionCreated,
  activeFeature,
  onFeatureSelect,
  projectId,
}: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const [newSession, setNewSession] = useState({
    title: '',
    description: '',
    coverColor: '#4c6ef5',
  });

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/projects-api', {
        credentials: 'include', // Ensure cookies/session are sent
      });

      if (!res.ok) {
        if (res.status === 401) {
          console.error('Unauthorized: Session might be expired or missing.');
          return; // Exit early if unauthorized
        }
        throw new Error(`HTTP Error: ${res.status}`);
      }

      const data = await res.json();

      const formatted: ProjectItem[] = data.map((session: any) => ({
        id: session.id,
        title: session.title,
        description: session.description || '',
        coverColor: session.coverColor || '#4c6ef5',
        lastActivity: new Date(
          session.lastActivity || session.updatedAt || session.createdAt
        ).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
        }),
        active: pathname.includes(`/projects/${session.id}`),
      }));

      setProjects(formatted);
    } catch (error) {
      console.error('Gagal memuat sesi brainstorming:', error);
    } finally {
      setLoading(false);
    }
  }, [pathname]);

  useEffect(() => {
    function handleUpdate() {
      fetchProjects();
    }

    eventBus.on('sessionCreated', handleUpdate);
    eventBus.on('sessionDeleted', handleUpdate);
    eventBus.on('sessionUpdated', handleUpdate);

    return () => {
      eventBus.off('sessionCreated', handleUpdate);
      eventBus.off('sessionDeleted', handleUpdate);
      eventBus.off('sessionUpdated', handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (mounted) {
      fetchProjects();
    }
  }, [mounted, fetchProjects]);

  const handleSessionSelect = useCallback(
    (projectId: string) => {
      router.push(`/projects/${projectId}`);
    },
    [router]
  );

  const handleNewSession = useCallback(() => {
    setCreateModalOpen(true);
  }, []);

  const handleCreateSession = async () => {
    if (!newSession.title.trim()) return;

    try {
      const res = await fetch('/api/projects-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(newSession),
      });

      if (!res.ok) {
        if (res.status === 401) {
          console.error('Unauthorized: Session might be expired or missing.');
          return;
        }
        throw new Error('Gagal membuat sesi brainstorming');
      }

      const data = await res.json();

      await fetchProjects();
      setCreateModalOpen(false);
      setNewSession({ title: '', description: '', coverColor: '#4c6ef5' });
      onSessionCreated?.();
    } catch (error) {
      console.error('Error creating session', error);
    }
  };

  return (
    <>
      <AppShell
        header={{ height: 60 }}
        navbar={{
          width: 260,
          breakpoint: 'sm',
          collapsed: { mobile: !sidebarOpened, desktop: !sidebarOpened },
        }}
        padding={0}
      >
        <AppShellHeader>
          <DashboardHeader
            sidebarOpened={sidebarOpened}
            onToggleSidebar={onToggleSidebar}
            mounted={mounted}
          />
        </AppShellHeader>

        <AppShellNavbar p="md">
          <DashboardNavbar
            projects={projects}
            mounted={mounted}
            onSessionSelect={handleSessionSelect}
            onNewSession={handleNewSession}
          />
        </AppShellNavbar>

        <AppShellMain>
          {/* Activity Bar + Content wrapper */}
          <Box
            style={{
              display: 'flex',
              height: 'calc(100vh - 60px)',
              overflow: 'hidden',
            }}
          >
            {/* ─── VS Code-style Activity Bar ─── */}
            <ActivityBar
              onFeatureSelect={onFeatureSelect}
              activeFeature={activeFeature}
              onNewSession={handleNewSession}
              projectId={projectId}
            />

            {/* ─── Main content (fills the rest) ─── */}
            <Box
              style={{
                flex: 1,
                minWidth: 0,
                overflowY: 'hidden',
                overflowX: 'hidden',
              }}
            >
              {children}
            </Box>
          </Box>
        </AppShellMain>
      </AppShell>

      {/* Create Session Modal */}
      <Modal
        opened={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setNewSession({ title: '', description: '', coverColor: '#4c6ef5' });
        }}
        title="Buat Sesi Brainstorming Baru"
        size="md"
        centered
        styles={{
          header: { fontWeight: 700 },
        }}
      >
        <Stack gap="md">
          <TextInput
            label="Judul Sesi"
            placeholder="Masukkan judul sesi brainstorming"
            value={newSession.title}
            onChange={(e) =>
              setNewSession({ ...newSession, title: e.currentTarget.value })
            }
            required
          />

          <Textarea
            label="Deskripsi (Opsional)"
            placeholder="Jelaskan tujuan sesi brainstorming Anda"
            value={newSession.description}
            onChange={(e) =>
              setNewSession({
                ...newSession,
                description: e.currentTarget.value,
              })
            }
            minRows={3}
          />

          <Box>
            <Text size="sm" fw={500} mb="xs">
              Warna Cover
            </Text>
            <ColorPicker
              value={newSession.coverColor}
              onChange={(color) =>
                setNewSession({ ...newSession, coverColor: color })
              }
              withPicker={false}
              swatches={[
                '#4c6ef5',
                '#51cf66',
                '#ff6b6b',
                '#ffd43b',
                '#9775fa',
                '#40c057',
                '#fd7e14',
                '#15aabf',
                '#748ffc',
                '#69db7c',
                '#ffa8a8',
                '#ffe066',
              ]}
              swatchesPerRow={6}
            />
            <Group mt="xs" gap="xs" align="center">
              <Text size="xs" c="dimmed">
                Warna terpilih:
              </Text>
              <Box
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  backgroundColor: newSession.coverColor,
                  border: '2px solid #e9ecef',
                }}
              />
              <Text size="xs" c="dimmed">
                {newSession.coverColor}
              </Text>
            </Group>
          </Box>

          <Group justify="flex-end" mt="md">
            <Button
              variant="subtle"
              onClick={() => {
                setCreateModalOpen(false);
                setNewSession({
                  title: '',
                  description: '',
                  coverColor: '#4c6ef5',
                });
              }}
            >
              Batal
            </Button>
            <Button
              onClick={handleCreateSession}
              disabled={!newSession.title.trim()}
              loading={loading}
            >
              Buat Sesi
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

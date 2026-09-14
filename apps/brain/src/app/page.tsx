/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Grid,
  Card,
  Text,
  Button,
  Group,
  Stack,
  ThemeIcon,
  ActionIcon,
  Modal,
  TextInput,
  Textarea,
  ColorPicker,
  Badge,
  Box,
  Avatar,
  Menu,
  Paper,
  Skeleton,
  Center,
  Divider,
  rem,
  useMantineColorScheme,
  useMantineTheme,
  Tooltip,
  Overlay,
  Loader,
} from '@mantine/core';
import {
  IconPlus,
  IconBrain,
  IconCalendar,
  IconDots,
  IconEdit,
  IconTrash,
  IconCopy,
  IconShare,
  IconArticle,
  IconMessageCircle,
  IconChartDots,
  IconFolder,
  IconSearch,
  IconFolderOpen,
  IconFileText,
  IconSquareRoundedX,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useRouter } from 'next/navigation';
import { eventBus } from '@sre-monorepo/lib';
import { DebugAuth } from '@/components/DebugAuth';
import { createClient } from '@sre-monorepo/lib';

interface BrainstormingProject {
  id: string;
  title: string;
  description?: string;
  coverColor: string;
  articleCount: number;
  chatCount: number;
  lastActivity: string;
  createdAt: string;
}

interface Project {
  id: string;
  title: string;
  description?: string;
  coverColor: string;
  lastActivity: string;
  active: boolean;
}

export default function ProjectDashboard() {
  const [projects, setProjects] = useState<BrainstormingProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingProject, setEditingProject] =
    useState<BrainstormingProject | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [sidebarOpened, setSidebarOpened] = useState(false);

  const { colorScheme } = useMantineColorScheme();
  const theme = useMantineTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = mounted ? colorScheme === 'dark' : false;
  const [loadingStates, setLoadingStates] = useState<{
    [key: string]: boolean;
  }>({});
  const [projectId, setProjectId] = useState<string | null>(null);

  const router = useRouter();

  const mappedProjects: Project[] = projects.map((project) => ({
    id: project.id,
    title: project.title,
    description: project.description,
    coverColor: project.coverColor,
    lastActivity: project.lastActivity,
    active: activeSessionId === project.id,
  }));

  const handleSessionSelect = useCallback(
    (projectId: string) => {
      setActiveSessionId(projectId);
      router.push(`/projects/${projectId}`);
    },
    [router]
  );

  const handleNewSession = useCallback(() => {
    setCreateModalOpen(true);
  }, []);

  const handleChatSelect = useCallback((chatId: number) => {
    console.log('Selected Chat');
  }, []);

  const handleToogleSidebar = useCallback(() => {
    setSidebarOpened((o) => !o);
  }, []);

  const handleNewChat = useCallback(() => {
    console.log('New Chat clicked');
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const getSessionId = async () => {
      console.log('🔍 Getting projectId from existing API...');
      try {
        const response = await fetch('/api/session');
        const data = await response.json();

        if (response.ok && data.projectId) {
          console.log('✅ Got projectId from API:', data.projectId);
          console.log('📋 Session data:', {
            userId: data.user?.id,
            email: data.user?.email,
            expiresAt: data.expires_at,
          });
          setProjectId(data.projectId);
        } else {
          console.error(
            '❌ Failed to get projectId:',
            data.error || 'No projectId in response'
          );
          setProjectId(null);
        }
      } catch (error) {
        console.error('❌ Error calling session API:', error);
        setProjectId(null);
      }
    };

    getSessionId();
  }, []);

  // Form states
  const [newProject, setNewProject] = useState({
    title: '',
    description: '',
    coverColor: '#4c6ef5',
  });

  const setButtonLoading = (key: string, loading: boolean) => {
    setLoadingStates((prev) => ({
      ...prev,
      [key]: loading,
    }));
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects-api', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      const data = await res.json();

      const formatted: BrainstormingProject[] = data.map((p: any) => ({
        id: p.id,
        title: p.title,
        description: p.description || '',
        coverColor: p.coverColor || '#4c6ef5',
        articleCount: p._count?.articles || 0,
        chatCount: p._count?.chatMessages || 0,
        lastActivity: new Date(
          p.lastActivity || p.updatedAt || p.createdAt
        ).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
        }),
        createdAt: new Date(p.createdAt).toISOString().split('T')[0],
      }));

      setProjects(formatted);
    } catch (error) {
      console.error('Gagal memuat proyek', error);
    } finally {
      setLoading(false);
    }
  };

  // Mock data for demonstration
  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    return () => {
      setLoadingStates({});
    };
  }, []);

  useEffect(() => {
    function handleUpdate() {
      fetchProjects();
    }
    eventBus.on('sessionCreated', handleUpdate);
    eventBus.on('sessionDeleted', handleUpdate);
    eventBus.on('sessionUpdated', handleUpdate);
    eventBus.on('articleDeleted', handleUpdate);

    return () => {
      eventBus.off('sessionCreated', handleUpdate);
      eventBus.off('sessionDeleted', handleUpdate);
      eventBus.off('sessionUpdated', handleUpdate);
      eventBus.off('articleDeleted', handleUpdate);
    };
  }, []);

  const filteredProjects = projects.filter(
    (project) =>
      project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSessionCreatedFromSidebar = useCallback(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async () => {
    if (!newProject.title.trim()) return;
    try {
      const res = await fetch('/api/projects-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newProject),
      });

      const data = await res.json();

      if (res.ok) {
        await fetchProjects(); // kamu bisa pisahkan ke fungsi di luar
        eventBus.emit('sessionCreated');
        setCreateModalOpen(false);
        setNewProject({ title: '', description: '', coverColor: '#4c6ef5' });

        setMounted(false);
        setTimeout(() => setMounted(true), 100);
        notifications.show({
          title: 'Success',
          message: 'Berhasil membuat sesi',
          color: 'green',
          position: 'top-right',
        });
      } else {
        notifications.show({
          title: 'Gagal',
          message: 'Gagal membuat sesi',
          color: 'red',
          position: 'top-right',
        });

        throw new Error('Gagal membuat proyek');
      }
    } catch (error) {
      console.error('Error', error);
      notifications.show({
        title: 'Gagal',
        message: 'Gagal membuat sesi',
        color: 'red',
        position: 'top-right',
      });
    }
  };

  const deleteProject = async (id: string, title: string) => {
    modals.openConfirmModal({
      title: (
        <Text size="lg" fw={600} c="red">
          🗑️ Konfirmasi Hapus sesi
        </Text>
      ),
      children: (
        <Box>
          <Text size="sm" mb="md">
            Apakah Anda yakin ingin menghapus sesi berikut?
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
        confirm: 'Ya, Hapus Sesi',
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
        await handleDeleteProject(id);
      },
    });
  };

  const handleDeleteProject = async (projectId: string) => {
    // const confirmed = confirm('Apakah kamu yakin ingin menghapus proyek ini?');
    // if (!confirmed) return;

    try {
      const res = await fetch(`/api/projects-api/${projectId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchProjects();
        eventBus.emit('sessionDeleted', projectId);
        notifications.show({
          title: 'Success',
          message: 'Berhasil hapus sesi',
          color: 'green',
          position: 'top-right',
        });
      } else {
        const err = await res.json();
        notifications.show({
          title: 'Gagal',
          message: 'Gagal hapus sesi',
          color: 'red',
          position: 'top-right',
        });
        throw new Error(err?.error || 'Gagal menghapus proyek');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleEditProject = async () => {
    if (!editingProject) return;

    try {
      const res = await fetch(`/api/projects-api/${editingProject.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editingProject.title,
          description: editingProject.description,
          coverColor: editingProject.coverColor,
        }),
      });

      if (!res.ok) {
        notifications.show({
          title: 'Gagal',
          message: 'Gagal update sesi',
          color: 'red',
          position: 'top-right',
        });
        throw new Error('Gagal menyimpan perubahan');
      }

      await fetchProjects();
      eventBus.emit('sessionUpdated', editingProject.id);
      setEditingProject(null);
      notifications.show({
        title: 'Success',
        message: 'Berhasil update sesi',
        color: 'green',
        position: 'top-right',
      });
    } catch (error) {
      console.error('Edit error:', error);
      // alert('Terjadi kesalahan saat menyimpan perubahan.');
      notifications.show({
        title: 'Gagal',
        message: 'Gagal update sesi',
        color: 'red',
        position: 'top-right',
      });
    }
  };

  const handleDuplicateProject = (project: BrainstormingProject) => {
    const duplicated: BrainstormingProject = {
      ...project,
      id: Date.now().toString(),
      title: `${project.title} (Copy)`,
      lastActivity: 'Baru dibuat',
      createdAt: new Date().toISOString().split('T')[0],
    };
    setProjects((prev) => [duplicated, ...prev]);
  };

  const handleDeleteArticle = async (articleId: string) => {
    await fetch(`/api/articles/${articleId}`, {
      method: 'DELETE',
    });
    eventBus.emit('articleDeleted');
  };

  const ProjectCard = ({
    project,
    isLoading,
  }: {
    project: BrainstormingProject;
    isLoading?: boolean;
  }) => {
    const isCardLoading = loadingStates[`project-${project.id}`];
    const isDraftLoading = loadingStates[`draft-${project.id}`];

    return (
      <Card
        radius="lg"
        padding={0}
        style={{
          cursor: 'pointer',
          transition:
            'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
          height: '100%',
          backgroundColor: isDark ? '#12131c' : '#fff',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : '#e9ecef'}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-3px)';
          e.currentTarget.style.boxShadow = isDark
            ? '0 12px 36px rgba(0,0,0,0.5)'
            : '0 8px 24px rgba(0,0,0,0.08)';
          e.currentTarget.style.borderColor = isDark
            ? 'rgba(255,255,255,0.14)'
            : '#c5ccd6';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.borderColor = isDark
            ? 'rgba(255,255,255,0.07)'
            : '#e9ecef';
        }}
        onClick={() => {
          setButtonLoading(`project-${project.id}`, true);
          router.push(`/projects/${project.id}`);
        }}
      >
        {/* Loading Overlay */}
        {isCardLoading && (
          <Overlay
            color={isDark ? '#0d0e16' : '#fff'}
            backgroundOpacity={0.85}
            style={{ borderRadius: 'var(--mantine-radius-lg)', zIndex: 5 }}
          >
            <Center h="100%">
              <Loader size="sm" color={project.coverColor || 'blue'} />
            </Center>
          </Overlay>
        )}

        {/* Card body */}
        <Box
          p="lg"
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            gap: 0,
          }}
        >
          {/* Top: Status + Menu */}
          <Group justify="space-between" align="center" mb={12}>
            <Group gap={6} align="center">
              <Box
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  flexShrink: 0,
                  backgroundColor: project.coverColor,
                  boxShadow: `0 0 6px ${project.coverColor}`,
                }}
              />
              <Text
                size="xs"
                fw={700}
                style={{
                  color: project.coverColor,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                ACTIVE
              </Text>
            </Group>

            <Menu shadow="lg" width={180} position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                  style={{ opacity: 0.6 }}
                >
                  <IconDots size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconEdit size={14} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingProject(project);
                  }}
                >
                  Edit
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconCopy size={14} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDuplicateProject(project);
                  }}
                >
                  Duplicate
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconTrash size={14} />}
                  color="red"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteProject(project.id, project.title!);
                  }}
                >
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>

          {/* Title */}
          <Text
            fw={700}
            lineClamp={2}
            mb={6}
            style={{
              fontSize: 18,
              color: isDark ? '#fff' : '#1a1b1e',
              lineHeight: 1.3,
            }}
          >
            {project.title}
          </Text>

          {/* Description */}
          <Text
            size="sm"
            lineClamp={2}
            style={{
              color: project.description
                ? isDark
                  ? '#868e96'
                  : '#6c757d'
                : '#f76707',
              lineHeight: 1.5,
              flex: 1,
              minHeight: 40,
            }}
          >
            {project.description || 'Tidak ada deskripsi'}
          </Text>

          {/* Stats */}
          <Group gap="md" mt={14} mb={14}>
            <Group gap={5} align="center">
              <IconArticle size={13} color={isDark ? '#555' : '#adb5bd'} />
              <Text size="xs" c="dimmed">
                {project.articleCount} Files
              </Text>
            </Group>
            <Group gap={5} align="center">
              <IconMessageCircle
                size={13}
                color={isDark ? '#555' : '#adb5bd'}
              />
              <Text size="xs" c="dimmed">
                {project.chatCount} Chats
              </Text>
            </Group>
          </Group>

          {/* Divider */}
          <Divider
            style={{
              borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f3f5',
            }}
            mb={12}
          />

          {/* Bottom: timestamp + actions */}
          <Group justify="space-between" align="center">
            <Text size="xs" c="dimmed">
              Updated {project.lastActivity}
            </Text>
            <Group gap={6}>
              <Button
                variant="subtle"
                size="xs"
                radius="xl"
                color="gray"
                onClick={(e) => {
                  e.stopPropagation();
                  setButtonLoading(`draft-${project.id}`, true);
                  if (!projectId) {
                    setButtonLoading(`draft-${project.id}`, false);
                    return;
                  }
                  const writerUrl = `${process.env.NEXT_PUBLIC_WRITER_APP_URL}/project/${project.id}/draft?projectId=${projectId}`;
                  window.open(writerUrl, '_blank');
                  setButtonLoading(`draft-${project.id}`, false);
                }}
                loading={isDraftLoading}
                disabled={isCardLoading || isDraftLoading}
              >
                Draft
              </Button>
              <Button
                variant="filled"
                size="xs"
                radius="xl"
                color="blue"
                onClick={(e) => {
                  e.stopPropagation();
                  setButtonLoading(`project-${project.id}`, true);
                  router.push(`/projects/${project.id}`);
                }}
                loading={isCardLoading}
                disabled={isCardLoading || isDraftLoading}
              >
                Buka
              </Button>
            </Group>
          </Group>
        </Box>
      </Card>
    );
  };

  const CreateProjectCard = () => (
    <Card
      radius="lg"
      padding={0}
      style={{
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        height: '100%',
        background: isDark
          ? 'linear-gradient(145deg, #1a1b2e 0%, #12131c 100%)'
          : 'linear-gradient(145deg, #f0f4ff 0%, #e8eeff 100%)',
        border: `1px dashed ${isDark ? 'rgba(99,102,241,0.35)' : 'rgba(99,102,241,0.4)'}`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      onClick={() => setCreateModalOpen(true)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = isDark
          ? '0 12px 36px rgba(99,102,241,0.2)'
          : '0 8px 24px rgba(99,102,241,0.15)';
        e.currentTarget.style.borderColor = isDark
          ? 'rgba(99,102,241,0.7)'
          : 'rgba(99,102,241,0.7)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = isDark
          ? 'rgba(99,102,241,0.35)'
          : 'rgba(99,102,241,0.4)';
      }}
    >
      <Stack align="center" gap="md" px="xl">
        <Box
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(99,102,241,0.45)',
          }}
        >
          <IconPlus size={28} color="#fff" stroke={2.5} />
        </Box>
        <Text
          fw={700}
          ta="center"
          style={{ fontSize: 16, color: isDark ? '#e2e4f0' : '#3730a3' }}
        >
          Buat Sesi Brainstorming
        </Text>
        <Text
          size="sm"
          c="dimmed"
          ta="center"
          style={{ maxWidth: 200, lineHeight: 1.5 }}
        >
          Mulai sesi riset baru untuk mengeksplorasi ide dan konsep kognitif.
        </Text>
      </Stack>
    </Card>
  );

  return (
    <DashboardLayout
      sidebarOpened={sidebarOpened}
      onToggleSidebar={handleToogleSidebar}
      mounted={mounted}
      onSessionCreated={handleSessionCreatedFromSidebar}
    >
      <Container size="xl" py="xl" px="xl" style={{ minHeight: '100%' }}>
        {/* Header */}
        <Group
          justify="space-between"
          align="center"
          mb="xl"
          wrap="wrap"
          gap="md"
        >
          <Stack gap={4}>
            <Group gap="sm" align="center">
              <ThemeIcon
                size={40}
                variant="gradient"
                gradient={{ from: 'indigo', to: 'cyan', deg: 45 }}
                radius="md"
                style={{
                  boxShadow: isDark
                    ? '0 0 20px rgba(76, 110, 245, 0.4)'
                    : 'none',
                }}
              >
                <IconBrain size={24} />
              </ThemeIcon>
              <Text
                variant="gradient"
                gradient={{
                  from: isDark ? 'white' : 'dark',
                  to: isDark ? 'gray.5' : 'gray.7',
                  deg: 90,
                }}
                style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}
              >
                Sesi Brainstorming
              </Text>
            </Group>
            <Text c="dimmed" size="sm" mt={2}>
              Kelola proyek penelitian dan sintesis literatur
            </Text>
          </Stack>

          <Group gap="sm" wrap="nowrap">
            <TextInput
              placeholder="Cari proyek..."
              leftSection={
                <IconSearch size={16} color={theme.colors.gray[5]} />
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              style={{ width: 260 }}
              radius="xl"
              styles={{
                input: {
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.05)'
                    : '#fff',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : theme.colors.gray[3]}`,
                  '&:focus': {
                    borderColor: theme.colors.indigo[4],
                  },
                },
              }}
            />
            <Button
              leftSection={<IconSearch size={16} />}
              variant="gradient"
              gradient={{ from: 'indigo', to: 'blue' }}
              radius="xl"
              onClick={() => {
                const searchInput = document.querySelector(
                  'input[placeholder="Cari proyek..."]'
                ) as HTMLInputElement;
                if (searchInput) searchInput.focus();
              }}
              style={{
                boxShadow: isDark
                  ? '0 4px 15px rgba(76, 110, 245, 0.3)'
                  : 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Cari
            </Button>
          </Group>
        </Group>

        {/* Projects Grid */}
        {loading ? (
          <Grid gutter="xl">
            {[...Array(6)].map((_, i) => (
              <Grid.Col key={i} span={{ base: 12, sm: 6, lg: 4 }}>
                <Card withBorder h={300} radius="lg">
                  <Stack gap="md">
                    <Skeleton height={6} />
                    <Skeleton height={20} width="80%" />
                    <Skeleton height={40} />
                    <Skeleton height={15} width="60%" />
                    <Skeleton height={15} width="40%" />
                  </Stack>
                </Card>
              </Grid.Col>
            ))}
          </Grid>
        ) : (
          <Grid gutter="xl">
            {/* Create new project card */}
            <Grid.Col span={{ base: 12, sm: 6, lg: 4 }}>
              <div style={{ height: 300 }}>
                <CreateProjectCard />
              </div>
            </Grid.Col>

            {/* Existing projects */}
            {filteredProjects.map((project) => (
              <Grid.Col key={project.id} span={{ base: 12, sm: 6, lg: 4 }}>
                <div style={{ height: 300 }}>
                  <ProjectCard
                    project={project}
                    isLoading={loadingStates[`project-${project.id}`]}
                  />
                </div>
              </Grid.Col>
            ))}
          </Grid>
        )}

        {/* Empty state */}
        {!loading && filteredProjects.length === 0 && searchQuery && (
          <Center py="xl">
            <Stack align="center" gap="md">
              <ThemeIcon size={64} variant="light" color="gray" radius="xl">
                <IconFolder size={32} />
              </ThemeIcon>
              <Text size="lg" c="dimmed">
                Tidak ada proyek yang ditemukan
              </Text>
              <Text size="sm" c="dimmed">
                Coba kata kunci lain atau buat proyek baru
              </Text>
            </Stack>
          </Center>
        )}

        {/* Create Project Modal */}
        <Modal
          opened={createModalOpen}
          onClose={() => {
            setCreateModalOpen(false);
            setNewProject({
              title: '',
              description: '',
              coverColor: '#4c6ef5',
            });
          }}
          title="Buat Proyek Brainstorming Baru"
          size="md"
        >
          <Stack gap="md">
            <TextInput
              label="Judul Proyek"
              placeholder="Masukkan judul proyek"
              value={newProject.title}
              onChange={(e) =>
                setNewProject({ ...newProject, title: e.currentTarget.value })
              }
              required
            />

            <Textarea
              label="Deskripsi (Opsional)"
              placeholder="Jelaskan tujuan proyek penelitian Anda"
              value={newProject.description}
              onChange={(e) =>
                setNewProject({
                  ...newProject,
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
                value={newProject.coverColor}
                onChange={(color) =>
                  setNewProject({ ...newProject, coverColor: color })
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
              {/* TAMBAH PREVIEW WARNA TERPILIH */}
              <Group mt="xs" gap="xs" align="center">
                <Text size="xs" c="dimmed">
                  Warna terpilih:
                </Text>
                <Box
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    backgroundColor: newProject.coverColor,
                    border: '2px solid #e9ecef',
                  }}
                />
                <Text size="xs" c="dimmed">
                  {newProject.coverColor}
                </Text>
              </Group>
            </Box>

            <Group justify="flex-end" mt="md">
              <Button
                variant="subtle"
                onClick={() => {
                  setCreateModalOpen(false);
                  setNewProject({
                    title: '',
                    description: '',
                    coverColor: '#4c6ef5',
                  });
                }}
              >
                Batal
              </Button>
              <Button
                onClick={handleCreateProject}
                disabled={!newProject.title.trim()}
              >
                Buat Proyek
              </Button>
            </Group>
          </Stack>
        </Modal>
        {/* Edit Project Modal */}
        <Modal
          opened={!!editingProject}
          onClose={() => setEditingProject(null)}
          title="Edit Proyek Brainstorming"
          size="md"
        >
          {editingProject && (
            <Stack gap="md">
              <TextInput
                label="Judul Proyek"
                placeholder="Masukkan judul proyek"
                value={editingProject.title}
                onChange={(e) =>
                  setEditingProject({
                    ...editingProject,
                    title: e.currentTarget.value,
                  })
                }
                required
              />

              <Textarea
                label="Deskripsi (Opsional)"
                placeholder="Jelaskan tujuan proyek penelitian Anda"
                value={editingProject.description}
                onChange={(e) =>
                  setEditingProject({
                    ...editingProject,
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
                  value={editingProject.coverColor}
                  onChange={(color) =>
                    setEditingProject({ ...editingProject, coverColor: color })
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
                />
              </Box>
              {/* TAMBAH PREVIEW WARNA TERPILIH */}
              <Group mt="xs" gap="xs" align="center">
                <Text size="xs" c="dimmed">
                  Warna terpilih:
                </Text>
                <Box
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    backgroundColor: editingProject.coverColor,
                    border: '2px solid #e9ecef',
                  }}
                />
                <Text size="xs" c="dimmed">
                  {editingProject.coverColor}
                </Text>
              </Group>

              <Group justify="flex-end" mt="md">
                <Button
                  variant="subtle"
                  onClick={() => setEditingProject(null)}
                >
                  Batal
                </Button>
                <Button onClick={handleEditProject}>Simpan Perubahan</Button>
              </Group>
            </Stack>
          )}
        </Modal>
      </Container>
    </DashboardLayout>
  );
}

'use client';

import { useEffect, useState } from 'react';
import {
  Modal,
  TextInput,
  Stack,
  Group,
  Text,
  Avatar,
  ActionIcon,
  Loader,
  Badge,
  ScrollArea,
  Box,
  Button,
  Divider,
} from '@mantine/core';
import { IconSearch, IconTrash, IconCrown, IconCopy, IconLink, IconRefresh } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface PlatformUser {
  id: string;
  name: string | null;
  email: string;
}

interface Collaborator {
  id: string;
  userId: string;
  user: PlatformUser;
}

interface ShareDraftModalProps {
  opened: boolean;
  onClose: () => void;
  writerSessionId: string;
  isOwner: boolean;
}

export default function ShareDraftModal({ opened, onClose, writerSessionId, isOwner }: ShareDraftModalProps) {
  const [owner, setOwner] = useState<PlatformUser | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<PlatformUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);

  const loadShareLink = async () => {
    if (!writerSessionId || !isOwner) return;
    setLinkLoading(true);
    try {
      const res = await fetch(`/api/writer-sessions/${writerSessionId}/share-link`);
      if (res.ok) {
        const data = await res.json();
        setShareToken(data.token ?? null);
      }
    } catch (error) {
      console.error('Failed to load share link:', error);
    } finally {
      setLinkLoading(false);
    }
  };

  const handleGenerateLink = async () => {
    setLinkBusy(true);
    try {
      const res = await fetch(`/api/writer-sessions/${writerSessionId}/share-link`, { method: 'POST' });
      if (!res.ok) throw new Error('Gagal membuat link undangan');
      const data = await res.json();
      setShareToken(data.token);
      notifications.show({ title: 'Berhasil', message: 'Link undangan dibuat', color: 'green' });
    } catch (error: any) {
      notifications.show({ title: 'Gagal', message: error.message, color: 'red' });
    } finally {
      setLinkBusy(false);
    }
  };

  const handleRevokeLink = async () => {
    setLinkBusy(true);
    try {
      const res = await fetch(`/api/writer-sessions/${writerSessionId}/share-link`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menonaktifkan link undangan');
      setShareToken(null);
      notifications.show({ title: 'Berhasil', message: 'Link undangan dinonaktifkan', color: 'green' });
    } catch (error: any) {
      notifications.show({ title: 'Gagal', message: error.message, color: 'red' });
    } finally {
      setLinkBusy(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareToken) return;
    const url = `${window.location.origin}/invite/${shareToken}`;

    // navigator.clipboard requires a secure context (HTTPS, or a browser-recognized
    // localhost) — plain-HTTP dev hosts like writer.lvh.me don't qualify, so it's
    // often unavailable/throws there even though it works fine once deployed.
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        notifications.show({ title: 'Disalin', message: 'Link undangan disalin ke clipboard', color: 'blue' });
        return;
      } catch {
        // fall through to the legacy fallback below
      }
    }

    const textarea = document.createElement('textarea');
    textarea.value = url;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      const copied = document.execCommand('copy');
      if (copied) {
        notifications.show({ title: 'Disalin', message: 'Link undangan disalin ke clipboard', color: 'blue' });
      } else {
        throw new Error('execCommand copy returned false');
      }
    } catch {
      notifications.show({ title: 'Gagal', message: 'Tidak bisa menyalin link, salin manual ya', color: 'red' });
    } finally {
      document.body.removeChild(textarea);
    }
  };

  const loadCollaborators = async () => {
    if (!writerSessionId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/writer-sessions/${writerSessionId}/collaborators`);
      if (res.ok) {
        const data = await res.json();
        setOwner(data.owner);
        setCollaborators(data.collaborators || []);
      }
    } catch (error) {
      console.error('Failed to load collaborators:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (opened) {
      loadCollaborators();
      loadShareLink();
      setSearch('');
      setSearchResults([]);
    }
  }, [opened, writerSessionId]);

  useEffect(() => {
    if (!isOwner || search.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(search.trim())}`);
        if (res.ok) {
          const data = await res.json();
          const existingIds = new Set([owner?.id, ...collaborators.map((c) => c.userId)]);
          setSearchResults((data.users || []).filter((u: PlatformUser) => !existingIds.has(u.id)));
        }
      } catch (error) {
        console.error('User search failed:', error);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [search, isOwner, owner, collaborators]);

  const handleAdd = async (userId: string) => {
    setAddingId(userId);
    try {
      const res = await fetch(`/api/writer-sessions/${writerSessionId}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Gagal menambah kolaborator');
      }
      setSearch('');
      setSearchResults([]);
      await loadCollaborators();
      notifications.show({ title: 'Berhasil', message: 'Kolaborator ditambahkan', color: 'green' });
    } catch (error: any) {
      notifications.show({ title: 'Gagal', message: error.message, color: 'red' });
    } finally {
      setAddingId(null);
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      const res = await fetch(`/api/writer-sessions/${writerSessionId}/collaborators/${userId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Gagal menghapus kolaborator');
      await loadCollaborators();
      notifications.show({ title: 'Berhasil', message: 'Kolaborator dihapus', color: 'green' });
    } catch (error: any) {
      notifications.show({ title: 'Gagal', message: error.message, color: 'red' });
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Kolaborator Draft" size="md" centered>
      <Stack gap="md">
        {isOwner && (
          <Stack gap={6}>
            <Text size="xs" fw={700} tt="uppercase" c="dimmed">
              Link Undangan
            </Text>
            {linkLoading ? (
              <Group justify="center" py="xs">
                <Loader size="sm" />
              </Group>
            ) : shareToken ? (
              <Stack gap={6}>
                <Group gap={6} wrap="nowrap">
                  <TextInput
                    readOnly
                    value={typeof window !== 'undefined' ? `${window.location.origin}/invite/${shareToken}` : ''}
                    style={{ flex: 1 }}
                    onClick={(e) => e.currentTarget.select()}
                  />
                  <ActionIcon variant="light" onClick={handleCopyLink} size="lg">
                    <IconCopy size={16} />
                  </ActionIcon>
                </Group>
                <Group gap="xs">
                  <Button
                    variant="subtle"
                    size="xs"
                    color="gray"
                    leftSection={<IconRefresh size={14} />}
                    loading={linkBusy}
                    onClick={handleGenerateLink}
                  >
                    Buat ulang link
                  </Button>
                  <Button
                    variant="subtle"
                    size="xs"
                    color="red"
                    loading={linkBusy}
                    onClick={handleRevokeLink}
                  >
                    Nonaktifkan
                  </Button>
                </Group>
                <Text size="xs" c="dimmed">
                  Siapa saja yang punya link ini dan login ke platform bisa ikut mengedit draft ini.
                </Text>
              </Stack>
            ) : (
              <Button
                variant="light"
                size="xs"
                leftSection={<IconLink size={14} />}
                loading={linkBusy}
                onClick={handleGenerateLink}
              >
                Buat link undangan
              </Button>
            )}
            <Divider my={4} />
          </Stack>
        )}

        {isOwner && (
          <TextInput
            placeholder="Cari nama atau email user..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            rightSection={searching ? <Loader size={14} /> : null}
          />
        )}

        {searchResults.length > 0 && (
          <Box style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 8 }} p="xs">
            <Stack gap={4}>
              {searchResults.map((u) => (
                <Group key={u.id} justify="space-between" wrap="nowrap">
                  <Group gap="xs" wrap="nowrap">
                    <Avatar size="sm" radius="xl" color="blue">
                      {(u.name || u.email).charAt(0).toUpperCase()}
                    </Avatar>
                    <Box style={{ minWidth: 0 }}>
                      <Text size="sm" fw={500} truncate>{u.name || u.email}</Text>
                      <Text size="xs" c="dimmed" truncate>{u.email}</Text>
                    </Box>
                  </Group>
                  <ActionIcon
                    variant="light"
                    color="blue"
                    loading={addingId === u.id}
                    onClick={() => handleAdd(u.id)}
                  >
                    +
                  </ActionIcon>
                </Group>
              ))}
            </Stack>
          </Box>
        )}

        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
          Punya Akses
        </Text>

        {loading ? (
          <Group justify="center" py="md">
            <Loader size="sm" />
          </Group>
        ) : (
          <ScrollArea.Autosize mah={280}>
            <Stack gap={6}>
              {owner && (
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="xs" wrap="nowrap">
                    <Avatar size="sm" radius="xl" color="grape">
                      {(owner.name || owner.email).charAt(0).toUpperCase()}
                    </Avatar>
                    <Box style={{ minWidth: 0 }}>
                      <Text size="sm" fw={500} truncate>{owner.name || owner.email}</Text>
                      <Text size="xs" c="dimmed" truncate>{owner.email}</Text>
                    </Box>
                  </Group>
                  <Badge variant="light" color="grape" leftSection={<IconCrown size={12} />}>
                    Pemilik
                  </Badge>
                </Group>
              )}

              {collaborators.map((c) => (
                <Group key={c.id} justify="space-between" wrap="nowrap">
                  <Group gap="xs" wrap="nowrap">
                    <Avatar size="sm" radius="xl" color="blue">
                      {(c.user.name || c.user.email).charAt(0).toUpperCase()}
                    </Avatar>
                    <Box style={{ minWidth: 0 }}>
                      <Text size="sm" fw={500} truncate>{c.user.name || c.user.email}</Text>
                      <Text size="xs" c="dimmed" truncate>{c.user.email}</Text>
                    </Box>
                  </Group>
                  {isOwner && (
                    <ActionIcon variant="subtle" color="red" onClick={() => handleRemove(c.userId)}>
                      <IconTrash size={14} />
                    </ActionIcon>
                  )}
                </Group>
              ))}

              {collaborators.length === 0 && (
                <Text size="xs" c="dimmed" ta="center" py="sm">
                  Belum ada kolaborator
                </Text>
              )}
            </Stack>
          </ScrollArea.Autosize>
        )}
      </Stack>
    </Modal>
  );
}

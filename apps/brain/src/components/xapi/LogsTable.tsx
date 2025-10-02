// src/components/xapi/LogsTable.tsx
import React from 'react';
import { Card, Table, Badge, Group, Text, Pagination, Skeleton, Center, Stack } from '@mantine/core';

interface LogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorEmail: string;
  verb: string;
  objectName: string;
  interactionType: string;
}

interface LogsTableProps {
  logs: LogEntry[];
  loading?: boolean;
  pagination: {
    page: number;
    totalPages: number;
    total: number;
  };
  onPageChange: (page: number) => void;
}

export const LogsTable: React.FC<LogsTableProps> = ({ 
  logs, 
  loading = false,
  pagination,
  onPageChange
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getInteractionBadgeColor = (type: string): string => {
    const colors: Record<string, string> = {
      'node-click': 'blue',
      'edge-click': 'grape',
      'pdf-upload': 'green',
      'pdf-view': 'yellow',
      'chat-interaction': 'pink',
      'annotation-save': 'indigo',
      'text-selection': 'orange',
      'modal-interaction': 'gray',
      'tab-navigation': 'teal',
      'view-mode-change': 'cyan'
    };
    return colors[type] || 'gray';
  };

  if (loading) {
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} height={60} />
          ))}
        </Stack>
      </Card>
    );
  }

  const rows = logs.map((log) => (
    <Table.Tr key={log.id}>
      <Table.Td>
        <Text size="sm">{formatDate(log.timestamp)}</Text>
      </Table.Td>
      <Table.Td>
        <div>
          <Text size="sm" fw={500}>{log.actorName}</Text>
          <Text size="xs" c="dimmed">{log.actorEmail}</Text>
        </div>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{log.verb}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" lineClamp={2}>{log.objectName}</Text>
      </Table.Td>
      <Table.Td>
        <Badge 
          color={getInteractionBadgeColor(log.interactionType)}
          variant="light"
          size="sm"
        >
          {log.interactionType}
        </Badge>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Table.ScrollContainer minWidth={800}>
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Timestamp</Table.Th>
              <Table.Th>Nama Mahasiswa (Actor)</Table.Th>
              <Table.Th>Aktivitas (Verb)</Table.Th>
              <Table.Th>Objek Interaksi</Table.Th>
              <Table.Th>Tipe</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {logs.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Center py="xl">
                    <Text c="dimmed">Tidak ada data log yang ditemukan</Text>
                  </Center>
                </Table.Td>
              </Table.Tr>
            ) : (
              rows
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {/* Pagination */}
      <Group justify="space-between" mt="lg">
        <Text size="sm" c="dimmed">
          Menampilkan {((pagination.page - 1) * 20) + 1} sampai{' '}
          {Math.min(pagination.page * 20, pagination.total)} dari{' '}
          {pagination.total} hasil
        </Text>
        <Pagination
          value={pagination.page}
          onChange={onPageChange}
          total={pagination.totalPages}
          withEdges
        />
      </Group>
    </Card>
  );
};
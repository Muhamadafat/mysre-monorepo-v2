// src/app/xapi-dashboard/logs/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Container, 
  Title, 
  Text, 
  Card, 
  Group, 
  Button, 
  TextInput,
  Select,
  Tabs,
  Stack,
  Loader,
  Center
} from '@mantine/core';
import { 
  IconSearch, 
  IconDownload, 
  IconFileText, 
  IconChartBar,
  IconCalendar,
  IconFilter
} from '@tabler/icons-react';
import { LogsTable } from '@/components/xapi/LogsTable';
import { ExportModal, ExportConfig } from '@/components/xapi/ExportModal';

interface LogsData {
  logs: any[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  filters: {
    activityTypes: string[];
  };
}

export default function XapiLogsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LogsData | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  
  const [filters, setFilters] = useState({
    page: 1,
    startDate: '',
    endDate: '',
    activityType: 'all',
    search: ''
  });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: filters.page.toString(),
        limit: '20'
      });

      if (filters.startDate) {
        params.append('startDate', filters.startDate);
      }
      if (filters.endDate) {
        params.append('endDate', filters.endDate);
      }
      if (filters.activityType !== 'all') {
        params.append('activityType', filters.activityType);
      }
      if (filters.search) {
        params.append('search', filters.search);
      }

      const response = await fetch(`/api/xapi-dashboard/logs?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        console.error('Failed to fetch logs:', result.error);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filters.page]);

  const handleSearch = () => {
    setFilters({ ...filters, page: 1 }); // Reset to page 1 when searching
    setTimeout(() => fetchLogs(), 100);
  };

  const handlePageChange = (page: number) => {
    setFilters({ ...filters, page });
  };

  const handleExport = async (config: ExportConfig) => {
    try {
      // PERBAIKAN: Kirim filter yang sedang aktif ke export API
      const exportPayload = {
        ...config,
        search: filters.search, // Tambahkan search filter
        activityType: filters.activityType // Tambahkan activity type filter
      };

      const response = await fetch('/api/xapi-dashboard/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(exportPayload)
      });

      if (config.format === 'json' || config.format === 'csv') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `xapi-export-${Date.now()}.${config.format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const result = await response.json();
        console.log('Export result:', result);
        alert('XLSX export requires additional client-side processing');
      }

      setShowExportModal(false);
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Gagal mengekspor data');
    }
  };

  const activityOptions = [
    { value: 'all', label: 'Semua Aktivitas' },
    ...(data?.filters.activityTypes || []).map(type => ({
      value: type,
      label: type.replace(/-/g, ' ').replace(/_/g, ' ')
    }))
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--mantine-color-gray-0)' }}>
      {/* Header */}
      <Card shadow="sm" padding="xl" mb="lg" radius={0}>
        <Container size="xl">
          <Title order={1} mb="xs">Detail Log xAPI</Title>
          <Text c="dimmed">
            Lihat dan ekspor data aktivitas pembelajaran secara detail
          </Text>
        </Container>
      </Card>

      {/* Main Content */}
      <Container size="xl" py="lg">
        {/* Navigation Tabs */}
        <Card shadow="sm" padding={0} radius="md" withBorder mb="xl">
          <Tabs value="logs">
            <Tabs.List>
              <Tabs.Tab 
                value="dashboard" 
                leftSection={<IconChartBar size={16} />}
                onClick={() => router.push('/xapi-dashboard')}
              >
                Dasbor xAPI
              </Tabs.Tab>
              <Tabs.Tab 
                value="logs" 
                leftSection={<IconFileText size={16} />}
              >
                Lihat Log xAPI
              </Tabs.Tab>
            </Tabs.List>
          </Tabs>
        </Card>

        {/* Filter Section */}
        <Card shadow="sm" padding="lg" radius="md" withBorder mb="xl">
          <Stack gap="md">
            {/* Search Bar */}
            <Group grow>
              <TextInput
                placeholder="Cari berdasarkan nama mahasiswa atau aktivitas..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                leftSection={<IconSearch size={16} />}
              />
              <Button onClick={handleSearch}>
                Cari
              </Button>
            </Group>

            {/* Filters Row */}
            <Group grow>
              <TextInput
                label="Dari Tanggal"
                placeholder="YYYY-MM-DD"
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                leftSection={<IconCalendar size={16} />}
              />
              <TextInput
                label="Sampai Tanggal"
                placeholder="YYYY-MM-DD"
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                leftSection={<IconCalendar size={16} />}
              />
              <Select
                label="Jenis Aktivitas"
                placeholder="Pilih jenis aktivitas"
                value={filters.activityType}
                onChange={(value) => setFilters({ ...filters, activityType: value || 'all' })}
                data={activityOptions}
                leftSection={<IconFilter size={16} />}
                clearable
              />
            </Group>

            {/* Action Buttons */}
            <Group justify="flex-end">
              <Button
                leftSection={<IconDownload size={16} />}
                color="green"
                onClick={() => setShowExportModal(true)}
              >
                Ekspor Hasil
              </Button>
            </Group>
          </Stack>
        </Card>

        {/* Logs Table */}
        {loading && !data ? (
          <Center py="xl">
            <Stack align="center" gap="md">
              <Loader size="lg" />
              <Text c="dimmed">Memuat data log...</Text>
            </Stack>
          </Center>
        ) : data ? (
          <LogsTable
            logs={data.logs}
            loading={loading}
            pagination={data.pagination}
            onPageChange={handlePageChange}
          />
        ) : null}
      </Container>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        currentFilters={{
          search: filters.search,
          activityType: filters.activityType
        }}
      />
    </div>
  );
}
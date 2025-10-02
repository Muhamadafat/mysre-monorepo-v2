// src/components/xapi/ExportModal.tsx
import React, { useState } from 'react';
import { 
  Modal, 
  Button, 
  Radio, 
  Group, 
  Stack, 
  Checkbox,
  Title,
  Text,
  Paper,
  ScrollArea,
  TextInput,
  Divider
} from '@mantine/core';
import { IconDownload, IconCalendar } from '@tabler/icons-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (config: ExportConfig) => void;
  currentFilters?: {
    search?: string;
    activityType?: string;
  };
}

export interface ExportConfig {
  startDate: string;
  endDate: string;
  format: 'csv' | 'xlsx' | 'json';
  columns: string[];
  exportType?: 'raw' | 'quantitative';
  quantitativeColumns?: string[];
}

export const ExportModal: React.FC<ExportModalProps> = ({ 
  isOpen, 
  onClose, 
  onExport,
  currentFilters
}) => {
  const [exportType, setExportType] = useState<'raw' | 'quantitative'>('raw');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [format, setFormat] = useState<'csv' | 'xlsx' | 'json'>('csv');
  
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'timestamp',
    'actorName',
    'verb',
    'objectName',
    'interactionType'
  ]);

  const [selectedQuantColumns, setSelectedQuantColumns] = useState<string[]>([
    'actorName',
    'totalPdfUpload',
    'totalNodeClick',
    'totalEdgeClick',
    'totalChatInteraction',
    'totalAnnotation',
    'totalActivities'
  ]);

  const rawColumns = [
    { id: 'timestamp', label: 'Timestamp' },
    { id: 'actorName', label: 'Nama Mahasiswa' },
    { id: 'actorEmail', label: 'Email Mahasiswa' },
    { id: 'verb', label: 'Aktivitas (Verb)' },
    { id: 'objectName', label: 'Objek Interaksi' },
    { id: 'objectDescription', label: 'Deskripsi Objek' },
    { id: 'interactionType', label: 'Tipe Interaksi' },
    { id: 'projectId', label: 'Project ID' },
    { id: 'sessionId', label: 'Session ID' },
    { id: 'sequence', label: 'Sequence' },
    { id: 'success', label: 'Success Status' },
    { id: 'completion', label: 'Completion Status' }
  ];

  const quantitativeColumns = [
    { id: 'actorName', label: 'Nama Mahasiswa (Actor)' },
    { id: 'actorEmail', label: 'Email Mahasiswa' },
    { id: 'totalPdfUpload', label: 'Jumlah Unggah Dokumen' },
    { id: 'totalNodeClick', label: 'Jumlah Buka Node' },
    { id: 'totalEdgeClick', label: 'Jumlah Buka Edge' },
    { id: 'totalChatInteraction', label: 'Jumlah Interaksi Chatbot' },
    { id: 'totalAnnotation', label: 'Jumlah Anotasi Dibuat' },
    { id: 'totalTextSelection', label: 'Jumlah Seleksi Teks' },
    { id: 'totalPdfView', label: 'Jumlah Buka PDF' },
    { id: 'totalActivities', label: 'Total Semua Aktivitas' }
  ];

  const handleColumnToggle = (columnId: string) => {
    if (selectedColumns.includes(columnId)) {
      setSelectedColumns(selectedColumns.filter(col => col !== columnId));
    } else {
      setSelectedColumns([...selectedColumns, columnId]);
    }
  };

  const handleQuantColumnToggle = (columnId: string) => {
    if (selectedQuantColumns.includes(columnId)) {
      setSelectedQuantColumns(selectedQuantColumns.filter(col => col !== columnId));
    } else {
      setSelectedQuantColumns([...selectedQuantColumns, columnId]);
    }
  };

  const handleExport = () => {
    if (!startDate || !endDate) {
      alert('Mohon pilih rentang tanggal');
      return;
    }

    if (exportType === 'raw' && selectedColumns.length === 0) {
      alert('Mohon pilih minimal satu kolom');
      return;
    }

    if (exportType === 'quantitative' && selectedQuantColumns.length === 0) {
      alert('Mohon pilih minimal satu kolom kuantitatif');
      return;
    }

    if (exportType === 'quantitative' && format === 'json') {
      setFormat('csv');
    }

    onExport({
      startDate,
      endDate,
      format,
      columns: exportType === 'raw' ? selectedColumns : [],
      exportType,
      quantitativeColumns: exportType === 'quantitative' ? selectedQuantColumns : []
    });
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={
        <Title order={3}>
          {exportType === 'raw' ? 'Ekspor Data Log xAPI' : 'Ekspor Data Kuantitatif'}
        </Title>
      }
      size="lg"
      centered
    >
      <Stack gap="lg">
        {/* Export Type Selection */}
        <div>
          <Text size="sm" fw={500} mb="xs">
            Tipe Ekspor
          </Text>
          <Radio.Group
            value={exportType}
            onChange={(value) => setExportType(value as 'raw' | 'quantitative')}
          >
            <Stack gap="xs">
              <Radio 
                value="raw" 
                label="Log Mentah (Raw Log)" 
                description="Data xAPI statement per baris aktivitas"
              />
              <Radio 
                value="quantitative" 
                label="Data Kuantitatif (Summary)" 
                description="Data agregat per mahasiswa untuk analisis statistik"
              />
            </Stack>
          </Radio.Group>
        </div>

        <Divider />

        {/* Info for Quantitative Export */}
        {exportType === 'quantitative' && (
          <Paper withBorder p="sm" style={{ backgroundColor: 'var(--mantine-color-blue-0)' }}>
            <Text size="sm" fw={500} mb="xs">Informasi Ekspor Kuantitatif:</Text>
            <Text size="xs" c="dimmed">
              Setiap baris pada file ekspor akan mewakili satu mahasiswa beserta total aktivitasnya dalam rentang tanggal yang dipilih.
            </Text>
          </Paper>
        )}

        {/* Info about active filters for raw export */}
        {exportType === 'raw' && (currentFilters?.search || (currentFilters?.activityType && currentFilters.activityType !== 'all')) && (
          <Paper withBorder p="sm" style={{ backgroundColor: 'var(--mantine-color-blue-0)' }}>
            <Text size="sm" fw={500} mb="xs">Filter Aktif:</Text>
            <Stack gap={4}>
              {currentFilters?.search && (
                <Text size="xs" c="dimmed">
                  🔍 Pencarian: "{currentFilters.search}"
                </Text>
              )}
              {currentFilters?.activityType && currentFilters.activityType !== 'all' && (
                <Text size="xs" c="dimmed">
                  🏷️ Jenis Aktivitas: {currentFilters.activityType}
                </Text>
              )}
            </Stack>
            <Text size="xs" style={{ color: 'var(--mantine-color-blue-7)' }} mt="xs">
              Data yang diekspor akan sesuai dengan filter di atas
            </Text>
          </Paper>
        )}

        {/* Date Range */}
        <div>
          <Text size="sm" fw={500} mb="xs">
            Rentang Tanggal
          </Text>
          <Group grow>
            <TextInput
              label="Dari Tanggal"
              placeholder="YYYY-MM-DD"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              leftSection={<IconCalendar size={16} />}
            />
            <TextInput
              label="Sampai Tanggal"
              placeholder="YYYY-MM-DD"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              leftSection={<IconCalendar size={16} />}
            />
          </Group>
        </div>

        {/* File Format */}
        <div>
          <Text size="sm" fw={500} mb="xs">
            Format File
          </Text>
          <Radio.Group
            value={format}
            onChange={(value) => setFormat(value as 'csv' | 'xlsx' | 'json')}
          >
            <Group>
              <Radio value="csv" label=".CSV" />
              <Radio value="xlsx" label=".XLSX" />
              {exportType === 'raw' && <Radio value="json" label=".JSON" />}
            </Group>
          </Radio.Group>
        </div>

        {/* Column Selection - Raw */}
        {exportType === 'raw' && (
          <div>
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={500}>
                Pilih Kolom Data
              </Text>
              <Text size="xs" c="dimmed">
                {selectedColumns.length} kolom dipilih
              </Text>
            </Group>
            <Paper withBorder p="md">
              <ScrollArea h={200}>
                <Stack gap="xs">
                  {rawColumns.map((column) => (
                    <Checkbox
                      key={column.id}
                      label={column.label}
                      checked={selectedColumns.includes(column.id)}
                      onChange={() => handleColumnToggle(column.id)}
                    />
                  ))}
                </Stack>
              </ScrollArea>
            </Paper>
          </div>
        )}

        {/* Column Selection - Quantitative */}
        {exportType === 'quantitative' && (
          <div>
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={500}>
                Pilih Kolom Kuantitatif yang Akan Diekspor
              </Text>
              <Text size="xs" c="dimmed">
                {selectedQuantColumns.length} kolom dipilih
              </Text>
            </Group>
            <Paper withBorder p="md">
              <ScrollArea h={200}>
                <Stack gap="xs">
                  {quantitativeColumns.map((column) => (
                    <Checkbox
                      key={column.id}
                      label={column.label}
                      checked={selectedQuantColumns.includes(column.id)}
                      onChange={() => handleQuantColumnToggle(column.id)}
                    />
                  ))}
                </Stack>
              </ScrollArea>
            </Paper>
          </div>
        )}

        {/* Action Buttons */}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Batal
          </Button>
          <Button 
            leftSection={<IconDownload size={16} />}
            onClick={handleExport}
          >
            Unduh Data
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
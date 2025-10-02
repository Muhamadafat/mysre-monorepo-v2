// src/app/xapi-dashboard/page.tsx
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
  Tabs,
  Stack,
  Loader,
  Center,
  TextInput
} from '@mantine/core';
import { 
  IconCalendar, 
  IconRefresh, 
  IconFileText, 
  IconChartBar 
} from '@tabler/icons-react';
import { DashboardCards } from '@/components/xapi/DashboardCards';
import { ActivityChart } from '@/components/xapi/ActivityChart';
import { TimelineChart } from '@/components/xapi/TimeLineChart';

interface AnalyticsData {
  summary: {
    totalStudents: number;
    totalActivities: number;
    mostCommonActivity: {
      name: string;
      count: number;
    };
    avgInteractionTime: number;
  };
  activityDistribution: Array<{
    name: string;
    count: number;
  }>;
  activityTimeline: Array<{
    date: string;
    count: number;
  }>;
}

export default function XapiDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/xapi-dashboard/analytics?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        console.error('Failed to fetch analytics:', result.error);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleDateFilter = () => {
    fetchAnalytics();
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setTimeout(() => fetchAnalytics(), 100);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--mantine-color-gray-0)' }}>
      {/* Header */}
      <Card shadow="sm" padding="xl" mb="lg" radius={0}>
        <Container size="xl">
          <Title order={1} mb="xs">Dasbor Analitik xAPI</Title>
          <Text c="dimmed">
            Monitor dan analisis aktivitas pembelajaran mahasiswa
          </Text>
        </Container>
      </Card>

      {/* Main Content */}
      <Container size="xl" py="lg">
        {/* Filter Section */}
        <Card shadow="sm" padding="lg" radius="md" withBorder mb="xl">
          <Group grow align="flex-end">
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
            <Group>
              <Button onClick={handleDateFilter}>
                Filter
              </Button>
              <Button 
                variant="default" 
                onClick={handleReset}
                leftSection={<IconRefresh size={16} />}
              >
                Reset
              </Button>
            </Group>
          </Group>
        </Card>

        {/* Navigation Tabs */}
        <Card shadow="sm" padding={0} radius="md" withBorder mb="xl">
          <Tabs defaultValue="dashboard">
            <Tabs.List>
              <Tabs.Tab 
                value="dashboard" 
                leftSection={<IconChartBar size={16} />}
              >
                Dasbor xAPI
              </Tabs.Tab>
              <Tabs.Tab 
                value="logs" 
                leftSection={<IconFileText size={16} />}
                onClick={() => router.push('/xapi-dashboard/logs')}
              >
                Lihat Log xAPI
              </Tabs.Tab>
            </Tabs.List>
          </Tabs>
        </Card>

        {/* Dashboard Content */}
        {loading && !data ? (
          <Center py="xl">
            <Stack align="center" gap="md">
              <Loader size="lg" />
              <Text c="dimmed">Memuat data analytics...</Text>
            </Stack>
          </Center>
        ) : data ? (
          <>
            <DashboardCards summary={data.summary} loading={loading} />
            <ActivityChart data={data.activityDistribution} loading={loading} />
            <TimelineChart data={data.activityTimeline} loading={loading} />
          </>
        ) : null}
      </Container>
    </div>
  );
}
'use client';

import { useEffect, useState } from 'react';
import { Stack, Title, Text, Group, Badge, SimpleGrid, Card, ThemeIcon, LoadingOverlay, Button, Box, Avatar, Progress, Center, RingProgress, Alert } from '@mantine/core';
import { IconUsers, IconBulb, IconPencil, IconTrendingUp, IconChartBar, IconRefresh, IconArrowUp, IconUser, IconClock, IconTarget } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { UserAnalyticsCard } from '@/components/analytics/user-analytics-card';

// Types (sama seperti sebelumnya)
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  group: string;
  nim: string;
  createdAt: string;
  avatar_url?: string | null;
}

interface LearningAnalytics {
  userId: string;
  brainStats: {
    totalProjects: number;
    totalNodes: number;
    totalEdges: number;
    totalChatQueries: number;
    nodeClicks: number;
    edgeClicks: number;
    sessionDuration: number;
    lastActivity: string;
    avgNodesPerProject: number;
    avgEdgesPerProject: number;
    mostUsedNodeTypes: any[];
    relationshipPatterns: any[];
  };
  writerStats: {
    totalDrafts: number;
    totalAnnotations: number;
    totalWritingSessions: number;
    aiAssistanceUsage: number;
    citationCount: number;
    avgWordsPerDraft: number;
    writingProgress: any[];
    lastWritingActivity: string;
    mostUsedSemanticTags: any[];
    annotationFrequency: any[];
  };
  overallStats: {
    recentActivity: number;
    totalLoginSessions: number;
    totalTimeSpent: number;
    preferredModule: 'both';
    activityPattern: any[];
    weeklyActivity: any[];
    productivityScore: number;
    engagementLevel: 'low' | 'medium' | 'high';
  };
}

interface UserAnalytics {
  user: User;
  analytics: LearningAnalytics;
}

export default function MyAnalyticsPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(null);
  const [allAnalytics, setAllAnalytics] = useState<UserAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  // Load current user first
  useEffect(() => {
    console.log('🔍 Starting to load current user...');
    setDebugInfo('Loading current user...');
    loadCurrentUser();
  }, []);

  // Track page view and load analytics after current user is loaded
  useEffect(() => {
    if (currentUser) {
      console.log('✅ Current user loaded:', currentUser);
      setDebugInfo(`Current user loaded: ${currentUser.name} (${currentUser.id})`);
      trackPageView();
      loadMyAnalytics();
    }
  }, [currentUser]);

  const loadCurrentUser = async () => {
    try {
      console.log('📡 Fetching current user from /api/auth/signin...');
      const res = await fetch('/api/auth/signin', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 Response status:', res.status);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: User not authenticated`);
      }

      const data = await res.json();
      console.log('📡 Response data:', data);
      
      if (!data || !data.user) {
        throw new Error('User not authenticated - no user data in response');
      }

      setCurrentUser(data.user);
      setDebugInfo(`User loaded: ${data.user.name}`);
    } catch (error: any) {
      console.error('❌ Error loading current user:', error);
      setError(`Error loading user: ${error.message}`);
      setDebugInfo(`Error: ${error.message}`);
      
      // Don't redirect immediately for debugging
      setTimeout(() => {
        notifications.show({
          title: 'Error',
          message: 'Sesi Anda telah berakhir. Silakan login kembali.',
          color: 'red',
        });
      }, 1000);
    }
  };

  const trackPageView = async () => {
    if (!currentUser?.id) return;

    try {
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'page_view',
          userId: currentUser.id,
          document: 'my-analytics',
          metadata: {
            page: 'my-analytics',
            timestamp: new Date().toISOString(),
          },
        }),
      });
    } catch (error) {
      console.error('⚠️ Error tracking page view:', error);
    }
  };

  const loadMyAnalytics = async () => {
    if (!currentUser?.id) {
      console.log('❌ Cannot load analytics: no current user');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('📡 Fetching analytics from /api/analytics/user/${currentUser.id}...');
      setDebugInfo('Loading analytics data...');
      
      // Menggunakan API user spesifik yang sudah ada
      const response = await fetch(`/api/analytics/user/${currentUser.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 Analytics response status:', response.status);

      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.status} ${response.statusText}`);
      }

      const analyticsData: LearningAnalytics = await response.json();
      console.log('📡 Analytics data received:', analyticsData);
      
      // Construct UserAnalytics dari response dan current user
      const myAnalytics: UserAnalytics = {
        user: currentUser,
        analytics: analyticsData
      };
      
      console.log('🔍 Constructed analytics:', myAnalytics);
      
      setUserAnalytics(myAnalytics);
      setDebugInfo(`Analytics loaded successfully for ${currentUser.name}`);

      // Track analytics loaded event
      try {
        await trackEvent('my_analytics_loaded', {
          productivityScore: myAnalytics.analytics.overallStats.productivityScore,
          engagementLevel: myAnalytics.analytics.overallStats.engagementLevel,
          totalProjects: myAnalytics.analytics.brainStats.totalProjects,
          totalDrafts: myAnalytics.analytics.writerStats.totalDrafts,
        });
      } catch (trackError) {
        console.error('⚠️ Error tracking event:', trackError);
      }

    } catch (error: any) {
      console.error('❌ Error loading my analytics:', error);
      setError(`Gagal memuat data analytics: ${error.message}`);
      setDebugInfo(`Error: ${error.message}`);
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const trackEvent = async (action: string, metadata?: any) => {
    if (!currentUser?.id) return;

    try {
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          userId: currentUser.id,
          document: 'my-analytics',
          metadata,
        }),
      });
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  };

  const handleRefreshData = async () => {
    await trackEvent('my_analytics_refreshed');
    loadMyAnalytics();
  };

  const getEngagementColor = (level: string) => {
    switch (level) {
      case 'high': return 'green';
      case 'medium': return 'yellow';
      case 'low': return 'red';
      default: return 'gray';
    }
  };

  const getProductivityLevel = (score: number) => {
    if (score >= 80) return { label: 'Excellent', color: 'green' };
    if (score >= 60) return { label: 'Good', color: 'blue' };
    if (score >= 40) return { label: 'Average', color: 'yellow' };
    return { label: 'Needs Improvement', color: 'red' };
  };

  // Debug panel (hapus di production)
  const DebugPanel = () => (
    <Alert color="blue" title="Debug Info" mb="md">
      <Text size="sm" mb="xs">Status: {debugInfo}</Text>
      <Text size="xs" c="gray.6">Current User ID: {currentUser?.id || 'Not loaded'}</Text>
      <Text size="xs" c="gray.6">Current User Name: {currentUser?.name || 'Not loaded'}</Text>
      <Text size="xs" c="gray.6">Analytics Found: {userAnalytics ? 'Yes' : 'No'}</Text>
    </Alert>
  );

  if (error) {
    return (
      <Stack gap="xl">
        <DebugPanel />
        <Alert color="red" title="Error">
          {error}
          <Button mt="md" onClick={() => {
            setError(null);
            loadCurrentUser();
          }}>
            Try Again
          </Button>
        </Alert>
      </Stack>
    );
  }

  if (loading || !currentUser) {
    return (
      <Stack gap="xl">
        <DebugPanel />
        <LoadingOverlay visible={loading} />
        <Center h={400}>
          <Stack align="center" gap="md">
            <Text>Loading your analytics...</Text>
            <Text size="sm" c="gray.6">{debugInfo}</Text>
          </Stack>
        </Center>
      </Stack>
    );
  }

  if (!userAnalytics) {
    return (
      <Stack gap="xl">
        <DebugPanel />
        <Alert color="yellow" title="No Analytics Data">
          No analytics data found for your account. This might be normal if you're a new user.
          <Button mt="md" onClick={handleRefreshData}>
            Refresh Data
          </Button>
        </Alert>
      </Stack>
    );
  }

  const { user, analytics } = userAnalytics;
  const productivityLevel = getProductivityLevel(analytics.overallStats.productivityScore);

  return (
    <Stack gap="xl">
      {/* Debug panel - remove in production */}
      {/* <DebugPanel /> */}
      
      <Group justify="space-between">
        <div>
          <Title order={2}>My Learning Analytics</Title>
          <Text c="gray.6">Analisis mendalam perilaku pembelajaran Anda untuk meningkatkan produktivitas</Text>
        </div>
        <Group>
          <Button 
            leftSection={<IconRefresh size={16} />} 
            variant="light" 
            onClick={handleRefreshData}
            loading={loading}
          >
            Refresh Data
          </Button>
        </Group>
      </Group>

      {/* Personal Summary Card */}
      <Card withBorder shadow="md" radius="lg" p="xl" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <Group justify="space-between" align="flex-start">
          <Group gap="lg">
            <Avatar src={user.avatar_url} size="xl" color="white">
              {user.name.charAt(0)}
            </Avatar>
            <div>
              <Text size="xl" fw={700} mb="xs">
                {user.name}
              </Text>
              <Text size="sm" opacity={0.9} mb="sm">
                {user.email} • {user.nim}
              </Text>
              <Group gap="sm">
                <Badge color="rgba(255,255,255,0.2)" variant="filled">
                  Group {user.group}
                </Badge>
                <Badge color={getEngagementColor(analytics.overallStats.engagementLevel)} variant="filled">
                  {analytics.overallStats.engagementLevel.toUpperCase()} Engagement
                </Badge>
              </Group>
            </div>
          </Group>
          
          <Box ta="center">
            <Text size="sm" opacity={0.9} mb="xs">
              Productivity Score
            </Text>
            <RingProgress
              size={120}
              thickness={12}
              sections={[{ value: analytics.overallStats.productivityScore, color: 'white' }]}
              label={
                <Center>
                  <Stack gap={0} align="center">
                    <Text size="lg" fw={700}>
                      {analytics.overallStats.productivityScore}
                    </Text>
                    <Text size="xs" opacity={0.8}>
                      out of 100
                    </Text>
                  </Stack>
                </Center>
              }
            />
            <Badge color={productivityLevel.color} variant="filled" mt="sm">
              {productivityLevel.label}
            </Badge>
          </Box>
        </Group>
      </Card>

      {/* Quick Stats */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
        <Card withBorder shadow="sm" radius="md" p="lg">
          <Group justify="space-between">
            <div>
              <Text c="gray.6" size="sm" fw={500} tt="uppercase">
                Brain Projects
              </Text>
              <Text fw={700} size="xl">
                {analytics.brainStats.totalProjects}
              </Text>
              <Text size="xs" c="blue" mt="xs">
                {analytics.brainStats.totalNodes} nodes created
              </Text>
            </div>
            <ThemeIcon color="violet" variant="light" size="xl" radius="md">
              <IconBulb size={28} />
            </ThemeIcon>
          </Group>
        </Card>

        <Card withBorder shadow="sm" radius="md" p="lg">
          <Group justify="space-between">
            <div>
              <Text c="gray.6" size="sm" fw={500} tt="uppercase">
                Writing Drafts
              </Text>
              <Text fw={700} size="xl">
                {analytics.writerStats.totalDrafts}
              </Text>
              <Text size="xs" c="green" mt="xs">
                {analytics.writerStats.totalAnnotations} annotations
              </Text>
            </div>
            <ThemeIcon color="green" variant="light" size="xl" radius="md">
              <IconPencil size={28} />
            </ThemeIcon>
          </Group>
        </Card>

        <Card withBorder shadow="sm" radius="md" p="lg">
          <Group justify="space-between">
            <div>
              <Text c="gray.6" size="sm" fw={500} tt="uppercase">
                Total Time Spent
              </Text>
              <Text fw={700} size="xl">
                {Math.round(analytics.overallStats.totalTimeSpent / 60)}h
              </Text>
              <Text size="xs" c="blue" mt="xs">
                {analytics.overallStats.totalLoginSessions} sessions
              </Text>
            </div>
            <ThemeIcon color="blue" variant="light" size="xl" radius="md">
              <IconClock size={28} />
            </ThemeIcon>
          </Group>
        </Card>

        <Card withBorder shadow="sm" radius="md" p="lg">
          <Group justify="space-between">
            <div>
              <Text c="gray.6" size="sm" fw={500} tt="uppercase">
                Recent Activity
              </Text>
              <Text fw={700} size="xl">
                {analytics.overallStats.recentActivity}
              </Text>
              <Text size="xs" c="orange" mt="xs">
                Actions in 24h
              </Text>
            </div>
            <ThemeIcon color="orange" variant="light" size="xl" radius="md">
              <IconTrendingUp size={28} />
            </ThemeIcon>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Detailed Analytics Card */}
      <UserAnalyticsCard user={user} analytics={analytics} />
    </Stack>
  );
}
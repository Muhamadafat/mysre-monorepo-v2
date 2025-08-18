'use client';

import { Card, Group, Text, Badge, Stack, SimpleGrid, Box, Tabs, Avatar, RingProgress, Center } from '@mantine/core';
import { IconBulb, IconPencil, IconChartBar, IconClock } from '@tabler/icons-react';

// Types based on API responses
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

export interface UserAnalyticsCardProps {
  user: User;
  analytics: LearningAnalytics;
  compact?: boolean;
}

// Component untuk menampilkan analytics per user
export function UserAnalyticsCard({ user, analytics, compact = false }: UserAnalyticsCardProps) {
  const { brainStats, writerStats, overallStats } = analytics;

  if (compact) {
    return (
      <Card withBorder shadow="sm" radius="md" p="md">
        <Group justify="space-between" mb="xs">
          <Group gap="sm">
            <Avatar src={user.avatar_url} size="sm" color="blue">
              {user.name.charAt(0)}
            </Avatar>
            <div>
              <Text size="sm" fw={500}>
                {user.name}
              </Text>
              <Text size="xs" c="gray.6">
                {user.nim || user.email}
              </Text>
            </div>
          </Group>
          <Badge color={user.group === 'A' ? 'blue' : 'green'} variant="light" size="sm">
            Group {user.group}
          </Badge>
        </Group>

        <SimpleGrid cols={3} spacing="xs">
          <Box>
            <Text size="xs" c="gray.6">
              Brain Projects
            </Text>
            <Text size="sm" fw={600}>
              {brainStats.totalProjects}
            </Text>
          </Box>
          <Box>
            <Text size="xs" c="gray.6">
              Drafts
            </Text>
            <Text size="sm" fw={600}>
              {writerStats.totalDrafts}
            </Text>
          </Box>
          <Box>
            <Text size="xs" c="gray.6">
              Engagement
            </Text>
            <Text size="sm" fw={600} tt="capitalize">
              {overallStats.engagementLevel}
            </Text>
          </Box>
        </SimpleGrid>
      </Card>
    );
  }

  return (
    <Card withBorder shadow="sm" radius="md" p="lg">
      <Group justify="space-between" mb="lg">
        <Group gap="md">
          <Avatar src={user.avatar_url} size="lg" color="blue">
            {user.name.charAt(0)}
          </Avatar>
          <div>
            <Text size="lg" fw={600}>
              {user.name}
            </Text>
            <Text size="sm" c="gray.6">
              {user.email}
            </Text>
            <Group gap="xs" mt="xs">
              <Badge color={user.group === 'A' ? 'blue' : 'green'} variant="light">
                Group {user.group}
              </Badge>
              <Badge color="gray" variant="outline" size="sm">
                {user.nim}
              </Badge>
            </Group>
          </div>
        </Group>
        <Box ta="right">
          <Text size="sm" c="gray.6">
            Productivity Score
          </Text>
          <Text size="xl" fw={700} c="blue">
            {overallStats.productivityScore}/100
          </Text>
          <RingProgress
            size={80}
            thickness={8}
            sections={[{ value: overallStats.productivityScore, color: 'blue' }]}
            label={
              <Center>
                <Text size="xs" fw={700}>
                  {overallStats.productivityScore}%
                </Text>
              </Center>
            }
            mt="xs"
          />
        </Box>
      </Group>

      <Tabs defaultValue="brain">
        <Tabs.List>
          <Tabs.Tab value="brain" leftSection={<IconBulb size={16} />}>
            Brain Analytics
          </Tabs.Tab>
          <Tabs.Tab value="writer" leftSection={<IconPencil size={16} />}>
            Writer Analytics
          </Tabs.Tab>
          <Tabs.Tab value="overall" leftSection={<IconChartBar size={16} />}>
            Overall Behavior
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="brain" pt="md">
          <SimpleGrid cols={2} spacing="md">
            <Card withBorder p="md">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text size="sm" c="gray.6" mb="xs">
                    Total Projects
                  </Text>
                  <Text size="xl" fw={700}>
                    {brainStats.totalProjects}
                  </Text>
                </div>
                <IconBulb size={24} color="var(--mantine-color-violet-6)" />
              </Group>
            </Card>
            
            <Card withBorder p="md">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text size="sm" c="gray.6" mb="xs">
                    Nodes Created
                  </Text>
                  <Text size="xl" fw={700}>
                    {brainStats.totalNodes}
                  </Text>
                </div>
                <Text size="xs" c="gray.5">
                  Avg: {brainStats.avgNodesPerProject.toFixed(1)}/project
                </Text>
              </Group>
            </Card>
            
            <Card withBorder p="md">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text size="sm" c="gray.6" mb="xs">
                    Relationships
                  </Text>
                  <Text size="xl" fw={700}>
                    {brainStats.totalEdges}
                  </Text>
                </div>
                <Text size="xs" c="gray.5">
                  Avg: {brainStats.avgEdgesPerProject.toFixed(1)}/project
                </Text>
              </Group>
            </Card>
            
            <Card withBorder p="md">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text size="sm" c="gray.6" mb="xs">
                    Chat Queries
                  </Text>
                  <Text size="xl" fw={700}>
                    {brainStats.totalChatQueries}
                  </Text>
                </div>
                <IconClock size={24} color="var(--mantine-color-blue-6)" />
              </Group>
            </Card>
          </SimpleGrid>

          <Card withBorder p="md" mt="md" style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
            <Text size="sm" fw={500} mb="xs">
              Interaction Statistics
            </Text>
            <Group justify="space-between">
              <Text size="sm" c="gray.6">
                Node Clicks: <Text span fw={600}>{brainStats.nodeClicks}</Text>
              </Text>
              <Text size="sm" c="gray.6">
                Edge Clicks: <Text span fw={600}>{brainStats.edgeClicks}</Text>
              </Text>
              <Text size="sm" c="gray.6">
                Last Activity: <Text span fw={600}>
                  {brainStats.lastActivity ? new Date(brainStats.lastActivity).toLocaleDateString('id-ID') : 'Never'}
                </Text>
              </Text>
            </Group>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="writer" pt="md">
          <SimpleGrid cols={2} spacing="md">
            <Card withBorder p="md">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text size="sm" c="gray.6" mb="xs">
                    Total Drafts
                  </Text>
                  <Text size="xl" fw={700}>
                    {writerStats.totalDrafts}
                  </Text>
                </div>
                <IconPencil size={24} color="var(--mantine-color-green-6)" />
              </Group>
            </Card>
            
            <Card withBorder p="md">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text size="sm" c="gray.6" mb="xs">
                    Annotations
                  </Text>
                  <Text size="xl" fw={700}>
                    {writerStats.totalAnnotations}
                  </Text>
                </div>
                <Text size="xs" c="gray.5">
                  Active Learning
                </Text>
              </Group>
            </Card>
            
            <Card withBorder p="md">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text size="sm" c="gray.6" mb="xs">
                    Writing Sessions
                  </Text>
                  <Text size="xl" fw={700}>
                    {writerStats.totalWritingSessions}
                  </Text>
                </div>
                <Text size="xs" c="gray.5">
                  Sessions
                </Text>
              </Group>
            </Card>
            
            <Card withBorder p="md">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text size="sm" c="gray.6" mb="xs">
                    AI Assistance
                  </Text>
                  <Text size="xl" fw={700}>
                    {writerStats.aiAssistanceUsage}
                  </Text>
                </div>
                <Badge 
                  color={writerStats.aiAssistanceUsage > 10 ? 'green' : writerStats.aiAssistanceUsage > 5 ? 'yellow' : 'red'} 
                  variant="light" 
                  size="sm"
                >
                  {writerStats.aiAssistanceUsage > 10 ? 'Active' : writerStats.aiAssistanceUsage > 5 ? 'Moderate' : 'Low'}
                </Badge>
              </Group>
            </Card>
          </SimpleGrid>

          <Card withBorder p="md" mt="md" style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
            <Text size="sm" fw={500} mb="xs">
              Writing Quality Metrics
            </Text>
            <Group justify="space-between">
              <Text size="sm" c="gray.6">
                Citations: <Text span fw={600}>{writerStats.citationCount}</Text>
              </Text>
              <Text size="sm" c="gray.6">
                Avg Words/Draft: <Text span fw={600}>{writerStats.avgWordsPerDraft}</Text>
              </Text>
              <Text size="sm" c="gray.6">
                Last Activity: <Text span fw={600}>
                  {new Date(writerStats.lastWritingActivity).toLocaleDateString('id-ID')}
                </Text>
              </Text>
            </Group>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="overall" pt="md">
          <SimpleGrid cols={2} spacing="md">
            <Card withBorder p="md">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text size="sm" c="gray.6" mb="xs">
                    Recent Activity
                  </Text>
                  <Text size="xl" fw={700}>
                    {overallStats.recentActivity}
                  </Text>
                </div>
                <Badge 
                  color={overallStats.recentActivity > 10 ? 'green' : overallStats.recentActivity > 5 ? 'yellow' : 'red'} 
                  variant="light"
                >
                  {overallStats.recentActivity > 10 ? 'Very Active' : overallStats.recentActivity > 5 ? 'Active' : 'Inactive'}
                </Badge>
              </Group>
              <Text size="xs" c="gray.6" mt="xs">
                Actions in last 24h
              </Text>
            </Card>
            
            <Card withBorder p="md">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text size="sm" c="gray.6" mb="xs">
                    Login Sessions
                  </Text>
                  <Text size="xl" fw={700}>
                    {overallStats.totalLoginSessions}
                  </Text>
                </div>
                <IconChartBar size={24} color="var(--mantine-color-blue-6)" />
              </Group>
              <Text size="xs" c="gray.6" mt="xs">
                Total logins tracked
              </Text>
            </Card>
            
            <Card withBorder p="md">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text size="sm" c="gray.6" mb="xs">
                    Time Spent
                  </Text>
                  <Text size="xl" fw={700}>
                    {Math.round(overallStats.totalTimeSpent / 60)}h
                  </Text>
                </div>
                <Text size="xs" c="gray.5">
                  {Math.round(overallStats.totalTimeSpent % 60)}min
                </Text>
              </Group>
              <Text size="xs" c="gray.6" mt="xs">
                Estimated total time
              </Text>
            </Card>
            
            <Card withBorder p="md">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text size="sm" c="gray.6" mb="xs">
                    Preferred Module
                  </Text>
                  <Text size="lg" fw={600} tt="capitalize" c="blue">
                    {overallStats.preferredModule}
                  </Text>
                </div>
                <Badge color="blue" variant="outline">
                  Balanced
                </Badge>
              </Group>
              <Text size="xs" c="gray.6" mt="xs">
                Most used learning mode
              </Text>
            </Card>
          </SimpleGrid>

          <Card withBorder p="md" mt="md" style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
            <Group justify="space-between" align="center">
              <div>
                <Text size="sm" fw={500} mb="xs">
                  Overall Engagement Level
                </Text>
                <Badge 
                  color={
                    overallStats.engagementLevel === 'high' ? 'green' : 
                    overallStats.engagementLevel === 'medium' ? 'yellow' : 'red'
                  } 
                  variant="filled" 
                  size="lg"
                >
                  {overallStats.engagementLevel.toUpperCase()} ENGAGEMENT
                </Badge>
              </div>
              <RingProgress
                size={100}
                thickness={10}
                sections={[{ 
                  value: overallStats.productivityScore, 
                  color: overallStats.engagementLevel === 'high' ? 'green' : 
                         overallStats.engagementLevel === 'medium' ? 'yellow' : 'red'
                }]}
                label={
                  <Center>
                    <Stack gap={0} align="center">
                      <Text size="sm" fw={700}>
                        {overallStats.productivityScore}
                      </Text>
                      <Text size="xs" c="gray.6">
                        Score
                      </Text>
                    </Stack>
                  </Center>
                }
              />
            </Group>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </Card>
  );
}
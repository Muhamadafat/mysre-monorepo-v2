// src/components/xapi/DashboardCards.tsx
import React from 'react';
import { Card, Group, Text, Title, ThemeIcon, SimpleGrid, Skeleton } from '@mantine/core';
import { IconUsers, IconActivity, IconTrendingUp, IconClock } from '@tabler/icons-react';

interface SummaryData {
  totalStudents: number;
  totalActivities: number;
  mostCommonActivity: {
    name: string;
    count: number;
  };
  avgInteractionTime: number;
}

interface DashboardCardsProps {
  summary: SummaryData;
  loading?: boolean;
}

export const DashboardCards: React.FC<DashboardCardsProps> = ({ 
  summary, 
  loading = false 
}) => {
  const cards = [
    {
      title: 'Total Mahasiswa',
      value: summary.totalStudents,
      icon: IconUsers,
      color: 'blue'
    },
    {
      title: 'Total Aktivitas',
      value: summary.totalActivities,
      icon: IconActivity,
      color: 'green'
    },
    {
      title: 'Aktivitas Paling Umum',
      value: summary.mostCommonActivity.name,
      subtitle: `${summary.mostCommonActivity.count}x`,
      icon: IconTrendingUp,
      color: 'grape'
    },
    {
      title: 'Aktivitas per Sesi',
      value: summary.avgInteractionTime,
      subtitle: 'rata-rata',
      icon: IconClock,
      color: 'orange'
    }
  ];

  if (loading) {
    return (
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg" mb="xl">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} shadow="sm" padding="lg" radius="md" withBorder>
            <Skeleton height={20} width="70%" mb="md" />
            <Skeleton height={32} width="50%" />
          </Card>
        ))}
      </SimpleGrid>
    );
  }

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg" mb="xl">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <Card 
            key={index}
            shadow="sm" 
            padding="lg" 
            radius="md" 
            withBorder
            style={{ cursor: 'default' }}
          >
            <Group justify="space-between" mb="md">
              <Text size="sm" c="dimmed" fw={500}>
                {card.title}
              </Text>
              <ThemeIcon 
                color={card.color} 
                variant="light" 
                size="lg" 
                radius="md"
              >
                <Icon size={20} />
              </ThemeIcon>
            </Group>
            
            <Group align="baseline" gap="xs">
              <Title order={2} c={card.color}>
                {typeof card.value === 'number' 
                  ? card.value.toLocaleString() 
                  : card.value}
              </Title>
              {card.subtitle && (
                <Text size="sm" c="dimmed">
                  {card.subtitle}
                </Text>
              )}
            </Group>
          </Card>
        );
      })}
    </SimpleGrid>
  );
};
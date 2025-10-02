// src/components/xapi/ActivityChart.tsx
import React from 'react';
import { Card, Title, Skeleton, Text, Box } from '@mantine/core';

interface ActivityData {
  name: string;
  count: number;
}

interface ActivityChartProps {
  data: ActivityData[];
  loading?: boolean;
}

export const ActivityChart: React.FC<ActivityChartProps> = ({ 
  data, 
  loading = false 
}) => {
  if (loading) {
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder mb="xl">
        <Skeleton height={24} width="40%" mb="lg" />
        <Skeleton height={350} />
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder mb="xl">
        <Title order={3} mb="lg">
          Distribusi Aktivitas (Quantity of Learning)
        </Title>
        <Text c="dimmed" ta="center" py="xl">
          Tidak ada data untuk ditampilkan
        </Text>
      </Card>
    );
  }

  const maxCount = Math.max(...data.map(d => d.count));
  const chartHeight = 300;
  const barWidth = 60;
  const gap = 20;
  const chartWidth = Math.max(800, data.length * (barWidth + gap));

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder mb="xl">
      <Title order={3} mb="lg">
        Distribusi Aktivitas (Quantity of Learning)
      </Title>
      
      <Box style={{ overflowX: 'auto', overflowY: 'hidden' }}>
        <svg 
          width={chartWidth} 
          height={chartHeight + 100}
          style={{ minWidth: '100%' }}
        >
          {/* Y-axis grid lines */}
          {[0, 1, 2, 3, 4].map((i) => {
            const y = chartHeight - (chartHeight / 4) * i;
            const value = Math.round((maxCount / 4) * i);
            return (
              <g key={i}>
                <line
                  x1={50}
                  y1={y}
                  x2={chartWidth - 20}
                  y2={y}
                  stroke="#e0e0e0"
                  strokeWidth={1}
                />
                <text
                  x={40}
                  y={y + 5}
                  textAnchor="end"
                  fontSize={12}
                  fill="#666"
                >
                  {value}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {data.map((item, index) => {
            const barHeight = (item.count / maxCount) * chartHeight;
            const x = 70 + index * (barWidth + gap);
            const y = chartHeight - barHeight;
            
            return (
              <g key={index}>
                {/* Bar */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill="#228be6"
                  rx={4}
                  style={{ cursor: 'pointer' }}
                />
                
                {/* Count label on top of bar */}
                <text
                  x={x + barWidth / 2}
                  y={y - 5}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight="bold"
                  fill="#228be6"
                >
                  {item.count}
                </text>

                {/* X-axis label */}
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + 20}
                  textAnchor="end"
                  fontSize={11}
                  fill="#666"
                  transform={`rotate(-45 ${x + barWidth / 2} ${chartHeight + 20})`}
                >
                  {item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name}
                </text>
              </g>
            );
          })}

          {/* Y-axis label */}
          <text
            x={20}
            y={chartHeight / 2}
            textAnchor="middle"
            fontSize={12}
            fill="#666"
            transform={`rotate(-90 20 ${chartHeight / 2})`}
          >
            Jumlah Aktivitas
          </text>

          {/* X-axis label */}
          <text
            x={chartWidth / 2}
            y={chartHeight + 80}
            textAnchor="middle"
            fontSize={12}
            fill="#666"
          >
            Jenis Aktivitas
          </text>
        </svg>
      </Box>
    </Card>
  );
};
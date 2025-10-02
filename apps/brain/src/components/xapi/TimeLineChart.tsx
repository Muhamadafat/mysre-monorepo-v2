// src/components/xapi/TimelineChart.tsx
import React from 'react';
import { Card, Title, Skeleton, Text, Box } from '@mantine/core';

interface TimelineData {
  date: string;
  count: number;
}

interface TimelineChartProps {
  data: TimelineData[];
  loading?: boolean;
}

export const TimelineChart: React.FC<TimelineChartProps> = ({ 
  data, 
  loading = false 
}) => {
  if (loading) {
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Skeleton height={24} width="40%" mb="lg" />
        <Skeleton height={350} />
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={3} mb="lg">
          Aktivitas Belajar per Sesi
        </Title>
        <Text c="dimmed" ta="center" py="xl">
          Tidak ada data untuk ditampilkan
        </Text>
      </Card>
    );
  }

  const maxCount = Math.max(...data.map(d => d.count), 1);
  const chartHeight = 300;
  const chartWidth = 800;
  const padding = { top: 20, right: 30, bottom: 60, left: 60 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  // Calculate points for the line
  const points = data.map((item, index) => {
    const x = padding.left + (index / Math.max(data.length - 1, 1)) * innerWidth;
    const y = padding.top + innerHeight - (item.count / maxCount) * innerHeight;
    return { x, y, ...item };
  });

  // Create path for line chart
  const linePath = points
    .map((point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      return `L ${point.x} ${point.y}`;
    })
    .join(' ');

  // Create area path (filled)
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + innerHeight} L ${padding.left} ${padding.top + innerHeight} Z`;

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Title order={3} mb="lg">
        Aktivitas Belajar per Sesi
      </Title>
      
      <Box style={{ overflowX: 'auto' }}>
        <svg width={chartWidth} height={chartHeight + 40}>
          {/* Grid lines */}
          {[0, 1, 2, 3, 4].map((i) => {
            const y = padding.top + (innerHeight / 4) * i;
            const value = Math.round(maxCount - (maxCount / 4) * i);
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={chartWidth - padding.right}
                  y2={y}
                  stroke="#e0e0e0"
                  strokeWidth={1}
                />
                <text
                  x={padding.left - 10}
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

          {/* Area under line */}
          <path
            d={areaPath}
            fill="#51cf66"
            fillOpacity={0.2}
          />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#51cf66"
            strokeWidth={3}
          />

          {/* Data points */}
          {points.map((point, index) => (
            <g key={index}>
              <circle
                cx={point.x}
                cy={point.y}
                r={5}
                fill="#51cf66"
                stroke="white"
                strokeWidth={2}
                style={{ cursor: 'pointer' }}
              />
              
              {/* Hover label */}
              <title>{`${point.date}: ${point.count} aktivitas`}</title>
            </g>
          ))}

          {/* X-axis labels */}
          {points.map((point, index) => {
            // Show every nth label to avoid overlap
            const showEvery = Math.max(1, Math.floor(data.length / 10));
            if (index % showEvery !== 0 && index !== data.length - 1) return null;
            
            const dateStr = point.date.split('-').slice(1).join('-'); // MM-DD
            return (
              <text
                key={`label-${index}`}
                x={point.x}
                y={padding.top + innerHeight + 20}
                textAnchor="middle"
                fontSize={10}
                fill="#666"
                transform={`rotate(-45 ${point.x} ${padding.top + innerHeight + 20})`}
              >
                {dateStr}
              </text>
            );
          })}

          {/* Y-axis label */}
          <text
            x={15}
            y={chartHeight / 2}
            textAnchor="middle"
            fontSize={12}
            fill="#666"
            transform={`rotate(-90 15 ${chartHeight / 2})`}
          >
            Jumlah Aktivitas
          </text>

          {/* X-axis label */}
          <text
            x={chartWidth / 2}
            y={chartHeight + 30}
            textAnchor="middle"
            fontSize={12}
            fill="#666"
          >
            Tanggal
          </text>
        </svg>
      </Box>
    </Card>
  );
};
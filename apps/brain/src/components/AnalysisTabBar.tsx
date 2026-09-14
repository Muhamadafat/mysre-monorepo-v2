// src/components/AnalysisTabBar.tsx
'use client';

import { useRef, useEffect } from 'react';
import { Box, Text, Tooltip } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { AnalysisTab } from '@/types';

interface AnalysisTabBarProps {
  tabs: AnalysisTab[];
  activeTabId: string | null;
  dark: boolean;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewAnalysis: () => void;
  maxTabs?: number;
}

export default function AnalysisTabBar({
  tabs,
  activeTabId,
  dark,
  onSelectTab,
  onCloseTab,
  onNewAnalysis,
  maxTabs = 6,
}: AnalysisTabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll ke tab terbaru saat tab baru ditambah
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [tabs.length]);

  const TAB_COLORS = [
    '#6366f1',
    '#14b8a6',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#ec4899',
  ];

  return (
    <Box
      style={{
        display: 'flex',
        alignItems: 'center',
        borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
        backgroundColor: dark ? 'rgba(13,15,24,0.97)' : '#f8fafc',
        flexShrink: 0,
        minHeight: 40,
        position: 'relative',
      }}
    >
      {/* Scrollable Tab List */}
      <Box
        ref={scrollRef}
        style={{
          display: 'flex',
          alignItems: 'stretch',
          flex: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <style>{`
          .analysis-tab-scroll::-webkit-scrollbar { display: none; }
          @keyframes tab-slide-in {
            from { opacity: 0; transform: translateX(16px); }
            to   { opacity: 1; transform: translateX(0); }
          }
          @keyframes tab-spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        {tabs.map((tab, idx) => {
          const isActive = tab.id === activeTabId;
          const color = TAB_COLORS[idx % TAB_COLORS.length];

          return (
            <Box
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 10px 0 12px',
                minWidth: 140,
                maxWidth: 220,
                height: 40,
                cursor: 'pointer',
                flexShrink: 0,
                position: 'relative',
                animation: 'tab-slide-in 0.22s cubic-bezier(0.4,0,0.2,1)',
                backgroundColor: isActive
                  ? dark
                    ? 'rgba(99,102,241,0.1)'
                    : 'rgba(99,102,241,0.06)'
                  : 'transparent',
                borderRight: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}`,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = dark
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(0,0,0,0.03)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    'transparent';
                }
              }}
            >
              {/* Active indicator — garis bawah warna unik */}
              {isActive && (
                <Box
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    background: `linear-gradient(90deg, ${color}, ${color}aa)`,
                    borderRadius: '2px 2px 0 0',
                  }}
                />
              )}

              {/* Tab number badge */}
              <Box
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  backgroundColor: isActive
                    ? color
                    : dark
                      ? 'rgba(255,255,255,0.12)'
                      : 'rgba(0,0,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 9,
                  fontWeight: 800,
                  color: isActive ? '#fff' : dark ? '#94a3b8' : '#64748b',
                  flexShrink: 0,
                  transition: 'all 0.15s',
                }}
              >
                {idx + 1}
              </Box>

              {/* Loading spinner */}
              {tab.status === 'loading' && (
                <Box
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    border: `1.5px solid ${color}`,
                    borderTopColor: 'transparent',
                    animation: 'tab-spin 0.75s linear infinite',
                    flexShrink: 0,
                  }}
                />
              )}

              {/* Tab label */}
              <Text
                size="xs"
                fw={isActive ? 700 : 400}
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: isActive
                    ? dark
                      ? '#e2e8f0'
                      : '#1e293b'
                    : dark
                      ? '#94a3b8'
                      : '#64748b',
                  lineHeight: 1.3,
                  transition: 'color 0.15s',
                  fontSize: 11,
                }}
              >
                {tab.label}
              </Text>

              {/* Close button */}
              <Box
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  cursor: 'pointer',
                  color: dark ? '#64748b' : '#94a3b8',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = dark
                    ? 'rgba(239,68,68,0.15)'
                    : 'rgba(239,68,68,0.1)';
                  (e.currentTarget as HTMLElement).style.color = '#ef4444';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    'transparent';
                  (e.currentTarget as HTMLElement).style.color = dark
                    ? '#64748b'
                    : '#94a3b8';
                }}
                title="Tutup tab"
              >
                <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M1 1l8 8M9 1L1 9"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* + Analisis Baru button */}
      <Tooltip
        label={
          tabs.length >= maxTabs
            ? `Maks ${maxTabs} tab. Tutup tab lama terlebih dahulu.`
            : 'Analisis Baru'
        }
        position="bottom"
        withArrow
      >
        <Box
          onClick={onNewAnalysis}
          style={{
            width: 36,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: tabs.length >= maxTabs ? 'not-allowed' : 'pointer',
            opacity: tabs.length >= maxTabs ? 0.35 : 1,
            color: dark ? '#a5b4fc' : '#6366f1',
            borderLeft: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            if (tabs.length < maxTabs) {
              (e.currentTarget as HTMLElement).style.backgroundColor = dark
                ? 'rgba(99,102,241,0.12)'
                : 'rgba(99,102,241,0.07)';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor =
              'transparent';
          }}
        >
          <IconPlus size={14} />
        </Box>
      </Tooltip>
    </Box>
  );
}

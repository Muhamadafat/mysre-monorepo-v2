'use client';

import { Modal, Box, Text, useMantineColorScheme } from '@mantine/core';
import { IconSparkles } from '@tabler/icons-react';
import { ExtendedNode, ComparativeAnalysisData, LoadingStep } from '@/types';
import ComparativeAnalysisResult from '@/components/ComparativeAnalysisResult';

interface ComparativeModalProps {
  opened: boolean;
  onClose: () => void;
  /** Daftar artikel yang akan dibandingkan (min. 2) */
  nodes: ExtendedNode[];
  /** Callback saat header artikel diklik — buka halaman detail */
  onNodeClick?: (nodeId: string) => void;
  /** Jika true, render sebagai inline (tidak pakai <Modal>) */
  inline?: boolean;
  // backward-compat — diabaikan kalau nodes.length >= 1
  nodeA?: ExtendedNode | null;
  nodeB?: ExtendedNode | null;
  // AI Narration props
  caData?: ComparativeAnalysisData | null;
  caLoading?: boolean;
  caLoadingSteps?: LoadingStep[]; // langkah-langkah loading bertahap
  caError?: string | null;
  onCaRetry?: () => void;
  caAspects?: string[]; // aspek yang dianalisis (untuk badge)
  caArticleTitles?: string[]; // judul artikel (untuk header Perbedaan)
  caCreatedAt?: number; // timestamp untuk footer
  onSaveNote?: (text: string) => Promise<void> | void; // callback simpan catatan
  caTabLabel?: string; // label tab sebagai sumber catatan
  globalHighlights?: string[]; // Catatan/highlights global dari parent
}

export default function ComparativeModal({
  opened,
  onClose,
  inline = false,
  caData,
  caLoading = false,
  caLoadingSteps,
  caError,
  onCaRetry,
  caAspects = [],
  caArticleTitles = [],
  caCreatedAt,
  onSaveNote,
  caTabLabel = 'Analisis Komparatif',
  globalHighlights = [],
}: ComparativeModalProps) {
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';

  const contentStyles = inline
    ? {
        display: 'flex',
        flexDirection: 'column' as const,
        backgroundColor: dark ? '#0d0f18' : '#ffffff',
        border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
        borderRadius: 16,
        overflow: 'hidden' as const,
        height: '100%', // mengisi Box parent (flex:1, minHeight:0)
      }
    : {
        height: '92vh',
        display: 'flex',
        flexDirection: 'column' as const,
        overflow: 'hidden',
        backgroundColor: dark ? '#0d0f18' : '#ffffff',
        border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
        boxShadow: dark
          ? '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.15)'
          : '0 32px 80px rgba(0,0,0,0.18)',
      };

  const innerContent = (
    <Box style={contentStyles}>
      {/* ── AI NARRATION SECTION ── */}
      {(caLoading || caData || caError) && (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            minHeight: 0,
          }}
        >
          {/* Divider header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              backgroundColor: dark
                ? 'rgba(99,102,241,0.07)'
                : 'rgba(99,102,241,0.03)',
              borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}`,
              position: 'sticky',
              top: 0,
              zIndex: 2,
            }}
          >
            <IconSparkles size={14} color="#6366f1" />
            <Text
              size="10px"
              fw={800}
              style={{ letterSpacing: '0.1em', color: '#6366f1' }}
            >
              ANALISIS AI — NARASI KOMPARATIF
            </Text>
            {caLoading && (
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: '#6366f1',
                  animation: 'ca-pulse 1s ease-in-out infinite',
                }}
              />
            )}
          </div>
          <style>{`@keyframes ca-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }`}</style>
          <ComparativeAnalysisResult
            data={caData}
            loading={caLoading}
            loadingSteps={caLoadingSteps}
            error={caError}
            onRetry={onCaRetry}
            isDark={dark}
            aspects={caAspects}
            articleTitles={caArticleTitles}
            createdAt={caCreatedAt}
            onSaveNote={onSaveNote}
            caTabLabel={caTabLabel}
            globalHighlights={globalHighlights}
          />
        </div>
      )}
    </Box>
  );

  if (inline) {
    if (!opened) return null;
    return innerContent;
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="90%"
      padding={0}
      radius="xl"
      centered
      withCloseButton={false}
      overlayProps={{ blur: 6, opacity: 0.6 }}
      styles={{
        body: {
          padding: 0,
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
        content: {
          padding: 0,
          backgroundColor: 'transparent',
          boxShadow: 'none',
        },
      }}
    >
      {innerContent}
    </Modal>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/graph/page.tsx
'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import useSWR from 'swr';

import {
  Alert,
  Box,
  Button,
  Group,
  MultiSelect,
  Text,
  Modal,
  Badge,
  ActionIcon,
  Stack,
  Card,
  ThemeIcon,
  useMantineColorScheme,
  useMantineTheme,
  Loader,
  Select,
  TextInput,
  Textarea,
  ScrollArea,
  Container,
  Tooltip,
  Menu,
  Popover,
  Divider,
  Paper,
} from '@mantine/core';
import {
  IconNetwork,
  IconCircleDot,
  IconSettings,
  IconChevronRight,
  IconEye,
  IconUpload,
  IconChevronLeft,
  IconPlus,
  IconMessage,
  IconHighlight,
  IconList,
  IconArticle,
  IconChartDots2,
  IconLayoutGrid,
  IconArrowUp,
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconZoomIn,
  IconZoomOut,
  IconMaximize,
  IconChevronDown,
  IconCheck,
  IconArrowsSplit2,
  IconHistory,
  IconNote,
  IconTrash,
  IconSearch,
  IconFilter,
  IconDotsVertical,
  IconPlayerPlay,
} from '@tabler/icons-react';
import {
  ExtendedEdge,
  ExtendedNode,
  ComparativeAnalysisData,
  AnalysisTab,
  LoadingStep,
} from '@/types';
import NetworkGraph from '@/components/NetworkGraph';
import ChatPanel from '@/components/ChatPanel';
import NodeDetail, { handleAnalytics } from '@/components/NodeDetail';
import EdgeDetail from '@/components/EdgeDetail';
import { DashboardLayout } from '@/components/DashboardLayout';
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import dynamic from 'next/dynamic';
// import { resolve } from 'path';
// import Neo2 from '@/components/Neo2';
import AnnotationPanel from '@/components/AnnotationPanel';
import WebViewer from '@/components/WebViewerDynamic';
import ArticleDetailTable from '@/components/ArticleDetailTable';
import { Cite } from '@citation-js/core';
import '@citation-js/plugin-ris';
import { createClient } from '@sre-monorepo/lib';
import { useXapiTracking } from '@/hooks/useXapiTracking';
import { useUploadStore } from '@/store/useUploadStore';
import { ProgressPanel } from '@/components/FloatingProgress/ProgressPanel';
import WebGazerContext from '@/components/context/WebGazerContext';
import ComparativeModal from '@/components/ComparativeModal';
import AnalysisTabBar from '@/components/AnalysisTabBar';
import { toProperCase } from '@/lib/stringFormatters';

// const Neograph = dynamic(() => import('@/components/NeoGraph'), {
//     ssr: false,
// });

const relationMapping = {
  SIMILAR_BACKGROUND: 'SIMILAR_BACKGROUND',
  SIMILAR_METHODOLOGY: 'SIMILAR_METHODOLOGY',
  SIMILAR_OBJECTIVE: 'SIMILAR_OBJECTIVE',
  SIMILAR_GAP: 'SIMILAR_GAP',
  SIMILAR_FUTUREWORK: 'SIMILAR_FUTUREWORK',
};

const relationColors = {
  SIMILAR_BACKGROUND: 'blue',
  SIMILAR_METHODOLOGY: 'green',
  SIMILAR_GAP: 'red',
  SIMILAR_FUTUREWORK: 'purple',
  SIMILAR_OBJECTIVE: 'orange',
};

const ARTICLE_PALETTE = [
  { primary: '#6366f1', soft: 'rgba(99,102,241,0.10)', badge: '#6366f1' },
  { primary: '#14b8a6', soft: 'rgba(20,184,166,0.10)', badge: '#0d9488' },
  { primary: '#f59e0b', soft: 'rgba(245,158,11,0.10)', badge: '#d97706' },
  { primary: '#ef4444', soft: 'rgba(239,68,68,0.10)', badge: '#dc2626' },
  { primary: '#8b5cf6', soft: 'rgba(139,92,246,0.10)', badge: '#7c3aed' },
  { primary: '#ec4899', soft: 'rgba(236,72,153,0.10)', badge: '#db2777' },
];

function getRelationDisplayName(relation: string): string {
  const displayNames: Record<string, string> = {
    SIMILAR_BACKGROUND: 'Latar Belakang',
    SIMILAR_METHODOLOGY: 'Metodologi',
    SIMILAR_OBJECTIVE: 'Tujuan',
    SIMILAR_GAP: 'Gap Penelitian',
    SIMILAR_FUTUREWORK: 'Arahan Masa Depan',
  };

  return (
    displayNames[relation] ||
    relation.charAt(0).toUpperCase() + relation.slice(1)
  );
}

function getRelationColor(relation: string): string {
  return relationColors[relation as keyof typeof relationColors] || 'gray';
}

function getDisplayRelationKey(apiRelation: string): string {
  return apiRelation;
}

type ChatSessionListItem = {
  id: string;
  title: string;
  lastPreview: string | null;
  mode: 'STRICT' | 'RESEARCH' | null;
  contextSnapshot: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  lastActivity: string;
};

function formatChatSessionTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function Home() {
  const params = useParams();
  const rawSessionId = params?.id;
  const projectId = Array.isArray(rawSessionId)
    ? rawSessionId[0]
    : rawSessionId;

  const { data: indexingStatus } = useSWR(
    projectId ? `/api/projects/${projectId}/indexing-status` : null,
    (url) => fetch(url, { credentials: 'omit' }).then((res) => res.json()),
    { refreshInterval: (data) => (data?.isIndexing ? 5000 : 0) }
  );

  const isIndexing = indexingStatus?.isIndexing === true;
  const hasIndexError = indexingStatus?.hasError === true;

  // Virtual Job for Indexing Notification
  const indexingJobId = `indexing-${projectId}`;
  const prevIsIndexing = useRef(isIndexing);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fullPath = `${pathname}?${searchParams.toString()}`;

  // Auto-Sync Graph State
  const jobs = useUploadStore((state) => state.jobs);
  const addJob = useUploadStore((state) => state.addJob);
  const updateJob = useUploadStore((state) => state.updateJob);
  const removeJob = useUploadStore((state) => state.removeJob);

  const syncedJobsRef = useRef<Record<string, boolean>>({});

  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const theme = useMantineTheme();

  const [mounted, setMounted] = useState(false);
  const dark = mounted ? colorScheme === 'dark' : false;

  const [sidebarOpened, setSidebarOpened] = useState(false);
  const [activeActivityFeature, setActiveActivityFeature] =
    useState<string>('graph');
  const [chatSidebarOpen, setChatSidebarOpen] = useState(false);
  const [tableMaximized, setTableMaximized] = useState(false);

  const [isGraphFullscreen, setIsGraphFullscreen] = useState(false);

  const toggleGraphFullscreen = useCallback(() => {
    setIsGraphFullscreen((prev) => {
      const next = !prev;
      // Trigger resize fit after CSS applies
      setTimeout(() => {
        if (networkRef.current) {
          networkRef.current.fit({ animation: false });
        }
      }, 50);
      return next;
    });
  }, []);

  // AI Chat panel resize state
  const [chatPanelWidth, setChatPanelWidth] = useState(420);
  const [chatPanelFullscreen, setChatPanelFullscreen] = useState(false);
  const [chatHistoryPopoverOpened, setChatHistoryPopoverOpened] =
    useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSessionListItem[]>([]);
  const [chatSessionsLoading, setChatSessionsLoading] = useState(false);
  const [chatSessionsLoaded, setChatSessionsLoaded] = useState(false);
  const [chatSessionsError, setChatSessionsError] = useState<string | null>(null);
  const [creatingChatSession, setCreatingChatSession] = useState(false);
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(
    null
  );
  const [switchingChatSession, setSwitchingChatSession] = useState(false);
  const isDraggingChat = useRef(false);
  const chatDragStartX = useRef(0);
  const chatDragStartWidth = useRef(0);
  const CHAT_MIN_WIDTH = 260;
  const CHAT_MAX_WIDTH = 700;

  // Analysis Controls panel — opens when 'articles' is selected in ActivityBar
  const analysisOpen = activeActivityFeature === 'articles';

  // Analysis panel resize state
  const [analysisPanelWidth, setAnalysisPanelWidth] = useState(300);
  const [analysisPanelFullscreen, setAnalysisPanelFullscreen] = useState(false);
  const ANALYSIS_MIN_WIDTH = 260;
  const [ANALYSIS_MAX_WIDTH, setAnalysis_MAX_WIDTH] = useState(900);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAnalysis_MAX_WIDTH(window.innerWidth - 100);
    }
  }, []);

  const isDraggingAnalysis = useRef(false);
  const analysisDragStartX = useRef(0);
  const analysisDragStartWidth = useRef(0);

  // PDF inline viewer state
  const [viewingPdfNode, setViewingPdfNode] = useState<ExtendedNode | null>(
    null
  );
  const [viewingPdfUrl, setViewingPdfUrl] = useState<string | null>(null);

  // PDF Modal state (WebViewer dengan Highlighted Notes)
  const [pdfModalOpened, setPdfModalOpened] = useState(false);
  const [pdfModalUrl, setPdfModalUrl] = useState<string | null>(null);
  const [pdfModalTitle, setPdfModalTitle] = useState<string>('');

  const [tableHeight, setTableHeight] = useState(280);
  const isDraggingTable = useRef(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const col2Ref = useRef<HTMLDivElement>(null);
  const networkRef = useRef<any>(null);

  const handleNetworkReady = useCallback((network: any) => {
    networkRef.current = network;
  }, []);

  // Navigation control handlers
  const handleNavMove = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right') => {
      if (!networkRef.current) {
        console.warn('Network instance not ready');
        return;
      }
      const currentView = networkRef.current.getViewPosition();
      const moveStep = 100;
      const movements = {
        up: { x: currentView.x, y: currentView.y - moveStep },
        down: { x: currentView.x, y: currentView.y + moveStep },
        left: { x: currentView.x - moveStep, y: currentView.y },
        right: { x: currentView.x + moveStep, y: currentView.y },
      };
      networkRef.current.moveTo({
        position: movements[direction],
        animation: false,
      });
    },
    []
  );

  const handleZoomIn = useCallback(() => {
    if (!networkRef.current) {
      console.warn('Network instance not ready');
      return;
    }
    const scale = networkRef.current.getScale();
    networkRef.current.moveTo({ scale: scale * 1.2, animation: false });
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!networkRef.current) {
      console.warn('Network instance not ready');
      return;
    }
    const scale = networkRef.current.getScale();
    const newScale = Math.max(0.05, scale / 1.2);
    networkRef.current.moveTo({ scale: newScale, animation: false });
  }, []);

  const handleFitView = useCallback(() => {
    if (!networkRef.current) {
      console.warn('Network instance not ready');
      return;
    }
    networkRef.current.fit({ animation: true });
  }, []);

  const handleTableDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingTable.current = true;
      dragStartY.current = e.clientY;
      dragStartHeight.current = tableHeight;
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [tableHeight]
  );

  // Analysis panel drag handler
  const handleAnalysisDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingAnalysis.current = true;
      analysisDragStartX.current = e.clientX;
      analysisDragStartWidth.current = analysisPanelWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [analysisPanelWidth]
  );

  // Chat panel drag handlers
  const handleChatDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingChat.current = true;
      chatDragStartX.current = e.clientX;
      chatDragStartWidth.current = chatPanelWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [chatPanelWidth]
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (
        !isDraggingTable.current &&
        !isDraggingChat.current &&
        !isDraggingAnalysis.current
      )
        return;

      // Table resize
      if (isDraggingTable.current) {
        const delta = dragStartY.current - e.clientY;
        const col2H = col2Ref.current?.clientHeight ?? 600;
        const newH = Math.min(
          Math.max(dragStartHeight.current + delta, 120),
          col2H - 200
        );
        setTableHeight(newH);
      }

      // Analysis panel resize (drag right edge → wider)
      if (isDraggingAnalysis.current) {
        const delta = e.clientX - analysisDragStartX.current;
        const newW = Math.min(
          Math.max(analysisDragStartWidth.current + delta, ANALYSIS_MIN_WIDTH),
          ANALYSIS_MAX_WIDTH
        );
        setAnalysisPanelWidth(newW);
      }

      // Chat panel resize (drag left edge → bigger panel)
      if (isDraggingChat.current) {
        const delta = chatDragStartX.current - e.clientX;
        const newW = Math.min(
          Math.max(chatDragStartWidth.current + delta, CHAT_MIN_WIDTH),
          CHAT_MAX_WIDTH
        );
        setChatPanelWidth(newW);
      }
    };
    const onUp = () => {
      if (isDraggingTable.current) {
        isDraggingTable.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
      if (isDraggingAnalysis.current) {
        isDraggingAnalysis.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
      if (isDraggingChat.current) {
        isDraggingChat.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const [selectedNode, setSelectedNode] = useState<ExtendedNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<ExtendedEdge | null>(null);
  const [detailModalEdge, setDetailModalEdge] = useState<ExtendedEdge | null>(
    null
  );
  const [edgeDetailReturn, setEdgeDetailReturn] = useState<ExtendedEdge | null>(
    null
  );

  // ── Multi-Tab Analisis State ─────────────────────────────────────────────────────────
  const MAX_ANALYSIS_TABS = 6;
  const [analysisTabs, setAnalysisTabs] = useState<AnalysisTab[]>([]);
  const [activeAnalysisTabId, setActiveAnalysisTabId] = useState<string | null>(
    null
  );
  const [closeLoadingTabConfirm, setCloseLoadingTabConfirm] = useState<
    string | null
  >(null);
  const [showingNewSelector, setShowingNewSelector] = useState(true); // panel pilih artikel baru

  // ── GLOBAL HIGHLIGHTS (Permanen untuk semua hasil analisis) ──
  const [savedAnalysisHighlights, setSavedAnalysisHighlights] = useState<
    string[]
  >([]);

  // Load global highlights from DB
  const loadGlobalHighlights = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/annotation?projectId=${projectId}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const annotations = await res.json();
      if (Array.isArray(annotations)) {
        // Filter anotasi khusus untuk hasil analisis (page 0) secara global
        const globalNotes = annotations.filter((a: any) => a.page === 0);
        const highlights = globalNotes
          .map((n: any) => n.highlightedText)
          .filter(Boolean);
        setSavedAnalysisHighlights(highlights);
        console.log('✅ Loaded global highlights:', highlights.length);
      }
    } catch (err) {
      console.error('Failed to load global highlights:', err);
    }
  }, [projectId]);

  useEffect(() => {
    loadGlobalHighlights();
  }, [loadGlobalHighlights]);

  // Backward-compat: tampilkan selector jika belum ada tab sama sekali
  const comparativeModal = analysisTabs.length > 0;

  // Helper: label otomatis
  const buildTabLabel = useCallback(
    (
      nodeIds: string[],
      aspects: string[],
      allNodes: ExtendedNode[],
      tabIndex: number
    ) => {
      const ASPECT_LABELS: Record<string, string> = {
        background: 'Latar',
        goal: 'Tujuan',
        method: 'Metode',
        gap: 'Gap',
        future: 'Masa Depan',
        SIMILAR_BACKGROUND: 'Latar',
        SIMILAR_OBJECTIVE: 'Tujuan',
        SIMILAR_METHODOLOGY: 'Metode',
        SIMILAR_GAP: 'Gap',
        SIMILAR_FUTUREWORK: 'Masa Depan',
      };
      const ASPECT_FULL_LABELS: Record<string, string> = {
        background: 'Latar Belakang',
        goal: 'Tujuan',
        method: 'Metodologi',
        gap: 'Gap Penelitian',
        future: 'Penelitian Lanjut',
        SIMILAR_BACKGROUND: 'Latar Belakang',
        SIMILAR_OBJECTIVE: 'Tujuan',
        SIMILAR_METHODOLOGY: 'Metodologi',
        SIMILAR_GAP: 'Gap Penelitian',
        SIMILAR_FUTUREWORK: 'Penelitian Lanjut',
      };
      const aspLabel =
        aspects.length > 0
          ? aspects
              .slice(0, 2)
              .map((a) => ASPECT_LABELS[a] ?? a)
              .join(' & ')
          : 'Analisis';

      return `Analisis #${tabIndex} — ${aspLabel}`;
    },
    []
  );

  // Helper: buka selector (scroll ke comparative view, maximize)
  const openComparativeSelector = useCallback(() => {
    setTableViewTab('comparative');
    setViewMode('detail');
    setTableMaximized(true);
    setShowingNewSelector(true); // tampilkan panel selector artikel
  }, []);

  // Tutup tab: cek dulu apakah loading
  const handleCloseTab = useCallback(
    (tabId: string) => {
      const tab = analysisTabs.find((t) => t.id === tabId);
      if (!tab) return;
      if (tab.status === 'loading') {
        setCloseLoadingTabConfirm(tabId);
        return;
      }
      setAnalysisTabs((prev) => {
        const next = prev.map((t) =>
          t.id === tabId ? { ...t, isOpen: false } : t
        );
        // Jika yang ditutup adalah tab aktif, aktifkan tab sebelumnya
        if (activeAnalysisTabId === tabId) {
          const openTabs = next.filter((t) => t.isOpen !== false);
          setActiveAnalysisTabId(
            openTabs.length > 0 ? openTabs[openTabs.length - 1].id : null
          );
        }
        return next;
      });
    },
    [analysisTabs, activeAnalysisTabId]
  );

  // Konfirmasi paksa tutup tab loading
  const confirmCloseLoadingTab = useCallback(
    (tabId: string) => {
      setAnalysisTabs((prev) => {
        const next = prev.filter((t) => t.id !== tabId);
        if (activeAnalysisTabId === tabId) {
          const openTabs = next.filter((t) => t.isOpen !== false);
          setActiveAnalysisTabId(
            openTabs.length > 0 ? openTabs[openTabs.length - 1].id : null
          );
        }
        return next;
      });
      setCloseLoadingTabConfirm(null);
    },
    [activeAnalysisTabId]
  );
  // State untuk selector artikel komparatif (pending = belum dijalankan)
  const [comparativePendingIds, setComparativePendingIds] = useState<string[]>(
    []
  );
  const [comparativeLocked, setComparativeLocked] = useState(false); // untuk Step 4: artikel terkunci via relasi
  const [comparativePendingRelation, setComparativePendingRelation] = useState<
    string | undefined
  >(undefined);

  // ── Aspek Analisis Default state ────────────────────────────────────────────
  const ANALYSIS_ASPECTS = [
    {
      id: 'SIMILAR_BACKGROUND',
      label: 'Latar Belakang',
      description: 'Menganalisis konteks dan permasalahan utama penelitian.',
      icon: '📄',
      color: '#6366f1',
    },
    {
      id: 'SIMILAR_OBJECTIVE',
      label: 'Tujuan Penelitian',
      description: 'Membandingkan tujuan dan fokus utama penelitian.',
      icon: '🎯',
      color: '#14b8a6',
    },
    {
      id: 'SIMILAR_METHODOLOGY',
      label: 'Metodologi',
      description:
        'Membandingkan pendekatan, metode, dan teknik yang digunakan.',
      icon: '🔬',
      color: '#8b5cf6',
    },
    {
      id: 'SIMILAR_GAP',
      label: 'Gap Penelitian',
      description: 'Mengidentifikasi celah penelitian yang ditemukan.',
      icon: '⚠️',
      color: '#f59e0b',
    },
    {
      id: 'SIMILAR_FUTUREWORK',
      label: 'Arahan Masa Depan',
      description: 'Membandingkan rekomendasi dan arah penelitian selanjutnya.',
      icon: '🚀',
      color: '#ec4899',
    },
  ];
  const [selectedAspects, setSelectedAspects] = useState<string[]>([]);

  // Search artikel di panel komparatif
  const [comparativeArticleSearch, setComparativeArticleSearch] = useState('');

  const toggleAspect = useCallback((id: string) => {
    setSelectedAspects((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }, []);

  const [activeRelations, setActiveRelations] = useState<string[]>([
    'SIMILAR_BACKGROUND',
    'SIMILAR_METHODOLOGY',
    'SIMILAR_GAP',
    'SIMILAR_FUTUREWORK',
    'SIMILAR_OBJECTIVE',
  ]);
  const [activeArticles, setActiveArticles] = useState<string[]>([]);
  const [nodes, setNodes] = useState<ExtendedNode[]>([]);
  const [edges, setEdges] = useState<ExtendedEdge[]>([]);

  const availableAspects = useMemo(() => {
    if (comparativeLocked && comparativePendingIds.length === 2) {
      const [id1, id2] = comparativePendingIds;
      const relatedEdges = edges.filter(
        (e) =>
          (String(e.from) === String(id1) && String(e.to) === String(id2)) ||
          (String(e.from) === String(id2) && String(e.to) === String(id1))
      );
      const relationTypes = new Set(
        relatedEdges.map((e) => getDisplayRelationKey(e.relation || ''))
      );
      return ANALYSIS_ASPECTS.filter((aspect) => relationTypes.has(aspect.id));
    }
    return ANALYSIS_ASPECTS;
  }, [comparativeLocked, comparativePendingIds, edges, ANALYSIS_ASPECTS]);

  // ── Simpan highlight dari hasil analisis ke catatan ─────────────────────────────────────
  const [annotationRefreshKey, setAnnotationRefreshKey] = useState(0);
  const [annotationTab, setAnnotationTab] = useState<'files' | 'analysis'>(
    'files'
  );

  const handleSaveNoteFromAnalysis = useCallback(
    async (
      text: string,
      customLabel?: string,
      targetArticleId?: string,
      providedComment?: string
    ) => {
      // Ambil articleId pertama dari tab aktif jika tidak disediakan
      const activeTab = analysisTabs.find((t) => t.id === activeAnalysisTabId);
      const firstNodeId = activeTab?.nodeIds?.[0];
      const firstNode = firstNodeId
        ? nodes.find((n) => String(n.id) === firstNodeId)
        : null;
      const articleId =
        targetArticleId ??
        (firstNode as any)?.articleId ??
        (firstNode as any)?.article?.id;
      const label = customLabel ?? activeTab?.label ?? 'Analisis Komparatif';

      const saveAction = async (comment: string) => {
        try {
          const res = await fetch('/api/annotation/comparative', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              articleId,
              highlightedText: text,
              tabLabel: label,
              projectId,
              comment,
            }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.message || 'Gagal menyimpan catatan');
          }

          // Trigger refresh AnnotationPanel
          setAnnotationRefreshKey((k) => k + 1);

          // Update global highlights locally (untuk load dari DB saat refresh)
          setSavedAnalysisHighlights((prev) => [...prev, text]);

          // ── SIMPAN highlight ke tab yang aktif ─────────────────────────────
          // Ini memastikan highlight permanen SELALU ada di tab ini,
          // bahkan sebelum page refresh / fetch dari DB.
          setAnalysisTabs((prev) =>
            prev.map((t) =>
              t.id === activeAnalysisTabId
                ? {
                    ...t,
                    localHighlights: [...(t.localHighlights || []), text],
                  }
                : t
            )
          );

          // Buka sidebar dan arahkan ke tab anotasi, serta tab analisis di dalamnya
          setChatSidebarOpen(true);
          setActiveTab('annotation');
          setAnnotationTab('analysis');

          notifications.show({
            title: '✅ Catatan Tersimpan',
            message: `Kutipan dari "${label}" berhasil disimpan ke catatan.`,
            color: 'green',
            position: 'top-right',
            autoClose: 3000,
          });
        } catch (err: any) {
          notifications.show({
            title: 'Gagal Menyimpan',
            message:
              err?.message ?? 'Terjadi kesalahan saat menyimpan catatan.',
            color: 'red',
            position: 'top-right',
          });
          throw err;
        }
      };

      if (providedComment !== undefined) {
        await saveAction(providedComment);
        return;
      }

      modals.openConfirmModal({
        title: (
          <Group gap="xs">
            <ThemeIcon variant="light" color="blue" size="sm">
              <IconNote size={14} />
            </ThemeIcon>
            <Text size="md" fw={700}>
              Tambah Catatan Anda
            </Text>
          </Group>
        ),
        children: (
          <Stack gap="md" py="xs">
            <Text size="sm" c="dimmed">
              Simpan hasil analisis ini ke koleksi catatan Anda. Anda bisa
              menambahkan catatan pribadi di bawah ini.
            </Text>
            <Box
              p="xs"
              style={{
                backgroundColor: dark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                borderRadius: 8,
                borderLeft: `4px solid ${theme.colors.blue[6]}`,
              }}
            >
              <Text size="xs" fw={700} c="blue" mb={4}>
                HASIL ANALISIS:
              </Text>
              <Text size="sm" lineClamp={3} style={{ fontStyle: 'italic' }}>
                "{text}"
              </Text>
            </Box>
            <Textarea
              id="analysis-note-input"
              label="Catatan Anda (Opsional)"
              placeholder="Ketik catatan pribadi Anda di sini..."
              minRows={3}
              autosize
              data-autofocus
            />
          </Stack>
        ),
        labels: { confirm: 'Simpan ke Catatan', cancel: 'Batal' },
        confirmProps: { color: 'blue', radius: 'md' },
        cancelProps: { variant: 'subtle', radius: 'md' },
        centered: true,
        size: 'md',
        onConfirm: async () => {
          const comment =
            (
              document.getElementById(
                'analysis-note-input'
              ) as HTMLTextAreaElement
            )?.value || '';
          await saveAction(comment);
        },
      });
    },
    [analysisTabs, activeAnalysisTabId, nodes, projectId, dark, theme]
  );

  const handleSaveNoteFromArticle = useCallback(() => {
    // Trigger refresh AnnotationPanel
    setAnnotationRefreshKey((k) => k + 1);

    // Buka sidebar dan arahkan ke tab anotasi, serta tab file di dalamnya
    setChatSidebarOpen(true);
    setActiveTab('annotation');
    setAnnotationTab('files');
  }, []);

  // TAMBAHAN: State untuk tracking loading
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Tambahan dropdown graph
  const [graph, setGraph] = useState<'visjs' | 'neovisjs'>('visjs');
  const [neo4jData, setNeo4jData] = useState<{ nodes: any[]; edges: any[] }>({
    nodes: [],
    edges: [],
  });
  const [graphKey, setGraphKey] = useState(0);
  const graphContainerRef = useRef<HTMLDivElement>(null);

  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [previousGraph, setPreviousGraph] = useState<'visjs' | 'neovisjs'>(
    'visjs'
  );
  const [uploadModalOpened, setUploadModalOpened] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    author: '',
    year: '',
    abstract: '',
    keywords: '',
    doi: '',
    // category: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  //for tab
  const [activeTab, setActiveTab] = useState<
    'chat' | 'annotation' | 'detail' | 'relation' | 'ca-history'
  >('chat');
  const [tableViewTab, setTableViewTab] = useState<'table' | 'comparative'>(
    'table'
  );

  //for graph
  const [viewMode, setViewMode] = useState<'graph' | 'detail' | 'grid'>(
    'graph'
  );

  //for reset
  const [resetChatContext, setResetChatContext] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUpLoading] = useState(false);

  //for ris
  const [uploadMode, setUploadMode] = useState<
    'choose' | 'with-ris' | 'direct' | 'pdf-only'
  >('choose');
  const [risFile, setRisFile] = useState<File | null>(null);
  const [isProcessingRis, setIsProcessingRis] = useState(false);
  const risFileInputRef = useRef<HTMLInputElement | null>(null);

  const [session, setSession] = useState<any>(null);
  const supabase = createClient();

  const hasSessionId = !!projectId;
  const [currentUploadId, setCurrentUploadId] = useState<string | null>(null);

  const loadChatSessions = useCallback(
    async ({
      silent = false,
    }: {
      silent?: boolean;
    } = {}): Promise<ChatSessionListItem[]> => {
      if (!projectId) {
        return [];
      }

      setChatSessionsLoading(true);
      setChatSessionsError(null);

      try {
        const response = await fetch(
          `/api/chat/sessions?projectId=${encodeURIComponent(projectId)}`
        );
        const data = await response.json();

        if (!response.ok || !Array.isArray(data.sessions)) {
          throw new Error(data.error || 'Failed to load chat sessions.');
        }

        setChatSessions(data.sessions);
        setChatSessionsLoaded(true);
        setChatSessionsError(null);
        return data.sessions as ChatSessionListItem[];
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to load chat sessions.';

        setChatSessionsError(message);
        console.error(
          silent
            ? 'Silent chat session load failed:'
            : 'Chat session load failed:',
          message
        );

        return [];
      } finally {
        setChatSessionsLoading(false);
      }
    },
    [projectId]
  );

  const cleanupEmptyChatSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      if (!projectId) {
        return false;
      }

      const response = await fetch(
        `/api/chat?projectId=${encodeURIComponent(projectId)}&chatSessionId=${encodeURIComponent(sessionId)}&page=1&limit=1`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to inspect chat session.');
      }

      if (typeof data.total !== 'number' || data.total > 0) {
        return false;
      }

      const deleteResponse = await fetch(
        `/api/chat/sessions/${encodeURIComponent(sessionId)}?projectId=${encodeURIComponent(projectId)}`,
        {
          method: 'DELETE',
        }
      );
      const deleteData = await deleteResponse.json();

      if (!deleteResponse.ok) {
        throw new Error(
          deleteData.error || 'Failed to delete empty chat session.'
        );
      }

      setChatSessions((prev) => prev.filter((session) => session.id !== sessionId));
      return true;
    },
    [projectId]
  );

  const handleChatSelect = useCallback(
    async (chatId: string) => {
      if (switchingChatSession || chatId === activeChatSessionId) {
        setChatHistoryPopoverOpened(false);
        return;
      }

      setSwitchingChatSession(true);

      try {
        if (activeChatSessionId) {
          await cleanupEmptyChatSession(activeChatSessionId);
        }

        setActiveChatSessionId(chatId);
        setChatHistoryPopoverOpened(false);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to switch chat thread.';
        notifications.show({
          color: 'red',
          title: 'Thread chat gagal dipindah',
          message,
        });
      } finally {
        setSwitchingChatSession(false);
      }
    },
    [activeChatSessionId, cleanupEmptyChatSession, switchingChatSession]
  );

  const createChatSession = useCallback(
    async ({
      silent = false,
      skipEmptyCleanup = false,
    }: {
      silent?: boolean;
      skipEmptyCleanup?: boolean;
    } = {}): Promise<ChatSessionListItem | null> => {
      if (!projectId || creatingChatSession) {
        return null;
      }

      setCreatingChatSession(true);

      try {
        const response = await fetch('/api/chat/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId,
            mode: 'STRICT',
            contextSnapshot: { documents: [] },
          }),
        });
        const data = await response.json();

        if (!response.ok || !data.session) {
          throw new Error(data.error || 'Failed to create chat session.');
        }

        const newSession = data.session as ChatSessionListItem;

        if (activeChatSessionId && !skipEmptyCleanup) {
          await cleanupEmptyChatSession(activeChatSessionId);
        }

        setChatSessions((prev) => [newSession, ...prev]);
        setChatSessionsLoaded(true);
        setChatSessionsError(null);
        setActiveChatSessionId(newSession.id);
        setChatHistoryPopoverOpened(false);

        if (!silent) {
          notifications.show({
            color: 'green',
            title: 'Thread chat dibuat',
            message: 'Session baru aktif dan ditambahkan ke riwayat chat.',
          });
        }

        return newSession;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to create chat session.';

        if (!silent) {
          notifications.show({
            color: 'red',
            title: 'New chat gagal dibuat',
            message,
          });
        } else {
          console.error('Silent chat session bootstrap failed:', message);
        }

        return null;
      } finally {
        setCreatingChatSession(false);
      }
    },
    [
      activeChatSessionId,
      cleanupEmptyChatSession,
      creatingChatSession,
      projectId,
    ]
  );

  const handleCreateChatSession = useCallback(async () => {
    if (!projectId) {
      return;
    }
    await createChatSession();
  }, [createChatSession, projectId]);

  useEffect(() => {
    if (
      activeTab === 'chat' &&
      chatHistoryPopoverOpened &&
      !chatSessionsLoading &&
      !chatSessionsLoaded
    ) {
      void loadChatSessions({ silent: true });
    }
  }, [
    activeTab,
    chatHistoryPopoverOpened,
    chatSessionsError,
    chatSessionsLoaded,
    chatSessionsLoading,
    loadChatSessions,
  ]);

  useEffect(() => {
    let cancelled = false;

    const ensureActiveChatSession = async () => {
      if (
        activeTab !== 'chat' ||
        !projectId ||
        chatSessionsLoading ||
        creatingChatSession
      ) {
        return;
      }

      let sessions = chatSessions;

      if (!chatSessionsLoaded) {
        sessions = await loadChatSessions({ silent: true });
        if (cancelled) {
          return;
        }
      }

      if (sessions.length === 0) {
        await createChatSession({ silent: true, skipEmptyCleanup: true });
      }
    };

    void ensureActiveChatSession();

    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    chatSessions,
    chatSessionsLoaded,
    chatSessionsLoading,
    createChatSession,
    creatingChatSession,
    loadChatSessions,
    projectId,
  ]);

  useEffect(() => {
    setChatSessions([]);
    setChatSessionsLoaded(false);
    setChatSessionsError(null);
    setActiveChatSessionId(null);
  }, [projectId]);

  useEffect(() => {
    if (chatSessions.length === 0) {
      setActiveChatSessionId(null);
      return;
    }

    if (!activeChatSessionId) {
      setActiveChatSessionId(chatSessions[0].id);
      return;
    }

    const stillExists = chatSessions.some(
      (session) => session.id === activeChatSessionId
    );

    if (!stillExists) {
      setActiveChatSessionId(chatSessions[0].id);
    }
  }, [activeChatSessionId, chatSessions]);

  // ── Comparative Analysis: fetch handler (multi-tab + bertahap) ────────────────────────
  const runComparativeAnalysis = useCallback(
    async (nodeIds: string[], edgeRelation?: string) => {
      // Cek batas maksimum tab
      if (analysisTabs.length >= MAX_ANALYSIS_TABS) {
        notifications.show({
          title: '\u{1F6AB} Maksimal 6 tab analisis',
          message:
            'Anda sudah membuka 6 tab analisis. Silakan tutup tab yang tidak diperlukan terlebih dahulu.',
          color: 'red',
          position: 'top-right',
          autoClose: 4000,
        });
        return;
      }

      const tabId = `tab-${Date.now()}`;
      const tabIndex = analysisTabs.length + 1;
      const label = buildTabLabel(nodeIds, selectedAspects, nodes, tabIndex);

      // ── Inisialisasi loading steps ─────────────────────────────────────────────
      const initSteps: LoadingStep[] = [
        {
          id: 'fetch',
          label: 'Tahap 1: Mengambil data artikel dari database',
          description: 'Mencari dan memuat data artikel yang dipilih...',
          status: 'running',
          estimateSec: undefined,
        },
        {
          id: 'ai',
          label: 'Tahap 2: AI menghasilkan narasi analisis',
          description:
            'AI sedang membaca, membandingkan, dan menulis narasi analisis...',
          status: 'waiting',
          estimateSec: 20,
        },
      ];

      const newTab: AnalysisTab = {
        id: tabId,
        nodeIds,
        aspects: selectedAspects,
        edgeRelation,
        label,
        status: 'loading',
        data: null,
        error: null,
        createdAt: Date.now(),
        loadingSteps: initSteps,
        isOpen: true,
        localHighlights: [], // ← highlight permanen per-tab
      };

      setAnalysisTabs((prev) => [...prev, newTab]);
      setActiveAnalysisTabId(tabId);
      setTableViewTab('comparative');
      setViewMode('detail');
      setTableMaximized(true);
      setComparativePendingIds([]);
      setComparativeLocked(false); // Reset lock state setelah analisis dimulai

      // Helper: update step di tab tertentu
      const updateStep = (stepId: string, patch: Partial<LoadingStep>) => {
        setAnalysisTabs((prev) =>
          prev.map((t) =>
            t.id !== tabId
              ? t
              : {
                  ...t,
                  loadingSteps: t.loadingSteps.map((s) =>
                    s.id === stepId ? { ...s, ...patch } : s
                  ),
                }
          )
        );
      };

      // ── Tahap 1: simulasi pengambilan data (~1.2 detik) ────────────────────────
      const step1Start = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 1200)); // simulasi DB fetch
      updateStep('fetch', {
        status: 'done',
        durationMs: Date.now() - step1Start,
      });

      // ── Tahap 2: AI analysis ───────────────────────────────────────────────────
      const step2Start = Date.now();
      updateStep('ai', { status: 'running' });

      try {
        // Resolve nodeIds -> file_hashes using node attributes (same pattern as ChatPanel activeHashes)
        const fileHashes = nodeIds
          .map((id: string) => {
            const node = nodes.find((n) => String(n.id) === String(id));
            return node?.attributes?.hash || node?.articleId;
          })
          .filter(Boolean) as string[];

        if (fileHashes.length < 2) {
          throw new Error(
            'Tidak dapat menemukan hash dokumen yang valid. Pastikan artikel sudah diproses.'
          );
        }

        const res = await fetch('/api/comparative', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            file_hashes: fileHashes,
            aspects: selectedAspects.length > 0 ? selectedAspects : undefined,
            project_id: projectId,
          }),
        });
        const data: ComparativeAnalysisData = await res.json();
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

        // Tahap 2 selesai
        updateStep('ai', {
          status: 'done',
          durationMs: Date.now() - step2Start,
        });

        // Transisi ke hasil dengan sedikit delay agar animasi "done" terlihat
        await new Promise((resolve) => setTimeout(resolve, 600));
        setAnalysisTabs((prev) =>
          prev.map((t) => (t.id === tabId ? { ...t, status: 'done', data } : t))
        );
      } catch (err: any) {
        const errMsg = err.message || 'Gagal menghasilkan analisis';
        updateStep('ai', {
          status: 'error',
          durationMs: Date.now() - step2Start,
          errorMsg: errMsg,
        });
        setAnalysisTabs((prev) =>
          prev.map((t) =>
            t.id === tabId ? { ...t, status: 'error', error: errMsg } : t
          )
        );
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [analysisTabs.length, selectedAspects, nodes, projectId, buildTabLabel]
  );

  const {
    trackNodeClick,
    trackEdgeClick,
    trackPdfUpload,
    trackPdfView,
    trackChatInteraction,
    trackModalInteraction,
    trackTabChange,
    trackViewModeChange,
    trackGraphModeChange,
  } = useXapiTracking(session);

  //webgazer
  const [isTracking, setIsTracking] = useState(false);
  const gazeDataRef = useRef<{ x: number; y: number; timestamp: number }[]>([]);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);

  //perekaman
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const captureScreenshot = async (): Promise<string | null> => {
    if (!screenStreamRef.current || !screenStreamRef.current.active) {
      console.warn('Screen stream is not active, cannot capture screenshot');
      return null;
    }

    try {
      const videoTrack = screenStreamRef.current.getVideoTracks()[0];
      const imageCapture = new ImageCapture(videoTrack);
      const imageBitmap = await (imageCapture as any).grabFrame();

      const canvas = document.createElement('canvas');
      canvas.width = imageBitmap.width;
      canvas.height = imageBitmap.height;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.drawImage(imageBitmap, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.7);
      }
      return null;
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      return null;
    }
  };

  const startRecording = async () => {
    try {
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      setCameraStream(camStream);

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      screenStreamRef.current = stream;
      recordedChunksRef.current = [];

      //instance mediarecorder
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      //atur handler saat ada rekaman
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      //atur handler saat stop rekaman
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: 'video/webm',
        });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `session-recording-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      };

      recorder.start();
      setIsRecording(true);
      console.log('Screen recording started');
    } catch (error) {
      console.error('Error starting screen recording:', error);
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        setCameraStream(null);
      }
      console.error('Gagal memulai sesi:', error);
      notifications.show({
        title: 'Perekaman Gagal',
        message: 'Izin untuk merekam layar ditolak atau terjadi error.',
        color: 'red',
      });
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'recording'
    ) {
      mediaRecorderRef.current.stop();
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }

    setIsRecording(false);
    console.log('Screen recording stopped');
  };

  const sendGazeData = async () => {
    if (gazeDataRef.current.length === 0) {
      return;
    }

    console.log('--- DEBUGGING DATA TO BE SENT ---');
    console.log('Type of projectId:', typeof projectId);
    console.log('Value of projectId:', JSON.stringify(projectId, null, 2));

    const dataToSend = [...gazeDataRef.current];
    gazeDataRef.current = [];

    const screenshotDataUrl = await captureScreenshot();

    try {
      await fetch('/api/track-gaze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: projectId,
          gazeData: dataToSend,
          screenshot: screenshotDataUrl,
        }),
      });
      console.log(`Sent ${dataToSend} gaze points`);
    } catch (error) {
      console.error('Failed to send gaze data:', error);
      gazeDataRef.current.unshift(...dataToSend);
    }
  };

  const startEyeTracking = async () => {
    // try {
    //   await navigator.mediaDevices.getUserMedia({video: true});
    // } catch (error) {
    //   notifications.show({
    //     title: 'Akses Kamera Ditolak',
    //     message: 'Mohon izinkan akses kamera di pengaturan browser untuk fitur ini.',
    //     color: 'yellow',
    //     position: 'top-right',
    //   })
    //   return;
    // }

    const webgazer = (await import('webgazer')).default;

    await webgazer.begin();
    webgazer.setGazeListener((data, elapsedTime) => {
      if (data) {
        gazeDataRef.current.push({
          x: data.x,
          y: data.y,
          timestamp: Date.now(),
        });
      }
    });
    webgazer.showPredictionPoints(true);
    webgazer.showVideo(false);

    setIsTracking(true);
    notifications.show({
      title: 'Pelacakan Mata Aktif',
      message: 'Kamera telah diaktifkan untuk melacak pandangan Anda.',
      color: 'green',
      position: 'top-right',
    });
  };

  const stopEyeTracking = async () => {
    const webgazer = (await import('webgazer')).default;
    webgazer.end();
    setIsTracking(false);

    await sendGazeData();

    notifications.show({
      title: 'Pelacakan Mata Dihentikan',
      message: 'Kamera telah dinonaktifkan.',
      color: 'blue',
      position: 'top-right',
    });
  };

  useEffect(() => {
    if (isTracking) {
      intervalIdRef.current = setInterval(sendGazeData, 5000);
    }

    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
    };
  }, [isTracking]);

  const startSession = async () => {
    await startEyeTracking();
    await startRecording();
  };

  const stopSession = async () => {
    stopEyeTracking();
    stopRecording();
  };

  const contextValue = {
    isSessionActive: isTracking || isRecording,
    startSession,
    stopSession,
  };

  const VideoPreview = ({ stream }: { stream: MediaStream | null }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
      }
    }, [stream]);

    if (!stream) {
      return null;
    }

    return (
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '150px',
          height: '150px',
          borderRadius: '50%',
          objectFit: 'cover',
          border: '3px solid #fff',
          boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
          zIndex: 1000,
        }}
      ></video>
    );
  };

  // ✅ Session setup
  useEffect(() => {
    const getSessionFromAPI = async () => {
      try {
        const response = await fetch('/api/session');
        const data = await response.json();

        if (data.user) {
          console.log('✅ Got session from API:', data.user.email);
          setSession({
            user: data.user,
            expires_at: data.expires_at,
            projectId: projectId,
          });
        } else {
          console.log('❌ No session from API');
        }
      } catch (error) {
        console.error('API session fetch error:', error);
      }
    };

    getSessionFromAPI();
  }, []);

  const parseRisFile = async (risContent: string) => {
    try {
      // Menggunakan citation-js untuk parsing RIS
      const cite = new Cite(risContent);

      // Try getting data without format options first
      let jsonData = cite.format('data');

      // If it's a string, try parsing it
      if (typeof jsonData === 'string') {
        jsonData = JSON.parse(jsonData);
      }

      // Ensure it's an array
      const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
      const data = dataArray[0];

      if (!data) {
        throw new Error('Tidak dapat mem-parse file RIS');
      }

      // Mapping dari format citation-js ke format yang dibutuhkan
      const parsedData = {
        title: data.title || '',
        author: data.author
          ? data.author
              .map((author: any) =>
                `${author.given || ''} ${author.family || ''}`.trim()
              )
              .join(', ')
          : '',
        year: data.issued
          ? data.issued['date-parts']?.[0]?.[0]?.toString() || ''
          : '',
        abstract: data.abstract || '',
        keywords: data.keyword
          ? Array.isArray(data.keyword)
            ? data.keyword.join(', ')
            : data.keyword
          : '',
        doi: data.DOI || '',
      };

      return parsedData;
    } catch (error) {
      console.error('Error parsing RIS with citation-js:', error);
      // Fallback ke parsing manual jika citation-js gagal
      return parseRisFileManual(risContent);
    }
  };

  const parseRisFileManual = (risContent: string) => {
    const lines = risContent.split('\n');
    const parsedData: any = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('TI - ')) {
        parsedData.title = trimmed.substring(6);
      } else if (trimmed.startsWith('AU - ')) {
        if (!parsedData.author) parsedData.author = trimmed.substring(6);
        else parsedData.author += `, ${trimmed.substring(6)}`;
      } else if (trimmed.startsWith('PY - ')) {
        parsedData.year = trimmed.substring(6);
      } else if (trimmed.startsWith('AB - ')) {
        parsedData.abstract = trimmed.substring(6);
      } else if (trimmed.startsWith('KW - ')) {
        if (!parsedData.keywords) parsedData.keywords = trimmed.substring(6);
        else parsedData.keywords += `, ${trimmed.substring(6)}`;
      } else if (trimmed.startsWith('DO - ')) {
        parsedData.doi = trimmed.substring(6);
      } else if (trimmed.startsWith('T2 - ') || trimmed.startsWith('JO - ')) {
        parsedData.journal = trimmed.substring(6);
      }
    }

    return parsedData;
  };

  // Function untuk handle RIS file upload
  const onRisFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.ris')) {
      notifications.show({
        title: 'Format tidak didukung',
        message: 'Mohon upload file RIS',
        color: 'yellow',
        position: 'top-right',
      });
      return;
    }

    setRisFile(file);
    setIsProcessingRis(true);

    try {
      const content = await file.text();
      const parsedData = await parseRisFile(content);

      // Auto-fill form dengan data dari RIS
      setUploadForm({
        title: parsedData.title || '',
        author: parsedData.author || '',
        year: parsedData.year || '',
        abstract: parsedData.abstract || '',
        keywords: parsedData.keywords || '',
        doi: parsedData.doi || '',
        // category: ''
      });

      notifications.show({
        title: 'RIS berhasil diproses',
        message: 'Data artikel telah diisi otomatis',
        color: 'green',
        position: 'top-right',
      });
    } catch (error) {
      notifications.show({
        title: 'Error parsing RIS',
        message: 'Gagal memproses file RIS',
        color: 'red',
        position: 'top-right',
      });
    } finally {
      setIsProcessingRis(false);
      e.target.value = '';
    }
  };

  // Function untuk handle direct PDF upload
  const handleDirectPdfUpload = async () => {
    if (!selectedFile) return;

    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setCurrentUploadId(uploadId);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', selectedFile.name);
    formData.append('projectId', projectId as string);
    formData.append('uploadId', uploadId);
    formData.append('project_id', projectId as string);

    try {
      const res = await fetch('/api/ingestion/upload?mode=submit', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Upload failed: ${text}`);
      }

      const data = await res.json();

      if (data.job_id) {
        useUploadStore
          .getState()
          .addJob(data.job_id, selectedFile.name, projectId as string);
      }

      trackPdfUpload(selectedFile.name, 'direct');

      // Reset dan tutup modal
      handleModalClose();
    } catch (error: any) {
      setCurrentUploadId(null);

      notifications.show({
        title: 'Upload Gagal',
        message: error.message || 'Terjadi kesalahan saat upload',
        color: 'red',
        position: 'top-right',
      });
    }
  };

  // Enhanced modal close handler
  const handleModalClose = () => {
    setUploadModalOpened(false);
    setSelectedFile(null);
    setRisFile(null);
    setUploadMode('choose');
    setUploadForm({
      title: '',
      author: '',
      year: '',
      abstract: '',
      keywords: '',
      doi: '',
      // category: ''
    });
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (activeTab !== 'chat') {
      // Reset context saat pindah dari chat ke tab lain
      setResetChatContext(true);
    }
  }, [activeTab]);

  const handleContextReset = () => {
    setResetChatContext(false);
  };

  const fetchNeo4jData = async () => {
    try {
      const articleIdsParam =
        activeArticles.length > 0
          ? `&articleIds=${activeArticles.join(',')}`
          : '';
      const res = await fetch(
        `/api/neo4j/query?projectId=${projectId}${articleIdsParam}`
      );

      if (res.ok) {
        const data = await res.json();
        setNeo4jData(data);
      }
    } catch (error) {
      console.error('Error fetching Neo4j data:', error);
    }
  };

  // Effect untuk fetch Neo4j data ketika filter berubah
  useEffect(() => {
    if (
      graph === 'neovisjs' &&
      projectId &&
      !isLoadingSession &&
      !isLoadingData
    ) {
      fetchNeo4jData();
    }
  }, [graph, activeArticles, projectId, isLoadingSession, isLoadingData]);

  const cleanupNavigationButtons = useCallback(() => {
    // Cleanup semua tombol navigasi yang mungkin tertinggal
    const navigationSelectors = [
      // NeoVis navigation buttons
      '.neovis-navigation',
      '.neovis-controls',
      '.neovis-toolbar',
      // Generic navigation buttons yang sering digunakan library graph
      '[class*="navigation"]',
      '[class*="control"]',
      '[class*="toolbar"]',
      '[class*="zoom"]',
      '[class*="pan"]',
      // Specific button types
      'button[title*="zoom"]',
      'button[title*="pan"]',
      'button[title*="fit"]',
      'button[title*="center"]',
      // SVG controls yang sering digunakan untuk navigasi
      'svg[class*="control"]',
      'svg[class*="navigation"]',
      // Generic floating buttons
      '.floating-button',
      '.graph-controls',
      // Buttons dengan style position absolute/fixed yang mungkin floating
      'button[style*="position: absolute"]',
      'button[style*="position: fixed"]',
      'div[style*="position: absolute"][style*="button"]',
      'div[style*="position: fixed"][style*="button"]',
    ];

    navigationSelectors.forEach((selector) => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          // Check if element is actually a navigation button
          const isNavButton =
            el.textContent?.includes('→') ||
            el.textContent?.includes('↓') ||
            el.textContent?.includes('-') ||
            el.textContent?.includes('+') ||
            el.getAttribute('title')?.toLowerCase().includes('zoom') ||
            el.getAttribute('title')?.toLowerCase().includes('pan') ||
            el.getAttribute('aria-label')?.toLowerCase().includes('navigation');

          if (
            isNavButton ||
            selector.includes('navigation') ||
            selector.includes('control')
          ) {
            el.remove();
          }
        });
      } catch (e) {
        console.warn(`Could not clean selector: ${selector}`, e);
      }
    });

    // Cleanup berdasarkan content text (untuk tombol dengan simbol)
    const allButtons = document.querySelectorAll(
      'button, div[role="button"], span[role="button"]'
    );
    allButtons.forEach((button) => {
      const text = button.textContent?.trim();
      const title = button.getAttribute('title');
      const ariaLabel = button.getAttribute('aria-label');

      // Check for navigation symbols atau keywords
      const navigationPatterns = [
        '→',
        '←',
        '↑',
        '↓', // Arrow symbols
        '⊕',
        '⊖', // Plus/minus in circle
        '🔍',
        '🔎', // Magnifying glass
        '+',
        '-', // Simple plus minus
        'zoom',
        'pan',
        'fit',
        'center',
        'reset', // Keywords
      ];

      const isNavigationButton = navigationPatterns.some(
        (pattern) =>
          text?.includes(pattern) ||
          title?.toLowerCase().includes(pattern.toLowerCase()) ||
          ariaLabel?.toLowerCase().includes(pattern.toLowerCase())
      );

      if (isNavigationButton) {
        // Double check it's not part of our main UI
        const isPartOfMainUI =
          button.closest('.mantine-Card-root') ||
          button.closest('.mantine-Grid-col') ||
          button.closest('[data-mantine-component]');

        if (!isPartOfMainUI) {
          button.remove();
        }
      }
    });

    const cleanupAttempts = [100, 300, 500, 1000];

    cleanupAttempts.forEach((delay) => {
      setTimeout(() => {}, delay);
    });

    return () => {
      cleanupNavigationButtons();

      if (graphContainerRef.current) {
        graphContainerRef.current.innerHTML = '';
      }

      const neoElements = document.querySelectorAll(
        '[id*="neo"], [class*="neo"], [data-neo]'
      );
      neoElements.forEach((el) => el.remove());
    };
  }, []);

  useEffect(() => {
    cleanupNavigationButtons();
  }, [router, cleanupNavigationButtons]);

  const handleGraphTypeChange = useCallback(
    async (newGraphType: 'visjs' | 'neovisjs') => {
      setIsCleaningUp(true);
      setPreviousGraph(graph);

      if (graphContainerRef.current) {
        const container = graphContainerRef.current;
        const clonedContainer = container.cloneNode(false) as HTMLDivElement;
        container.parentNode?.replaceChild(clonedContainer, container);
        graphContainerRef.current = clonedContainer;
      }

      setSelectedNode(null);
      setSelectedEdge(null);

      if (newGraphType === 'visjs' && newGraphType === 'visjs') {
        setNeo4jData({ nodes: [], edges: [] });

        // Multiple cleanup attempts dengan delay
        const cleanupAttempts = [50, 150, 300, 500];

        cleanupAttempts.forEach((delay) => {
          setTimeout(() => {
            cleanupNavigationButtons();

            // Additional cleanup for persistent elements
            const persistentElements = document.querySelectorAll(
              '[class*="neo"], [id*="neo"], [data-*="neo"], ' +
                '.vis-navigation, .vis-button, .vis-up, .vis-down, .vis-left, .vis-right, .vis-zoomIn, .vis-zoomOut, .vis-zoomExtends'
            );

            persistentElements.forEach((el) => {
              try {
                el.remove();
              } catch (e) {
                // Element might already be removed
              }
            });

            // Force remove any remaining floating buttons outside our container
            const floatingButtons = document.querySelectorAll(
              'body > button, body > div > button'
            );
            floatingButtons.forEach((button) => {
              const rect = button.getBoundingClientRect();
              // If button is small and positioned like a navigation control
              if (rect.width < 50 && rect.height < 50) {
                const isPartOfMainUI =
                  button.closest('.mantine-AppShell-root') !== null;
                if (!isPartOfMainUI) {
                  button.remove();
                }
              }
            });
          }, delay);
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 150));

      setGraph(newGraphType);
      setGraphKey((prev) => prev + 1);

      if (newGraphType === 'visjs') {
        setIsLoadingData(false);
      }

      setTimeout(() => {
        cleanupNavigationButtons();
        setIsCleaningUp(false);
      }, 200);
    },
    [graph, cleanupNavigationButtons]
  );

  useEffect(() => {
    return () => {
      // Cleanup saat component unmount
      if (graphContainerRef.current) {
        graphContainerRef.current.innerHTML = '';
      }

      // Clear any remaining Neo4j elements
      const neoElements = document.querySelectorAll(
        '[id*="neo"], [class*="neo"], [data-neo]'
      );
      neoElements.forEach((el) => el.remove());
    };
  }, []);

  useEffect(() => {
    // Hanya jalankan cleanup jika sedang di vis.js tapi pernah menggunakan neovisjs
    if (graph === 'visjs' && previousGraph === 'neovisjs') {
      const timeoutId = setTimeout(() => {
        cleanupNavigationButtons();
      }, 300); // Delay untuk memastikan render selesai

      return () => clearTimeout(timeoutId);
    }
  }, [
    activeRelations,
    activeArticles,
    graph,
    previousGraph,
    cleanupNavigationButtons,
  ]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpened((o) => !o);
  }, []);

  // Handle Activity Bar feature selection
  const handleActivityFeatureSelect = useCallback(
    (featureId: string) => {
      setActiveActivityFeature(featureId);
      if (featureId === 'graph') {
        setViewMode('graph');
      } else if (featureId === 'grid') {
        setViewMode('grid');
      } else if (featureId === 'articles') {
        setViewMode('detail');
      } else if (featureId === 'chat') {
        setViewMode('graph');
        setActiveTab('chat');
      } else if (featureId === 'annotation') {
        setViewMode('graph');
        setActiveTab('annotation');
      } else if (featureId === 'ca-history') {
        setViewMode('graph');
        setActiveTab('ca-history');
      }
    },
    [setViewMode, setActiveTab]
  );
  //PERBAIKAN: Filter logic yang lebih robust
  const filteredNodes = useMemo(() => {
    // Jika masih loading, return empty array
    if (isLoadingSession || isLoadingData) return [];

    // Jika tidak ada artikel yang dipilih, tampilkan semua
    if (activeArticles.length === 0) return nodes;

    // Filter berdasarkan artikel yang dipilih
    return nodes.filter((node) => activeArticles.includes(String(node.id)));
  }, [activeArticles, nodes, isLoadingSession, isLoadingData]);

  const filteredEdges = useMemo(() => {
    if (isLoadingSession || isLoadingData) return [];

    const nodeIds = new Set(filteredNodes.map((n) => n.id));

    // Convert display relation names to API relation names
    const mappedActiveRelations = activeRelations
      .map(
        (relation) => relationMapping[relation as keyof typeof relationMapping]
      )
      .filter(Boolean);

    return edges.filter((edge) => {
      const matchRelation =
        activeRelations.length > 0 &&
        mappedActiveRelations.includes(edge.relation || '');
      const matchNodes = nodeIds.has(edge.from) && nodeIds.has(edge.to);

      return matchRelation && matchNodes;
    });
  }, [activeRelations, edges, filteredNodes, isLoadingSession, isLoadingData]);

  // Tambahkan useEffect khusus untuk monitoring perubahan filtered nodes/edges
  useEffect(() => {
    if (
      graph === 'visjs' &&
      previousGraph === 'neovisjs' &&
      (filteredNodes.length > 0 || filteredEdges.length > 0)
    ) {
      // Cleanup setelah data ter-filter
      const cleanupTimeout = setTimeout(() => {
        cleanupNavigationButtons();
      }, 100);

      return () => clearTimeout(cleanupTimeout);
    }
  }, [
    filteredNodes,
    filteredEdges,
    graph,
    previousGraph,
    cleanupNavigationButtons,
  ]);

  // Enhance MutationObserver untuk lebih agresif
  useEffect(() => {
    if (graph === 'visjs' && previousGraph === 'neovisjs') {
      const observer = new MutationObserver((mutations) => {
        let shouldCleanup = false;

        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;

              // Check berbagai jenis elemen yang bisa jadi navigation button
              const tagName = element.tagName.toLowerCase();
              const isButton =
                tagName === 'button' ||
                element.getAttribute('role') === 'button' ||
                (tagName === 'div' && element.tagName === 'pointer');

              if (isButton) {
                const text = element.textContent?.trim();
                const className = element.className;
                const id = element.id;

                // Deteksi navigation button patterns
                const isNavButton =
                  ['→', '←', '↑', '↓', '+', '-', '⊕', '⊖'].some((symbol) =>
                    text?.includes(symbol)
                  ) ||
                  className.includes('nav') ||
                  className.includes('control') ||
                  className.includes('zoom') ||
                  className.includes('pan') ||
                  id.includes('nav') ||
                  id.includes('control');

                if (isNavButton) {
                  const isPartOfMainUI =
                    element.closest('.mantine-Card-root') ||
                    element.closest('.mantine-Grid-col') ||
                    element.closest('[data-mantine-component]');

                  if (!isPartOfMainUI) {
                    shouldCleanup = true;
                  }
                }
              }
            }
          });
        });

        if (shouldCleanup) {
          // Delay cleanup sedikit untuk menghindari race condition
          setTimeout(() => {
            cleanupNavigationButtons();
          }, 50);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        attributeOldValue: false,
      });

      return () => observer.disconnect();
    }
  }, [graph, previousGraph, cleanupNavigationButtons]);

  // Tambahkan cleanup pada setiap perubahan checkbox relasi
  const handleRelationChange = useCallback(
    (relation: string, checked: boolean) => {
      if (checked) {
        setActiveRelations([...activeRelations, relation]);
      } else {
        setActiveRelations(activeRelations.filter((r) => r !== relation));
      }

      // Cleanup buttons setelah relasi berubah jika sebelumnya menggunakan neovisjs
      if (graph === 'visjs' && previousGraph === 'neovisjs') {
        setTimeout(() => {
          cleanupNavigationButtons();
        }, 200);
      }
    },
    [activeRelations, graph, previousGraph, cleanupNavigationButtons]
  );

  // Tambahkan cleanup saat MultiSelect artikel berubah
  const handleArticleSelectionChange = useCallback(
    (selectedArticles: string[]) => {
      setActiveArticles(selectedArticles);
      setSelectedNode(null);

      // Cleanup buttons setelah artikel selection berubah
      if (graph === 'visjs' && previousGraph === 'neovisjs') {
        setTimeout(() => {
          cleanupNavigationButtons();
        }, 200);
      }
    },
    [graph, previousGraph, cleanupNavigationButtons]
  );

  //PERBAIKAN: Fetch data function
  const fetchData = async () => {
    try {
      setIsLoadingData(true);
      const graphRes = await fetch(
        `/api/graph/context?project_id=${encodeURIComponent(String(projectId))}`,
        {
          method: 'GET',
          cache: 'no-store',
        }
      );

      if (!graphRes.ok) {
        const text = await graphRes.text();
        throw new Error(`Failed to fetch graph context: ${text}`);
      }

      const graphData = await graphRes.json();
      const nodesData = Array.isArray(graphData?.nodes) ? graphData.nodes : [];
      const edgesData = Array.isArray(graphData?.edges) ? graphData.edges : [];

      const mappedNodes = nodesData.map((node: any) => {
        const rawLabel = node.label || `Node ${node.id}`;
        const fullLabel = toProperCase(rawLabel);
        const truncatedLabel =
          fullLabel.length > 30
            ? fullLabel.substring(0, 10) + '...'
            : fullLabel;

        return {
          ...node,
          label: truncatedLabel,
          title: fullLabel,
        };
      });

      setNodes(mappedNodes);

      const mappedEdges = edgesData.map((edge: any, index: number) => ({
        id:
          edge.id ||
          `${edge.from}-${edge.to}-${edge.relation || 'unknown'}-${index}`,
        from: edge.from,
        to: edge.to,
        label: edge.label,
        relation: edge.relation || 'unknown',
        arrows: 'to',
        color: { color: getRelationColor(edge.relation) || 'gray' },
        font: { color: 'black', background: 'white' },
      }));

      setEdges(mappedEdges);
    } catch (error) {
      console.error('Error Fetching Data:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

  //PERBAIKAN: Load session function
  const loadSession = async () => {
    if (!projectId) return;

    try {
      setIsLoadingSession(true);
      const res = await fetch(`/api/projects-api/${projectId}`, {
        cache: 'no-store',
      });
      const session = await res.json();

      setActiveArticles(session.selectedFilterArticles ?? []);
      const mapLegacyRelationToCanonical = (rel: string) => {
        const map: Record<string, string> = {
          background: 'SIMILAR_BACKGROUND',
          method: 'SIMILAR_METHODOLOGY',
          goal: 'SIMILAR_OBJECTIVE',
          future: 'SIMILAR_FUTUREWORK',
          gap: 'SIMILAR_GAP',
        };
        return map[rel] || rel;
      };

      const rawFilters = session.graphFilters ?? [
        'SIMILAR_BACKGROUND',
        'SIMILAR_METHODOLOGY',
        'SIMILAR_GAP',
        'SIMILAR_FUTUREWORK',
        'SIMILAR_OBJECTIVE',
      ];
      setActiveRelations(
        rawFilters.map((r: string) => mapLegacyRelationToCanonical(r))
      );

      if (Array.isArray(session.comparativeTabs)) {
        // Backward-compat: pastikan setiap tab punya localHighlights dan tutup semua tab
        setAnalysisTabs(
          session.comparativeTabs.map((t: any) => ({
            localHighlights: [],
            ...t,
            isOpen: false,
          }))
        );
      } else if (session.comparativeTabs) {
        try {
          const parsed =
            typeof session.comparativeTabs === 'string'
              ? JSON.parse(session.comparativeTabs)
              : session.comparativeTabs;
          if (Array.isArray(parsed)) {
            setAnalysisTabs(
              parsed.map((t: any) => ({
                localHighlights: [],
                ...t,
                isOpen: false,
              }))
            );
          }
        } catch (e) {
          console.error('Failed to parse comparativeTabs:', e);
        }
      }
    } catch (error) {
      console.error('Error loading session:', error);
    } finally {
      setIsLoadingSession(false);
    }
  };

  //PERBAIKAN: Load data dan session secara paralel
  useEffect(() => {
    if (!projectId) return;

    const initializeData = async () => {
      await Promise.all([fetchData(), loadSession()]);
    };

    initializeData();
  }, [projectId]);

  // [Phase 5: Auto-Sync Restoration & Handoff Re-position]
  useEffect(() => {
    // KONDISI 1: Ketika Upload Selesai & Indexing Dimulai
    if (isIndexing && !prevIsIndexing.current) {
      // 1A. Hapus job lama dari UI (Lapis 1 Handoff)
      const currentJobs = useUploadStore.getState().jobs;
      Object.keys(currentJobs).forEach((id) => {
        if (id !== indexingJobId && currentJobs[id].projectId === projectId) {
          removeJob(id);
        }
      });

      // 1B. Suntikkan Virtual Job "Penyiapan Agen AI"
      addJob(indexingJobId, 'Penyiapan Agen AI', projectId as string);
      updateJob(indexingJobId, {
        stage: 'INDEXING_VECTORS',
        status: 'PROCESSING',
        progress: 99,
      });

      // 1C. 🎯 TRIGGER REFRESH (BARU): Tarik data graf hasil proses end-to-end
      fetchData();

      // KONDISI 2: Ketika Indexing Selesai
    } else if (!isIndexing && prevIsIndexing.current) {
      // 2A. Tandai Virtual Job "Selesai" (agar progress bar 100%)
      updateJob(indexingJobId, {
        status: 'COMPLETED',
        stage: 'COMPLETED',
        progress: 100,
      });

      // 2B. 🎯 TRIGGER REFRESH (BARU): Tarik data graf final
      fetchData();
    }

    prevIsIndexing.current = isIndexing;
  }, [
    isIndexing,
    projectId,
    indexingJobId,
    addJob,
    updateJob,
    removeJob,
    fetchData,
  ]);

  useEffect(() => {
    if (!projectId || indexingStatus === undefined) return;
    if (isIndexing) return;

    const currentJobs = useUploadStore.getState().jobs;
    if (currentJobs[indexingJobId]) {
      removeJob(indexingJobId);
    }
  }, [indexingStatus, indexingJobId, isIndexing, projectId, removeJob]);

  // Phase D.4.3: Auto-Sync Trigger
  useEffect(() => {
    Object.keys(jobs).forEach((jobId) => {
      const job = jobs[jobId];
      if (job.status === 'COMPLETED' && !syncedJobsRef.current[jobId]) {
        syncedJobsRef.current[jobId] = true;
        fetchData(); // Execute auto-sync

        notifications.show({
          title: '🔄 Graf Diperbarui Otomatis',
          message: `Literatur "${job.filename}" berhasil diintegrasikan ke jaringan pengetahuan.`,
          color: 'green',
          position: 'top-right',
          autoClose: 4000,
        });
      }
    });
  }, [jobs, fetchData]);

  //PERBAIKAN: Debounced save untuk menghindari terlalu banyak request
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialSaveRef = useRef(true);

  useEffect(() => {
    if (!projectId || isLoadingSession || isLoadingData) return;

    if (isInitialSaveRef.current) {
      isInitialSaveRef.current = false;
      return;
    }

    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/projects-api/${projectId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            selectedFilterArticles: activeArticles,
            graphFilters: activeRelations,
            lastSelectedNodeId: selectedNode?.id ?? null,
            lastSelectedEdgeId: selectedEdge?.id ?? null,
            comparativeTabs: analysisTabs,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        console.error('Error saving session:', error);
      }
    }, 500); // Debounce 500ms

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    activeArticles,
    activeRelations,
    selectedNode,
    selectedEdge,
    analysisTabs,
    projectId,
    isLoadingSession,
    isLoadingData,
  ]);

  const handleNodeClick = useCallback(
    (node: ExtendedNode) => {
      console.log('🎯 Node clicked:', {
        id: node.id,
        label: node.label,
        hasSession: !!session,
      });
      setSelectedEdge(null);
      setSelectedNode({ ...node });
      // Buka sidebar kanan langsung ke tab Detail Artikel
      setChatSidebarOpen(true);
      setActiveTab('detail');
      if (session) {
        console.log('📤 Tracking node click...');
        trackNodeClick(node);
      } else {
        console.warn('⚠️ No session for node tracking');
      }
    },
    [trackNodeClick, session]
  );

  const handleEdgeClick = useCallback(
    (edge: ExtendedEdge) => {
      setSelectedNode(null);
      setSelectedEdge(edge);
      setDetailModalEdge(edge);
      // Buka sidebar kanan dan langsung ke tab 'relation'
      setChatSidebarOpen(true);
      setActiveTab('relation');
      trackEdgeClick(edge);
    },
    [trackEdgeClick]
  );

  const onFileChangeInModal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.pdf')) {
      notifications.show({
        title: 'Format tidak didukung',
        message: 'Mohon upload file PDF',
        color: 'yellow',
        position: 'top-right',
      });
      return;
    }

    // Set file dan auto-fill title jika kosong
    setSelectedFile(file);
    if (!uploadForm.title) {
      setUploadForm({
        ...uploadForm,
        title: file.name.replace('.pdf', ''),
      });
    }

    // Clear input
    e.target.value = '';
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) return;

    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setCurrentUploadId(uploadId);

    // TETAP KIRIM DATA SEPERTI KODE LAMA (hanya file, title, projectId)
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', selectedFile.name); // Gunakan nama file, bukan form title
    formData.append('projectId', projectId as string);
    formData.append('uploadId', uploadId);
    formData.append('author', uploadForm.author);
    formData.append('year', uploadForm.year);
    formData.append('abstract', uploadForm.abstract);
    formData.append('keywords', uploadForm.keywords);
    formData.append('doi', uploadForm.doi);
    formData.append('project_id', projectId as string);

    //for ris
    // formData.append('', sele)

    setUpLoading(true);
    try {
      const res = await fetch('/api/ingestion/upload', {
        method: 'POST',
        body: formData,
      });

      const contentType = res.headers.get('content-type');
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Upload failed: ${text}`);
      }

      let data: any = {};
      if (contentType?.includes('application/json')) {
        data = await res.json();
        console.log('File uploaded:', data);
      } else {
        const text = await res.text();
        console.log('Unexpected response:', text);
      }

      trackPdfUpload(selectedFile.name, 'form');

      // notifications.show({
      //   title: 'Berhasil',
      //   message: `File "${selectedFile.name}" berhasil diunggah dan diproses`,
      //   color: 'green',
      //   position: 'top-right',
      // });

      // // Reset form dan tutup modal
      // setUploadModalOpened(false);
      // setSelectedFile(null);
      // setUploadForm({
      //   title: '',
      //   author: '',
      //   year: '',
      //   abstract: '',
      //   keywords: '',
      //   doi: '',
      //   // category: ''
      // });

      // // Refresh data setelah upload
      // await fetchData();
    } catch (error: any) {
      setUpLoading(false);
      setCurrentUploadId(null);

      notifications.show({
        title: 'Upload Gagal',
        message: error.message || 'Terjadi Kesalahan saat upload',
        color: 'red',
        position: 'top-right',
      });
      console.error('File upload error:', error);
    }
  };

  const handleUploadComplete = async () => {
    setUpLoading(false);
    setCurrentUploadId(null);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    notifications.show({
      id: 'upload-success', // ✅ Prevent duplicate
      title: 'Berhasil',
      message: `File "${selectedFile?.name}" berhasil diunggah dan diproses`,
      color: 'green',
      position: 'top-right',
    });

    // Reset form dan tutup modal
    setUploadModalOpened(false);
    setSelectedFile(null);
    setUploadForm({
      title: '',
      author: '',
      year: '',
      abstract: '',
      keywords: '',
      doi: '',
    });

    // Refresh data setelah upload
    await fetchData();
  };

  // ─── Handler: Hapus Artikel (Custom Modal Konfirmasi) ────────────
  const [deletingNodeId, setDeletingNodeId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteNodeId, setPendingDeleteNodeId] = useState<string | null>(
    null
  );
  const [pendingDeleteTitle, setPendingDeleteTitle] = useState<string>('');

  // Membuka modal konfirmasi
  const handleDeleteArticle = (
    nodeId: string,
    nodeTitle: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setPendingDeleteNodeId(nodeId);
    setPendingDeleteTitle(nodeTitle);
    setDeleteConfirmOpen(true);
  };

  // Eksekusi hapus setelah user konfirmasi di modal
  const executeDeleteArticle = async () => {
    if (!pendingDeleteNodeId) return;
    const nodeId = pendingDeleteNodeId;
    setDeleteConfirmOpen(false);
    setPendingDeleteNodeId(null);
    setPendingDeleteTitle('');

    setDeletingNodeId(nodeId);
    try {
      const res = await fetch(
        `/api/graph/literature/${encodeURIComponent(nodeId)}`,
        {
          method: 'DELETE',
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gagal menghapus: ${text}`);
      }

      notifications.show({
        title: 'Terhapus',
        message: 'Artikel dan file terkait berhasil dihapus',
        color: 'green',
        position: 'top-right',
      });

      setNodes((prev) => prev.filter((n) => String(n.id) !== nodeId));
      setActiveArticles((prev) => prev.filter((id) => id !== nodeId));

      // Clear selection if the deleted node was selected
      if (String(selectedNode?.id) === String(nodeId)) {
        setSelectedNode(null);
        setChatSidebarOpen(false);
      }
      if (String(viewingPdfNode?.id) === String(nodeId)) {
        setViewingPdfNode(null);
        setViewingPdfUrl(null);
      }

      await fetchData();
    } catch (err: any) {
      notifications.show({
        title: 'Gagal Hapus',
        message: err.message || 'Terjadi kesalahan',
        color: 'red',
        position: 'top-right',
      });
    } finally {
      setDeletingNodeId(null);
    }
  };

  // ─── Handler: Buka PDF → Inline dalam panel (WebViewer) ────────────
  const resolvePdfUrl = useCallback((node: ExtendedNode): string | null => {
    return (
      node.attributes?.storage_url ||
      (node as any).article?.filePath ||
      (node as any).pdfUrl ||
      null
    );
  }, []);

  const handleViewPdf = (node: ExtendedNode, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const pdfUrl = resolvePdfUrl(node);
    if (pdfUrl) {
      setViewingPdfNode(node);
      setViewingPdfUrl(pdfUrl);
      // Auto-expand: perlebar panel ke 80% lebar layar atau minimal 850px jika saat ini sempit
      if (!analysisPanelFullscreen) {
        const targetWidth = Math.max(850, window.innerWidth * 0.8);
        if (analysisPanelWidth < 800) {
          setAnalysisPanelWidth(Math.min(targetWidth, window.innerWidth - 100));
        }
      }
    } else {
      notifications.show({
        title: 'PDF tidak tersedia',
        message: 'File PDF untuk artikel ini tidak ditemukan',
        color: 'yellow',
        position: 'top-right',
      });
    }
  };

  const handleNextArticle = () => {
    if (!viewingPdfNode || nodes.length <= 1) return;
    const currentIndex = nodes.findIndex((n) => n.id === viewingPdfNode.id);
    const nextIndex = (currentIndex + 1) % nodes.length;
    handleViewPdf(nodes[nextIndex]);
  };

  const handlePrevArticle = () => {
    if (!viewingPdfNode || nodes.length <= 1) return;
    const currentIndex = nodes.findIndex((n) => n.id === viewingPdfNode.id);
    const prevIndex = (currentIndex - 1 + nodes.length) % nodes.length;
    handleViewPdf(nodes[prevIndex]);
  };

  //PERBAIKAN: Loading state yang lebih informatif
  if (!mounted || isLoadingSession || isLoadingData) {
    return (
      <DashboardLayout
        sidebarOpened={false}
        onToggleSidebar={() => {}}
        mounted={false}
        // chatHistory={chatHistory}
        // onChatSelect={handleChatSelect}
        // onNewChat={handleNewChat}
      >
        <Container fluid h="100%" p="xl">
          <Card shadow="sm" padding="xl" radius="lg" h="100%" withBorder>
            <Stack align="center" justify="center" h="100%">
              <Loader size="lg" />
              <Text size="lg" fw={500}>
                {isLoadingData && isLoadingSession
                  ? 'Memuat data dan sesi...'
                  : isLoadingData
                    ? 'Memuat data artikel...'
                    : 'Memuat pengaturan sesi...'}
              </Text>
              <Text size="sm" c="dimmed">
                Mohon tunggu sebentar
              </Text>
            </Stack>
          </Card>
        </Container>
      </DashboardLayout>
    );
  }

  return (
    <WebGazerContext.Provider value={contextValue}>
      <VideoPreview stream={cameraStream} />
      <DashboardLayout
        sidebarOpened={sidebarOpened}
        onToggleSidebar={handleToggleSidebar}
        mounted={mounted}
        activeFeature={activeActivityFeature}
        onFeatureSelect={handleActivityFeatureSelect}
        projectId={projectId as string}
      >
        {/* ── Main wrapper ── */}
        <Box
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            backgroundColor: dark ? '#0d0e14' : '#f1f3f9',
            padding: '16px',
            gap: '12px',
            boxSizing: 'border-box',
          }}
        >
          {/* ── MAIN CONTENT AREA (analysis panel + graph + optional chat sidebar) ── */}
          <Box
            style={{
              display: 'flex',
              gap: 12,
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            {/* ── ANALYSIS CONTROLS SLIDING PANEL ── */}
            <Box
              style={{
                width: analysisOpen
                  ? analysisPanelFullscreen
                    ? '100vw'
                    : analysisPanelWidth
                  : 0,
                minWidth: analysisOpen
                  ? analysisPanelFullscreen
                    ? '100vw'
                    : analysisPanelWidth
                  : 0,
                maxWidth: analysisOpen
                  ? analysisPanelFullscreen
                    ? '100vw'
                    : analysisPanelWidth
                  : 0,
                overflow: 'hidden',
                transition: isDraggingAnalysis.current
                  ? 'none'
                  : 'width 0.28s cubic-bezier(0.4,0,0.2,1), min-width 0.28s cubic-bezier(0.4,0,0.2,1), max-width 0.28s cubic-bezier(0.4,0,0.2,1)',
                flexShrink: 0,
                position: analysisPanelFullscreen ? 'fixed' : 'relative',
                top: analysisPanelFullscreen ? 0 : 'auto',
                left: analysisPanelFullscreen ? 0 : 'auto',
                bottom: analysisPanelFullscreen ? 0 : 'auto',
                zIndex: analysisPanelFullscreen ? 1100 : 50,
              }}
            >
              <Box
                style={{
                  width: analysisPanelFullscreen ? '100vw' : analysisPanelWidth,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: dark ? 'rgba(18,19,26,0.97)' : '#fff',
                  border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                  borderRadius: analysisPanelFullscreen ? 0 : 14,
                  backdropFilter: 'blur(16px)',
                  opacity: analysisOpen ? 1 : 0,
                  transition: 'opacity 0.2s ease 0.06s',
                  overflow: 'hidden',
                }}
              >
                {/* ── Header ── */}
                <Box
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: viewingPdfNode ? '8px 16px' : '14px 16px 12px',
                    borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}`,
                    flexShrink: 0,
                    backgroundColor: viewingPdfNode
                      ? dark
                        ? 'rgba(255,255,255,0.01)'
                        : '#fcfcfd'
                      : 'transparent',
                  }}
                >
                  {viewingPdfNode ? (
                    /* PDF viewer header Terpadu (Akan disinkronkan dengan toolbar WebViewer) */
                    <>
                      <Group gap={12}>
                        <Tooltip
                          label="Kembali ke Daftar"
                          position="bottom"
                          withArrow
                        >
                          <ActionIcon
                            size={28}
                            radius="md"
                            variant="light"
                            color="gray"
                            onClick={() => {
                              setViewingPdfNode(null);
                              setViewingPdfUrl(null);
                              setAnalysisPanelFullscreen(false);
                            }}
                          >
                            <IconChevronLeft size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Box style={{ minWidth: 0 }}>
                          <Text
                            size="11px"
                            fw={800}
                            style={{
                              letterSpacing: '0.05em',
                              color: theme.colors.blue[6],
                              textTransform: 'uppercase',
                            }}
                          >
                            Membaca Dokumen{' '}
                            {nodes.findIndex(
                              (n) => n.id === viewingPdfNode.id
                            ) + 1}{' '}
                            dari {nodes.length}
                          </Text>
                          <Text
                            size="12px"
                            fw={700}
                            style={{
                              color: dark ? '#e2e8f0' : '#1e293b',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: analysisPanelFullscreen
                                ? 600
                                : analysisPanelWidth - 250,
                            }}
                          >
                            {viewingPdfNode.title ||
                              viewingPdfNode.label ||
                              'Artikel'}
                          </Text>
                        </Box>
                      </Group>

                      <Group gap={8}>
                        {/* Navigation: Prev / Next */}
                        <Group gap={4} mr={8}>
                          <Tooltip label="Artikel Sebelumnya" position="bottom">
                            <ActionIcon
                              variant="subtle"
                              size="md"
                              onClick={handlePrevArticle}
                              disabled={nodes.length <= 1}
                            >
                              <IconChevronLeft size={18} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Artikel Berikutnya" position="bottom">
                            <ActionIcon
                              variant="subtle"
                              size="md"
                              onClick={handleNextArticle}
                              disabled={nodes.length <= 1}
                            >
                              <IconChevronRight size={18} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>

                        <Divider orientation="vertical" h={20} />

                        {/* Fullscreen toggle */}
                        <Tooltip
                          label={
                            analysisPanelFullscreen ? 'Minimize' : 'Fullscreen'
                          }
                          position="bottom"
                          withArrow
                        >
                          <ActionIcon
                            variant="light"
                            color="blue"
                            size={28}
                            radius="md"
                            onClick={() =>
                              setAnalysisPanelFullscreen((f) => !f)
                            }
                          >
                            {analysisPanelFullscreen ? (
                              <IconMaximize
                                size={16}
                                style={{ transform: 'rotate(180deg)' }}
                              />
                            ) : (
                              <IconMaximize size={16} />
                            )}
                          </ActionIcon>
                        </Tooltip>

                        <Tooltip
                          label="Buka Asli (Tab Baru)"
                          position="bottom"
                          withArrow
                        >
                          <ActionIcon
                            size={28}
                            radius="md"
                            variant="subtle"
                            color="gray"
                            onClick={() =>
                              viewingPdfUrl &&
                              window.open(
                                viewingPdfUrl,
                                '_blank',
                                'noopener,noreferrer'
                              )
                            }
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                              <polyline points="15 3 21 3 21 9"></polyline>
                              <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </>
                  ) : (
                    /* Normal header */
                    <>
                      <Text
                        size="sm"
                        fw={800}
                        style={{
                          letterSpacing: '0.1em',
                          color: dark ? '#cbd5e1' : '#1e293b',
                        }}
                      >
                        ANALYSIS CONTROLS
                      </Text>
                      <Group gap={4}>
                        {/* Fullscreen toggle for Normal View too */}
                        <Tooltip
                          label={
                            analysisPanelFullscreen ? 'Minimize' : 'Fullscreen'
                          }
                          position="bottom"
                          withArrow
                        >
                          <ActionIcon
                            variant="subtle"
                            color="indigo"
                            size={24}
                            radius="xl"
                            onClick={() =>
                              setAnalysisPanelFullscreen((f) => !f)
                            }
                          >
                            {analysisPanelFullscreen ? (
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 12 12"
                                fill="none"
                              >
                                <rect
                                  x="1"
                                  y="3"
                                  width="8"
                                  height="8"
                                  rx="1"
                                  stroke="currentColor"
                                  strokeWidth="1.4"
                                />
                                <path
                                  d="M4 3V2a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1h-1"
                                  stroke="currentColor"
                                  strokeWidth="1.4"
                                />
                              </svg>
                            ) : (
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 12 12"
                                fill="none"
                              >
                                <rect
                                  x="1"
                                  y="1"
                                  width="10"
                                  height="10"
                                  rx="1.5"
                                  stroke="currentColor"
                                  strokeWidth="1.4"
                                />
                              </svg>
                            )}
                          </ActionIcon>
                        </Tooltip>
                        <ActionIcon
                          size={22}
                          radius={6}
                          variant="subtle"
                          color="gray"
                          onClick={() => {
                            setActiveActivityFeature('graph');
                            setAnalysisPanelFullscreen(false);
                          }}
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 12 12"
                            fill="none"
                          >
                            <path
                              d="M1 1l10 10M11 1L1 11"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                            />
                          </svg>
                        </ActionIcon>
                      </Group>
                    </>
                  )}
                </Box>
                {/* ── Scrollable body ── */}
                <Box
                  style={{
                    flex: 1,
                    overflowY: viewingPdfNode ? 'hidden' : 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                  }}
                >
                  {viewingPdfNode ? (
                    /* ── INLINE WEBVIEWER (PDF + Highlighted Notes berdampingan) ── */
                    <Box
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 0,
                        height: '100%',
                      }}
                    >
                      <WebViewer
                        fileUrl={viewingPdfUrl ?? ''}
                        onAnalytics={handleAnalytics}
                        session={session}
                        onSave={handleSaveNoteFromArticle}
                        hideInternalToolbar={true} // Memberitahu WebViewer untuk menyatu dengan header parent
                      />
                    </Box>
                  ) : (
                    /* ── NORMAL LIST VIEW ── */
                    <>
                      {/* Pilih Artikel */}
                      <Box style={{ padding: '14px 16px 0' }}>
                        <Text
                          fw={700}
                          style={{
                            fontSize: 13,
                            color: dark ? '#e2e8f0' : '#1e293b',
                            marginBottom: 10,
                          }}
                        >
                          Pilih Artikel
                        </Text>
                        <MultiSelect
                          placeholder="Cari artikel..."
                          value={activeArticles}
                          onChange={handleArticleSelectionChange}
                          data={nodes.map((node) => ({
                            value: String(node.id),
                            label:
                              node.title || node.label || `Artikel ${node.id}`,
                          }))}
                          searchable
                          clearable
                          radius="md"
                          size="sm"
                          maxDropdownHeight={200}
                          styles={{
                            input: {
                              backgroundColor: dark
                                ? 'rgba(255,255,255,0.06)'
                                : '#f8fafc',
                              border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                              fontSize: 13,
                              borderRadius: 10,
                              color: dark ? '#94a3b8' : '#475569',
                            },
                          }}
                        />
                      </Box>

                      {/* Divider */}
                      <Box
                        style={{
                          height: 1,
                          backgroundColor: dark
                            ? 'rgba(255,255,255,0.06)'
                            : '#f1f5f9',
                          margin: '14px 0',
                        }}
                      />

                      {/* PDF File List */}
                      <Box
                        style={{
                          flex: 1,
                          overflowY: 'auto',
                          padding: '0 16px',
                        }}
                      >
                        {nodes.length === 0 ? (
                          <Box
                            style={{
                              padding: '24px 0',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 8,
                            }}
                          >
                            <svg
                              width="32"
                              height="32"
                              viewBox="0 0 24 24"
                              fill="none"
                              opacity="0.3"
                            >
                              <path
                                d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
                                stroke={dark ? '#94a3b8' : '#64748b'}
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M14 2v6h6"
                                stroke={dark ? '#94a3b8' : '#64748b'}
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            <Text size="xs" c="dimmed">
                              Belum ada artikel PDF
                            </Text>
                          </Box>
                        ) : (
                          <Stack gap={0}>
                            {nodes.map((node, idx) => {
                              const title =
                                node.title ||
                                node.label ||
                                `Artikel ${node.id}`;
                              const nodeId = String(node.id);
                              const isSel = activeArticles.includes(nodeId);
                              const isDeleting = deletingNodeId === nodeId;
                              const day = ((idx * 7 + 12) % 28) + 1;
                              const month = idx % 3 === 0 ? 6 : 8;
                              return (
                                <Box
                                  key={node.id}
                                  onClick={() =>
                                    handleArticleSelectionChange(
                                      isSel
                                        ? activeArticles.filter(
                                            (a) => a !== nodeId
                                          )
                                        : [...activeArticles, nodeId]
                                    )
                                  }
                                  style={{
                                    padding: '9px 4px',
                                    borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}`,
                                    cursor: 'pointer',
                                    backgroundColor: isSel
                                      ? dark
                                        ? 'rgba(99,102,241,0.1)'
                                        : 'rgba(99,102,241,0.06)'
                                      : 'transparent',
                                    borderRadius: isSel ? 6 : 0,
                                    transition: 'all 0.15s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    opacity: isDeleting ? 0.5 : 1,
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isSel)
                                      (
                                        e.currentTarget as HTMLElement
                                      ).style.backgroundColor = dark
                                        ? 'rgba(255,255,255,0.03)'
                                        : '#f8fafc';
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isSel)
                                      (
                                        e.currentTarget as HTMLElement
                                      ).style.backgroundColor = 'transparent';
                                  }}
                                >
                                  {/* File Info */}
                                  <Box style={{ flex: 1, minWidth: 0 }}>
                                    <Text
                                      size="sm"
                                      fw={500}
                                      style={{
                                        color: dark ? '#e2e8f0' : '#334155',
                                        lineHeight: 1.35,
                                        wordBreak: 'break-word',
                                      }}
                                    >
                                      {title}
                                      {title.toLowerCase().endsWith('.pdf')
                                        ? ''
                                        : '.pdf'}
                                    </Text>
                                    <Text
                                      size="11px"
                                      style={{
                                        color: dark ? '#475569' : '#94a3b8',
                                        marginTop: 2,
                                      }}
                                    >
                                      Last modified {day}/{month}/2023
                                    </Text>
                                  </Box>

                                  {/* Action Icons */}
                                  <Box
                                    style={{
                                      display: 'flex',
                                      gap: 4,
                                      flexShrink: 0,
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {/* Mata - buka PDF */}
                                    <Tooltip
                                      label="Lihat PDF"
                                      position="top"
                                      withArrow
                                      fz={11}
                                    >
                                      <ActionIcon
                                        size={24}
                                        radius={6}
                                        variant="subtle"
                                        color="blue"
                                        disabled={!resolvePdfUrl(node)}
                                        onClick={(e) => handleViewPdf(node, e)}
                                        style={{
                                          opacity: resolvePdfUrl(node)
                                            ? 1
                                            : 0.35,
                                        }}
                                      >
                                        {/* Eye icon */}
                                        <svg
                                          width="13"
                                          height="13"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                        >
                                          <path
                                            d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                          <circle
                                            cx="12"
                                            cy="12"
                                            r="3"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                          />
                                        </svg>
                                      </ActionIcon>
                                    </Tooltip>

                                    {/* Trash - hapus artikel */}
                                    <Tooltip
                                      label="Hapus artikel"
                                      position="top"
                                      withArrow
                                      fz={11}
                                    >
                                      <ActionIcon
                                        size={24}
                                        radius={6}
                                        variant="subtle"
                                        color="red"
                                        loading={isDeleting}
                                        onClick={(e) =>
                                          handleDeleteArticle(nodeId, title, e)
                                        }
                                      >
                                        {/* Trash icon */}
                                        <svg
                                          width="12"
                                          height="12"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                        >
                                          <polyline
                                            points="3 6 5 6 21 6"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                          <path
                                            d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                          <path
                                            d="M10 11v6"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                          />
                                          <path
                                            d="M14 11v6"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                          />
                                          <path
                                            d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                      </ActionIcon>
                                    </Tooltip>
                                  </Box>
                                </Box>
                              );
                            })}
                          </Stack>
                        )}
                      </Box>

                      {/* Divider */}
                      <Box
                        style={{
                          height: 1,
                          backgroundColor: dark
                            ? 'rgba(255,255,255,0.06)'
                            : '#f1f5f9',
                          margin: '14px 0',
                        }}
                      />

                      {/* FILTER CHIPS */}
                      <Box style={{ padding: '0 16px 14px' }}>
                        <Text
                          size="xs"
                          fw={800}
                          style={{
                            letterSpacing: '0.1em',
                            color: dark ? '#475569' : '#94a3b8',
                            marginBottom: 12,
                          }}
                        >
                          FILTER CHIPS
                        </Text>
                        <Stack gap={6}>
                          {[
                            {
                              key: 'SIMILAR_BACKGROUND',
                              label: 'Background',
                              color: '#3b82f6',
                            },
                            {
                              key: 'SIMILAR_METHODOLOGY',
                              label: 'Methodology',
                              color: '#22c55e',
                            },
                            {
                              key: 'SIMILAR_GAP',
                              label: 'Gap',
                              color: '#f97316',
                            },
                            {
                              key: 'SIMILAR_FUTUREWORK',
                              label: 'Future',
                              color: '#f59e0b',
                            },
                            {
                              key: 'SIMILAR_OBJECTIVE',
                              label: 'Objectives',
                              color: '#8b5cf6',
                            },
                          ].map((item) => {
                            const isActive = activeRelations.includes(item.key);
                            return (
                              <Box
                                key={item.key}
                                onClick={() =>
                                  handleRelationChange(item.key, !isActive)
                                }
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  padding: '6px 12px',
                                  borderRadius: 999,
                                  cursor: 'pointer',
                                  border: `1.5px solid ${item.color}${isActive ? 'bb' : '3a'}`,
                                  backgroundColor: isActive
                                    ? `${item.color}15`
                                    : 'transparent',
                                  boxShadow: isActive
                                    ? `0 0 10px ${item.color}22`
                                    : 'none',
                                  transition: 'all 0.18s ease',
                                  userSelect: 'none',
                                }}
                              >
                                <Box
                                  style={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: '50%',
                                    flexShrink: 0,
                                    backgroundColor: item.color,
                                    boxShadow: `0 0 5px ${item.color}aa`,
                                  }}
                                />
                                <Text
                                  size="xs"
                                  fw={600}
                                  style={{
                                    color: isActive
                                      ? item.color
                                      : dark
                                        ? '#94a3b8'
                                        : '#64748b',
                                  }}
                                >
                                  {item.label}
                                </Text>
                              </Box>
                            );
                          })}
                        </Stack>
                      </Box>
                    </> /* end normal list view */
                  )}{' '}
                  {/* end viewingPdfNode conditional */}
                </Box>{' '}
                {/* end scrollable body */}
                {/* ── Upload File sticky bottom (Popover) — hidden in PDF view ── */}
                {!viewingPdfNode && (
                  <Box
                    style={{
                      padding: '12px 16px 14px',
                      borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}`,
                      flexShrink: 0,
                    }}
                  >
                    <Popover
                      opened={uploadModalOpened}
                      onClose={handleModalClose}
                      position="top"
                      width={268}
                      withArrow
                      shadow="xl"
                      radius="lg"
                      withinPortal
                    >
                      <Popover.Target>
                        <Button
                          fullWidth
                          radius="xl"
                          size="md"
                          variant="gradient"
                          gradient={{
                            from: '#22c55e',
                            to: '#16a34a',
                            deg: 135,
                          }}
                          leftSection={<IconUpload size={18} />}
                          style={{
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            fontSize: 14,
                            boxShadow: '0 4px 24px rgba(34,197,94,0.45)',
                            height: 46,
                          }}
                          onClick={() => setUploadModalOpened(true)}
                        >
                          Upload File
                        </Button>
                      </Popover.Target>

                      <Popover.Dropdown
                        style={{
                          backgroundColor: dark
                            ? 'rgba(18,19,26,0.98)'
                            : '#fff',
                          border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                          backdropFilter: 'blur(20px)',
                          padding: 0,
                          overflow: 'hidden',
                        }}
                      >
                        {/* Header */}
                        <Box
                          style={{
                            padding: '12px 16px 10px',
                            borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : '#f1f5f9'}`,
                            background: dark
                              ? 'linear-gradient(135deg,rgba(34,197,94,0.1) 0%,rgba(18,19,26,0) 100%)'
                              : 'linear-gradient(135deg,rgba(34,197,94,0.06) 0%,rgba(255,255,255,0) 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <Text
                            fw={700}
                            size="sm"
                            style={{ color: dark ? '#e2e8f0' : '#1e293b' }}
                          >
                            Upload Artikel
                          </Text>
                          <ActionIcon
                            size={20}
                            radius={6}
                            variant="subtle"
                            color="gray"
                            onClick={handleModalClose}
                          >
                            <svg
                              width="9"
                              height="9"
                              viewBox="0 0 12 12"
                              fill="none"
                            >
                              <path
                                d="M1 1l10 10M11 1L1 11"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                              />
                            </svg>
                          </ActionIcon>
                        </Box>

                        {/* Body */}
                        <Box style={{ padding: '14px 16px' }}>
                          {uploadMode === 'choose' && (
                            <Stack gap="md">
                              <Text
                                size="xs"
                                fw={600}
                                style={{ color: dark ? '#94a3b8' : '#64748b' }}
                                ta="center"
                              >
                                Pilih cara upload artikel
                              </Text>
                              <Stack gap={8}>
                                <Box
                                  onClick={() => setUploadMode('with-ris')}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    padding: '10px 14px',
                                    borderRadius: 10,
                                    cursor: 'pointer',
                                    border: `1px solid ${dark ? 'rgba(59,130,246,0.3)' : '#bfdbfe'}`,
                                    backgroundColor: dark
                                      ? 'rgba(59,130,246,0.06)'
                                      : 'rgba(59,130,246,0.04)',
                                    transition: 'all 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    (
                                      e.currentTarget as HTMLElement
                                    ).style.backgroundColor = dark
                                      ? 'rgba(59,130,246,0.14)'
                                      : 'rgba(59,130,246,0.1)';
                                    (
                                      e.currentTarget as HTMLElement
                                    ).style.borderColor = dark
                                      ? 'rgba(59,130,246,0.6)'
                                      : '#93c5fd';
                                  }}
                                  onMouseLeave={(e) => {
                                    (
                                      e.currentTarget as HTMLElement
                                    ).style.backgroundColor = dark
                                      ? 'rgba(59,130,246,0.06)'
                                      : 'rgba(59,130,246,0.04)';
                                    (
                                      e.currentTarget as HTMLElement
                                    ).style.borderColor = dark
                                      ? 'rgba(59,130,246,0.3)'
                                      : '#bfdbfe';
                                  }}
                                >
                                  <ThemeIcon
                                    size={36}
                                    radius={9}
                                    variant="light"
                                    color="blue"
                                  >
                                    <IconUpload size={18} />
                                  </ThemeIcon>
                                  <Box>
                                    <Text
                                      size="sm"
                                      fw={600}
                                      style={{
                                        color: dark ? '#e2e8f0' : '#1e293b',
                                      }}
                                    >
                                      Upload dengan RIS
                                    </Text>
                                    <Text
                                      size="xs"
                                      style={{
                                        color: dark ? '#64748b' : '#94a3b8',
                                        marginTop: 1,
                                      }}
                                    >
                                      Isi metadata otomatis
                                    </Text>
                                  </Box>
                                </Box>

                                <Box
                                  onClick={() => setUploadMode('pdf-only')}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    padding: '10px 14px',
                                    borderRadius: 10,
                                    cursor: 'pointer',
                                    border: `1px solid ${dark ? 'rgba(34,197,94,0.3)' : '#bbf7d0'}`,
                                    backgroundColor: dark
                                      ? 'rgba(34,197,94,0.06)'
                                      : 'rgba(34,197,94,0.04)',
                                    transition: 'all 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    (
                                      e.currentTarget as HTMLElement
                                    ).style.backgroundColor = dark
                                      ? 'rgba(34,197,94,0.14)'
                                      : 'rgba(34,197,94,0.1)';
                                    (
                                      e.currentTarget as HTMLElement
                                    ).style.borderColor = dark
                                      ? 'rgba(34,197,94,0.6)'
                                      : '#86efac';
                                  }}
                                  onMouseLeave={(e) => {
                                    (
                                      e.currentTarget as HTMLElement
                                    ).style.backgroundColor = dark
                                      ? 'rgba(34,197,94,0.06)'
                                      : 'rgba(34,197,94,0.04)';
                                    (
                                      e.currentTarget as HTMLElement
                                    ).style.borderColor = dark
                                      ? 'rgba(34,197,94,0.3)'
                                      : '#bbf7d0';
                                  }}
                                >
                                  <ThemeIcon
                                    size={36}
                                    radius={9}
                                    variant="light"
                                    color="green"
                                  >
                                    <IconUpload size={18} />
                                  </ThemeIcon>
                                  <Box>
                                    <Text
                                      size="sm"
                                      fw={600}
                                      style={{
                                        color: dark ? '#e2e8f0' : '#1e293b',
                                      }}
                                    >
                                      Upload PDF
                                    </Text>
                                    <Text
                                      size="xs"
                                      style={{
                                        color: dark ? '#64748b' : '#94a3b8',
                                        marginTop: 1,
                                      }}
                                    >
                                      Tanpa metadata
                                    </Text>
                                  </Box>
                                </Box>
                              </Stack>
                            </Stack>
                          )}

                          {uploadMode === 'with-ris' && (
                            <Stack gap={10}>
                              <Group justify="space-between" align="center">
                                <Text
                                  size="sm"
                                  fw={600}
                                  style={{
                                    color: dark ? '#e2e8f0' : '#1e293b',
                                  }}
                                >
                                  Upload dengan RIS
                                </Text>
                                <ActionIcon
                                  variant="subtle"
                                  size={22}
                                  onClick={() => setUploadMode('choose')}
                                >
                                  <IconChevronLeft size={14} />
                                </ActionIcon>
                              </Group>
                              <div>
                                <input
                                  type="file"
                                  style={{ display: 'none' }}
                                  ref={risFileInputRef}
                                  onChange={onRisFileChange}
                                  accept=".ris"
                                />
                                <Button
                                  variant="light"
                                  color="blue"
                                  leftSection={<IconUpload size={14} />}
                                  onClick={() =>
                                    risFileInputRef.current?.click()
                                  }
                                  fullWidth
                                  size="sm"
                                  loading={isProcessingRis}
                                >
                                  {risFile
                                    ? `RIS: ${risFile.name}`
                                    : 'Pilih File RIS'}
                                </Button>
                              </div>
                              <div>
                                <input
                                  type="file"
                                  style={{ display: 'none' }}
                                  ref={fileInputRef}
                                  onChange={onFileChangeInModal}
                                  accept="application/pdf"
                                />
                                <Button
                                  variant="light"
                                  color="green"
                                  leftSection={<IconUpload size={14} />}
                                  onClick={() => fileInputRef.current?.click()}
                                  fullWidth
                                  size="sm"
                                >
                                  {selectedFile
                                    ? `PDF: ${selectedFile.name}`
                                    : 'Pilih File PDF'}
                                </Button>
                              </div>
                              <TextInput
                                label="Judul Artikel"
                                value={uploadForm.title}
                                onChange={(e) =>
                                  setUploadForm({
                                    ...uploadForm,
                                    title: e.target.value,
                                  })
                                }
                                required
                                size="sm"
                              />
                              <TextInput
                                label="Penulis"
                                value={uploadForm.author}
                                onChange={(e) =>
                                  setUploadForm({
                                    ...uploadForm,
                                    author: e.target.value,
                                  })
                                }
                                size="sm"
                              />
                              <TextInput
                                label="Tahun"
                                value={uploadForm.year}
                                onChange={(e) =>
                                  setUploadForm({
                                    ...uploadForm,
                                    year: e.target.value,
                                  })
                                }
                                size="sm"
                              />
                              <Textarea
                                label="Abstrak"
                                value={uploadForm.abstract}
                                onChange={(e) =>
                                  setUploadForm({
                                    ...uploadForm,
                                    abstract: e.target.value,
                                  })
                                }
                                minRows={2}
                                size="sm"
                              />
                              <TextInput
                                label="Kata Kunci"
                                value={uploadForm.keywords}
                                onChange={(e) =>
                                  setUploadForm({
                                    ...uploadForm,
                                    keywords: e.target.value,
                                  })
                                }
                                size="sm"
                              />
                              <TextInput
                                label="DOI"
                                value={uploadForm.doi}
                                onChange={(e) =>
                                  setUploadForm({
                                    ...uploadForm,
                                    doi: e.target.value,
                                  })
                                }
                                size="sm"
                              />
                              <Group justify="flex-end" mt={4}>
                                <Button
                                  size="xs"
                                  variant="light"
                                  onClick={() => setUploadMode('choose')}
                                >
                                  Kembali
                                </Button>
                                <Button
                                  size="xs"
                                  onClick={handleUploadSubmit}
                                  loading={uploading}
                                  disabled={!selectedFile}
                                >
                                  Upload
                                </Button>
                              </Group>
                            </Stack>
                          )}

                          {uploadMode === 'pdf-only' && (
                            <Stack gap={10}>
                              <Group justify="space-between" align="center">
                                <Text
                                  size="sm"
                                  fw={600}
                                  style={{
                                    color: dark ? '#e2e8f0' : '#1e293b',
                                  }}
                                >
                                  Upload PDF
                                </Text>
                                <ActionIcon
                                  variant="subtle"
                                  size={22}
                                  onClick={() => setUploadMode('choose')}
                                >
                                  <IconChevronLeft size={14} />
                                </ActionIcon>
                              </Group>
                              <div>
                                <input
                                  type="file"
                                  style={{ display: 'none' }}
                                  ref={fileInputRef}
                                  onChange={onFileChangeInModal}
                                  accept="application/pdf"
                                />
                                <Button
                                  variant="light"
                                  color="green"
                                  leftSection={<IconUpload size={14} />}
                                  onClick={() => fileInputRef.current?.click()}
                                  fullWidth
                                  size="sm"
                                >
                                  {selectedFile
                                    ? `File: ${selectedFile.name}`
                                    : 'Pilih File PDF'}
                                </Button>
                              </div>
                              {selectedFile && (
                                <Text size="xs" c="dimmed">
                                  File: {selectedFile.name}
                                </Text>
                              )}
                              <Group justify="flex-end" mt={4}>
                                <Button
                                  size="xs"
                                  variant="light"
                                  onClick={() => setUploadMode('choose')}
                                >
                                  Kembali
                                </Button>
                                <Button
                                  size="xs"
                                  onClick={handleDirectPdfUpload}
                                  loading={uploading}
                                  disabled={!selectedFile}
                                >
                                  Upload PDF
                                </Button>
                              </Group>
                            </Stack>
                          )}
                        </Box>
                      </Popover.Dropdown>
                    </Popover>
                  </Box>
                )}{' '}
                {/* end !viewingPdfNode */}
              </Box>

              {/* ── RIGHT DRAG HANDLE for resizing Analysis Panel ── */}
              {analysisOpen && !analysisPanelFullscreen && (
                <Box
                  onMouseDown={handleAnalysisDragStart}
                  onDoubleClick={() => {
                    if (analysisPanelWidth > 800) setAnalysisPanelWidth(320);
                    else setAnalysisPanelFullscreen(true);
                  }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: 8,
                    cursor: 'col-resize',
                    zIndex: 200,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'transparent',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      dark ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.2)';
                    (e.currentTarget as HTMLElement).style.boxShadow =
                      '0 0 15px rgba(99,102,241,0.5)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      'transparent';
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  }}
                >
                  <Box
                    style={{
                      width: 2,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: dark
                        ? 'rgba(165,180,252,0.8)'
                        : 'rgba(99,102,241,0.6)',
                    }}
                  />
                </Box>
              )}
            </Box>
            {/* ── GRAPH + TABLE AREA (full width) ── */}
            <Box
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                minWidth: 0,
              }}
            >
              {/* ── COL 2: Graph + Bottom Table Panel ── */}
              <Box
                ref={col2Ref}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0,
                  minHeight: 0,
                  flex: 1,
                }}
              >
                {/* ── GRAPH PANEL (hidden when table maximized) ── */}
                <Box
                  style={{
                    ...(isGraphFullscreen
                      ? {
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 1100,
                        }
                      : {
                          flex: 1,
                          minHeight: 200,
                          position: 'relative',
                        }),
                    backgroundColor: dark ? 'rgba(15,16,22,0.9)' : '#fff',
                    border: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}`,
                    borderRadius:
                      viewMode === 'detail' &&
                      !tableMaximized &&
                      !isGraphFullscreen
                        ? '16px 16px 0 0'
                        : isGraphFullscreen
                          ? 0
                          : 16,
                    overflow: 'hidden',
                    display:
                      tableMaximized && !isGraphFullscreen ? 'none' : undefined,
                  }}
                >
                  {/* ── Top Right Controls: Badges + Toggles ── */}
                  <Box
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      zIndex: 10,
                      display: 'flex',
                      gap: 10,
                      alignItems: 'center',
                    }}
                  >
                    {/* Floating stat badges */}
                    {filteredNodes.length > 0 && (
                      <Box style={{ display: 'flex', gap: 6 }}>
                        <Box
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '4px 10px',
                            borderRadius: 20,
                            backgroundColor: dark
                              ? 'rgba(0,6,15,0.75)'
                              : 'rgba(255,255,255,0.9)',
                            border: `1px solid ${dark ? 'rgba(34,211,238,0.25)' : '#a5f3fc'}`,
                            backdropFilter: 'blur(10px)',
                          }}
                        >
                          <Box
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              backgroundColor: '#22d3ee',
                              boxShadow: '0 0 6px #22d3ee',
                            }}
                          />
                          <Text
                            size="9px"
                            fw={800}
                            style={{
                              color: dark ? '#22d3ee' : '#0e7490',
                              letterSpacing: '0.06em',
                            }}
                          >
                            {filteredNodes.length} NODE
                          </Text>
                        </Box>
                        <Box
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '4px 10px',
                            borderRadius: 20,
                            backgroundColor: dark
                              ? 'rgba(0,6,15,0.75)'
                              : 'rgba(255,255,255,0.9)',
                            border: `1px solid ${dark ? 'rgba(249,115,22,0.25)' : '#fed7aa'}`,
                            backdropFilter: 'blur(10px)',
                          }}
                        >
                          <Box
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              backgroundColor: '#f97316',
                              boxShadow: '0 0 6px #f97316',
                            }}
                          />
                          <Text
                            size="9px"
                            fw={800}
                            style={{
                              color: dark ? '#f97316' : '#c2410c',
                              letterSpacing: '0.06em',
                            }}
                          >
                            {filteredEdges.length} EDGE
                          </Text>
                        </Box>
                      </Box>
                    )}

                    {/* ── View Mode Icon Toggles ── */}
                    <Box
                      style={{
                        display: 'flex',
                        gap: 2,
                        backgroundColor: dark
                          ? 'rgba(15,16,22,0.75)'
                          : 'rgba(255,255,255,0.85)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: 10,
                        padding: 3,
                        border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                        boxShadow: dark
                          ? '0 4px 16px rgba(0,0,0,0.4)'
                          : '0 2px 8px rgba(0,0,0,0.1)',
                      }}
                    >
                      <Tooltip
                        label={
                          viewMode === 'detail' ? 'Tutup Tabel' : 'Lihat Tabel'
                        }
                        position="bottom"
                        withArrow
                      >
                        <ActionIcon
                          size={28}
                          radius={7}
                          variant={
                            viewMode === 'detail' ? 'filled' : 'transparent'
                          }
                          color={viewMode === 'detail' ? 'indigo' : 'gray'}
                          onClick={() =>
                            setViewMode(
                              viewMode === 'detail' ? 'graph' : 'detail'
                            )
                          }
                          style={{ transition: 'all 0.15s ease' }}
                        >
                          <IconList size={14} />
                        </ActionIcon>
                      </Tooltip>

                      {/* ── AI Chat Toggle (next to Table View) ── */}
                      <Tooltip
                        label={
                          chatSidebarOpen ? 'Tutup AI Chat' : 'Buka AI Chat'
                        }
                        position="bottom"
                        withArrow
                      >
                        <ActionIcon
                          size={28}
                          radius={7}
                          variant={chatSidebarOpen ? 'filled' : 'transparent'}
                          color={chatSidebarOpen ? 'violet' : 'gray'}
                          onClick={() => setChatSidebarOpen((o) => !o)}
                          style={{ transition: 'all 0.15s ease' }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 16 16"
                            fill="none"
                          >
                            <rect
                              x="1.5"
                              y="2"
                              width="13"
                              height="12"
                              rx="1.5"
                              stroke="currentColor"
                              strokeWidth="1.2"
                              fill="none"
                            />
                            <line
                              x1="10"
                              y1="2"
                              x2="10"
                              y2="14"
                              stroke="currentColor"
                              strokeWidth="1.2"
                            />
                            <rect
                              x="10.5"
                              y="2.6"
                              width="3.4"
                              height="10.8"
                              rx="0.5"
                              fill="currentColor"
                              opacity="0.35"
                            />
                          </svg>
                        </ActionIcon>
                      </Tooltip>
                    </Box>
                  </Box>

                  <ProgressPanel projectId={projectId} />

                  {/* Graph content (always rendered) */}
                  {filteredNodes.length === 0 ? (
                    /* ── EMPTY STATE ── */
                    <Box
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '48px 24px',
                        gap: 16,
                        minHeight: 280,
                        background: dark
                          ? 'radial-gradient(ellipse at 50% 0%, rgba(109,40,217,0.08) 0%, transparent 70%)'
                          : 'radial-gradient(ellipse at 50% 0%, rgba(109,40,217,0.04) 0%, transparent 70%)',
                      }}
                    >
                      <Box
                        style={{ position: 'relative', width: 72, height: 72 }}
                      >
                        <Box
                          style={{
                            width: 72,
                            height: 72,
                            borderRadius: '50%',
                            border: `2px solid ${dark ? 'rgba(109,40,217,0.3)' : 'rgba(109,40,217,0.15)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: dark
                              ? 'rgba(109,40,217,0.08)'
                              : 'rgba(109,40,217,0.05)',
                          }}
                        >
                          <Text style={{ fontSize: 30 }}>🔬</Text>
                        </Box>
                        {[0, 1, 2].map((i) => (
                          <Box
                            key={i}
                            style={{
                              position: 'absolute',
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: [
                                '#7c3aed',
                                '#22d3ee',
                                '#f59e0b',
                              ][i],
                              opacity: 0.7,
                              top: ['4px', '50%', '58px'][i],
                              left: ['50%', '4px', '50%'][i],
                              transform: 'translate(-50%,-50%)',
                              boxShadow: `0 0 8px ${'#7c3aed #22d3ee #f59e0b'.split(' ')[i]}`,
                            }}
                          />
                        ))}
                      </Box>
                      <Box style={{ textAlign: 'center' }}>
                        <Text
                          fw={700}
                          style={{
                            fontSize: 15,
                            color: dark ? '#e2e8f0' : '#1e293b',
                            marginBottom: 6,
                          }}
                        >
                          Knowledge Graph Kosong
                        </Text>
                        <Text
                          size="xs"
                          c="dimmed"
                          style={{ maxWidth: 260, lineHeight: 1.6 }}
                        >
                          Upload artikel penelitian PDF untuk mulai membangun
                          jaringan pengetahuan otomatis
                        </Text>
                      </Box>
                    </Box>
                  ) : (
                    <>
                      <NetworkGraph
                        nodes={filteredNodes}
                        edges={filteredEdges}
                        onNodeClick={handleNodeClick}
                        onEdgeClick={handleEdgeClick}
                        key={`${fullPath}-visjs-${graphKey}`}
                        onNetworkReady={handleNetworkReady}
                      />

                      {/* ── Right Side Controls (Zoom & Legend) ── */}
                      <Stack
                        gap={12}
                        style={{
                          position: 'absolute',
                          bottom: 15,
                          right: 15,
                          zIndex: 10,
                          pointerEvents: 'none',
                        }}
                      >
                        {/* Zoom and Fit Controls */}
                        <Stack
                          gap={4}
                          style={{
                            pointerEvents: 'auto',
                            alignSelf: 'flex-end',
                          }}
                        >
                          <Button
                            size="sm"
                            variant="light"
                            onClick={handleZoomIn}
                          >
                            <IconZoomIn size={16} />
                          </Button>
                          <Button
                            size="sm"
                            variant="light"
                            onClick={handleZoomOut}
                          >
                            <IconZoomOut size={16} />
                          </Button>
                          <Button
                            size="sm"
                            variant="light"
                            onClick={toggleGraphFullscreen}
                          >
                            <IconMaximize
                              size={16}
                              style={{
                                transform: isGraphFullscreen
                                  ? 'rotate(180deg)'
                                  : 'none',
                              }}
                            />
                          </Button>
                        </Stack>

                        {/* Legend UI */}
                        <Box
                          style={{
                            backgroundColor: dark
                              ? 'rgba(30, 41, 59, 0.85)'
                              : 'rgba(255, 255, 255, 0.9)',
                            backdropFilter: 'blur(4px)',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`,
                            pointerEvents: 'auto',
                          }}
                        >
                          <Text
                            size="10px"
                            fw={700}
                            tt="uppercase"
                            c="dimmed"
                            mb={8}
                            style={{ letterSpacing: '0.05em' }}
                          >
                            Informasi Relasi
                          </Text>
                          <Stack gap={6}>
                            {Object.entries(relationColors).map(
                              ([key, color]) => (
                                <Group key={key} gap={8} wrap="nowrap">
                                  <Box
                                    style={{
                                      width: 12,
                                      height: 12,
                                      borderRadius: '3px',
                                      backgroundColor: color,
                                    }}
                                  />
                                  <Text
                                    size="xs"
                                    fw={500}
                                    style={{
                                      color: dark ? '#cbd5e1' : '#334155',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {toProperCase(
                                      key
                                        .replace('SIMILAR_', '')
                                        .replace('FUTUREWORK', 'FUTURE WORK')
                                    )}
                                  </Text>
                                </Group>
                              )
                            )}
                          </Stack>
                        </Box>
                      </Stack>

                      {/* ── Navigation Controls (bottom left) ── */}
                      <Box
                        style={{
                          position: 'absolute',
                          bottom: 15,
                          left: 15,
                          zIndex: 10,
                          transition: 'bottom 0.2s ease',
                          pointerEvents: 'none',
                        }}
                      >
                        {/* Directional Controls (WASD) */}
                        <Box style={{ pointerEvents: 'auto' }}>
                          <Stack gap={4} align="center">
                            <Button
                              size="sm"
                              variant="light"
                              onClick={() => handleNavMove('up')}
                            >
                              <IconArrowUp size={16} />
                            </Button>
                            <Group gap={4}>
                              <Button
                                size="sm"
                                variant="light"
                                onClick={() => handleNavMove('left')}
                              >
                                <IconArrowLeft size={16} />
                              </Button>
                              <Button
                                size="sm"
                                variant="light"
                                onClick={() => handleNavMove('down')}
                              >
                                <IconArrowDown size={16} />
                              </Button>
                              <Button
                                size="sm"
                                variant="light"
                                onClick={() => handleNavMove('right')}
                              >
                                <IconArrowRight size={16} />
                              </Button>
                            </Group>
                          </Stack>
                        </Box>
                      </Box>
                    </>
                  )}
                </Box>

                {/* ── DRAG HANDLE (VS Code-style resize bar) ── */}
                {viewMode === 'detail' && (
                  <Box
                    onMouseDown={handleTableDragStart}
                    style={{
                      height: 8,
                      flexShrink: 0,
                      cursor: 'row-resize',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: dark
                        ? 'rgba(99,102,241,0.08)'
                        : 'rgba(99,102,241,0.05)',
                      borderLeft: `1px solid ${dark ? 'rgba(99,102,241,0.2)' : '#e0e7ff'}`,
                      borderRight: `1px solid ${dark ? 'rgba(99,102,241,0.2)' : '#e0e7ff'}`,
                      transition: 'background-color 0.15s',
                      position: 'relative',
                      zIndex: 5,
                      userSelect: 'none',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        dark
                          ? 'rgba(99,102,241,0.22)'
                          : 'rgba(99,102,241,0.14)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        dark
                          ? 'rgba(99,102,241,0.08)'
                          : 'rgba(99,102,241,0.05)';
                    }}
                  >
                    {/* Grip dots */}
                    <Box
                      style={{ display: 'flex', gap: 3, alignItems: 'center' }}
                    >
                      {[0, 1, 2, 3, 4].map((i) => (
                        <Box
                          key={i}
                          style={{
                            width: 3,
                            height: 3,
                            borderRadius: '50%',
                            backgroundColor: dark
                              ? 'rgba(165,180,252,0.5)'
                              : 'rgba(99,102,241,0.4)',
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {/* ── BOTTOM TABLE PANEL (draggable height) ── */}
                <Box
                  style={{
                    height: viewMode === 'detail' ? tableHeight : 0,
                    minHeight: 0,
                    overflow: 'hidden',
                    flexShrink: 0,
                    backgroundColor: dark ? 'rgba(12,13,20,0.95)' : '#fff',
                    border:
                      viewMode === 'detail'
                        ? `1px solid ${dark ? 'rgba(99,102,241,0.2)' : '#e0e7ff'}`
                        : 'none',
                    borderRadius: tableMaximized ? 14 : '0 0 14px 14px',
                    backdropFilter: 'blur(12px)',
                    flex: tableMaximized ? 1 : undefined,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* Table Header */}
                  <Box
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 16px 8px',
                      borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}`,
                      flexShrink: 0,
                    }}
                  >
                    <Group
                      gap={4}
                      p={2}
                      style={{
                        backgroundColor: dark
                          ? 'rgba(255,255,255,0.03)'
                          : 'rgba(0,0,0,0.03)',
                        borderRadius: 8,
                        marginLeft: 8,
                      }}
                    >
                      {/* TAB: TABEL */}
                      <Box
                        onClick={() => setTableViewTab('table')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '5px 12px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.07em',
                          backgroundColor:
                            tableViewTab === 'table'
                              ? dark
                                ? 'rgba(99,102,241,0.2)'
                                : '#fff'
                              : 'transparent',
                          boxShadow:
                            tableViewTab === 'table'
                              ? '0 2px 4px rgba(0,0,0,0.1)'
                              : 'none',
                          color:
                            tableViewTab === 'table'
                              ? dark
                                ? '#a5b4fc'
                                : '#4338ca'
                              : dark
                                ? '#94a3b8'
                                : '#64748b',
                          transition: 'all 0.15s',
                        }}
                      >
                        <IconList size={12} />
                        <span>TABEL</span>
                      </Box>

                      {/* TAB: KOMPARATIF */}
                      <Box
                        onClick={() => {
                          setTableViewTab('comparative');
                          if (
                            analysisTabs.length === 0 ||
                            !activeAnalysisTabId
                          ) {
                            setShowingNewSelector(true);
                            setActiveAnalysisTabId(null);
                          } else {
                            setShowingNewSelector(false);
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '5px 12px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.07em',
                          backgroundColor:
                            tableViewTab === 'comparative'
                              ? dark
                                ? 'rgba(20,184,166,0.2)'
                                : '#fff'
                              : 'transparent',
                          boxShadow:
                            tableViewTab === 'comparative'
                              ? '0 2px 4px rgba(0,0,0,0.1)'
                              : 'none',
                          color:
                            tableViewTab === 'comparative'
                              ? dark
                                ? '#2dd4bf'
                                : '#0d9488'
                              : dark
                                ? '#94a3b8'
                                : '#64748b',
                          transition: 'all 0.15s',
                        }}
                      >
                        <IconArrowsSplit2 size={12} />
                        <span>KOMPARATIF</span>
                      </Box>
                    </Group>

                    <Group gap={6}>
                      <Tooltip
                        label={tableMaximized ? 'Restore' : 'Maximize'}
                        position="bottom"
                        withArrow
                      >
                        <ActionIcon
                          size={22}
                          radius={6}
                          variant="subtle"
                          color="indigo"
                          onClick={() => {
                            setTableMaximized((m) => !m);
                            if (!tableMaximized) {
                              setViewMode('detail');
                            }
                          }}
                        >
                          {tableMaximized ? (
                            <svg
                              width="11"
                              height="11"
                              viewBox="0 0 12 12"
                              fill="none"
                            >
                              <rect
                                x="1"
                                y="3"
                                width="8"
                                height="8"
                                rx="1"
                                stroke="currentColor"
                                strokeWidth="1.4"
                              />
                              <path
                                d="M4 3V2a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1h-1"
                                stroke="currentColor"
                                strokeWidth="1.4"
                              />
                            </svg>
                          ) : (
                            <svg
                              width="11"
                              height="11"
                              viewBox="0 0 12 12"
                              fill="none"
                            >
                              <rect
                                x="1"
                                y="1"
                                width="10"
                                height="10"
                                rx="1.5"
                                stroke="currentColor"
                                strokeWidth="1.4"
                              />
                              <path
                                d="M4 1v2.5H1.5"
                                stroke="currentColor"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                              />
                              <path
                                d="M8 1v2.5H10.5"
                                stroke="currentColor"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                              />
                              <path
                                d="M4 11V8.5H1.5"
                                stroke="currentColor"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                              />
                              <path
                                d="M8 11V8.5H10.5"
                                stroke="currentColor"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                              />
                            </svg>
                          )}
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Tutup Tabel" position="bottom" withArrow>
                        <ActionIcon
                          size={22}
                          radius={6}
                          variant="subtle"
                          color="gray"
                          onClick={() => {
                            setViewMode('graph');
                            setTableMaximized(false);
                          }}
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 12 12"
                            fill="none"
                          >
                            <path
                              d="M1 1l10 10M11 1L1 11"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                            />
                          </svg>
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Box>

                  {/* Table / Comparative / History Content */}
                  {tableViewTab === 'table' ? (
                    <Box
                      style={{
                        flex: 1,
                        height: tableMaximized
                          ? undefined
                          : `calc(${tableHeight}px - 42px)`,
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 0,
                      }}
                    >
                      <Box
                        p="xs"
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          minHeight: 0,
                        }}
                      >
                        <ArticleDetailTable
                          nodes={nodes}
                          activeArticles={activeArticles}
                          session={session}
                          onSaveNote={handleSaveNoteFromArticle}
                        />
                      </Box>
                    </Box>
                  ) : (
                    <Box
                      style={{
                        flex: 1,
                        height: tableMaximized
                          ? undefined
                          : `calc(${tableHeight}px - 42px)`,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                      }}
                    >
                      {!showingNewSelector &&
                      analysisTabs.filter((t) => t.isOpen !== false).length >
                        0 ? (
                        <>
                          <AnalysisTabBar
                            tabs={analysisTabs.filter(
                              (t) => t.isOpen !== false
                            )}
                            activeTabId={activeAnalysisTabId}
                            dark={dark}
                            onSelectTab={setActiveAnalysisTabId}
                            onCloseTab={handleCloseTab}
                            onNewAnalysis={() => setShowingNewSelector(true)}
                          />
                          <Box
                            style={{
                              flex: 1,
                              minHeight: 0,
                              overflow: 'hidden',
                              position: 'relative',
                            }}
                          >
                            {(() => {
                              const activeTab = analysisTabs.find(
                                (t) => t.id === activeAnalysisTabId
                              );
                              return (
                                <ComparativeModal
                                  key={activeTab?.id || 'empty'}
                                  opened={!!activeAnalysisTabId}
                                  onClose={() => setActiveAnalysisTabId(null)}
                                  nodes={
                                    activeTab && activeTab.nodeIds
                                      ? (activeTab.nodeIds
                                          .map((id) =>
                                            nodes.find(
                                              (n) => String(n.id) === id
                                            )
                                          )
                                          .filter(Boolean) as any[])
                                      : []
                                  }
                                  inline={true}
                                  onNodeClick={(nodeId) => {
                                    const node = nodes.find(
                                      (n) => String(n.id) === nodeId
                                    );
                                    if (node) {
                                      setSelectedNode(node);
                                      setActiveTab('detail');
                                      setChatSidebarOpen(true);
                                    }
                                  }}
                                  caData={activeTab?.data}
                                  caLoading={activeTab?.status === 'loading'}
                                  caLoadingSteps={activeTab?.loadingSteps}
                                  caError={activeTab?.error}
                                  caAspects={activeTab?.aspects}
                                  caArticleTitles={
                                    activeTab && activeTab.nodeIds
                                      ? activeTab.nodeIds
                                          .map((id) =>
                                            nodes.find(
                                              (n) => String(n.id) === id
                                            )
                                          )
                                          .filter(Boolean)
                                          .map(
                                            (n) =>
                                              (n?.title ??
                                                (n as any)?.label ??
                                                `Artikel`) as string
                                          )
                                      : []
                                  }
                                  caCreatedAt={activeTab?.createdAt}
                                  onSaveNote={handleSaveNoteFromAnalysis}
                                  caTabLabel={activeTab?.label}
                                  globalHighlights={[
                                    ...savedAnalysisHighlights,
                                    ...(activeTab?.localHighlights || []),
                                  ]}
                                  onCaRetry={() => {
                                    if (activeTab) {
                                      setTimeout(() => {
                                        runComparativeAnalysis(
                                          activeTab.nodeIds || [],
                                          activeTab.edgeRelation
                                        );
                                      }, 50);
                                    }
                                  }}
                                />
                              );
                            })()}
                          </Box>
                        </>
                      ) : (
                        <ScrollArea style={{ flex: 1 }}>
                          <Box
                            p="lg"
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 20,
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            {/* Header */}
                            <Box
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <Box
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10,
                                }}
                              >
                                <ThemeIcon
                                  size={38}
                                  radius="md"
                                  variant="light"
                                  color="teal"
                                >
                                  <IconArrowsSplit2 size={20} />
                                </ThemeIcon>
                                <Box>
                                  <Text
                                    fw={700}
                                    size="sm"
                                    style={{
                                      color: dark ? '#e2e8f0' : '#1e293b',
                                    }}
                                  >
                                    Pilih & Tambah Artikel
                                  </Text>
                                  <Text size="xs" c="dimmed">
                                    Artikel Terpilih (
                                    {comparativePendingIds.length}
                                    {comparativePendingIds.length >= 2
                                      ? ' ✓'
                                      : '/2 min'}
                                    )
                                  </Text>
                                </Box>
                              </Box>
                              {/* Tombol Batal — hanya muncul saat ada tab yang bisa dikembali */}
                              {showingNewSelector &&
                                analysisTabs.filter((t) => t.isOpen !== false)
                                  .length > 0 &&
                                activeAnalysisTabId && (
                                  <Box
                                    onClick={() => setShowingNewSelector(false)}
                                    style={{
                                      padding: '5px 12px',
                                      borderRadius: 7,
                                      cursor: 'pointer',
                                      border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: dark ? '#94a3b8' : '#64748b',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 5,
                                      transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={(e) => {
                                      (
                                        e.currentTarget as HTMLElement
                                      ).style.backgroundColor = dark
                                        ? 'rgba(255,255,255,0.06)'
                                        : '#f8fafc';
                                    }}
                                    onMouseLeave={(e) => {
                                      (
                                        e.currentTarget as HTMLElement
                                      ).style.backgroundColor = 'transparent';
                                    }}
                                  >
                                    <svg
                                      width="9"
                                      height="9"
                                      viewBox="0 0 12 12"
                                      fill="none"
                                    >
                                      <path
                                        d="M1 1l10 10M11 1L1 11"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                      />
                                    </svg>
                                    Batal
                                  </Box>
                                )}
                            </Box>

                            {/* Status bar */}
                            {comparativeLocked && (
                              <Box
                                style={{
                                  padding: '8px 12px',
                                  borderRadius: 8,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10,
                                  backgroundColor: dark
                                    ? 'rgba(251,191,36,0.08)'
                                    : 'rgba(251,191,36,0.05)',
                                  border: `1px solid ${dark ? 'rgba(251,191,36,0.25)' : 'rgba(251,191,36,0.2)'}`,
                                }}
                              >
                                <Box style={{ fontSize: 16 }}>🔒</Box>
                                <Text
                                  size="xs"
                                  fw={600}
                                  style={{
                                    color: dark ? '#fbbf24' : '#b45309',
                                  }}
                                >
                                  Kedua artikel dari relasi ini telah dikunci
                                  untuk analisis.
                                </Text>
                              </Box>
                            )}
                            {!comparativeLocked &&
                              comparativePendingIds.length === 1 && (
                                <Box
                                  style={{
                                    padding: '7px 12px',
                                    borderRadius: 8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 7,
                                    backgroundColor: dark
                                      ? 'rgba(99,102,241,0.08)'
                                      : 'rgba(99,102,241,0.05)',
                                    border: `1px solid ${dark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)'}`,
                                  }}
                                >
                                  <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 12 12"
                                    fill="none"
                                  >
                                    <circle
                                      cx="6"
                                      cy="6"
                                      r="5"
                                      stroke="#6366f1"
                                      strokeWidth="1.5"
                                    />
                                    <path
                                      d="M6 4v3M6 8.5v.5"
                                      stroke="#6366f1"
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                    />
                                  </svg>
                                  <Text
                                    size="xs"
                                    fw={500}
                                    style={{
                                      color: dark ? '#a5b4fc' : '#4338ca',
                                    }}
                                  >
                                    Minimal 2 artikel diperlukan untuk analisis
                                    komparatif.
                                  </Text>
                                </Box>
                              )}
                            {!comparativeLocked &&
                              comparativePendingIds.length >= 2 && (
                                <Box
                                  style={{
                                    padding: '7px 12px',
                                    borderRadius: 8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 7,
                                    backgroundColor: dark
                                      ? 'rgba(20,184,166,0.08)'
                                      : 'rgba(20,184,166,0.05)',
                                    border: `1px solid ${dark ? 'rgba(20,184,166,0.25)' : 'rgba(20,184,166,0.2)'}`,
                                  }}
                                >
                                  <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 12 12"
                                    fill="none"
                                  >
                                    <circle
                                      cx="6"
                                      cy="6"
                                      r="5"
                                      stroke="#14b8a6"
                                      strokeWidth="1.5"
                                    />
                                    <path
                                      d="M3.5 6l2 2 3-3"
                                      stroke="#14b8a6"
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                  <Text
                                    size="xs"
                                    fw={600}
                                    style={{ color: '#14b8a6' }}
                                  >
                                    {comparativePendingIds.length === 2
                                      ? 'Kedua'
                                      : `${comparativePendingIds.length}`}{' '}
                                    artikel siap untuk dianalisis.
                                  </Text>
                                </Box>
                              )}

                            {/* Daftar artikel (Locked Preview vs Normal List) */}
                            {comparativeLocked ? (
                              /* ── STEP 4: Tampilan Terkunci (Side-by-Side) ── */
                              <Box
                                style={{
                                  padding: '20px',
                                  borderRadius: 12,
                                  border: `2px dashed ${dark ? 'rgba(251,191,36,0.3)' : '#fde68a'}`,
                                  backgroundColor: dark
                                    ? 'rgba(251,191,36,0.04)'
                                    : 'rgba(251,191,36,0.02)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: 16,
                                }}
                              >
                                <Box
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    width: '100%',
                                  }}
                                >
                                  {(() => {
                                    const COLORS = ['#6366f1', '#14b8a6'];
                                    const selectedNodes = comparativePendingIds
                                      .map((id) =>
                                        nodes.find((n) => String(n.id) === id)
                                      )
                                      .filter(Boolean);

                                    return (
                                      <>
                                        {/* Article A */}
                                        <Box
                                          style={{
                                            flex: 1,
                                            padding: '12px',
                                            borderRadius: 10,
                                            backgroundColor: dark
                                              ? 'rgba(255,255,255,0.05)'
                                              : '#fff',
                                            border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                                            position: 'relative',
                                          }}
                                        >
                                          <Badge
                                            size="xs"
                                            color="indigo"
                                            variant="filled"
                                            style={{
                                              position: 'absolute',
                                              top: -10,
                                              left: 10,
                                            }}
                                          >
                                            File A
                                          </Badge>
                                          <Group gap="xs" wrap="nowrap">
                                            <ThemeIcon
                                              size="sm"
                                              variant="light"
                                              color="indigo"
                                            >
                                              <IconArticle size={14} />
                                            </ThemeIcon>
                                            <Text
                                              size="xs"
                                              fw={700}
                                              lineClamp={1}
                                              style={{ flex: 1 }}
                                            >
                                              {selectedNodes[0]?.title ||
                                                'Artikel A'}
                                            </Text>
                                            <Box style={{ opacity: 0.5 }}>
                                              <svg
                                                width="10"
                                                height="10"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2.5"
                                              >
                                                <rect
                                                  x="3"
                                                  y="11"
                                                  width="18"
                                                  height="11"
                                                  rx="2"
                                                  ry="2"
                                                />
                                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                              </svg>
                                            </Box>
                                          </Group>
                                        </Box>

                                        <Box style={{ opacity: 0.3 }}>
                                          <IconArrowsSplit2 size={16} />
                                        </Box>

                                        {/* Article B */}
                                        <Box
                                          style={{
                                            flex: 1,
                                            padding: '12px',
                                            borderRadius: 10,
                                            backgroundColor: dark
                                              ? 'rgba(255,255,255,0.05)'
                                              : '#fff',
                                            border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                                            position: 'relative',
                                          }}
                                        >
                                          <Badge
                                            size="xs"
                                            color="teal"
                                            variant="filled"
                                            style={{
                                              position: 'absolute',
                                              top: -10,
                                              left: 10,
                                            }}
                                          >
                                            File B
                                          </Badge>
                                          <Group gap="xs" wrap="nowrap">
                                            <ThemeIcon
                                              size="sm"
                                              variant="light"
                                              color="teal"
                                            >
                                              <IconArticle size={14} />
                                            </ThemeIcon>
                                            <Text
                                              size="xs"
                                              fw={700}
                                              lineClamp={1}
                                              style={{ flex: 1 }}
                                            >
                                              {selectedNodes[1]?.title ||
                                                'Artikel B'}
                                            </Text>
                                            <Box style={{ opacity: 0.5 }}>
                                              <svg
                                                width="10"
                                                height="10"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2.5"
                                              >
                                                <rect
                                                  x="3"
                                                  y="11"
                                                  width="18"
                                                  height="11"
                                                  rx="2"
                                                  ry="2"
                                                />
                                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                              </svg>
                                            </Box>
                                          </Group>
                                        </Box>
                                      </>
                                    );
                                  })()}
                                </Box>
                                <Box
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    opacity: 0.7,
                                  }}
                                >
                                  <Box style={{ fontSize: 14 }}>ℹ️</Box>
                                  <Text
                                    size="10px"
                                    fw={600}
                                    style={{
                                      color: dark ? '#fbbf24' : '#b45309',
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.04em',
                                    }}
                                  >
                                    Artikel terpilih dari relasi graf dan tidak
                                    dapat diubah
                                  </Text>
                                </Box>
                              </Box>
                            ) : (
                              /* ── NORMAL: Daftar artikel dengan tombol Tambah ── */
                              <Box
                                style={{
                                  borderRadius: 10,
                                  border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                                  backgroundColor: dark
                                    ? 'rgba(255,255,255,0.02)'
                                    : '#fafafa',
                                  overflow: 'hidden',
                                }}
                              >
                                {/* Search */}
                                <Box
                                  style={{
                                    padding: '8px 10px',
                                    borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}`,
                                  }}
                                >
                                  <Box
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      backgroundColor: dark
                                        ? 'rgba(255,255,255,0.05)'
                                        : '#fff',
                                      border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                                      borderRadius: 7,
                                      padding: '5px 10px',
                                    }}
                                  >
                                    <svg
                                      width="12"
                                      height="12"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      opacity={0.45}
                                    >
                                      <circle
                                        cx="11"
                                        cy="11"
                                        r="8"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                      />
                                      <path
                                        d="M21 21l-4.35-4.35"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                      />
                                    </svg>
                                    <input
                                      value={comparativeArticleSearch}
                                      onChange={(e) =>
                                        setComparativeArticleSearch(
                                          e.target.value
                                        )
                                      }
                                      placeholder="Cari artikel..."
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        outline: 'none',
                                        fontSize: 12,
                                        color: dark ? '#e2e8f0' : '#334155',
                                        width: '100%',
                                      }}
                                    />
                                  </Box>
                                </Box>
                                {/* List artikel */}
                                <Box
                                  style={{ maxHeight: 200, overflowY: 'auto' }}
                                >
                                  {(() => {
                                    const COLORS = [
                                      '#6366f1',
                                      '#14b8a6',
                                      '#f59e0b',
                                      '#ef4444',
                                      '#8b5cf6',
                                      '#ec4899',
                                    ];
                                    const LABELS = [
                                      'A',
                                      'B',
                                      'C',
                                      'D',
                                      'E',
                                      'F',
                                    ];
                                    const filtered = nodes.filter((n) => {
                                      const title = (
                                        n.title ??
                                        n.label ??
                                        ''
                                      ).toLowerCase();
                                      return title.includes(
                                        comparativeArticleSearch.toLowerCase()
                                      );
                                    });
                                    if (filtered.length === 0)
                                      return (
                                        <Box
                                          style={{
                                            padding: '16px',
                                            textAlign: 'center',
                                          }}
                                        >
                                          <Text size="xs" c="dimmed">
                                            Tidak ada artikel ditemukan
                                          </Text>
                                        </Box>
                                      );
                                    return filtered.map((node, idx) => {
                                      const nodeId = String(node.id);
                                      const isAdded =
                                        comparativePendingIds.includes(nodeId);
                                      const addedIdx =
                                        comparativePendingIds.indexOf(nodeId);
                                      const color = isAdded
                                        ? COLORS[addedIdx % COLORS.length]
                                        : dark
                                          ? '#475569'
                                          : '#94a3b8';
                                      const letter = isAdded
                                        ? (LABELS[addedIdx] ??
                                          String(addedIdx + 1))
                                        : null;
                                      const title = (node.title ??
                                        node.label ??
                                        `Artikel ${node.id}`) as string;
                                      return (
                                        <Box
                                          key={nodeId}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            padding: '8px 12px',
                                            borderBottom:
                                              idx < filtered.length - 1
                                                ? `1px solid ${dark ? 'rgba(255,255,255,0.04)' : '#f1f5f9'}`
                                                : 'none',
                                            transition: 'background 0.12s',
                                          }}
                                          onMouseEnter={(e) =>
                                            ((
                                              e.currentTarget as HTMLElement
                                            ).style.backgroundColor = dark
                                              ? 'rgba(255,255,255,0.03)'
                                              : '#f8fafc')
                                          }
                                          onMouseLeave={(e) =>
                                            ((
                                              e.currentTarget as HTMLElement
                                            ).style.backgroundColor =
                                              'transparent')
                                          }
                                        >
                                          {/* Badge huruf atau dot */}
                                          <Box
                                            style={{
                                              width: 22,
                                              height: 22,
                                              borderRadius: 4,
                                              flexShrink: 0,
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              backgroundColor: isAdded
                                                ? color
                                                : dark
                                                  ? 'rgba(255,255,255,0.06)'
                                                  : '#f1f5f9',
                                              color: isAdded
                                                ? '#fff'
                                                : dark
                                                  ? '#64748b'
                                                  : '#94a3b8',
                                              fontSize: 10,
                                              fontWeight: 800,
                                              transition: 'all 0.15s',
                                            }}
                                          >
                                            {isAdded ? (
                                              letter
                                            ) : (
                                              <svg
                                                width="6"
                                                height="6"
                                                viewBox="0 0 6 6"
                                                fill="currentColor"
                                              >
                                                <circle cx="3" cy="3" r="3" />
                                              </svg>
                                            )}
                                          </Box>
                                          <Text
                                            size="xs"
                                            fw={500}
                                            style={{
                                              flex: 1,
                                              color: dark
                                                ? '#cbd5e1'
                                                : '#334155',
                                              lineHeight: 1.35,
                                              wordBreak: 'break-word',
                                            }}
                                            lineClamp={2}
                                          >
                                            {title}
                                          </Text>
                                          {/* Tombol Tambah / Hapus */}
                                          {isAdded ? (
                                            <Box
                                              onClick={() =>
                                                setComparativePendingIds(
                                                  (prev) =>
                                                    prev.filter(
                                                      (i) => i !== nodeId
                                                    )
                                                )
                                              }
                                              style={{
                                                flexShrink: 0,
                                                padding: '3px 8px',
                                                borderRadius: 5,
                                                fontSize: 11,
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                border: `1px solid ${dark ? 'rgba(239,68,68,0.3)' : '#fecaca'}`,
                                                color: dark
                                                  ? '#f87171'
                                                  : '#dc2626',
                                                backgroundColor: dark
                                                  ? 'rgba(239,68,68,0.08)'
                                                  : 'rgba(239,68,68,0.05)',
                                                whiteSpace: 'nowrap',
                                              }}
                                            >
                                              Hapus
                                            </Box>
                                          ) : (
                                            <Box
                                              onClick={() =>
                                                setComparativePendingIds(
                                                  (prev) => [...prev, nodeId]
                                                )
                                              }
                                              style={{
                                                flexShrink: 0,
                                                padding: '3px 10px',
                                                borderRadius: 5,
                                                fontSize: 11,
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                border: `1px solid ${dark ? 'rgba(99,102,241,0.4)' : '#c7d2fe'}`,
                                                color: dark
                                                  ? '#a5b4fc'
                                                  : '#4338ca',
                                                backgroundColor: dark
                                                  ? 'rgba(99,102,241,0.08)'
                                                  : 'rgba(99,102,241,0.05)',
                                                whiteSpace: 'nowrap',
                                                transition: 'all 0.15s',
                                              }}
                                            >
                                              Tambah
                                            </Box>
                                          )}
                                        </Box>
                                      );
                                    });
                                  })()}
                                </Box>
                              </Box>
                            )}

                            {/* Info banner saat terkunci */}
                            {comparativeLocked && (
                              <Box
                                style={{
                                  padding: '10px 14px',
                                  borderRadius: 8,
                                  backgroundColor: dark
                                    ? 'rgba(99,102,241,0.06)'
                                    : '#f1f5f9',
                                  border: `1px solid ${dark ? 'rgba(99,102,241,0.1)' : '#e2e8f0'}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10,
                                }}
                              >
                                <Box style={{ fontSize: 16 }}>ℹ️</Box>
                                <Text
                                  size="11px"
                                  c="dimmed"
                                  style={{ lineHeight: 1.5 }}
                                >
                                  Artikel dipilih dari relasi dan tidak dapat
                                  diubah. Silakan{' '}
                                  <strong>checklist aspek analisis</strong> di
                                  bawah untuk melanjutkan.
                                </Text>
                              </Box>
                            )}

                            {/* Aspek Analisis Default */}
                            <Box
                              onMouseDown={(e) => e.stopPropagation()}
                              style={{
                                borderRadius: 10,
                                border: `1px solid ${dark ? 'rgba(99,102,241,0.22)' : 'rgba(99,102,241,0.18)'}`,
                                backgroundColor: dark
                                  ? 'rgba(99,102,241,0.05)'
                                  : 'rgba(99,102,241,0.03)',
                                overflow: 'hidden',
                              }}
                            >
                              <Box
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  padding: '10px 14px 8px',
                                  borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(99,102,241,0.12)'}`,
                                }}
                              >
                                <Text
                                  size="xs"
                                  fw={700}
                                  style={{
                                    letterSpacing: '0.06em',
                                    color: dark ? '#a5b4fc' : '#4338ca',
                                    flex: 1,
                                  }}
                                >
                                  Checklist Aspek Analisis
                                </Text>
                                <Text
                                  size="10px"
                                  style={{
                                    color: dark ? '#64748b' : '#94a3b8',
                                  }}
                                >
                                  {selectedAspects.length}/
                                  {availableAspects.length} dipilih
                                </Text>
                              </Box>
                              <Box style={{ padding: '6px 0 4px' }}>
                                {/* Default aspects */}
                                {availableAspects.map((aspect, idx) => {
                                  const isChecked = selectedAspects.includes(
                                    aspect.id
                                  );
                                  const totalLen = availableAspects.length;
                                  return (
                                    <Box
                                      key={aspect.id}
                                      onClick={() => toggleAspect(aspect.id)}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: '8px 14px',
                                        cursor: 'pointer',
                                        transition: 'background 0.15s',
                                        borderBottom:
                                          idx < totalLen - 1
                                            ? `1px solid ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}`
                                            : 'none',
                                        backgroundColor: isChecked
                                          ? dark
                                            ? `${aspect.color}12`
                                            : `${aspect.color}08`
                                          : 'transparent',
                                      }}
                                      onMouseEnter={(e) => {
                                        (
                                          e.currentTarget as HTMLElement
                                        ).style.backgroundColor = isChecked
                                          ? dark
                                            ? `${aspect.color}20`
                                            : `${aspect.color}12`
                                          : dark
                                            ? 'rgba(255,255,255,0.03)'
                                            : 'rgba(0,0,0,0.03)';
                                      }}
                                      onMouseLeave={(e) => {
                                        (
                                          e.currentTarget as HTMLElement
                                        ).style.backgroundColor = isChecked
                                          ? dark
                                            ? `${aspect.color}12`
                                            : `${aspect.color}08`
                                          : 'transparent';
                                      }}
                                    >
                                      <Box
                                        style={{
                                          width: 18,
                                          height: 18,
                                          borderRadius: 4,
                                          flexShrink: 0,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          border: `1.5px solid ${isChecked ? aspect.color : dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}`,
                                          backgroundColor: isChecked
                                            ? aspect.color
                                            : 'transparent',
                                          transition: 'all 0.15s ease',
                                        }}
                                      >
                                        {isChecked && (
                                          <svg
                                            width="10"
                                            height="10"
                                            viewBox="0 0 12 12"
                                            fill="none"
                                          >
                                            <path
                                              d="M2 6l3 3 5-5"
                                              stroke="#fff"
                                              strokeWidth="1.8"
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                            />
                                          </svg>
                                        )}
                                      </Box>
                                      <Box
                                        style={{
                                          width: 30,
                                          height: 30,
                                          borderRadius: 6,
                                          flexShrink: 0,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          backgroundColor: dark
                                            ? 'rgba(255,255,255,0.06)'
                                            : 'rgba(0,0,0,0.05)',
                                          fontSize: 14,
                                        }}
                                      >
                                        {aspect.icon}
                                      </Box>
                                      <Box style={{ flex: 1, minWidth: 0 }}>
                                        <Text
                                          size="xs"
                                          fw={isChecked ? 700 : 500}
                                          style={{
                                            color: isChecked
                                              ? dark
                                                ? '#e2e8f0'
                                                : '#1e293b'
                                              : dark
                                                ? '#94a3b8'
                                                : '#64748b',
                                            lineHeight: 1.3,
                                          }}
                                        >
                                          {aspect.label}
                                        </Text>
                                        <Text
                                          size="xs"
                                          style={{
                                            color: dark ? '#64748b' : '#94a3b8',
                                            fontSize: 10,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          {aspect.description}
                                        </Text>
                                      </Box>
                                    </Box>
                                  );
                                })}
                              </Box>
                            </Box>

                            {/* Tombol Mulai Analisis */}
                            {(() => {
                              const isLocked = isIndexing || hasIndexError;
                              const canStart =
                                !isLocked &&
                                comparativePendingIds.length >= 2 &&
                                selectedAspects.length > 0;
                              return (
                                <Box
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={() => {
                                    if (canStart) {
                                      runComparativeAnalysis(
                                        comparativePendingIds,
                                        comparativePendingRelation
                                      );
                                      setShowingNewSelector(false); // kembali ke tampilan tab
                                      setComparativePendingRelation(undefined); // reset setelah jalan
                                    }
                                  }}
                                  style={{
                                    padding: '10px 18px',
                                    borderRadius: 8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    cursor: canStart
                                      ? 'pointer'
                                      : 'not-allowed',
                                    opacity: canStart ? 1 : 0.4,
                                    background: canStart
                                      ? 'linear-gradient(135deg, #6366f1, #14b8a6)'
                                      : dark
                                        ? 'rgba(255,255,255,0.05)'
                                        : '#f1f5f9',
                                    color: canStart
                                      ? '#fff'
                                      : dark
                                        ? '#64748b'
                                        : '#9ca3af',
                                    fontWeight: 700,
                                    fontSize: 13,
                                    letterSpacing: '0.04em',
                                    transition: 'all 0.2s ease',
                                    boxShadow: canStart
                                      ? '0 4px 16px rgba(99,102,241,0.35)'
                                      : 'none',
                                  }}
                                >
                                  <IconArrowsSplit2 size={16} />
                                  Mulai Analisis Komparatif
                                  {canStart && (
                                    <Badge
                                      size="xs"
                                      color="white"
                                      variant="filled"
                                      radius="sm"
                                      style={{ color: '#6366f1' }}
                                    >
                                      {comparativePendingIds.length}
                                    </Badge>
                                  )}
                                </Box>
                              );
                            })()}

                            {(comparativePendingIds.length < 2 ||
                              selectedAspects.length === 0) && (
                              <Text size="xs" c="dimmed" ta="center">
                                {comparativePendingIds.length < 2 &&
                                selectedAspects.length === 0
                                  ? 'Pilih minimal 2 artikel dan 1 aspek analisis'
                                  : comparativePendingIds.length < 2
                                    ? 'Pilih minimal 2 artikel untuk memulai perbandingan'
                                    : 'Pilih minimal 1 aspek analisis'}
                              </Text>
                            )}

                            {comparativePendingIds.length === 0 && (
                              <Box
                                style={{
                                  padding: '12px 16px',
                                  borderRadius: 8,
                                  backgroundColor: dark
                                    ? 'rgba(99,102,241,0.06)'
                                    : 'rgba(99,102,241,0.04)',
                                  border: `1px solid ${dark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)'}`,
                                  textAlign: 'center',
                                }}
                              >
                                <Text
                                  size="xs"
                                  c="dimmed"
                                  style={{ lineHeight: 1.6 }}
                                >
                                  ðŸ’¡ Klik panah <strong>(â†’)</strong> pada
                                  graf lalu tekan{' '}
                                  <strong>
                                    &quot;Bandingkan Mendalam&quot;
                                  </strong>{' '}
                                  untuk otomatis memulai analisis, atau pilih
                                  manual di atas.
                                </Text>
                              </Box>
                            )}
                          </Box>
                        </ScrollArea>
                      )}

                      {/* ── Dialog Konfirmasi Tutup Tab Loading ── */}
                      <Modal
                        opened={!!closeLoadingTabConfirm}
                        onClose={() => setCloseLoadingTabConfirm(null)}
                        withCloseButton={false}
                        centered
                        size={380}
                        radius="lg"
                        padding={0}
                        styles={{
                          content: {
                            backgroundColor: dark ? '#12131a' : '#fff',
                            border: `1px solid ${dark ? 'rgba(245,158,11,0.25)' : '#fde68a'}`,
                            overflow: 'hidden',
                          },
                          overlay: { backdropFilter: 'blur(4px)' },
                        }}
                      >
                        {closeLoadingTabConfirm &&
                          (() => {
                            const tab = analysisTabs.find(
                              (t) => t.id === closeLoadingTabConfirm
                            );
                            return (
                              <Box>
                                <Box
                                  style={{
                                    padding: '16px 20px 12px',
                                    background: dark
                                      ? 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, transparent 100%)'
                                      : 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, transparent 100%)',
                                    borderBottom: `1px solid ${dark ? 'rgba(245,158,11,0.15)' : '#fde68a'}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                  }}
                                >
                                  <Box style={{ fontSize: 18 }}>âš ï¸</Box>
                                  <Text
                                    fw={700}
                                    size="sm"
                                    style={{
                                      color: dark ? '#fbbf24' : '#b45309',
                                    }}
                                  >
                                    Tutup Tab yang Sedang Loading?
                                  </Text>
                                </Box>
                                <Box style={{ padding: '16px 20px 20px' }}>
                                  <Text
                                    size="sm"
                                    c="dimmed"
                                    mb="lg"
                                    style={{ lineHeight: 1.6 }}
                                  >
                                    Analisis{' '}
                                    <strong>&quot;{tab?.label}&quot;</strong>{' '}
                                    masih dalam proses loading. Anda yakin ingin
                                    menutup tab ini?
                                  </Text>
                                  <Box
                                    style={{
                                      display: 'flex',
                                      gap: 8,
                                      justifyContent: 'flex-end',
                                    }}
                                  >
                                    <Box
                                      onClick={() =>
                                        setCloseLoadingTabConfirm(null)
                                      }
                                      style={{
                                        padding: '7px 16px',
                                        borderRadius: 7,
                                        cursor: 'pointer',
                                        border: `1px solid ${dark ? 'rgba(255,255,255,0.12)' : '#e2e8f0'}`,
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: dark ? '#94a3b8' : '#64748b',
                                      }}
                                    >
                                      Batal
                                    </Box>
                                    <Box
                                      onClick={() =>
                                        confirmCloseLoadingTab(
                                          closeLoadingTabConfirm
                                        )
                                      }
                                      style={{
                                        padding: '7px 16px',
                                        borderRadius: 7,
                                        cursor: 'pointer',
                                        background:
                                          'linear-gradient(135deg, #ef4444, #dc2626)',
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: '#fff',
                                        boxShadow:
                                          '0 2px 8px rgba(239,68,68,0.3)',
                                      }}
                                    >
                                      Ya, Tutup
                                    </Box>
                                  </Box>
                                </Box>
                              </Box>
                            );
                          })()}
                      </Modal>
                    </Box>
                  )}
                </Box>
              </Box>{' '}
              {/* end GRAPH + TABLE AREA */}
            </Box>{' '}
            {/* end MAIN CONTENT AREA */}
            {/* ── SECONDARY SIDEBAR: AI Chat (slides in from right, resizable) ── */}
            {chatPanelFullscreen && (
              /* Fullscreen overlay backdrop */
              <Box
                onClick={() => setChatPanelFullscreen(false)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 199,
                  backgroundColor: 'rgba(0,0,0,0.45)',
                  backdropFilter: 'blur(3px)',
                }}
              />
            )}
            <Box
              style={{
                width: chatSidebarOpen
                  ? chatPanelFullscreen
                    ? '100vw'
                    : chatPanelWidth
                  : 0,
                minWidth: chatSidebarOpen
                  ? chatPanelFullscreen
                    ? '100vw'
                    : chatPanelWidth
                  : 0,
                maxWidth: chatSidebarOpen
                  ? chatPanelFullscreen
                    ? '100vw'
                    : chatPanelWidth
                  : 0,
                overflow: 'hidden',
                transition: isDraggingChat.current
                  ? 'none'
                  : 'width 0.28s cubic-bezier(0.4,0,0.2,1), min-width 0.28s cubic-bezier(0.4,0,0.2,1), max-width 0.28s cubic-bezier(0.4,0,0.2,1)',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                position: chatPanelFullscreen ? 'fixed' : 'relative',
                top: chatPanelFullscreen ? 0 : undefined,
                right: chatPanelFullscreen ? 0 : undefined,
                bottom: chatPanelFullscreen ? 0 : undefined,
                zIndex: chatPanelFullscreen ? 200 : undefined,
              }}
            >
              {/* Left drag-resize handle */}
              {chatSidebarOpen && !chatPanelFullscreen && (
                <Box
                  onMouseDown={handleChatDragStart}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 6,
                    cursor: 'col-resize',
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'transparent',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      dark ? 'rgba(99,102,241,0.35)' : 'rgba(99,102,241,0.2)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      'transparent';
                  }}
                >
                  {/* Grip dots */}
                  <Box
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                      alignItems: 'center',
                    }}
                  >
                    {[0, 1, 2, 3].map((i) => (
                      <Box
                        key={i}
                        style={{
                          width: 3,
                          height: 3,
                          borderRadius: '50%',
                          backgroundColor: dark
                            ? 'rgba(165,180,252,0.55)'
                            : 'rgba(99,102,241,0.45)',
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {/* Inner wrapper so content doesn't squish during animation */}
              <Box
                style={{
                  width: chatPanelFullscreen ? '100%' : chatPanelWidth,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: dark ? 'rgba(18,19,26,0.97)' : '#fff',
                  border: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
                  borderRadius: chatPanelFullscreen ? 0 : 14,
                  backdropFilter: 'blur(16px)',
                  overflow: 'hidden',
                  opacity: chatSidebarOpen ? 1 : 0,
                  transition: 'opacity 0.2s ease 0.06s',
                }}
              >
                {/* ─ Header ─ */}
                <Box
                  style={{
                    padding: '10px 14px 9px',
                    borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}`,
                    background: dark
                      ? 'linear-gradient(135deg, rgba(109,40,217,0.12) 0%, rgba(18,19,26,0) 100%)'
                      : 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(255,255,255,0) 100%)',
                    flexShrink: 0,
                  }}
                >
                  <Box
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      gap: 8,
                    }}
                  >
                    <Menu
                      shadow="md"
                      width={220}
                      position="bottom-start"
                      withinPortal
                    >
                      <Menu.Target>
                        <Button
                          variant={dark ? 'subtle' : 'light'}
                          color={
                            activeTab === 'chat'
                              ? 'indigo'
                              : activeTab === 'annotation'
                                ? 'orange'
                                : activeTab === 'relation'
                                  ? 'teal'
                                  : 'blue'
                          }
                          size="xs"
                          radius="md"
                          leftSection={
                            activeTab === 'chat' ? (
                              <IconMessage size={14} />
                            ) : activeTab === 'annotation' ? (
                              <IconHighlight size={14} />
                            ) : activeTab === 'relation' ? (
                              <IconNetwork size={14} />
                            ) : (
                              <IconArticle size={14} />
                            )
                          }
                          rightSection={<IconChevronDown size={14} />}
                          styles={{
                            root: {
                              border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                              backgroundColor: dark
                                ? 'rgba(255,255,255,0.06)'
                                : '#f8fafc',
                              fontWeight: 600,
                            },
                          }}
                        >
                          {activeTab === 'chat'
                            ? 'Chat AI'
                            : activeTab === 'annotation'
                              ? 'Catatan'
                              : activeTab === 'relation'
                                ? 'Ringkasan Relasi'
                                : activeTab === 'ca-history'
                                  ? 'Riwayat Analisis'
                                  : 'Detail Artikel'}
                        </Button>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<IconNetwork size={16} />}
                          rightSection={
                            activeTab === 'relation' ? (
                              <IconCheck size={14} />
                            ) : null
                          }
                          onClick={() => setActiveTab('relation')}
                        >
                          Ringkasan Relasi
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconArticle size={16} />}
                          rightSection={
                            activeTab === 'detail' ? (
                              <IconCheck size={14} />
                            ) : null
                          }
                          onClick={() => setActiveTab('detail')}
                        >
                          Detail Artikel
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconMessage size={16} />}
                          rightSection={
                            activeTab === 'chat' ? (
                              <IconCheck size={14} />
                            ) : null
                          }
                          onClick={() => setActiveTab('chat')}
                        >
                          Chat AI
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconHighlight size={16} />}
                          rightSection={
                            activeTab === 'annotation' ? (
                              <IconCheck size={14} />
                            ) : null
                          }
                          onClick={() => setActiveTab('annotation')}
                        >
                          Catatan
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconHistory size={16} />}
                          rightSection={
                            activeTab === 'ca-history' ? (
                              <IconCheck size={14} />
                            ) : null
                          }
                          onClick={() => setActiveTab('ca-history')}
                        >
                          Riwayat Analisis
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>

                    <Box style={{ flex: 1, minWidth: 0 }} />

                    {/* Fullscreen + close buttons - right */}
                    <Group gap={4} style={{ flexShrink: 0 }}>
                      {activeTab === 'chat' && (
                        <Popover
                          opened={chatHistoryPopoverOpened}
                          onChange={setChatHistoryPopoverOpened}
                          position="bottom-end"
                          width={320}
                          withinPortal
                          shadow="md"
                        >
                          <Popover.Target>
                            <Tooltip
                              label="Riwayat chat"
                              position="bottom"
                              withArrow
                            >
                              <ActionIcon
                                variant="subtle"
                                color="indigo"
                                size={24}
                                radius="xl"
                                onClick={() =>
                                  setChatHistoryPopoverOpened((opened) => !opened)
                                }
                              >
                                <IconHistory size={14} />
                              </ActionIcon>
                            </Tooltip>
                          </Popover.Target>
                          <Popover.Dropdown p={10}>
                            <Stack gap={10}>
                              <Button
                                size="xs"
                                radius="md"
                                leftSection={<IconPlus size={14} />}
                                loading={creatingChatSession}
                                onClick={handleCreateChatSession}
                                styles={{
                                  root: {
                                    justifyContent: 'flex-start',
                                  },
                                }}
                              >
                                New chat
                              </Button>

                              <Divider />

                              {chatSessionsLoading ? (
                                <Group gap={8} justify="center" py="sm">
                                  <Loader size="sm" />
                                  <Text size="sm" c="dimmed">
                                    Memuat riwayat chat...
                                  </Text>
                                </Group>
                              ) : chatSessionsError ? (
                                <Paper
                                  radius="md"
                                  p="sm"
                                  withBorder
                                  style={{
                                    background: dark
                                      ? 'rgba(127, 29, 29, 0.12)'
                                      : '#fff5f5',
                                    borderColor: dark
                                      ? 'rgba(248, 113, 113, 0.24)'
                                      : '#fecaca',
                                  }}
                                >
                                  <Text size="sm" fw={600} c="red.7">
                                    Riwayat chat belum bisa dimuat
                                  </Text>
                                  <Text size="xs" c="dimmed" mt={4}>
                                    {chatSessionsError}
                                  </Text>
                                  <Button
                                    mt="sm"
                                    size="xs"
                                    radius="md"
                                    variant="light"
                                    onClick={() =>
                                      void loadChatSessions({ silent: true })
                                    }
                                  >
                                    Coba lagi
                                  </Button>
                                </Paper>
                              ) : chatSessions.length === 0 ? (
                                <Paper
                                  radius="md"
                                  p="sm"
                                  withBorder
                                  style={{
                                    background: dark
                                      ? 'rgba(255,255,255,0.03)'
                                      : '#f8fafc',
                                  }}
                                >
                                  <Text size="sm" fw={600}>
                                    Belum ada riwayat chat
                                  </Text>
                                  <Text size="xs" c="dimmed" mt={4}>
                                    Gunakan tombol New chat untuk membuat
                                    thread pertama.
                                  </Text>
                                </Paper>
                              ) : (
                                <ScrollArea.Autosize mah={280} type="scroll">
                                  <Stack gap={8}>
                                    {chatSessions.map((session) => (
                                      <Paper
                                        key={session.id}
                                        radius="md"
                                        p="sm"
                                        withBorder
                                        onClick={() => void handleChatSelect(session.id)}
                                        style={{
                                          cursor: switchingChatSession
                                            ? 'progress'
                                            : 'pointer',
                                          background: dark
                                            ? session.id === activeChatSessionId
                                              ? 'rgba(99,102,241,0.14)'
                                              : 'rgba(255,255,255,0.03)'
                                            : session.id === activeChatSessionId
                                              ? 'rgba(99,102,241,0.08)'
                                              : '#ffffff',
                                          borderColor: dark
                                            ? session.id === activeChatSessionId
                                              ? 'rgba(129,140,248,0.45)'
                                              : 'rgba(255,255,255,0.08)'
                                            : session.id === activeChatSessionId
                                              ? '#a5b4fc'
                                              : '#e2e8f0',
                                          opacity:
                                            switchingChatSession &&
                                            session.id !== activeChatSessionId
                                              ? 0.75
                                              : 1,
                                          transition:
                                            'background-color 0.18s ease, border-color 0.18s ease',
                                        }}
                                      >
                                        <Group
                                          justify="space-between"
                                          align="flex-start"
                                          wrap="nowrap"
                                          gap={8}
                                        >
                                          <Box style={{ minWidth: 0, flex: 1 }}>
                                            <Text
                                              size="sm"
                                              fw={600}
                                              lineClamp={1}
                                            >
                                              {session.title}
                                            </Text>
                                            <Text
                                              size="xs"
                                              c="dimmed"
                                              mt={4}
                                              lineClamp={2}
                                            >
                                              {session.lastPreview ||
                                                'Belum ada preview jawaban.'}
                                            </Text>
                                          </Box>
                                          {session.mode ? (
                                            <Badge
                                              size="xs"
                                              variant="light"
                                              color={
                                                session.mode === 'RESEARCH'
                                                  ? 'teal'
                                                  : 'gray'
                                              }
                                          >
                                            {session.mode}
                                          </Badge>
                                          ) : null}
                                        </Group>
                                        {session.id === activeChatSessionId && (
                                          <Text
                                            size="xs"
                                            fw={600}
                                            mt={6}
                                            c={dark ? 'indigo.2' : 'indigo.7'}
                                          >
                                            Thread aktif
                                          </Text>
                                        )}
                                        <Text size="xs" c="dimmed" mt={8}>
                                          {formatChatSessionTimestamp(
                                            session.lastActivity
                                          )}
                                        </Text>
                                      </Paper>
                                    ))}
                                  </Stack>
                                </ScrollArea.Autosize>
                              )}
                            </Stack>
                          </Popover.Dropdown>
                        </Popover>
                      )}

                      {/* Fullscreen toggle */}
                      <Tooltip
                        label={chatPanelFullscreen ? 'Restore' : 'Fullscreen'}
                        position="bottom"
                        withArrow
                      >
                        <ActionIcon
                          variant="subtle"
                          color="indigo"
                          size={24}
                          radius="xl"
                          onClick={() => setChatPanelFullscreen((f) => !f)}
                          style={{ transition: 'all 0.18s' }}
                        >
                          {chatPanelFullscreen ? (
                            /* Restore icon */
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 12 12"
                              fill="none"
                            >
                              <rect
                                x="1"
                                y="3"
                                width="8"
                                height="8"
                                rx="1"
                                stroke="currentColor"
                                strokeWidth="1.4"
                              />
                              <path
                                d="M4 3V2a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1h-1"
                                stroke="currentColor"
                                strokeWidth="1.4"
                              />
                            </svg>
                          ) : (
                            /* Maximize icon */
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 12 12"
                              fill="none"
                            >
                              <rect
                                x="1"
                                y="1"
                                width="10"
                                height="10"
                                rx="1.5"
                                stroke="currentColor"
                                strokeWidth="1.4"
                              />
                              <path
                                d="M4 1v2.5H1.5"
                                stroke="currentColor"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                              />
                              <path
                                d="M8 1v2.5H10.5"
                                stroke="currentColor"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                              />
                              <path
                                d="M4 11V8.5H1.5"
                                stroke="currentColor"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                              />
                              <path
                                d="M8 11V8.5H10.5"
                                stroke="currentColor"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                              />
                            </svg>
                          )}
                        </ActionIcon>
                      </Tooltip>

                      {/* X close button */}
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size={24}
                        radius="xl"
                        onClick={() => {
                          setChatSidebarOpen(false);
                          setChatPanelFullscreen(false);
                        }}
                      >
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 12 12"
                          fill="none"
                        >
                          <path
                            d="M1 1l10 10M11 1L1 11"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                          />
                        </svg>
                      </ActionIcon>
                    </Group>
                  </Box>
                </Box>

                {/* ─ Chat/Annotation Content ─ */}
                <Box style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                  {activeTab === 'chat' ? (
                    <ChatPanel
                      selectedNode={selectedNode}
                      selectedEdge={selectedEdge}
                      projectId={projectId}
                      activeChatSessionId={activeChatSessionId}
                      onThreadActivity={() =>
                        loadChatSessions({ silent: true }).then(() => undefined)
                      }
                      availableContextNodes={filteredNodes}
                      resetContext={resetChatContext}
                      onContextReset={handleContextReset}
                      onSaveNote={handleSaveNoteFromArticle}
                      disabled={isIndexing || hasIndexError}
                    />
                  ) : activeTab === 'annotation' ? (
                    <AnnotationPanel
                      projectId={projectId}
                      session={session}
                      refreshKey={annotationRefreshKey}
                      defaultTab={annotationTab}
                    />
                  ) : activeTab === 'ca-history' ? (
                    /* ── TAB: Riwayat Analisis Komparatif ── */
                    <Box
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                      }}
                    >
                      {/* Search and Filter */}
                      <Box p="md" pb="sm" style={{ flexShrink: 0 }}>
                        <Group wrap="nowrap" gap="sm">
                          <TextInput
                            placeholder="Cari riwayat analisis..."
                            leftSection={<IconSearch size={16} />}
                            style={{ flex: 1 }}
                            radius="md"
                            styles={{
                              input: {
                                backgroundColor: dark
                                  ? 'rgba(255,255,255,0.02)'
                                  : '#f8fafc',
                                border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                              },
                            }}
                          />
                          <ActionIcon
                            size="input-sm"
                            variant="default"
                            radius="md"
                            style={{
                              width: 36,
                              height: 36,
                              backgroundColor: dark
                                ? 'rgba(255,255,255,0.02)'
                                : '#f8fafc',
                              border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                            }}
                          >
                            <img
                              src="/images/send_icon.webp"
                              alt="Send"
                              style={{
                                width: 18,
                                height: 18,
                                objectFit: 'contain',
                              }}
                            />
                          </ActionIcon>
                        </Group>
                      </Box>

                      <ScrollArea h="100%" style={{ flex: 1 }}>
                        <Box px="md" pb="md">
                          {analysisTabs.length === 0 ? (
                            <Paper
                              withBorder
                              p="md"
                              mt="md"
                              radius="md"
                              style={{
                                backgroundColor: dark
                                  ? 'rgba(255,255,255,0.02)'
                                  : '#f8fafc',
                                borderStyle: 'dashed',
                              }}
                            >
                              <Text size="sm" c="dimmed" ta="center">
                                Belum ada riwayat analisis untuk sesi ini.
                              </Text>
                            </Paper>
                          ) : (
                            <>
                              {/* TERAKHIR DIBUKA */}
                              {activeAnalysisTabId && (
                                <Box mb="xl">
                                  <Text
                                    size="11px"
                                    fw={800}
                                    c="dimmed"
                                    mb="sm"
                                    style={{ letterSpacing: '0.05em' }}
                                  >
                                    ─ TERAKHIR DIBUKA
                                  </Text>
                                  {analysisTabs
                                    .filter((t) => t.id === activeAnalysisTabId)
                                    .map((tab, idx) => (
                                      <Box
                                        key={tab.id}
                                        onClick={() => {
                                          setAnalysisTabs((prev) =>
                                            prev.map((t) =>
                                              t.id === tab.id
                                                ? { ...t, isOpen: true }
                                                : t
                                            )
                                          );
                                          setActiveAnalysisTabId(tab.id);
                                          setTableViewTab('comparative');
                                          setViewMode('detail');
                                          setShowingNewSelector(false);
                                        }}
                                        style={{
                                          position: 'relative',
                                          padding: '12px 16px',
                                          borderRadius: 12,
                                          cursor: 'pointer',
                                          backgroundColor: dark
                                            ? 'rgba(30, 41, 59, 0.3)'
                                            : '#fff',
                                          border: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}`,
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 16,
                                          transition: 'background-color 0.2s',
                                        }}
                                        onMouseEnter={(e) => {
                                          (
                                            e.currentTarget as HTMLElement
                                          ).style.backgroundColor = dark
                                            ? 'rgba(30, 41, 59, 0.6)'
                                            : '#f8fafc';
                                        }}
                                        onMouseLeave={(e) => {
                                          (
                                            e.currentTarget as HTMLElement
                                          ).style.backgroundColor = dark
                                            ? 'rgba(30, 41, 59, 0.3)'
                                            : '#fff';
                                        }}
                                      >
                                        {/* Aktif Saat Ini Badge */}
                                        <Badge
                                          size="sm"
                                          radius="sm"
                                          color="cyan"
                                          variant="filled"
                                          style={{
                                            position: 'absolute',
                                            top: -10,
                                            right: 12,
                                            fontSize: '9px',
                                            textTransform: 'none',
                                            fontWeight: 600,
                                            backgroundColor: dark
                                              ? '#0284c7'
                                              : '#0ea5e9',
                                          }}
                                        >
                                          Aktif Saat Ini
                                        </Badge>

                                        <Box
                                          style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 8,
                                            backgroundColor: dark
                                              ? '#064e3b'
                                              : '#ccfbf1',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                          }}
                                        >
                                          <Text
                                            fw={700}
                                            style={{
                                              color: dark
                                                ? '#34d399'
                                                : '#0f766e',
                                            }}
                                          >
                                            {1}
                                          </Text>
                                        </Box>

                                        <Box style={{ flex: 1, minWidth: 0 }}>
                                          <Text
                                            size="sm"
                                            fw={600}
                                            truncate
                                            style={{
                                              color: dark
                                                ? '#cbd5e1'
                                                : '#334155',
                                            }}
                                          >
                                            {tab.label}
                                          </Text>
                                          <Text size="xs" c="dimmed" mt={4}>
                                            {tab.createdAt
                                              ? new Date(
                                                  tab.createdAt
                                                ).toLocaleDateString('id-ID', {
                                                  day: '2-digit',
                                                  month: 'short',
                                                  year: 'numeric',
                                                })
                                              : '-'}
                                            ,{' '}
                                            {tab.createdAt
                                              ? new Date(
                                                  tab.createdAt
                                                ).toLocaleTimeString('id-ID', {
                                                  hour: '2-digit',
                                                  minute: '2-digit',
                                                })
                                              : '-'}
                                          </Text>
                                          <Group gap="xs" mt={6}>
                                            <Badge
                                              size="xs"
                                              radius="sm"
                                              color="teal"
                                              variant={
                                                dark ? 'light' : 'outline'
                                              }
                                              style={{ textTransform: 'none' }}
                                            >
                                              {tab.nodeIds?.length || 0} File
                                            </Badge>
                                            <Badge
                                              size="xs"
                                              radius="sm"
                                              color="indigo"
                                              variant={
                                                dark ? 'light' : 'outline'
                                              }
                                              style={{ textTransform: 'none' }}
                                            >
                                              {tab.aspects?.length || 0} Aspek
                                            </Badge>
                                          </Group>
                                        </Box>

                                        <Group
                                          gap={4}
                                          style={{ flexShrink: 0 }}
                                        >
                                          <ActionIcon
                                            size="sm"
                                            variant="subtle"
                                            color="gray"
                                          >
                                            <IconPlayerPlay size={16} />
                                          </ActionIcon>
                                          <ActionIcon
                                            size="sm"
                                            variant="subtle"
                                            color="red"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleCloseTab(tab.id);
                                            }}
                                          >
                                            <IconTrash size={16} />
                                          </ActionIcon>
                                        </Group>
                                      </Box>
                                    ))}
                                </Box>
                              )}

                              {/* SEMUA RIWAYAT */}
                              <Box>
                                <Text
                                  size="11px"
                                  fw={800}
                                  c="dimmed"
                                  mb="sm"
                                  style={{ letterSpacing: '0.05em' }}
                                >
                                  ─ SEMUA RIWAYAT
                                </Text>
                                <Stack gap="sm">
                                  {analysisTabs
                                    .filter((t) => t.id !== activeAnalysisTabId)
                                    .map((tab, idx) => {
                                      const paletteColors = [
                                        {
                                          bg: dark ? '#064e3b' : '#ccfbf1',
                                          text: dark ? '#34d399' : '#0f766e',
                                        },
                                        {
                                          bg: dark ? '#1e3a8a' : '#e0e7ff',
                                          text: dark ? '#93c5fd' : '#3730a3',
                                        },
                                        {
                                          bg: dark ? '#451a03' : '#fef3c7',
                                          text: dark ? '#fbbf24' : '#b45309',
                                        },
                                        {
                                          bg: dark ? '#4a044e' : '#fae8ff',
                                          text: dark ? '#e879f9' : '#86198f',
                                        },
                                        {
                                          bg: dark ? '#3b0764' : '#fce7f3',
                                          text: dark ? '#f0abfc' : '#a21caf',
                                        },
                                      ];
                                      const colorIdx =
                                        idx % paletteColors.length;
                                      const pColor = paletteColors[colorIdx];

                                      return (
                                        <Box
                                          key={tab.id}
                                          onClick={() => {
                                            setAnalysisTabs((prev) =>
                                              prev.map((t) =>
                                                t.id === tab.id
                                                  ? { ...t, isOpen: true }
                                                  : t
                                              )
                                            );
                                            setActiveAnalysisTabId(tab.id);
                                            setTableViewTab('comparative');
                                            setViewMode('detail');
                                            setShowingNewSelector(false);
                                          }}
                                          style={{
                                            padding: '12px 16px',
                                            borderRadius: 12,
                                            cursor: 'pointer',
                                            backgroundColor: dark
                                              ? 'rgba(30, 41, 59, 0.3)'
                                              : '#fff',
                                            border: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 16,
                                            transition: 'background-color 0.2s',
                                          }}
                                          onMouseEnter={(e) => {
                                            (
                                              e.currentTarget as HTMLElement
                                            ).style.backgroundColor = dark
                                              ? 'rgba(30, 41, 59, 0.6)'
                                              : '#f8fafc';
                                          }}
                                          onMouseLeave={(e) => {
                                            (
                                              e.currentTarget as HTMLElement
                                            ).style.backgroundColor = dark
                                              ? 'rgba(30, 41, 59, 0.3)'
                                              : '#fff';
                                          }}
                                        >
                                          <Box
                                            style={{
                                              width: 40,
                                              height: 40,
                                              borderRadius: 8,
                                              backgroundColor: pColor.bg,
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              flexShrink: 0,
                                            }}
                                          >
                                            <Text
                                              fw={700}
                                              style={{ color: pColor.text }}
                                            >
                                              {idx + 2}
                                            </Text>
                                          </Box>

                                          <Box style={{ flex: 1, minWidth: 0 }}>
                                            <Text
                                              size="sm"
                                              fw={600}
                                              truncate
                                              style={{
                                                color: dark
                                                  ? '#cbd5e1'
                                                  : '#334155',
                                              }}
                                            >
                                              {tab.label}
                                            </Text>
                                            <Text size="xs" c="dimmed" mt={4}>
                                              {new Date(
                                                tab.createdAt
                                              ).toLocaleDateString('id-ID', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric',
                                              })}
                                              ,{' '}
                                              {new Date(
                                                tab.createdAt
                                              ).toLocaleTimeString('id-ID', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                              })}
                                            </Text>
                                            <Group gap="xs" mt={6}>
                                              <Badge
                                                size="xs"
                                                radius="sm"
                                                color="teal"
                                                variant={
                                                  dark ? 'light' : 'outline'
                                                }
                                                style={{
                                                  textTransform: 'none',
                                                }}
                                              >
                                                {tab.nodeIds?.length || 0} File
                                              </Badge>
                                              <Badge
                                                size="xs"
                                                radius="sm"
                                                color="indigo"
                                                variant={
                                                  dark ? 'light' : 'outline'
                                                }
                                                style={{
                                                  textTransform: 'none',
                                                }}
                                              >
                                                {tab.aspects?.length || 0} Aspek
                                              </Badge>
                                            </Group>
                                          </Box>

                                          <Group
                                            gap={4}
                                            style={{ flexShrink: 0 }}
                                          >
                                            <ActionIcon
                                              size="sm"
                                              variant="subtle"
                                              color="gray"
                                            >
                                              <IconPlayerPlay size={16} />
                                            </ActionIcon>
                                            <ActionIcon
                                              size="sm"
                                              variant="subtle"
                                              color="red"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleCloseTab(tab.id);
                                              }}
                                            >
                                              <IconTrash size={16} />
                                            </ActionIcon>
                                          </Group>
                                        </Box>
                                      );
                                    })}
                                </Stack>
                              </Box>
                            </>
                          )}
                        </Box>
                      </ScrollArea>
                    </Box>
                  ) : activeTab === 'relation' ? (
                    /* ── TAB: Ringkasan Relasi ── */
                    <ScrollArea h="100%">
                      {detailModalEdge ? (
                        <Box p="md">
                          <>
                            {/* Header Relasi */}
                            <Box
                              style={{
                                padding: '12px 16px',
                                borderRadius: 10,
                                background: dark
                                  ? 'linear-gradient(135deg, rgba(20,184,166,0.12) 0%, rgba(18,19,26,0) 100%)'
                                  : 'linear-gradient(135deg, rgba(20,184,166,0.08) 0%, rgba(255,255,255,0) 100%)',
                                border: `1px solid ${dark ? 'rgba(20,184,166,0.2)' : 'rgba(20,184,166,0.15)'}`,
                                marginBottom: 16,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                              }}
                            >
                              <ThemeIcon
                                size="lg"
                                variant="light"
                                color="teal"
                                radius="md"
                              >
                                <IconNetwork size={18} />
                              </ThemeIcon>
                              <Box>
                                <Text
                                  size="xs"
                                  fw={800}
                                  style={{
                                    letterSpacing: '0.08em',
                                    color: dark ? '#5eead4' : '#0d9488',
                                  }}
                                >
                                  RINGKASAN RELASI
                                </Text>
                                <Text
                                  size="sm"
                                  fw={600}
                                  style={{
                                    color: dark ? '#e2e8f0' : '#1e293b',
                                  }}
                                >
                                  {getRelationDisplayName(
                                    getDisplayRelationKey(
                                      detailModalEdge?.relation ?? ''
                                    )
                                  )}
                                </Text>
                              </Box>
                            </Box>

                            {/* EdgeDetail Component */}
                            <EdgeDetail
                              edge={detailModalEdge}
                              onSaveNote={handleSaveNoteFromAnalysis}
                              onClose={() => {
                                setDetailModalEdge(null);
                                setActiveTab('chat');
                              }}
                              onOpenNodeDetail={(nodeId) => {
                                const node = nodes.find(
                                  (n) => String(n.id) === nodeId
                                );
                                if (node) {
                                  setSelectedNode(node);
                                  setActiveTab('detail');
                                }
                              }}
                              onDeepCompare={(nodeIds) => {
                                // Step 4: Workspace Analisis terbuka -> 2 artikel sudah otomatis terdaftar & terkunci
                                setComparativePendingIds(nodeIds);
                                setComparativeLocked(true);
                                setComparativePendingRelation(
                                  detailModalEdge?.relation
                                ); // Simpan relasi untuk analisis nanti
                                setTableViewTab('comparative');
                                setViewMode('detail');
                                setTableMaximized(true);
                                setShowingNewSelector(true);
                              }}
                            />
                          </>
                        </Box>
                      ) : (
                        <Box
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            padding: '2rem',
                            textAlign: 'center',
                            gap: 12,
                          }}
                        >
                          <ThemeIcon
                            size={64}
                            radius="xl"
                            variant="light"
                            color="teal"
                          >
                            <IconNetwork size={32} />
                          </ThemeIcon>
                          <Text fw={500} c="dimmed">
                            Belum ada relasi dipilih
                          </Text>
                          <Text
                            size="sm"
                            c="dimmed"
                            style={{ lineHeight: 1.5 }}
                          >
                            Klik panah (→) pada graf untuk melihat detail
                            hubungan antar artikel
                          </Text>
                        </Box>
                      )}
                    </ScrollArea>
                  ) : (
                    <ScrollArea h="100%">
                      {selectedNode ? (
                        <NodeDetail
                          node={selectedNode}
                          trackPdfView={trackPdfView}
                          trackModalInteraction={trackModalInteraction}
                          onClose={() => setChatSidebarOpen(false)}
                          session={session}
                          projectId={projectId}
                        />
                      ) : (
                        <Box
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            padding: '2rem',
                            textAlign: 'center',
                            gap: 12,
                          }}
                        >
                          <ThemeIcon
                            size={64}
                            radius="xl"
                            variant="light"
                            color="blue"
                          >
                            <IconArticle size={32} />
                          </ThemeIcon>
                          <Text fw={500} c="dimmed">
                            Belum ada artikel dipilih
                          </Text>
                          <Text
                            size="sm"
                            c="dimmed"
                            style={{ lineHeight: 1.5 }}
                          >
                            Klik node pada graf untuk melihat detail dan summary
                            artikel di sini
                          </Text>
                        </Box>
                      )}
                    </ScrollArea>
                  )}
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Edge detail sekarang tampil di sidebar tab 'relation' — modal dihapus */}

          {/* ── MODAL: Konfirmasi Hapus Artikel ── */}
          <Modal
            opened={deleteConfirmOpen}
            onClose={() => {
              setDeleteConfirmOpen(false);
              setPendingDeleteNodeId(null);
              setPendingDeleteTitle('');
            }}
            withCloseButton={false}
            centered
            size={420}
            radius="lg"
            shadow="xl"
            padding={0}
            styles={{
              content: {
                backgroundColor: dark ? '#12131a' : '#fff',
                border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                overflow: 'hidden',
              },
              overlay: { backdropFilter: 'blur(4px)' },
            }}
          >
            {/* Header bergradient merah */}
            <Box
              style={{
                padding: '20px 24px 16px',
                background: dark
                  ? 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(18,19,26,0) 100%)'
                  : 'linear-gradient(135deg, rgba(239,68,68,0.06) 0%, rgba(255,255,255,0) 100%)',
                borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}`,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              {/* Ikon peringatan */}
              <Box
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  flexShrink: 0,
                  backgroundColor: dark
                    ? 'rgba(239,68,68,0.15)'
                    : 'rgba(239,68,68,0.08)',
                  border: `1.5px solid ${dark ? 'rgba(239,68,68,0.35)' : 'rgba(239,68,68,0.2)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 9v4"
                    stroke="#ef4444"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M12 17h.01"
                    stroke="#ef4444"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                    stroke="#ef4444"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Box>
              <Box>
                <Text
                  fw={700}
                  size="md"
                  style={{ color: dark ? '#f1f5f9' : '#0f172a' }}
                >
                  Hapus Artikel
                </Text>
                <Text
                  size="xs"
                  style={{ color: dark ? '#64748b' : '#94a3b8', marginTop: 2 }}
                >
                  Tindakan ini tidak bisa dibatalkan
                </Text>
              </Box>
            </Box>

            {/* Body */}
            <Box style={{ padding: '20px 24px' }}>
              <Text
                size="sm"
                style={{ color: dark ? '#94a3b8' : '#475569', lineHeight: 1.6 }}
              >
                Apakah kamu yakin ingin menghapus artikel
              </Text>
              <Text
                size="sm"
                fw={600}
                style={{
                  color: dark ? '#e2e8f0' : '#1e293b',
                  marginTop: 4,
                  marginBottom: 16,
                  padding: '8px 12px',
                  borderRadius: 8,
                  backgroundColor: dark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
                  border: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}`,
                  wordBreak: 'break-word',
                }}
              >
                {pendingDeleteTitle || 'artikel ini'}
              </Text>
              <Text size="xs" style={{ color: dark ? '#475569' : '#94a3b8' }}>
                Semua node, relasi, dan data terkait akan{' '}
                <span style={{ color: '#ef4444', fontWeight: 600 }}>
                  dihapus permanen
                </span>{' '}
                dari sistem.
              </Text>
            </Box>

            {/* Footer actions */}
            <Box
              style={{
                padding: '0 24px 20px',
                display: 'flex',
                gap: 10,
                justifyContent: 'flex-end',
              }}
            >
              <Button
                variant="subtle"
                color="gray"
                radius="xl"
                size="sm"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setPendingDeleteNodeId(null);
                  setPendingDeleteTitle('');
                }}
              >
                Batal
              </Button>
              <Button
                variant="filled"
                color="red"
                radius="xl"
                size="sm"
                loading={!!deletingNodeId}
                onClick={executeDeleteArticle}
                style={{ boxShadow: '0 4px 16px rgba(239,68,68,0.35)' }}
              >
                Hapus Artikel
              </Button>
            </Box>
          </Modal>

          {/* Upload modal dipindah ke Popover di atas tombol Upload File */}

          {/* ── PDF Modal dengan WebViewer (PDF + Highlighted Notes) ── */}
          <Modal
            opened={pdfModalOpened}
            onClose={() => {
              setPdfModalOpened(false);
              setPdfModalUrl(null);
              setPdfModalTitle('');
              setViewingPdfNode(null);
              setViewingPdfUrl(null);
            }}
            title={
              <Text
                size="sm"
                fw={600}
                style={{
                  maxWidth: 400,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {pdfModalTitle || 'Lihat Artikel'}
              </Text>
            }
            size="90%"
            padding="sm"
            centered
            overlayProps={{ blur: 3 }}
            styles={{
              content: {
                height: '90vh',
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
                position: 'relative',
              },
              body: {
                flex: 1,
                overflow: 'hidden',
                padding: 0,
                position: 'relative',
              },
            }}
          >
            {pdfModalUrl && (
              <div style={{ height: '100%', position: 'relative' }}>
                <WebViewer
                  fileUrl={pdfModalUrl}
                  onAnalytics={handleAnalytics}
                  session={session}
                  onSave={handleSaveNoteFromArticle}
                />
              </div>
            )}
          </Modal>
        </Box>
      </DashboardLayout>
    </WebGazerContext.Provider>
  );
}

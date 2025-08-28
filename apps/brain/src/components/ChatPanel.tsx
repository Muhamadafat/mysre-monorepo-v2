"use client"

import {
  Box,
  Text,
  Button,
  ScrollArea,
  Paper,
  Group,
  ActionIcon,
  Stack,
  TypographyStylesProvider,
  useMantineColorScheme,
  useMantineTheme,
  Loader,
  Switch,
  Tooltip,
  Anchor,
  Popover,
  Modal,
  ThemeIcon,
  CopyButton,
  TextInput,
  Transition,
  Badge,
  Avatar,
  Divider,
  Card,
} from "@mantine/core"
import {
  IconX,
  IconSearch,
  IconWorld,
  IconCircleDot,
  IconCopy,
  IconCheck,
  IconPaperclip,
  IconChevronRight,
  IconChevronLeft,
  IconSend,
  IconNote,
  IconUser,
  IconSparkles,
  IconBrain,
  IconMessageCircle,
  IconHelp,
} from "@tabler/icons-react"
import React, { useEffect, useState, useRef, useCallback } from "react"
import type { ExtendedNode, ExtendedEdge } from "../types"
import { notifications } from "@mantine/notifications"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useDebouncedValue } from "@mantine/hooks"
import WebViewer from "./WebViewer"
import NodeDetail, { handleAnalytics } from "./NodeDetail"
import { HelpGuideModal } from "./HelpGuideModal"
import ChatMessageItem from "./ChatMessageItem"
import ChatInputArea from "./ChatInputArea"
import AnnotationModal from "./AnnotationModal"
import { useXapiTracking } from "@/hooks/useXapiTracking"

interface ChatPanelProps {
  sessionId?: string
  selectedNode: ExtendedNode | null
  selectedEdge: ExtendedEdge | null
  resetContext?: boolean
  onContextReset?: () => void
}

type Reference = {
  url: string
  text: string
  preview: string
  ref_mark: string
  type?: string
  index?: number
}

type ChatMessage = {
  sender: "user" | "ai"
  text: string
  contextNodeIds?: string[]
  contextEdgeIds?: string[]
  references?: Reference[]
}

export default function ChatPanel({
  selectedNode,
  selectedEdge,
  sessionId,
  resetContext,
  onContextReset,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [contextNodes, setContextNodes] = useState<ExtendedNode[]>([])
  const [contextEdges, setContextEdges] = useState<ExtendedEdge[]>([])
  const [uploading, setUpLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messageEndRef = useRef<HTMLDivElement>(null)
  const { colorScheme } = useMantineColorScheme()
  const theme = useMantineTheme()
  const isDark = colorScheme === "dark"

  // State for suggestion
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionContext, setSuggestionContext] = useState<"input" | "response" | null>(null)
  const [debouncedInput] = useDebouncedValue(input, 500)
  const [selectedPDF, setSelectedPDF] = useState<string | null>(null)
  const [modalOpened, setModalOpened] = useState(false)
  const [detailModalNode, setDetailModalNode] = useState<any>(null)

  // For forceWeb
  const [forceWeb, setForceWeb] = useState(false)

  // For suggest
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0)
  const [suggestionScrollPosition, setSuggestionScrollPosition] = useState(0)
  const suggestionContainerRef = useRef<HTMLDivElement>(null)

  // For fetch chat - FIXED STATES
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [totalMessages, setTotalMessages] = useState(0)
  const MESSAGES_PER_PAGE = 3
  const isFetchingHistory = useRef(false)
  const isInitialLoad = useRef(true)

  // NEW: For scroll position tracking
  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 })
  const lastScrollHeight = useRef(0)

  // Add after other state declarations
  const lastFetchTime = useRef(0)
  const FETCH_COOLDOWN = 2000 // 2 seconds cooldown
  const [isScrolling, setIsScrolling] = useState(false)
  // const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Add after other state declarations
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true)
  const [isInitialMount, setIsInitialMount] = useState(true)

  // NEW: States for Annotation feature
  const [showAnnotationModal, setShowAnnotationModal] = useState(false)
  const [highlightedText, setHighlightedText] = useState<string>("")
  const [annotationTargetUrl, setAnnotationTargetUrl] = useState<string | null>(null)
  const [annotationCommentInput, setAnnotationCommentInput] = useState("")
  const [isSavingAnnotation, setIsSavingAnnotation] = useState(false)

  //state for infiniteloop
  const isHandlingScroll = useRef(false);
  const lastScrollUpdateTime = useRef(0)
  const SCROLL_UPDATE_THROTTLE = 100

  //for help modal
  const [helpModalOpened, setHelpModalOpened] = useState(false);

  //refactored
  const scrollPositionRef = useRef({x:0, y: 0});
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // xapi
  const [session, setSession] = useState<any>(null);
  const { trackChatInteraction, trackTextSelection, trackAnnotationAttempt, trackAnnotationSave } = useXapiTracking(session);

  useEffect(() => {
      const getSessionFromAPI = async () => {
        try {
          const response = await fetch('/api/session');
          const data = await response.json();
          
          if (data.user) {
            console.log("✅ Got session from API:", data.user.email);
            setSession({
              user: data.user,
              expires_at: data.expires_at
            });
          } else {
            console.log("❌ No session from API");
          }
        } catch (error) {
          console.error("API session fetch error:", error);
        }
      };
      
      getSessionFromAPI();
    }, []);

  const scrollSuggestions = (direction: "left" | "right") => {
    if (!suggestionContainerRef.current) return
    const container = suggestionContainerRef.current
    const scrollAmount = 200
    if (direction === "left") {
      container.scrollLeft -= scrollAmount
    } else {
      container.scrollLeft += scrollAmount
    }
    setSuggestionScrollPosition(container.scrollLeft)
  }

  // For nav
  const [showLeftScroll, setShowLeftScroll] = useState(false)
  const [showRightScroll, setShowRightScroll] = useState(false)

  const checkScrollButtons = () => {
    if (!suggestionContainerRef.current) return
    const container = suggestionContainerRef.current
    setShowLeftScroll(container.scrollLeft > 0)
    setShowRightScroll(container.scrollLeft < container.scrollWidth - container.clientWidth)
  }

  // Update scroll buttons when suggestions change
  useEffect(() => {
    checkScrollButtons()
    if (suggestionContainerRef.current) {
      const container = suggestionContainerRef.current
      container.addEventListener("scroll", checkScrollButtons)
      return () => {
        container.removeEventListener("scroll", checkScrollButtons)
      }
    }
  }, [suggestions])

  // Functions for suggestion navigation
  const nextSuggestion = () => {
    setCurrentSuggestionIndex((prev) => (prev + 1) % suggestions.length)
  }

  const prevSuggestion = () => {
    setCurrentSuggestionIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
  }

  // FIXED: Improved fetchChatMessages function
  const fetchChatMessages = useCallback(
    async (pageNumber = 1, append = false) => {
      if (loadingMore && pageNumber > 1) return // Prevent duplicate requests
      try {
        console.log(`🔄 Fetching messages - Page: ${pageNumber}, Append: ${append}`)
        if (pageNumber > 1) {
          setLoadingMore(true)
        }
        const res = await fetch(`/api/chat?sessionId=${sessionId}&page=${pageNumber}&limit=${MESSAGES_PER_PAGE}`)
        const data = await res.json()
        console.log(`📦 Received ${data.messages.length} messages, Total: ${data.total}, HasMore: ${data.hasMore}`)

        const formatted = data.messages.map((msg: any) => ({
          sender: msg.role === "assistant" ? "ai" : "user",
          text: msg.content,
          contextNodeIds: msg.contextNodeIds || [],
          contextEdgeIds: msg.contextEdgeIds || [],
          references: msg.references || [],
        }))

        if (append) {
          setMessages((prev) => {
            const newMessages = [...formatted, ...prev]
            console.log(`📝 Total messages after append: ${newMessages.length}`)
            return newMessages
          })
          // DON'T set shouldScrollToBottom for infinite scroll
        } else {
          setMessages(formatted)
          console.log(`📝 Set initial messages: ${formatted.length}`)
          setShouldScrollToBottom(true) // Only for initial load
        }

        setTotalMessages(data.total)
        setHasMore(data.hasMore)
        console.log(`📊 Updated state - Total: ${data.total}, HasMore: ${data.hasMore}, Page: ${pageNumber}`)
      } catch (error) {
        console.error("❌ Gagal memuat chat:", error)
      } finally {
        setLoadingMore(false)
      }
    },
    [sessionId, loadingMore],
  )

  // FIXED: Improved loadMoreMessages function
  const loadMoreMessages = useCallback(async () => {
    console.log("🔄 loadMoreMessages called")
    console.log(
      `📊 Current state - LoadingMore: ${loadingMore}, HasMore: ${hasMore}, IsFetching: ${isFetchingHistory.current}`,
    )

    if (loadingMore || !hasMore || isFetchingHistory.current) {
      console.log(
        `⏸️ Skip loading - LoadingMore: ${loadingMore}, HasMore: ${hasMore}, IsFetching: ${isFetchingHistory.current}`,
      )
      return
    }

    isFetchingHistory.current = true
    const nextPage = page + 1
    console.log(`🔄 Loading page ${nextPage}`)

    try {
      await fetchChatMessages(nextPage, true)
      setPage(nextPage)
      console.log(`✅ Successfully loaded page ${nextPage}`)
    } catch (error) {
      console.error("❌ Error in loadMoreMessages:", error)
    } finally {
      isFetchingHistory.current = false
      console.log("✅ loadMoreMessages completed")
    }
  }, [loadingMore, hasMore, page, fetchChatMessages])

  // FIXED: Initial load effect
  useEffect(() => {
    if (sessionId && isInitialLoad.current) {
      console.log("🚀 Initial load for session:", sessionId)
      isInitialLoad.current = false
      setPage(1)
      setHasMore(true)
      fetchChatMessages(1, false)
    }
  }, [sessionId, fetchChatMessages])

  // NEW: Improved scroll position change with debouncing and cooldown
  // const handleScrollPositionChange = useCallback(
  //   ({ x, y }: { x: number; y: number }) => {

  //     if (isHandlingScroll.current){
  //       console.log("⚠️ Scroll handler already running, skipping...");
  //       return;
  //     }

  //     if (typeof y !== 'number' || isNaN(y) || y < 0){
  //       console.warn("Invalid scroll position, skipping");
  //       return;
  //     }

  //     const now = Date.now()
  //     if (now - lastScrollUpdateTime.current < SCROLL_UPDATE_THROTTLE) {
  //       return // Skip this update
  //     }
  //     lastScrollUpdateTime.current = now

  //     // console.log(`📊 Scroll position changed - Y: ${y}`)
  //     // setScrollPosition({ x, y })
  //     // setIsScrolling(true)

  //     requestAnimationFrame(() => {
  //       setScrollPosition({ x, y })
  //       setIsScrolling(true)
  //     })
      
  //     // Clear existing timeout
  //     if (scrollTimeoutRef.current) {
  //       clearTimeout(scrollTimeoutRef.current)
  //     }

  //     // Debounce scroll handling
  //     scrollTimeoutRef.current = setTimeout(() => {
  //       if (isHandlingScroll.current) return

  //       requestAnimationFrame(() => {
  //         setIsScrolling(false)
  //       })

  //       // setIsScrolling(false)
  //       const scrollThreshold = 100 // Increased threshold
  //       const isNearTop = y <= scrollThreshold
  //       const canLoadMore = hasMore && !loadingMore && !isFetchingHistory.current

  //       // Check cooldown period
  //       const now = Date.now()
  //       // const timeSinceLastFetch = now - lastFetchTime.current
  //       // const cooldownPassed = timeSinceLastFetch > FETCH_COOLDOWN
  //       const timeSinceLastFetch = now - lastFetchTime.current
  //       const cooldownPassed = timeSinceLastFetch > FETCH_COOLDOWN


  //       console.log(
  //         `📊 Scroll Check - Y: ${y}, Threshold: ${scrollThreshold}, Near Top: ${isNearTop}, Can Load: ${canLoadMore}, Cooldown: ${cooldownPassed} (${timeSinceLastFetch}ms)`,
  //       )

  //       if (isNearTop && canLoadMore && cooldownPassed) {
  //         console.log("🔄 Triggering loadMoreMessages from scroll position change")
  //         lastFetchTime.current = now
  //         loadMoreMessages().finally(() => {
  //         setTimeout(() => {
  //           isHandlingScroll.current = false
  //         }, 200) // Increase timeout
  //       })
  //       }
  //     }, 600) // 300ms debounce
  //   },
  //   [hasMore, loadingMore, loadMoreMessages],
  // )
  const handleScrollPositionChange = useCallback(
      ({ x, y }: { x: number; y: number }) => {
          if (isHandlingScroll.current) {
              console.log("⚠️ Scroll handler already running, skipping...");
              return;
          }

          if (typeof y !== 'number' || isNaN(y) || y < 0) {
              console.warn("Invalid scroll position, skipping");
              return;
          }

          const now = Date.now();
          if (now - lastScrollUpdateTime.current < SCROLL_UPDATE_THROTTLE) {
              return; // Skip this update
          }
          lastScrollUpdateTime.current = now;

          // --- PERUBAHAN UTAMA DI SINI ---
          // Simpan posisi scroll ke ref, TIDAK ke state
          scrollPositionRef.current = { x, y };
          isScrollingRef.current = true;
          // Tidak ada lagi setScrollPosition() atau setIsScrolling()

          if (scrollTimeoutRef.current) {
              clearTimeout(scrollTimeoutRef.current);
          }

          scrollTimeoutRef.current = setTimeout(() => {
              isScrollingRef.current = false;
              
              if (isHandlingScroll.current) return;

              const scrollThreshold = 100;
              const isNearTop = scrollPositionRef.current.y <= scrollThreshold;
              const canLoadMore = hasMore && !loadingMore && !isFetchingHistory.current;

              const timeSinceLastFetch = Date.now() - lastFetchTime.current;
              const cooldownPassed = timeSinceLastFetch > FETCH_COOLDOWN;

              console.log(
                  `📊 Scroll Check - Y: ${scrollPositionRef.current.y}, Near Top: ${isNearTop}, Can Load: ${canLoadMore}, Cooldown: ${cooldownPassed}`
              );

              if (isNearTop && canLoadMore && cooldownPassed) {
                  console.log("🔄 Triggering loadMoreMessages from scroll");
                  lastFetchTime.current = Date.now();
                  isHandlingScroll.current = true; // Set flag before async call
                  loadMoreMessages().finally(() => {
                      setTimeout(() => {
                          isHandlingScroll.current = false;
                      }, 500); // Cooldown before allowing next handle
                  });
              }
          }, 300); // 300ms debounce
      },
      [hasMore, loadingMore, loadMoreMessages] // Dependencies tetap sama
  );

  // NEW: Handle scroll position restoration after loading more messages
  useEffect(() => {
    if (isFetchingHistory.current) {
      // Store current scroll height before new messages are added
      const scrollContainer = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement
      if (scrollContainer) {
        lastScrollHeight.current = scrollContainer.scrollHeight
      }
    }
  }, [loadingMore])

  // NEW: Improved scroll position restoration with offset
  useEffect(() => {
    if (!isFetchingHistory.current && loadingMore === false && messages.length > 0) {
      const scrollContainer = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement
      if (scrollContainer && lastScrollHeight.current > 0) {
        const newScrollHeight = scrollContainer.scrollHeight
        const heightDifference = newScrollHeight - lastScrollHeight.current

        if (heightDifference > 0) {
          console.log(`📏 Restoring scroll position - Height diff: ${heightDifference}`)
          // Add offset to prevent immediate re-trigger
          const offset = 200 // 200px offset from top
          // const newScrollTop = Math.max(scrollPosition.y + heightDifference + offset, offset)
          const newScrollTop = Math.max(scrollPositionRef.current.y + heightDifference + offset, offset)

          setTimeout(() => {
            scrollContainer.scrollTop = newScrollTop
            console.log(`✅ Scroll restored to: ${newScrollTop} (with ${offset}px offset)`)
            lastScrollHeight.current = 0 // Reset
          }, 100)
        }
      }
    }
  }, [messages.length, loadingMore])

  useEffect(() => {
    if (selectedNode) {
      addContextNode(selectedNode)
    }
  }, [selectedNode])

  // FIXED: Smoother scroll to bottom logic
  useEffect(() => {
    const shouldScroll =
      (isInitialMount && messages.length > 0) || (shouldScrollToBottom && !isFetchingHistory.current) || isLoading

    if (shouldScroll) {
      console.log("📍 Scrolling to bottom - Reason:", {
        isInitialMount,
        shouldScrollToBottom,
        isLoading,
        isFetchingHistory: isFetchingHistory.current,
      })

      const scrollToBottom = () => {
        if (scrollAreaRef.current) {
          const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]")
          if (scrollContainer) {
            setTimeout(() => {
              scrollContainer.scrollTo({
                top: scrollContainer.scrollHeight,
                behavior: shouldScrollToBottom ? "smooth" : "auto", // Smooth for new messages
              })
              console.log("✅ Scrolled to bottom completed")
            }, 100)
          }
        }

        if (messageEndRef.current && (shouldScrollToBottom || isLoading)) {
          setTimeout(() => {
            messageEndRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "end",
            })
          }, 150)
        }
      }

      scrollToBottom()

      // Reset flags after scrolling
      if (isInitialMount) {
        setIsInitialMount(false)
      }
      if (shouldScrollToBottom) {
        setShouldScrollToBottom(false)
      }
    }
  }, [messages.length, isLoading])

  const fetchInputSuggestion = async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    try {
      const response = await fetch("/api/suggestions/input", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          context: {
            nodeIds: contextNodes.map((n) => n.id),
            edgeIds: contextEdges.map((e) => e.id),
          },
          suggestion_type: "input",
        }),
      })

      const data = await response.json()
      setSuggestions(data.suggestions || [])
      setSuggestionContext("input")
      setShowSuggestions(true)
    } catch (error) {
      console.error("failed to fetch input suggestions:", error)
      setSuggestions([])
    }
  }

  const fetchInitialSuggestions = async () => {
    let mode: "general" | "single node" | "multiple node" = "general"
    if (contextNodes.length === 1) mode = "single node"
    else if (contextNodes.length > 1) mode = "multiple node"

    try {
      const res = await fetch("/api/suggestions/input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "",
          context: {
            nodeIds: contextNodes.map((n) => n.id),
            edgeIds: contextEdges.map((e) => e.id),
          },
          suggestion_type: "input",
          mode,
        }),
      })

      const data = await res.json()
      setSuggestions(data.suggestions || [])
      setShowSuggestions(true)
      setSuggestionContext("input")
    } catch (err) {
      console.error("Failed to fetch initial suggestions:", err)
    }
  }

  useEffect(() => {
    fetchInitialSuggestions()
  }, [contextNodes.length, contextEdges.length])

  const fetchFollowupSuggestions = async (lastMessage: string) => {
    try {
      const res = await fetch("/api/suggestions/followup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lastMessage: lastMessage,
          conversationHistory: messages.slice(-1),
          context: {
            nodeIds: contextNodes.map((n) => n.id),
            edgeIds: contextEdges.map((e) => e.id),
          },
        }),
      })

      const data = await res.json()
      setSuggestions(data.suggestions || [])
      setSuggestionContext("response")
      setShowSuggestions(true)
    } catch (error) {
      console.error("Failed to fetch followup suggestions:", error)
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const handleSend = useCallback (async (messageText: string) => {
    if (!messageText.trim() || isLoading) return

    if (contextNodes.length === 0) {
      // Show helpful message with option to open help
      const helpMessage = {
        sender: "ai" as const,
        text: `Saya melihat Anda belum memilih dokumen untuk dianalisis. Untuk mendapatkan hasil yang optimal, silakan:

1. **Pilih dokumen** dari graph view dengan mengklik node dokumen
2. **Upload PDF baru** menggunakan tombol upload
3. **Baca panduan lengkap** untuk memahami cara menggunakan platform ini

Apakah Anda ingin membuka panduan penggunaan?`,
        showHelpButton: true, // Custom property to show help button
        contextNodeIds: [],
      }

      setMessages((prev) => [
        ...prev, 
        { sender: "user", text: messageText, contextNodeIds: [] },
        helpMessage
      ])

      trackChatInteraction(messageText, 'question');
      
      trackChatInteraction(helpMessage.text, 'response');

      setInput("")
      setShouldScrollToBottom(true)
      return
    }

    setSuggestions([])
    setShowSuggestions(false)
    setSuggestionContext(null)

    const contextNodeIds = contextNodes.filter((node) => node && node.id).map((node) => String(node.id));

    const contextEdgeIds = contextEdges.filter((edge) => edge && edge.id).map((edge) => String(edge.id));

    setMessages((prev) => [...prev, { sender: "user", text: messageText, contextNodeIds: contextNodeIds }])
    setShouldScrollToBottom(true) // Ensure scroll to bottom for new messages

    trackChatInteraction(messageText, 'question');

    const currentInput = messageText
    setInput("")
    setIsLoading(true)

    // Reset pagination for new conversation
    setPage(1)
    setHasMore(true)

    // Scroll to bottom for new message
    setTimeout(() => {
      if (scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]")
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight
        }
      }
    }, 50)

    let payloadd = {}
    if (contextNodes.length === 0) {
      payloadd = {
        sessionId,
        question: currentInput,
        contextNodeIds: contextNodes.map((n) => n.id),
        contextEdgeIds: contextEdges.map((e) => e.id),
        forceWeb,
        mode: "general",
      }
    } else if (contextNodes.length === 1) {
      payloadd = {
        sessionId,
        question: currentInput,
        contextNodeIds: contextNodes.map((n) => n.id),
        contextEdgeIds: contextEdges.map((e) => e.id),
        forceWeb,
        mode: "single node",
        nodeId: contextNodes[0].id,
      }
    } else {
      payloadd = {
        sessionId,
        question: currentInput,
        contextNodeIds: contextNodes.map((n) => n.id),
        contextEdgeIds: contextEdges.map((e) => e.id),
        forceWeb,
        mode: "multiple node",
        nodeIds: contextNodes.map((n) => n.id),
      }
    }

    try {
      const result = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payloadd),
      })

      const data = await result.json()

      let processedReferences: Reference[] = []
      if (data.references && Array.isArray(data.references)) {
        processedReferences = data.references.map((ref: any, idx: number) => {
          const processedRef = {
            url: ref.url || ref.source_url || ref.link || "#",
            text: ref.text || ref.title || ref.document_preview || `Reference ${idx + 1}`,
            preview: ref.preview || ref.document_preview || ref.text || "No preview available",
            ref_mark: ref.ref_mark || `[${idx + 1}]`,
            type: ref.type || "document",
            index: idx + 1,
          }
          return processedRef
        })
      }

      setMessages((m) => [...m, { sender: "ai", text: data.answer, references: processedReferences || [], contextNodeIds: contextNodeIds, contextEdgeIds: contextEdgeIds }])

      trackChatInteraction(data.answer, 'response');

      setTimeout(async () => {
        await fetchFollowupSuggestions(data.answer)
      }, 500)
    } catch (error) {
      const errorMessage = "terjadi kesalahan dalam menjawab pertanyaan";
      setMessages((m) => [...m, { sender: "ai", text: "terjadi kesalahan dalam menjawab pertanyaan" }])
      trackChatInteraction(errorMessage, 'response');
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, contextNodes, contextEdges, sessionId, forceWeb, 
    setMessages, setIsLoading, setSuggestions, setShowSuggestions, 
    setSuggestionContext, setPage, setHasMore, setShouldScrollToBottom, 
    scrollAreaRef, fetchFollowupSuggestions, trackChatInteraction])

  const handleOpenHelp = () => {
    setHelpModalOpened(true)
  }

  const LoadingMoreIndicator = () => {
    return (
      <Box p="md" style={{ textAlign: "center" }}>
        <Group justify="center" gap="xs">
          <Loader size="sm" color="blue" />
          <Text size="sm" c="dimmed" fw={500}>
            Memuat pesan sebelumnya...
          </Text>
        </Group>
      </Box>
    )
  }

  // Debug button for testing
  const ScrollTestButton = () => {
    const testScroll = () => {
      console.log("🧪 Manual scroll test")
      console.log("📍 Current scroll position:", scrollPosition)
      console.log("📊 State - HasMore:", hasMore, "LoadingMore:", loadingMore)
      // Test manual load
      if (hasMore && !loadingMore) {
        console.log("🔄 Manual trigger loadMoreMessages")
        loadMoreMessages()
      }
    }

    return (
      <Box p="md" style={{ textAlign: "center" }}>
        <Button size="xs" variant="outline" onClick={testScroll}>
          🧪 Test Load More (Debug) - Y: {scrollPosition.y}
        </Button>
      </Box>
    )
  }

  const addContextNode = (node: ExtendedNode) => {
    if (!node || !node.id) return // Guard clause

    setContextNodes((prev) => {
      // Check if node already exists by id
      const exists = prev.some((n) => n.id === node.id)
      if (exists) {
        console.log(`Node ${node.id} already exists in context`)
        return prev
      }
      console.log(`Adding node ${node.id} to context`)
      return [...prev, node]
    })
  }

  const removeContextNode = (node: ExtendedNode) => {
    setContextNodes((prev) => prev.filter((n) => n.id !== node.id))
  }

  const AttachmentDisplay = ({ nodeIds }: { nodeIds: string[] }) => {
    if (!nodeIds || nodeIds.length === 0) return null

    return (
      <Box mb="sm">
        <Group gap={6} align="center">
          <IconPaperclip size={14} style={{ color: theme.colors.blue[6] }} />
          <Text size="xs" c="blue" fw={500}>
            {nodeIds.length} artikel dilampirkan
          </Text>
        </Group>
      </Box>
    )
  }

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleUploadFile = () => {
    fileInputRef.current?.click()
  }

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith(".pdf")) {
      notifications.show({
        title: "Format tidak didukung",
        message: "Mohon upload file PDF",
        color: "yellow",
        position: "top-right",
      })
      return
    }

    const formData = new FormData()
    formData.append("file", file)
    formData.append("title", file.name)

    setUpLoading(true)

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const contentType = res.headers.get("content-type")
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Upload failed: ${text}`)
      }

      let data: any = {}
      if (contentType?.includes("application/json")) {
        data = await res.json()
        console.log("File uploaded:", data)
      } else {
        const text = await res.text()
        console.log("Unexpected response:", text)
      }

      notifications.show({
        title: "Berhasil",
        message: `File "${file.name}" berhasil diunggah dan diproses`,
        color: "green",
        position: "top-right",
      })

      console.log("File Uploaded:", data)
    } catch (error: any) {
      notifications.show({
        title: "Upload Gagal",
        message: error.message || "Terjadi Kesalahan saat upload",
        color: "red",
        position: "top-right",
      })
      console.error("File upload error:", error)
    } finally {
      setUpLoading(false)
      e.target.value = ""
    }
  }

  // const handleKeyPress = (e: React.KeyboardEvent) => {
  //   if (e.key === "enter" && !e.shiftKey) {
  //     e.preventDefault()
  //     handleSend()
  //   }
  // }

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion)
    setShowSuggestions(false)
    setSuggestions([])
    setTimeout(() => {
      const textarea = document.querySelector("textarea")
      textarea?.focus()
    }, 100)
  }

  const handleCloseSuggestions = () => {
    setShowSuggestions(false)
    setSuggestions([])
    setSuggestionContext(null)
  }

  // Cleanup
  useEffect(() => {
    return () => {
      setSuggestions([])
      setShowSuggestions(false)
      setSuggestionContext(null)
      // Cleanup scroll timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  // Add this useEffect after the existing useEffects for context reset
  useEffect(() => {
    return () => {
      // Cleanup contextNodes when component unmounts
      console.log("ChatPanel unmounting, clearing context nodes")
      setContextNodes([])
      setContextEdges([])
    }
  }, [])

  // Add useEffect to handle reset from parent
  useEffect(() => {
    if (resetContext) {
      console.log("Resetting context nodes from parent")
      setContextNodes([])
      setContextEdges([])
      onContextReset?.()
    }
  }, [resetContext, onContextReset])

  const LoadingMessage = () => {
    return (
      <Card
        shadow="sm"
        radius="xl"
        withBorder
        style={{
          alignSelf: "flex-start",
          background: isDark
            ? `linear-gradient(135deg, ${theme.colors.dark[6]} 0%, ${theme.colors.dark[7]} 100%)`
            : `linear-gradient(135deg, ${theme.colors.gray[0]} 0%, ${theme.colors.gray[1]} 100%)`,
          maxWidth: "85%",
          padding: "20px",
          border: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[2]}`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Box
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "3px",
            background: `linear-gradient(90deg, ${theme.colors.blue[6]}, ${theme.colors.cyan[5]}, ${theme.colors.violet[6]})`,
            backgroundSize: "200% 100%",
            animation: "shimmer 2s infinite",
          }}
        />
        <Group mb="xs" gap="sm">
          <Avatar
            size="sm"
            radius="xl"
            style={{
              background: `linear-gradient(135deg, ${theme.colors.blue[6]} 0%, ${theme.colors.cyan[5]} 100%)`,
            }}
          >
            <IconBrain size={16} color="white" />
          </Avatar>
          <Text size="sm" fw={600} c={isDark ? theme.colors.gray[3] : theme.colors.gray[7]}>
            AI Assistant
          </Text>
        </Group>
        <Group gap="xs" align="center">
          <Loader size="sm" color="blue" />
          <Text size="sm" c="dimmed" fw={500}>
            Sedang berpikir...
          </Text>
          <Box style={{ display: "flex", gap: "2px", marginLeft: "8px" }}>
            {[0, 1, 2].map((i) => (
              <Box
                key={i}
                style={{
                  width: "4px",
                  height: "4px",
                  borderRadius: "50%",
                  backgroundColor: theme.colors.blue[6],
                  animation: `bounce 1.4s infinite ease-in-out both`,
                  animationDelay: `${i * 0.16}s`,
                }}
              />
            ))}
          </Box>
        </Group>
      </Card>
    )
  }

  const handlerOpenPdf = async (url: string) => {
    if (url.startsWith("graph://node/")) {
      const nodeId = url.split("graph://node/")[1]
      try {
        const res = await fetch(`/api/nodes/${nodeId}`)
        const data = await res.json()
        if (res.ok) {
          setDetailModalNode(data)
        } else {
          console.error("Node not found", data)
        }
      } catch (error) {
        console.error("Error fetching node", error)
      }
    } else {
      setSelectedPDF(url)
      setModalOpened(true)
    }
  }

  const ReferenceTooltip = ({ reference, order }: { reference: Reference; order: number }) => {
    const [opened, setOpened] = useState(false)
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)

    const handleMouseEnter = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => setOpened(true), 100)
    }

    const handleMouseLeave = () => {
      timeoutRef.current = setTimeout(() => setOpened(false), 1000)
    }

    const handlePopoverMouseEnter = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }

    const handlePopoverMouseLeave = () => {
      timeoutRef.current = setTimeout(() => setOpened(false), 1000)
    }

    return (
      <Popover
        width={350}
        position="bottom"
        withArrow
        shadow="xl"
        offset={5}
        withinPortal
        opened={opened}
        onClose={() => setOpened(false)}
        transitionProps={{ duration: 200 }}
      >
        <Popover.Target>
          <span
            onClick={() => handlerOpenPdf(reference.url)}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{
              cursor: "pointer",
              fontSize: "0.75rem",
              fontWeight: 600,
              margin: "0 2px",
              transition: "all 0.2s ease",
              background: `linear-gradient(135deg, ${theme.colors.blue[6]} 0%, ${theme.colors.cyan[5]} 100%)`,
              color: "white",
              padding: "2px 6px",
              borderRadius: "4px",
              display: "inline-block",
            }}
          >
            {reference.ref_mark}
          </span>
        </Popover.Target>
        <Popover.Dropdown
          onMouseEnter={handlePopoverMouseEnter}
          onMouseLeave={handlePopoverMouseLeave}
          style={{
            background: isDark
              ? `linear-gradient(135deg, ${theme.colors.dark[6]} 0%, ${theme.colors.dark[7]} 100%)`
              : `linear-gradient(135deg, ${theme.colors.gray[0]} 0%, white 100%)`,
            border: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[2]}`,
          }}
        >
          <Box p="sm" style={{ maxWidth: 320 }}>
            <Group gap="xs" mb="sm">
              <ThemeIcon size="sm" variant="gradient" gradient={{ from: "blue", to: "cyan" }}>
                <IconCircleDot size={12} />
              </ThemeIcon>
              <Text size="sm" fw={600}>
                Referensi {order}
              </Text>
            </Group>
            <Box
              mt={4}
              style={{
                fontSize: "0.75rem",
                wordBreak: "break-word",
                lineHeight: 1.5,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 4,
                WebkitBoxOrient: "vertical",
                color: "inherit",
                marginBottom: "12px",
                padding: "8px",
                backgroundColor: isDark ? theme.colors.dark[8] : theme.colors.gray[0],
                borderRadius: theme.radius.sm,
                border: `1px solid ${isDark ? theme.colors.dark[5] : theme.colors.gray[2]}`,
              }}
            >
              {reference.preview}
            </Box>
            <Button
              onClick={() => handlerOpenPdf(reference.url)}
              size="xs"
              variant="gradient"
              gradient={{ from: "blue", to: "cyan" }}
              leftSection={<IconCircleDot size={14} />}
              fullWidth
              style={{
                fontWeight: 500,
              }}
            >
              Buka Dokumen Lengkap
            </Button>
          </Box>
        </Popover.Dropdown>
      </Popover>
    )
  }

  // Enhanced helper function to process text with references
  const processTextWithReferences = (text: string, references: Reference[]) => {
    if (!references || references.length === 0) {
      return text
    }

    try {
      const parts: (string | React.ReactElement)[] = [];
      const remainingText = text;
      let currentIndex = 0;

      // Create a map of reference marks to reference objects
      const refMap = new Map()
      references.forEach((ref) => {
        refMap.set(ref.ref_mark, ref)
      })

      // Find all reference marks in the text
      const refMarkPattern = /\[[^\]]+\]/g
      const seenRefMarks = new Set<string>()
      let dynamicIndex = 1
      let match

      while ((match = refMarkPattern.exec(text)) !== null) {
        const refMark = match[0]
        const matchStart = match.index

        // Add text before the reference mark
        if (matchStart > currentIndex) {
          parts.push(text.substring(currentIndex, matchStart))
        }

        // Add the reference component if it exists in our map
        const reference = refMap.get(refMark)
        if (reference) {
          const order = seenRefMarks.has(refMark) ? Array.from(seenRefMarks).indexOf(refMark) + 1 : dynamicIndex++
          seenRefMarks.add(refMark)
          parts.push(
            <ReferenceTooltip
              key={`${reference.url}-${reference.ref_mark}-${matchStart}`}
              reference={reference}
              order={order}
            />,
          )
        } else {
          parts.push(refMark)
        }

        currentIndex = matchStart + refMark.length
      }

      // Add any remaining text
      if (currentIndex < text.length) {
        parts.push(text.substring(currentIndex))
      }

      return parts.length > 0 ? parts : text
    } catch (error) {
      console.error("🔍 Error processing text with references:", error)
      return text
    }
  }

  // NEW: Function to handle text selection for annotation
  const handleTextSelectionForAnnotation = useCallback((e: React.MouseEvent<HTMLDivElement>, message: ChatMessage) => {
    const selection = window.getSelection()
    if (!selection || selection.toString().length === 0) {
      setShowAnnotationModal(false)
      return
    }

    const selectedText = selection.toString().trim()
    if (selectedText.length === 0) {
      setShowAnnotationModal(false)
      return
    }

    // Ensure selection is within the AI message content
    const targetElement = e.target as HTMLElement
    const messageContentElement = targetElement.closest(".ai-message-content")
    if (!messageContentElement || !messageContentElement.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      setShowAnnotationModal(false)
      return
    }

    trackTextSelection(selectedText, message.text, message.contextNodeIds);

    if (!message.contextNodeIds || message.contextNodeIds.length === 0) {
      trackAnnotationAttempt(selectedText, false, "no_document_context");
      notifications.show({
        title: "Anotasi Tidak Tersedia",
        message: "Anotasi hanya tersedia untuk respons AI yang berdasarkan dokumen yang dilampirkan.",
        color: "yellow",
        position: "top-right",
      })
      // Clear selection to prevent re-triggering
      selection.empty()
      return
    }

    const documentUrl = message.references?.find(
      (ref) => ref.url.startsWith("http://") || ref.url.startsWith("https://"),
    )?.url

    if (!documentUrl || documentUrl === "#") {
      trackAnnotationAttempt(selectedText, false, "no_document_source");
      notifications.show({
        title: "Tidak Ada Dokumen Sumber",
        message: "Respons AI ini tidak memiliki dokumen sumber yang dapat dianotasi.",
        color: "yellow",
        position: "top-right",
      })
      // Clear selection to prevent re-triggering
      selection.empty()
      return
    }

    trackAnnotationAttempt(selectedText, true);
    setHighlightedText(selectedText)
    setAnnotationTargetUrl(documentUrl)
    setAnnotationCommentInput("") // Clear previous comment
    setShowAnnotationModal(true)

    // Clear selection after opening modal to prevent re-triggering
    selection.empty()
  }, [trackTextSelection, trackAnnotationAttempt])

  // NEW: Function to save annotation
  const handleSaveAnnotation = async () => {
    if (!highlightedText || !annotationTargetUrl) {
      notifications.show({
        title: "Error",
        message: "Tidak ada teks yang dipilih atau URL dokumen tidak ditemukan.",
        color: "red",
        position: "top-right",
      })
      return
    }

    console.log("Saving annotation with:", {
      highlightedText,
      annotationTargetUrl,
      annotationCommentInput,
    })

    setIsSavingAnnotation(true)

    try {
      const response = await fetch("/api/annotation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          document: annotationTargetUrl,
          metadata: {
            pageNumber: 1, // Defaulting to page 1 as chat response doesn't have specific page info
            highlightedText: highlightedText,
            contents: annotationCommentInput,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Gagal menyimpan anotasi.")
      }

      notifications.show({
        title: "Berhasil",
        message: "Anotasi berhasil disimpan!",
        color: "green",
        position: "top-right",
      })

      setShowAnnotationModal(false)
      setHighlightedText("")
      setAnnotationTargetUrl(null)
      setAnnotationCommentInput("")
    } catch (error: any) {
      console.error("Error saving annotation:", error)
      notifications.show({
        title: "Gagal",
        message: error.message || "Terjadi kesalahan saat menyimpan anotasi.",
        color: "red",
        position: "top-right",
      })
    } finally {
      setIsSavingAnnotation(false)
    }
  }

  return (
    <Box
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: "90vh",
        overflow: "hidden",
        position: "relative",
        background: isDark
          ? `linear-gradient(180deg, ${theme.colors.dark[8]} 0%, ${theme.colors.dark[9]} 100%)`
          : `linear-gradient(180deg, ${theme.colors.gray[0]} 0%, white 100%)`,
      }}
    >
      {/* Enhanced Chat History */}
      <ScrollArea
        ref={scrollAreaRef}
        style={{
          height: "500px",
          minHeight: 0,
        }}
        styles={{
          viewport: {
            "& > div": {
              display: "flex !important",
              flexDirection: "column",
              justifyContent: "flex-start",
            },
          },
        }}
        onScrollPositionChange={handleScrollPositionChange}
      >
        <Stack
          gap="lg"
          p="md"
          style={{
            minHeight: "535px",
          }}
        >
          {/* Loading indicator for infinite scroll */}
          {loadingMore && <LoadingMoreIndicator />}

          {/* Debug button - remove in production */}

          {/* Info if reached beginning of chat */}
          {!hasMore && messages.length > 0 && (
            <Box p="md" style={{ textAlign: "center" }}>
              <Divider
                label={
                  <Group gap="xs">
                    <IconMessageCircle size={16} />
                    <Text size="sm" c="dimmed" fw={500}>
                      Awal percakapan
                    </Text>
                  </Group>
                }
                labelPosition="center"
              />
            </Box>
          )}

          {messages.length === 0 && !loadingMore ? (
            <Box
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                minHeight: "505px",
                textAlign: "center",
              }}
            >
              <Stack align="center" gap="md">
                <ThemeIcon size={60} radius="xl" variant="gradient" gradient={{ from: "blue", to: "cyan", deg: 45 }}>
                  <IconSparkles size={30} />
                </ThemeIcon>
                <Text c="dimmed" size="lg" fw={500}>
                  Mulai Percakapan dengan AI Assistant
                </Text>
                <Text c="dimmed" size="sm">
                  Ajukan pertanyaan atau pilih dokumen untuk memulai
                </Text>
              </Stack>
            </Box>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <ChatMessageItem
                  key={idx} // Sebaiknya gunakan ID unik dari pesan jika ada
                  msg={msg}
                  isDark={isDark}
                  theme={theme}
                  onTextSelect={handleTextSelectionForAnnotation}
                  onOpenHelp={() => setHelpModalOpened(true)}
                  handlerOpenPdf={handlerOpenPdf}
                />
              ))}
              {isLoading && <LoadingMessage />}
              <div ref={messageEndRef} />
            </>
          )}
        </Stack>
      </ScrollArea>

      <ChatInputArea
        isLoading={isLoading}
        isDark={isDark}
        theme={theme}
        contextNodes={contextNodes}
        suggestions={suggestions}
        showLeftScroll={showLeftScroll}
        showRightScroll={showRightScroll}
        suggestionContainerRef={suggestionContainerRef}
        onSendMessage={handleSend}
        onRemoveContextNode={removeContextNode}
        // onSuggestionClick={handleSuggestionClick}
        onScrollSuggestions={scrollSuggestions}
      />

      {/* Enhanced Modals */}
      <Modal
        opened={modalOpened}
        onClose={() => {
          setModalOpened(false)
          setSelectedPDF(null)
        }}
        title={
          <Group gap="sm">
            <ThemeIcon variant="gradient" gradient={{ from: "blue", to: "cyan" }} size="md">
              <IconCircleDot size={16} />
            </ThemeIcon>
            <Text fw={600}>Lihat Artikel</Text>
          </Group>
        }
        size="90%"
        padding="sm"
        centered
        overlayProps={{ blur: 3 }}
        styles={{
          content: {
            height: "90vh",
            display: "flex",
            flexDirection: "column",
            padding: 0,
            position: "relative",
          },
          body: {
            flex: 1,
            overflow: "hidden",
            padding: 0,
            position: "relative",
          },
        }}
      >
        {selectedPDF && (
          <div style={{ height: "100%", position: "relative" }}>
            <WebViewer fileUrl={selectedPDF} onAnalytics={handleAnalytics} session={session} />
          </div>
        )}
      </Modal>

      <Modal
        opened={!!detailModalNode}
        onClose={() => {
          setDetailModalNode(null)
        }}
        title={
          <Group gap="sm">
            <ThemeIcon variant="gradient" gradient={{ from: "blue", to: "cyan" }} size="md">
              <IconCircleDot size={16} />
            </ThemeIcon>
            <Box>
              <Text fw={600}>{detailModalNode?.title || "Detail Artikel"}</Text>
              <Text size="xs" c="dimmed">
                Informasi lengkap artikel
              </Text>
            </Box>
          </Group>
        }
        size="75vw"
        radius="lg"
        shadow="xl"
      >
        <NodeDetail
          node={detailModalNode}
          onClose={() => {
            setDetailModalNode(null)
          }}
          session={session}
        />
      </Modal>

      {/* Enhanced Annotation Modal */}
      <AnnotationModal
        opened={showAnnotationModal}
        onClose={() => {
        setShowAnnotationModal(false);
        // Anda bisa reset state lain di sini jika perlu
        setHighlightedText("");
        setAnnotationTargetUrl(null);
        }}
        highlightedText={highlightedText}
        targetUrl={annotationTargetUrl}
      isDark={isDark}
      />

      <HelpGuideModal 
        opened={helpModalOpened} 
        onClose={() => setHelpModalOpened(false)} 
      />

      {/* Add CSS animations */}
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        
        @keyframes bounce {
          0%, 80%, 100% { 
            transform: scale(0);
          } 40% { 
            transform: scale(1.0);
          }
        }
      `}</style>
    </Box>
  )
}

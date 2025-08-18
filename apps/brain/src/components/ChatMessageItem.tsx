// src/app/components/ChatMessageItem.tsx

"use client"

import React, { useRef, useState } from "react"
import {
  Box,
  Text,
  Button,
  Paper,
  Group,
  ActionIcon,
  TypographyStylesProvider,
  useMantineTheme,
  ThemeIcon,
  CopyButton,
  Tooltip,
  Transition,
  Badge,
  Avatar,
  Card,
  Popover,
  Anchor,
  Stack,
} from "@mantine/core"
import { IconUser, IconBrain, IconCopy, IconCheck, IconPaperclip, IconCircleDot, IconHelp } from "@tabler/icons-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { ExtendedNode, ExtendedEdge } from "../types" // Pastikan path ini benar

// TIPE DAN INTERFACE DIDEFINISIKAN DI SINI
type Reference = {
  url: string
  text: string
  preview: string
  ref_mark: string
  type?: string
  index?: number
}

export type ChatMessage = {
  sender: "user" | "ai"
  text: string
  contextNodeIds?: string[]
  contextEdgeIds?: string[]
  references?: Reference[]
  showHelpButton?: boolean // Custom property for help message
}

interface ChatMessageItemProps {
  msg: ChatMessage
  isDark: boolean
  theme: ReturnType<typeof useMantineTheme>
  onTextSelect: (e: React.MouseEvent<HTMLDivElement>, message: ChatMessage) => void
  onOpenHelp: () => void
  handlerOpenPdf: (url: string) => void
}

// =================================================================
// SEMUA FUNGSI PEMBANTU KITA PINDAHKAN KE SINI
// =================================================================

const AttachmentDisplay = ({ nodeIds, theme }: { nodeIds: string[]; theme: any }) => {
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

const ReferenceTooltip = ({ reference, order, handlerOpenPdf, isDark, theme }: any) => {
  // ... (Salin-tempel lengkap komponen ReferenceTooltip dari ChatPanel.tsx Anda)
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

const processTextWithReferences = (text: string, references: Reference[], {handlerOpenPdf, isDark, theme}: any) => {
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
              handlerOpenPdf={handlerOpenPdf}
                isDark={isDark}
                theme={theme}
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
  

// =================================================================
// KOMPONEN UTAMA ITEM PESAN
// =================================================================

const ChatMessageItemComponent = ({
  msg,
  isDark,
  theme,
  onTextSelect,
  onOpenHelp,
  handlerOpenPdf,
}: ChatMessageItemProps) => {
  return (
    <Transition mounted={true} transition="slide-up" duration={300} timingFunction="ease">
                      {(styles) => (
                        <Card
                          shadow="sm"
                          radius="xl"
                          withBorder
                          style={{
                            ...styles,
                            alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
                            background:
                              msg.sender === "user"
                                ? isDark
                                  ? `linear-gradient(135deg, ${theme.colors.blue[8]} 0%, ${theme.colors.blue[9]} 100%)`
                                  : `linear-gradient(135deg, ${theme.colors.blue[0]} 0%, ${theme.colors.cyan[0]} 100%)`
                                : isDark
                                  ? `linear-gradient(135deg, ${theme.colors.dark[6]} 0%, ${theme.colors.dark[7]} 100%)`
                                  : `linear-gradient(135deg, ${theme.colors.gray[0]} 0%, white 100%)`,
                            maxWidth: "85%",
                            padding: "20px",
                            border: `1px solid ${
                              msg.sender === "user"
                                ? isDark
                                  ? theme.colors.blue[7]
                                  : theme.colors.blue[2]
                                : isDark
                                  ? theme.colors.dark[4]
                                  : theme.colors.gray[2]
                            }`,
                            position: "relative",
                            overflow: "hidden",
                          }}
                          // NEW: Add onMouseUp handler for AI messages
                          onMouseUp={msg.sender === "ai" ? (e) => onTextSelect(e, msg) : undefined}
                        >
                          {/* Accent line for AI messages */}
                          {msg.sender === "ai" && (
                            <Box
                              style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                height: "3px",
                                background: `linear-gradient(90deg, ${theme.colors.blue[6]}, ${theme.colors.cyan[5]}, ${theme.colors.violet[6]})`,
                              }}
                            />
                          )}
    
                          <Group justify="space-between" mb="md">
                            <Group gap="sm">
                              <Avatar
                                size="sm"
                                radius="xl"
                                style={{
                                  background:
                                    msg.sender === "user"
                                      ? `linear-gradient(135deg, ${theme.colors.green[6]} 0%, ${theme.colors.teal[5]} 100%)`
                                      : `linear-gradient(135deg, ${theme.colors.blue[6]} 0%, ${theme.colors.cyan[5]} 100%)`,
                                }}
                              >
                                {msg.sender === "user" ? (
                                  <IconUser size={16} color="white" />
                                ) : (
                                  <IconBrain size={16} color="white" />
                                )}
                              </Avatar>
                              <Text size="sm" fw={600} c={isDark ? theme.colors.gray[3] : theme.colors.gray[7]}>
                                {msg.sender === "user" ? "Anda" : "AI Assistant"}
                              </Text>
                            </Group>
    
                            {/* Copy Button - only for AI response */}
                            {msg.sender === "ai" && (
                              <CopyButton value={msg.text} timeout={2000}>
                                {({ copied, copy }) => (
                                  <Tooltip label={copied ? "Berhasil disalin!" : "Salin jawaban"} position="top" withArrow>
                                    <ActionIcon
                                      variant="subtle"
                                      size="sm"
                                      onClick={copy}
                                      style={{
                                        transition: "all 0.2s ease",
                                        transform: copied ? "scale(1.1)" : "scale(1)",
                                      }}
                                    >
                                      {copied ? (
                                        <IconCheck size={16} style={{ color: theme.colors.green[6] }} />
                                      ) : (
                                        <IconCopy size={16} style={{ color: theme.colors.gray[6] }} />
                                      )}
                                    </ActionIcon>
                                  </Tooltip>
                                )}
                              </CopyButton>
                            )}
                          </Group>
    
                          {/* Enhanced attachment display for user messages */}
                          {msg.sender === "user" && msg.contextNodeIds && msg.contextNodeIds.length > 0 && (
                            <AttachmentDisplay nodeIds={msg.contextNodeIds} theme={theme}/>
                          )}
    
                          {msg.sender === "user" ? (
                            <Text size="sm" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                              {msg.text}
                            </Text>
                          ) : (
                            <TypographyStylesProvider className="ai-message-content">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  p: ({ children }) => {
                                    const extractText = (children: React.ReactNode): string => {
                                      if (children === null || children === undefined) return ""
                                      if (typeof children === "string" || typeof children === "number") {
                                        return String(children)
                                      }
                                      if (Array.isArray(children)) {
                                        return children.map(extractText).join("")
                                      }
                                      if (React.isValidElement(children)) {
                                        return extractText((children.props as { children?: React.ReactNode }).children)
                                      }
                                      return ""
                                    }
    
                                    const textContent = extractText(children)
                                    if (!msg.references)
                                      return (
                                        <Box mb="xs" style={{ lineHeight: 1.6, fontSize: "14px" }}>
                                          {children}
                                        </Box>
                                      )
    
                                    const dedupedReferences = Array.from(
                                      new Map(msg.references.map((ref) => [`${ref.url}-${ref.ref_mark}`, ref])).values(),
                                    )
                                    const sortedReferences = dedupedReferences.sort(
                                      (a, b) => (a.index ?? 999) - (b.index ?? 999),
                                    )
                                    
                                    const propsForProcessing = { handlerOpenPdf, isDark, theme };
                                    const processedContent = processTextWithReferences(textContent, sortedReferences, propsForProcessing)
    
                                    return (
                                      <Box mb="xs" style={{ lineHeight: 1.6, fontSize: "14px" }}>
                                        {processedContent}
                                      </Box>
                                    )
                                  },
                                  h1: ({ children }) => (
                                    <Text
                                      size="xl"
                                      fw={700}
                                      mb="md"
                                      c={isDark ? theme.colors.gray[2] : theme.colors.gray[8]}
                                    >
                                      {children}
                                    </Text>
                                  ),
                                  h3: ({ children }) => (
                                    <Text
                                      size="md"
                                      fw={600}
                                      mb="sm"
                                      c={isDark ? theme.colors.gray[3] : theme.colors.gray[7]}
                                    >
                                      {children}
                                    </Text>
                                  ),
                                  ul: ({ children }) => (
                                    <Box component="ul" ml="md" mb="sm">
                                      {children}
                                    </Box>
                                  ),
                                  ol: ({ children }) => (
                                    <Box component="ol" ml="md" mb="sm">
                                      {children}
                                    </Box>
                                  ),
                                  li: ({ children }) => (
                                    <Text component="li" size="sm" mb="xs" style={{ lineHeight: 1.5 }}>
                                      {children}
                                    </Text>
                                  ),
                                  strong: ({ children }) => (
                                    <Text component="span" fw={700}>
                                      {children}
                                    </Text>
                                  ),
                                  em: ({ children }) => (
                                    <Text component="span" fs="italic">
                                      {children}
                                    </Text>
                                  ),
                                  code: ({ children, className }) => {
                                    const isInline = !className
                                    return isInline ? (
                                      <Badge
                                        variant="light"
                                        color="gray"
                                        style={{
                                          fontFamily: "monospace",
                                          fontSize: "0.8em",
                                        }}
                                      >
                                        {children}
                                      </Badge>
                                    ) : (
                                      <Paper
                                        bg={isDark ? theme.colors.dark[8] : theme.colors.gray[0]}
                                        p="md"
                                        mb="sm"
                                        radius="md"
                                        withBorder
                                        style={{
                                          overflow: "auto",
                                        }}
                                      >
                                        <Text
                                          component="pre"
                                          size="sm"
                                          style={{
                                            fontFamily: "monospace",
                                            margin: 0,
                                            whiteSpace: "pre-wrap",
                                          }}
                                        >
                                          <code>{children}</code>
                                        </Text>
                                      </Paper>
                                    )
                                  },
                                  table: ({ children }) => (
                                    <Box style={{ overflowX: "auto" }} mb="md">
                                      <Box
                                        component="table"
                                        style={{
                                          width: "100%",
                                          borderCollapse: "collapse",
                                          fontSize: "0.875rem",
                                        }}
                                      >
                                        {children}
                                      </Box>
                                    </Box>
                                  ),
                                  thead: ({ children }) => <Box component="thead">{children}</Box>,
                                  tbody: ({ children }) => <Box component="tbody">{children}</Box>,
                                  tr: ({ children }) => (
                                    <Box
                                      component="tr"
                                      style={{
                                        borderBottom: `1px solid ${isDark ? theme.colors.dark[5] : theme.colors.gray[2]}`,
                                      }}
                                    >
                                      {children}
                                    </Box>
                                  ),
                                  th: ({ children }) => (
                                    <Box
                                      component="th"
                                      p="sm"
                                      style={{
                                        backgroundColor: isDark ? theme.colors.dark[7] : theme.colors.gray[0],
                                        fontWeight: 600,
                                        textAlign: "left",
                                        border: `1px solid ${isDark ? theme.colors.dark[5] : theme.colors.gray[2]}`,
                                      }}
                                    >
                                      {children}
                                    </Box>
                                  ),
                                  td: ({ children }) => (
                                    <Box
                                      component="td"
                                      p="sm"
                                      style={{
                                        border: `1px solid ${isDark ? theme.colors.dark[5] : theme.colors.gray[2]}`,
                                        verticalAlign: "top",
                                      }}
                                    >
                                      {children}
                                    </Box>
                                  ),
                                  blockquote: ({ children }) => (
                                    <Paper
                                      pl="md"
                                      py="sm"
                                      mb="sm"
                                      radius="md"
                                      style={{
                                        borderLeft: `4px solid ${theme.colors.blue[6]}`,
                                        backgroundColor: isDark ? theme.colors.dark[7] : theme.colors.blue[0],
                                      }}
                                    >
                                      {children}
                                    </Paper>
                                  ),
                                }}
                              >
                                {msg.text}
                              </ReactMarkdown>
    
                              {/* NEW: Help button for guidance messages - TAMBAHKAN INI */}
                              {(msg as any).showHelpButton && (
                                <Box mt="md">
                                  <Button
                                    variant="gradient"
                                    gradient={{ from: "blue", to: "cyan" }}
                                    leftSection={<IconHelp size={16} />}
                                    onClick={onOpenHelp}
                                    size="sm"
                                    style={{ fontWeight: 500 }}
                                  >
                                    Buka Panduan Penggunaan
                                  </Button>
                                </Box>
                              )}
                              {/* Enhanced Reference List */}
                              {(msg.references?.length ?? 0) > 0 && (
                                <Card
                                  mt="md"
                                  p="sm"
                                  radius="md"
                                  withBorder
                                  style={{
                                    background: isDark
                                      ? `linear-gradient(135deg, ${theme.colors.dark[7]} 0%, ${theme.colors.dark[8]} 100%)`
                                      : `linear-gradient(135deg, ${theme.colors.gray[0]} 0%, ${theme.colors.gray[1]} 100%)`,
                                    border: `1px solid ${isDark ? theme.colors.dark[5] : theme.colors.gray[2]}`,
                                  }}
                                >
                                  <Group gap="xs" mb="sm">
                                    <ThemeIcon size="sm" variant="gradient" gradient={{ from: "blue", to: "cyan" }}>
                                      <IconCircleDot size={12} />
                                    </ThemeIcon>
                                    <Text size="xs" fw={600} c={isDark ? theme.colors.gray[4] : theme.colors.gray[6]}>
                                      Referensi:
                                    </Text>
                                  </Group>
                                  <Stack gap={6}>
                                    {msg.references
                                      ?.sort((a, b) => (a.index ?? 999) - (b.index ?? 999)) // Sort by the 'index' property
                                      .map((ref, idx) => (
                                        <Group key={`${ref.text.toLowerCase().trim()}-${idx}`} gap={8} align="flex-start">
                                          <Badge size="xs" variant="light" color="blue">
                                            {ref.ref_mark}
                                          </Badge>
                                          <Anchor
                                            href="#"
                                            size="xs"
                                            style={{
                                              wordBreak: "break-all",
                                              lineHeight: 1.4,
                                            }}
                                            onClick={(e) => {
                                              e.preventDefault()
                                              handlerOpenPdf(ref.url)
                                            }}
                                          >
                                            {ref.text}
                                          </Anchor>
                                        </Group>
                                      ))}
                                  </Stack>
                                </Card>
                              )}
                            </TypographyStylesProvider>
                          )}
                        </Card>
                      )}
                    </Transition>
  )
}

// React.memo adalah kunci optimasi utama!
export default React.memo(ChatMessageItemComponent)
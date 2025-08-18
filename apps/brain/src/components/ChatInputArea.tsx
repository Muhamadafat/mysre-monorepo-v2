// src/app/components/ChatInputArea.tsx

"use client"

import React, { useState, useRef } from "react"
import {
  Box, Card, Group, ActionIcon, Badge, Button,
  useMantineTheme,
} from "@mantine/core"
import {
  IconSend, IconPaperclip, IconX, IconChevronLeft, IconChevronRight
} from "@tabler/icons-react"
import type { ExtendedNode } from "../types" // Pastikan path ini benar

// PERBAIKAN: Interface props sekarang menerima semua state dan fungsi yang dibutuhkan
interface ChatInputAreaProps {
  isLoading: boolean
  isDark: boolean
  theme: ReturnType<typeof useMantineTheme>
  contextNodes: ExtendedNode[]
  suggestions: string[]
  showLeftScroll: boolean
  showRightScroll: boolean
  suggestionContainerRef: React.RefObject<HTMLDivElement | null>
  onSendMessage: (message: string) => void
  onRemoveContextNode: (node: ExtendedNode) => void
//   onSuggestionClick: (suggestion: string) => void
  onScrollSuggestions: (direction: "left" | "right") => void
}

const ChatInputArea = ({
  isLoading,
  isDark,
  theme,
  contextNodes,
  suggestions,
  showLeftScroll,
  showRightScroll,
  suggestionContainerRef,
  onSendMessage,
  onRemoveContextNode,
//   onSuggestionClick,
  onScrollSuggestions,
}: ChatInputAreaProps) => {
  const [input, setInput] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    onSendMessage(input)
    setInput("")
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    // Fokus kembali ke textarea agar pengguna bisa langsung mengirim
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTextAreaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement
    target.style.height = "auto"
    target.style.height = `${target.scrollHeight}px`
  }

  // Ini adalah salinan-tempel LENGKAP dari JSX input area Anda
  return (
    <Box
      p="md"
      style={{
        flexShrink: 0,
        borderTop: `1px solid ${isDark ? theme.colors.dark[5] : theme.colors.gray[2]}`,
        background: isDark
          ? `linear-gradient(180deg, ${theme.colors.dark[7]} 0%, ${theme.colors.dark[8]} 100%)`
          : `linear-gradient(180deg, white 0%, ${theme.colors.gray[0]} 100%)`,
      }}
    >
      {contextNodes.length > 0 && (
        <Box px="md" py="xs" style={{ flexShrink: 0 }}>
            <Group mb="xs" gap="xs" wrap="wrap">
                {contextNodes.map((node) => (
                    <Badge
                        key={`context-node-${node.id}`}
                        variant="gradient"
                        gradient={{ from: "blue", to: "cyan", deg: 45 }}
                        size="sm"
                        radius="md"
                        style={{
                            paddingLeft: "8px",
                            paddingRight: "4px",
                            height: "24px",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "11px",
                            fontWeight: 500,
                            maxWidth: "200px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                        rightSection={
                            <ActionIcon size="xs" variant="transparent" color="white" onClick={() => onRemoveContextNode(node)}>
                                <IconX size={10} />
                            </ActionIcon>
                        }
                        leftSection={<IconPaperclip size={10} />}
                    >
                        {(node.title || node.label || '').length > 20 ? `${(node.title || node.label || '').substring(0, 20)}...` : node.title || node.label}
                    </Badge>
                ))}
            </Group>
        </Box>
      )}

      <Card
        withBorder
        radius="xl"
        p="md"
        shadow="sm"
        style={{
          background: isDark
            ? `linear-gradient(135deg, ${theme.colors.dark[6]} 0%, ${theme.colors.dark[7]} 100%)`
            : `linear-gradient(135deg, white 0%, ${theme.colors.gray[0]} 100%)`,
          border: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[2]}`,
        }}
      >
        <Group align="flex-end" gap="sm" mb="sm">
          <Box style={{ flex: 1 }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleTextAreaInput}
              placeholder={isLoading ? "Menunggu Respon AI..." : "Mulai mengetik..."}
              rows={1}
              style={{
                width: "100%", padding: "16px", backgroundColor: "transparent",
                color: isDark ? theme.colors.gray[2] : theme.black,
                border: "none", outline: "none", resize: "none",
                minHeight: "24px", maxHeight: "120px", overflow: "hidden",
                fontFamily: "inherit", fontSize: "14px", lineHeight: "1.5",
                borderRadius: theme.radius.md,
              }}
            />
          </Box>
          <ActionIcon
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="xl"
            variant="gradient"
            gradient={{ from: "blue", to: "cyan", deg: 45 }}
            radius="xl"
            style={{
              cursor: !input.trim() || isLoading ? "not-allowed" : "pointer",
              opacity: !input.trim() || isLoading ? 0.5 : 1,
              transition: "all 0.2s ease",
              transform: !input.trim() || isLoading ? "scale(0.95)" : "scale(1)",
            }}
          >
            <IconSend size={20} />
          </ActionIcon>
        </Group>

        {suggestions.length > 0 && (
          <Group align="center" gap="sm" style={{ position: "relative" }}>
            {showLeftScroll && (
              <ActionIcon onClick={() => onScrollSuggestions("left")} size="sm" variant="gradient" radius="xl">
                <IconChevronLeft size={14} />
              </ActionIcon>
            )}
            <Box ref={suggestionContainerRef} style={{ flex: 1, overflowX: "auto", scrollBehavior: "smooth", scrollbarWidth: "none" }}>
              <Group gap="xs" wrap="nowrap" style={{ minWidth: "fit-content" }}>
                {suggestions.map((suggestion, index) => (
                  <Button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    variant="light"
                    size="xs"
                    radius="lg"
                    style={{
                        background: isDark
                          ? `linear-gradient(135deg, ${theme.colors.dark[5]} 0%, ${theme.colors.dark[6]} 100%)`
                          : `linear-gradient(135deg, ${theme.colors.gray[1]} 0%, ${theme.colors.gray[0]} 100%)`,
                        color: isDark ? theme.colors.gray[3] : theme.colors.gray[7],
                        padding: "4px 10px",
                        border: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[3]}`,
                        whiteSpace: "nowrap",
                        fontSize: "11px",
                        fontWeight: 500,
                        minWidth: "fit-content",
                        maxWidth: "200px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        flexShrink: 0,
                        transition: "all 0.2s ease",
                        height: "24px",
                        lineHeight: "1",
                    }}
                    styles={{
                        root: {
                          "&:hover": {
                            transform: "translateY(-1px)",
                            boxShadow: theme.shadows.sm,
                            background: isDark
                              ? `linear-gradient(135deg, ${theme.colors.blue[8]} 0%, ${theme.colors.cyan[8]} 100%)`
                              : `linear-gradient(135deg, ${theme.colors.blue[0]} 0%, ${theme.colors.cyan[0]} 100%)`,
                          },
                        },
                    }}
                  >
                    {suggestion.length > 32 ? `${suggestion.substring(0, 32)}...` : suggestion}
                  </Button>
                ))}
              </Group>
            </Box>
            {showRightScroll && (
              <ActionIcon onClick={() => onScrollSuggestions("right")} size="sm" variant="gradient" radius="xl">
                <IconChevronRight size={14} />
              </ActionIcon>
            )}
            <Badge variant="light" color="blue" size="xs">
              {suggestions.length}
            </Badge>
          </Group>
        )}
      </Card>
    </Box>
  )
}

export default ChatInputArea
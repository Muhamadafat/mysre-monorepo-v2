'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  Menu,
  Popover,
  Stack,
  Text,
  useMantineTheme,
} from '@mantine/core';
import {
  IconArrowUp,
  IconChevronDown,
  IconPaperclip,
  IconPlayerStop,
  IconPlus,
  IconSearch,
  IconTarget,
  IconX,
} from '@tabler/icons-react';
import type { ExtendedNode } from '../types';

type ChatMode = 'STRICT' | 'RESEARCH';
type ModelOption = 'GPT 5.4' | 'GPT 5.4 Nano';

interface ChatInputAreaProps {
  isLoading: boolean;
  isDark: boolean;
  theme: ReturnType<typeof useMantineTheme>;
  contextNodes: ExtendedNode[];
  availableContextNodes: ExtendedNode[];
  suggestions: string[];
  showLeftScroll: boolean;
  showRightScroll: boolean;
  suggestionContainerRef: React.RefObject<HTMLDivElement | null>;
  chatMode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  onSendMessage: (message: string) => void;
  onCancelStream: () => void;
  onRemoveContextNode: (node: ExtendedNode) => void;
  onToggleContextNode: (node: ExtendedNode, checked: boolean) => void;
  onScrollSuggestions: (direction: 'left' | 'right') => void;
}

const MODE_COPY: Record<ChatMode, { label: string; description: string }> = {
  STRICT: {
    label: 'Strict',
    description: 'Fokus analisis eksklusif pada dokumen yang sedang dipilih',
  },
  RESEARCH: {
    label: 'Research',
    description: 'Sintesis lintas dokumen berdasarkan relasi knowledge graph',
  },
};

const getNodeLabel = (node: ExtendedNode) => {
  const rawLabel =
    typeof node.title === 'string' && node.title.trim().length > 0
      ? node.title
      : typeof node.label === 'string' && node.label.trim().length > 0
        ? node.label
        : `Dokumen ${String(node.id)}`;

  return rawLabel.length > 42 ? `${rawLabel.slice(0, 42)}...` : rawLabel;
};

const ChatInputArea = ({
  isLoading,
  isDark,
  theme,
  contextNodes,
  availableContextNodes,
  suggestions,
  showLeftScroll,
  showRightScroll,
  suggestionContainerRef,
  chatMode,
  onModeChange,
  onSendMessage,
  onCancelStream,
  onRemoveContextNode,
  onToggleContextNode,
  onScrollSuggestions,
}: ChatInputAreaProps) => {
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<ModelOption>('GPT 5.4');
  const [filePopoverOpened, setFilePopoverOpened] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedNodeIds = useMemo(
    () => new Set(contextNodes.map((node) => String(node.id))),
    [contextNodes]
  );

  const uniqueAvailableNodes = useMemo(() => {
    const seen = new Set<string>();

    return availableContextNodes.filter((node) => {
      const id = String(node.id);
      if (!node.id || seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    });
  }, [availableContextNodes]);

  const handlePrimaryAction = () => {
    if (isLoading) {
      onCancelStream();
      return;
    }

    if (!input.trim()) return;

    onSendMessage(input);
    setInput('');

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handlePrimaryAction();
    }
  };

  const handleTextAreaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    target.style.height = 'auto';
    target.style.height = `${target.scrollHeight}px`;
  };

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
      <Box
        style={{
          borderRadius: 11,
          border: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[3]}`,
          background: isDark ? theme.colors.dark[7] : theme.white,
          padding: '14px 14px 12px',
          boxShadow: isDark ? 'none' : '0 8px 24px rgba(15, 23, 42, 0.06)',
        }}
      >
        {contextNodes.length > 0 && (
          <Box
            mb="sm"
            style={{
              overflowX: 'auto',
              overflowY: 'hidden',
              scrollbarWidth: 'thin',
              paddingBottom: 2,
            }}
          >
            <Group gap="xs" wrap="nowrap" style={{ minWidth: 'max-content' }}>
              {contextNodes.map((node) => (
                <Badge
                  key={`context-node-${node.id}`}
                  variant="light"
                  color="gray"
                  size="lg"
                  radius="xl"
                  style={{
                    paddingLeft: '10px',
                    paddingRight: '6px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 500,
                    maxWidth: '260px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    border: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[3]}`,
                    background: isDark ? theme.colors.dark[6] : theme.colors.gray[0],
                    color: isDark ? theme.colors.gray[2] : theme.colors.gray[8],
                  }}
                  leftSection={<IconPaperclip size={11} />}
                  rightSection={
                    <ActionIcon
                      size="xs"
                      variant="transparent"
                      color="gray"
                      onClick={() => onRemoveContextNode(node)}
                    >
                      <IconX size={11} />
                    </ActionIcon>
                  }
                >
                  {getNodeLabel(node)}
                </Badge>
              ))}
            </Group>
          </Box>
        )}

        <Box mb="sm">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleTextAreaInput}
            placeholder="Tanyakan sesuatu tentang dokumen ini..."
            rows={1}
            style={{
              width: '100%',
              padding: 0,
              backgroundColor: 'transparent',
              color: isDark ? theme.colors.gray[2] : theme.black,
              border: 'none',
              outline: 'none',
              resize: 'none',
              minHeight: '72px',
              maxHeight: '160px',
              overflowY: 'auto',
              fontFamily: 'inherit',
              fontSize: '16px',
              lineHeight: 1.55,
            }}
          />
        </Box>

        <Group align="center" justify="space-between" gap="sm" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <Popover
              opened={filePopoverOpened}
              onChange={setFilePopoverOpened}
              position="top-start"
              withArrow
              shadow="md"
              withinPortal
            >
              <Popover.Target>
                <ActionIcon
                  onClick={() => setFilePopoverOpened((prev) => !prev)}
                  size={40}
                  radius="xl"
                  variant="default"
                  aria-label="Pilih dokumen"
                  style={{
                    border: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[3]}`,
                    background: isDark ? theme.colors.dark[6] : theme.white,
                  }}
                >
                  <IconPlus size={18} />
                </ActionIcon>
              </Popover.Target>
              <Popover.Dropdown
                style={{
                  width: 300,
                  padding: 12,
                  background: isDark ? theme.colors.dark[7] : theme.white,
                  border: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[3]}`,
                }}
              >
                <Stack gap="sm">
                  <Box>
                    <Text size="sm" fw={600}>
                      Pilih dokumen
                    </Text>
                    <Text size="xs" c="dimmed">
                      Centang dokumen yang ingin dilampirkan ke percakapan.
                    </Text>
                  </Box>

                  {uniqueAvailableNodes.length > 0 ? (
                    <Stack gap="xs">
                      {uniqueAvailableNodes.map((node) => {
                        const nodeId = String(node.id);
                        return (
                          <Checkbox
                            key={`composer-node-${nodeId}`}
                            checked={selectedNodeIds.has(nodeId)}
                            onChange={(event) =>
                              onToggleContextNode(node, event.currentTarget.checked)
                            }
                            label={getNodeLabel(node)}
                            styles={{
                              body: { alignItems: 'flex-start' },
                              label: {
                                fontSize: '13px',
                                lineHeight: 1.35,
                                color: isDark ? theme.colors.gray[2] : theme.colors.gray[8],
                              },
                            }}
                          />
                        );
                      })}
                    </Stack>
                  ) : (
                    <Text size="sm" c="dimmed">
                      Belum ada dokumen yang tersedia untuk dipilih.
                    </Text>
                  )}
                </Stack>
              </Popover.Dropdown>
            </Popover>

            <Menu shadow="md" width={170} withinPortal>
              <Menu.Target>
                <Button
                  variant="subtle"
                  color="gray"
                  radius="md"
                  rightSection={<IconChevronDown size={14} />}
                  styles={{
                    root: { paddingInline: 6 },
                    label: {
                      fontSize: '14px',
                      fontWeight: 600,
                      color: isDark ? theme.colors.gray[2] : theme.colors.gray[7],
                    },
                  }}
                >
                  {selectedModel}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={() => setSelectedModel('GPT 5.4')}>
                  GPT 5.4
                </Menu.Item>
                <Menu.Item onClick={() => setSelectedModel('GPT 5.4 Nano')}>
                  GPT 5.4 Nano
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>

          <Group gap="sm" wrap="nowrap" style={{ paddingRight: 4 }}>
            <Menu shadow="md" width={280} withinPortal position="top-end">
              <Menu.Target>
                <Button
                  variant="light"
                  color="gray"
                  radius="md"
                  leftSection={
                    chatMode === 'STRICT' ? (
                      <IconTarget size={14} />
                    ) : (
                      <IconSearch size={14} />
                    )
                  }
                  rightSection={<IconChevronDown size={14} />}
                  styles={{
                    root: {
                      border: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[3]}`,
                      background: isDark ? theme.colors.dark[6] : theme.colors.gray[0],
                    },
                    label: {
                      fontSize: '14px',
                      fontWeight: 600,
                      color: isDark ? theme.colors.gray[2] : theme.colors.gray[7],
                    },
                  }}
                >
                  {MODE_COPY[chatMode].label}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                {(['STRICT', 'RESEARCH'] as ChatMode[]).map((mode) => (
                  <Menu.Item key={mode} onClick={() => onModeChange(mode)}>
                    <Stack gap={2}>
                      <Text size="sm" fw={600}>
                        {MODE_COPY[mode].label}
                      </Text>
                      <Text size="xs" c="dimmed" style={{ whiteSpace: 'normal' }}>
                        {MODE_COPY[mode].description}
                      </Text>
                    </Stack>
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>

            <ActionIcon
              onClick={handlePrimaryAction}
              disabled={!isLoading && !input.trim()}
              size={40}
              radius="xl"
              variant="filled"
              color={!isLoading && !input.trim() ? 'gray' : 'blue'}
              aria-label={isLoading ? 'Stop' : 'Send'}
              style={{
                cursor: !isLoading && !input.trim() ? 'not-allowed' : 'pointer',
                opacity: !isLoading && !input.trim() ? 0.55 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              {isLoading ? <IconPlayerStop size={16} /> : <IconArrowUp size={16} />}
            </ActionIcon>
          </Group>
        </Group>
      </Box>

      {suggestions.length > 0 && (
        <Group mt="sm" align="center" gap="sm" style={{ position: 'relative' }}>
          {showLeftScroll && (
            <ActionIcon
              onClick={() => onScrollSuggestions('left')}
              size="sm"
              variant="subtle"
              radius="xl"
              color="gray"
            >
              <IconArrowUp
                size={14}
                style={{ transform: 'rotate(-90deg)' }}
              />
            </ActionIcon>
          )}

          <Box
            ref={suggestionContainerRef}
            style={{
              flex: 1,
              overflowX: 'auto',
              scrollBehavior: 'smooth',
              scrollbarWidth: 'none',
            }}
          >
            <Group gap="xs" wrap="nowrap" style={{ minWidth: 'fit-content' }}>
              {suggestions.map((suggestion, index) => (
                <Button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  variant="light"
                  size="xs"
                  radius="xl"
                  style={{
                    background: isDark ? theme.colors.dark[6] : theme.colors.gray[0],
                    color: isDark ? theme.colors.gray[3] : theme.colors.gray[7],
                    padding: '4px 12px',
                    border: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[3]}`,
                    whiteSpace: 'nowrap',
                    fontSize: '12px',
                    fontWeight: 500,
                    minWidth: 'fit-content',
                    maxWidth: '220px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    flexShrink: 0,
                    height: '28px',
                  }}
                >
                  {suggestion}
                </Button>
              ))}
            </Group>
          </Box>

          {showRightScroll && (
            <ActionIcon
              onClick={() => onScrollSuggestions('right')}
              size="sm"
              variant="subtle"
              radius="xl"
              color="gray"
            >
              <IconArrowUp size={14} style={{ transform: 'rotate(90deg)' }} />
            </ActionIcon>
          )}
        </Group>
      )}
    </Box>
  );
};

export default ChatInputArea;

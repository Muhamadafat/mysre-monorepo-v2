/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  CopyButton,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
  Transition,
  Typography,
  useMantineTheme,
} from '@mantine/core';
import {
  IconCheck,
  IconCopy,
  IconFileText,
  IconHelp,
  IconSparkles,
} from '@tabler/icons-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage, Reference } from '../types';

interface ChatMessageItemProps {
  msg: ChatMessage;
  isDark: boolean;
  theme: ReturnType<typeof useMantineTheme>;
  onTextSelect: (
    e: React.MouseEvent<HTMLDivElement>,
    message: ChatMessage
  ) => void;
  onOpenHelp: () => void;
  handlerOpenPdf: (url: string) => void;
}

const MAX_VISIBLE_REFERENCES = 3;

const getReferenceTitle = (reference: Reference) => {
  return reference.title || reference.text || 'Dokumen Akademis';
};

const truncateReferenceTitle = (title: string, maxLength = 44) => {
  if (title.length <= maxLength) {
    return title;
  }

  return `${title.slice(0, maxLength - 3)}...`;
};

const getReferenceBadge = (reference: Reference, index: number) => {
  return reference.ref_mark || `Ref ${index + 1}`;
};

const getSortedReferences = (references?: Reference[]) => {
  if (!references) {
    return [];
  }

  return [...references]
    .sort((a, b) => (a.index ?? 999) - (b.index ?? 999))
    .filter(
      (reference, index, items) =>
        items.findIndex((item) => item.url === reference.url) === index
    );
};

const sanitizeAiMessageText = (text: string) => {
  return text
    .replace(
      /\n{2,}(?:#{1,6}\s*)?(?:\*\*)?(?:sumber(?:\s+bacaan)?|referensi)(?:\*\*)?:?[\s\S]*$/i,
      ''
    )
    .trim();
};

const getAssistantModeLabel = (mode?: ChatMessage['mode']) => {
  if (mode === 'RESEARCH') {
    return 'RESEARCH';
  }

  return 'STRICT';
};

const ChatMessageItemComponent = ({
  msg,
  isDark,
  theme,
  onTextSelect,
  onOpenHelp,
  handlerOpenPdf,
}: ChatMessageItemProps) => {
  const [showAllReferences, setShowAllReferences] = useState(false);
  const sortedReferences = useMemo(
    () => getSortedReferences(msg.references),
    [msg.references]
  );
  const visibleReferences = showAllReferences
    ? sortedReferences
    : sortedReferences.slice(0, MAX_VISIBLE_REFERENCES);
  const hiddenReferenceCount = Math.max(
    0,
    sortedReferences.length - MAX_VISIBLE_REFERENCES
  );
  const sanitizedText =
    msg.sender === 'ai' ? sanitizeAiMessageText(msg.text) : msg.text;

  if (msg.sender === 'user') {
    return (
      <Transition
        mounted={true}
        transition="slide-up"
        duration={300}
        timingFunction="ease"
      >
        {(styles) => (
          <Card
            shadow="sm"
            style={{
              ...styles,
              alignSelf: 'flex-end',
              background: '#8b5cf6',
              maxWidth: '85%',
              padding: '16px 18px',
              border: 'none',
              borderRadius: '18px 18px 8px 18px',
            }}
          >
            <Text
              size="sm"
              fw={500}
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
                color: 'rgba(255, 255, 255, 0.96)',
              }}
            >
              {msg.text}
            </Text>
          </Card>
        )}
      </Transition>
    );
  }

  return (
    <Transition
      mounted={true}
      transition="slide-up"
      duration={300}
      timingFunction="ease"
    >
      {(styles) => (
        <Box
          style={{
            ...styles,
            alignSelf: 'flex-start',
            maxWidth: '85%',
          }}
        >
          <Group gap="sm" mb="xs" align="center">
            <ThemeIcon
              size="sm"
              radius="xl"
              variant="light"
              color="violet"
              style={{
                background: isDark
                  ? theme.colors.violet[9]
                  : theme.colors.violet[0],
                border: `1px solid ${isDark ? theme.colors.violet[7] : theme.colors.violet[2]}`,
              }}
            >
              <IconSparkles size={14} />
            </ThemeIcon>
            <Group gap={8} align="center">
              <Text
                size="sm"
                fw={600}
                c={isDark ? theme.colors.gray[3] : theme.colors.gray[7]}
              >
                SRE Assistant
              </Text>
              <Badge
                size="xs"
                radius="xl"
                variant="light"
                color="gray"
                style={{
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {getAssistantModeLabel(msg.mode)}
              </Badge>
            </Group>
          </Group>

          <Card
            shadow="sm"
            radius={9}
            withBorder
            onMouseUp={(e) => onTextSelect(e, msg)}
            style={{
              background: isDark
                ? `linear-gradient(135deg, ${theme.colors.dark[6]} 0%, ${theme.colors.dark[7]} 100%)`
                : `linear-gradient(135deg, ${theme.colors.gray[0]} 0%, white 100%)`,
              padding: '18px 18px 14px',
              border: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[2]}`,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Typography className="ai-message-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => (
                    <Box
                      mb="xs"
                      style={{
                        lineHeight: 1.75,
                        fontSize: '14px',
                        color: isDark ? theme.colors.gray[2] : theme.colors.gray[8],
                      }}
                    >
                      {children}
                    </Box>
                  ),
                  a: ({ children }) => (
                    <Text
                      component="span"
                      c={isDark ? theme.colors.gray[2] : theme.colors.gray[8]}
                      fw={500}
                    >
                      {children}
                    </Text>
                  ),
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
                    <Text
                      component="li"
                      size="sm"
                      mb="xs"
                      style={{ lineHeight: 1.6 }}
                    >
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
                    const isInline = !className;
                    return isInline ? (
                      <Badge
                        variant="light"
                        color="gray"
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.8em',
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
                        style={{ overflow: 'auto' }}
                      >
                        <Text
                          component="pre"
                          size="sm"
                          style={{
                            fontFamily: 'monospace',
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          <code>{children}</code>
                        </Text>
                      </Paper>
                    );
                  },
                  table: ({ children }) => (
                    <Box style={{ overflowX: 'auto' }} mb="md">
                      <Box
                        component="table"
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          fontSize: '0.875rem',
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
                        backgroundColor: isDark
                          ? theme.colors.dark[7]
                          : theme.colors.gray[0],
                        fontWeight: 600,
                        textAlign: 'left',
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
                        verticalAlign: 'top',
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
                        backgroundColor: isDark
                          ? theme.colors.dark[7]
                          : theme.colors.blue[0],
                      }}
                    >
                      {children}
                    </Paper>
                  ),
                }}
              >
                {sanitizedText}
              </ReactMarkdown>
            </Typography>

            {(msg as any).showHelpButton && (
              <Box mt="md">
                <Button
                  variant="gradient"
                  gradient={{ from: 'blue', to: 'cyan' }}
                  leftSection={<IconHelp size={16} />}
                  onClick={onOpenHelp}
                  size="sm"
                  style={{ fontWeight: 500 }}
                >
                  Buka Panduan Penggunaan
                </Button>
              </Box>
            )}

            {sortedReferences.length > 0 && (
              <Box
                mt="md"
                style={{
                  borderTop: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[2]}`,
                  paddingTop: 10,
                }}
              >
                <Text
                  size="xs"
                  fw={600}
                  c={isDark ? theme.colors.gray[4] : theme.colors.gray[6]}
                  mb="xs"
                  style={{ letterSpacing: '0.06em' }}
                >
                  SUMBER
                </Text>

                <Stack gap={6}>
                  {visibleReferences.map((ref, idx) => (
                    <Button
                      key={`${ref.url}-${idx}`}
                      variant="subtle"
                      justify="space-between"
                      fullWidth
                      leftSection={
                        <ThemeIcon size={20} radius="xl" variant="light" color="gray">
                          <IconFileText size={11} />
                        </ThemeIcon>
                      }
                      rightSection={
                        <Text size="11px" c="dimmed" fw={500}>
                          {getReferenceBadge(ref, idx)}
                        </Text>
                      }
                      style={{
                        height: 'auto',
                        padding: '8px 10px',
                        borderRadius: 8,
                        backgroundColor: isDark ? theme.colors.dark[7] : theme.white,
                        border: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[2]}`,
                      }}
                      styles={{
                        inner: {
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          width: '100%',
                        },
                        label: {
                          flex: 1,
                          minWidth: 0,
                        },
                      }}
                      onClick={() => handlerOpenPdf(ref.url)}
                    >
                      <Tooltip
                        label={getReferenceTitle(ref)}
                        multiline
                        maw={360}
                        withArrow
                      >
                        <Text
                          size="12px"
                          fw={500}
                          c={isDark ? theme.colors.gray[2] : theme.colors.gray[8]}
                          ta="left"
                          style={{
                            lineHeight: 1.35,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={getReferenceTitle(ref)}
                        >
                          {truncateReferenceTitle(getReferenceTitle(ref))}
                        </Text>
                      </Tooltip>
                    </Button>
                  ))}
                </Stack>

                {hiddenReferenceCount > 0 && (
                  <Button
                    variant="subtle"
                    color="gray"
                    size="xs"
                    mt="xs"
                    px={0}
                    onClick={() => setShowAllReferences((prev) => !prev)}
                    styles={{
                      root: { height: 'auto' },
                      label: { fontSize: '12px', fontWeight: 500 },
                    }}
                  >
                    {showAllReferences
                      ? 'Tampilkan lebih sedikit'
                      : `Lihat lebih banyak (${hiddenReferenceCount})`}
                  </Button>
                )}
              </Box>
            )}

            <Group justify="flex-end" mt="sm">
              <CopyButton value={msg.text} timeout={2000}>
                {({ copied, copy }) => (
                  <Tooltip
                    label={copied ? 'Berhasil disalin' : 'Salin jawaban'}
                    position="top"
                    withArrow
                  >
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      onClick={copy}
                      style={{
                        transition: 'all 0.2s ease',
                        transform: copied ? 'scale(1.1)' : 'scale(1)',
                      }}
                    >
                      {copied ? (
                        <IconCheck
                          size={15}
                          style={{ color: theme.colors.green[6] }}
                        />
                      ) : (
                        <IconCopy
                          size={15}
                          style={{ color: theme.colors.gray[6] }}
                        />
                      )}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
          </Card>
        </Box>
      )}
    </Transition>
  );
};

export default React.memo(ChatMessageItemComponent);

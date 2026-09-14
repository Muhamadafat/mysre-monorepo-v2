import { fetchEventSource } from '@microsoft/fetch-event-source';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Reference } from '../types';

export type ChatMode = 'STRICT' | 'RESEARCH';
export type ChatMilestoneStep = 'router' | 'retrieval' | 'compressor';
export type ChatStreamStatus =
  | 'idle'
  | 'streaming'
  | 'completed'
  | 'error'
  | 'cancelled';

export interface ChatRequestContext {
  projectId: string;
  chatSessionId?: string;
  question: string;
  activeHashes: string[];
  mode: ChatMode;
  hasUsedResearch: boolean;
  contextSnapshot?: Record<string, unknown> | null;
}

export interface ChatMilestone {
  step: ChatMilestoneStep | string;
  label: string;
  details?: string;
  receivedAt: number;
}

export interface ChatMetrics {
  latency_ms?: number;
  tokens?: number;
  reference_count?: number;
  [key: string]: unknown;
}

export interface ActiveChatStream {
  role: 'assistant';
  text: string;
  status: ChatStreamStatus;
  references: Reference[];
  metrics?: ChatMetrics;
}

export interface ChatStoreMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  references?: Reference[];
  createdAt: number;
}

export interface MilestoneEventPayload {
  step: ChatMilestoneStep | string;
  label: string;
  details?: string;
}

export interface ChunkEventPayload {
  text: string;
}

export interface FinalEventPayload {
  references: Reference[];
  metrics?: ChatMetrics;
}

export interface ErrorEventPayload {
  message: string;
  code?: number;
}

export interface StreamChatOptions extends ChatRequestContext {
  endpoint?: string;
}

export interface ChatState {
  messages: ChatStoreMessage[];
  activeStream: ActiveChatStream | null;
  milestones: ChatMilestone[];
  isStreaming: boolean;
  streamError: string | null;
  hasUsedResearch: boolean;
  lastRequest: ChatRequestContext | null;
  abortController: AbortController | null;
  setMessages: (messages: ChatStoreMessage[]) => void;
  appendMessage: (message: ChatStoreMessage) => void;
  startStream: (request: ChatRequestContext) => void;
  streamChat: (request: StreamChatOptions) => Promise<void>;
  appendStreamChunk: (payload: ChunkEventPayload) => void;
  pushMilestone: (payload: MilestoneEventPayload) => void;
  completeStream: (payload: FinalEventPayload) => void;
  failStream: (payload: ErrorEventPayload) => void;
  cancelStream: () => void;
  clearMilestones: () => void;
  resetTransientState: () => void;
  setAbortController: (controller: AbortController | null) => void;
  setHasUsedResearch: (value: boolean) => void;
}

type PersistedChatState = Pick<
  ChatState,
  | 'messages'
  | 'activeStream'
  | 'milestones'
  | 'isStreaming'
  | 'streamError'
  | 'hasUsedResearch'
  | 'lastRequest'
>;

const createEmptyAssistantStream = (): ActiveChatStream => ({
  role: 'assistant',
  text: '',
  status: 'streaming',
  references: [],
});

const DEFAULT_CHAT_STREAM_ENDPOINT = '/api/chat/stream_pral';

const createUserMessage = (request: ChatRequestContext): ChatStoreMessage => ({
  id: `user-${Date.now()}`,
  role: 'user',
  text: request.question,
  createdAt: Date.now(),
});

const parseEventPayload = <T>(rawData: string): T => JSON.parse(rawData) as T;

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError';

export const useChatStore = create<ChatState>()(
  persist<ChatState, [], [], PersistedChatState>(
    (set) => ({
  messages: [],
  activeStream: null,
  milestones: [],
  isStreaming: false,
  streamError: null,
  hasUsedResearch: false,
  lastRequest: null,
  abortController: null,

  setMessages: (messages) => set({ messages }),

  appendMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  startStream: (request) =>
    set({
      messages: [...useChatStore.getState().messages, createUserMessage(request)],
      activeStream: createEmptyAssistantStream(),
      milestones: [],
      isStreaming: true,
      streamError: null,
      lastRequest: request,
      hasUsedResearch: request.hasUsedResearch,
    }),

  streamChat: async (request) => {
    const controller = new AbortController();
    const endpoint = request.endpoint ?? DEFAULT_CHAT_STREAM_ENDPOINT;

    set({ abortController: controller });
    useChatStore.getState().startStream(request);

    try {
      await fetchEventSource(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          question: request.question,
          projectId: request.projectId,
          chatSessionId: request.chatSessionId,
          activeHashes: request.activeHashes,
          mode: request.mode,
          hasUsedResearch: request.hasUsedResearch,
          contextSnapshot: request.contextSnapshot ?? null,
        }),
        signal: controller.signal,
        openWhenHidden: true,
        async onopen(response) {
          const contentType = response.headers.get('content-type');
          if (
            response.ok &&
            contentType?.includes('text/event-stream')
          ) {
            return;
          }

          if (
            response.status >= 400 &&
            response.status < 500 &&
            response.status !== 429
          ) {
            throw new Error(`Failed to open chat stream: ${response.status}`);
          }
        },
        onmessage(message) {
          if (!message.data?.trim()) {
            return;
          }

          try {
            if (message.event === 'milestone') {
              useChatStore
                .getState()
                .pushMilestone(parseEventPayload<MilestoneEventPayload>(message.data));
              return;
            }

            if (message.event === 'chunk') {
              useChatStore
                .getState()
                .appendStreamChunk(parseEventPayload<ChunkEventPayload>(message.data));
              return;
            }

            if (message.event === 'final') {
              useChatStore
                .getState()
                .completeStream(parseEventPayload<FinalEventPayload>(message.data));
              controller.abort();
              return;
            }

            if (message.event === 'error') {
              const payload = parseEventPayload<ErrorEventPayload>(message.data);
              useChatStore.getState().failStream(payload);
              throw new Error(payload.message);
            }
          } catch (error) {
            const messageText =
              error instanceof Error
                ? error.message
                : 'Failed to parse chat SSE payload.';
            useChatStore.getState().failStream({ message: messageText });
            throw error;
          }
        },
        onclose() {
          const state = useChatStore.getState();
          if (state.isStreaming) {
            state.failStream({
              message: 'Chat stream closed before final event was received.',
            });
          }
        },
        onerror(error) {
          if (controller.signal.aborted || isAbortError(error)) {
            return;
          }

          const message =
            error instanceof Error
              ? error.message
              : 'Failed to connect to chat streaming endpoint.';
          useChatStore.getState().failStream({ message });
          throw error;
        },
      });
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) {
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Failed to establish chat stream.';
      useChatStore.getState().failStream({ message });
      throw error;
    }
  },

  appendStreamChunk: ({ text }) =>
    set((state) => {
      const activeStream = state.activeStream ?? createEmptyAssistantStream();

      return {
        activeStream: {
          ...activeStream,
          text: activeStream.text + text,
          status: 'streaming',
        },
      };
    }),

  pushMilestone: ({ step, label, details }) =>
    set((state) => ({
      milestones: [
        ...state.milestones,
        {
          step,
          label,
          details,
          receivedAt: Date.now(),
        },
      ],
    })),

  completeStream: ({ references, metrics }) =>
    set((state) => {
      const activeStream = state.activeStream ?? createEmptyAssistantStream();

      return {
        activeStream: {
          ...activeStream,
          status: 'completed',
          references,
          metrics,
        },
        isStreaming: false,
        abortController: null,
      };
    }),

  failStream: ({ message }) =>
    set((state) => ({
      activeStream: state.activeStream
        ? {
            ...state.activeStream,
            status: 'error',
          }
        : null,
      isStreaming: false,
      streamError: message,
      abortController: null,
    })),

  cancelStream: () =>
    set((state) => {
      state.abortController?.abort();

      return {
        activeStream: state.activeStream
          ? {
              ...state.activeStream,
              status: 'cancelled',
            }
          : null,
        isStreaming: false,
        streamError: null,
        abortController: null,
      };
    }),

  clearMilestones: () => set({ milestones: [] }),

  resetTransientState: () =>
    set({
      activeStream: null,
      milestones: [],
      isStreaming: false,
      streamError: null,
      abortController: null,
    }),

  setAbortController: (controller) => set({ abortController: controller }),

  setHasUsedResearch: (value) => set({ hasUsedResearch: value }),
    }),
    {
      name: 'chat-stream-storage',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState: unknown): PersistedChatState => {
        if (!persistedState || typeof persistedState !== 'object') {
          return {
            messages: [],
            activeStream: null,
            milestones: [],
            isStreaming: false,
            streamError: null,
            hasUsedResearch: false,
            lastRequest: null,
          } satisfies PersistedChatState;
        }

        const persisted = persistedState as Partial<PersistedChatState>;

        return {
          messages: Array.isArray(persisted.messages)
            ? persisted.messages
            : [],
          activeStream: persisted.activeStream ?? null,
          milestones: Array.isArray(persisted.milestones)
            ? persisted.milestones
            : [],
          isStreaming:
            typeof persisted.isStreaming === 'boolean'
              ? persisted.isStreaming
              : false,
          streamError:
            typeof persisted.streamError === 'string'
              ? persisted.streamError
              : null,
          hasUsedResearch:
            typeof persisted.hasUsedResearch === 'boolean'
              ? persisted.hasUsedResearch
              : false,
          lastRequest: persisted.lastRequest ?? null,
        } satisfies PersistedChatState;
      },
      partialize: (state): PersistedChatState => ({
        messages: state.messages,
        activeStream: state.activeStream,
        milestones: state.milestones,
        isStreaming: state.isStreaming,
        streamError: state.streamError,
        hasUsedResearch: state.hasUsedResearch,
        lastRequest: state.lastRequest,
      }),
    }
  )
);

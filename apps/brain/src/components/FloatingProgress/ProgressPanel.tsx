import React, { useEffect, useRef } from 'react';
import {
  Stack,
  Affix,
  ActionIcon,
  Group,
  Text,
  ScrollArea,
  Tooltip,
} from '@mantine/core';
import { IconClearAll, IconX } from '@tabler/icons-react';
import { useUploadStore } from '@/store/useUploadStore';
import { ProgressItem } from './ProgressItem';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import type { UploadJob } from '@/store/useUploadStore';
import './progress.css';

interface ProgressPanelProps {
  projectId?: string | null;
}

export function ProgressPanel({ projectId }: ProgressPanelProps) {
  const jobs = useUploadStore((state) => state.jobs);
  const updateJob = useUploadStore((state) => state.updateJob);
  const removeJob = useUploadStore((state) => state.removeJob);
  const clearTerminalJobs = useUploadStore((state) => state.clearTerminalJobs);
  const clearCompleted = useUploadStore((state) => state.clearCompleted);

  const visibleJobs = Object.fromEntries(
    (Object.entries(jobs) as [string, UploadJob][]).filter(([_, job]) =>
      projectId ? job.projectId === projectId : true
    )
  ) as Record<string, UploadJob>;
  const jobKeys = Object.keys(visibleJobs);
  const hasActiveJobs = jobKeys.length > 0;

  // We need to keep track of active abort controllers so we can cancel them if needed.
  // Using a ref to store a map of jobId -> AbortController
  const controllersRef = useRef<Record<string, AbortController>>({});
  const reconnectAttemptsRef = useRef<Record<string, number>>({});
  const reconnectTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const cleanupTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const MAX_RECONNECT_ATTEMPTS = 1;
  const RECONNECT_DELAY_MS = 1000;
  // Keep completed upload jobs on screen long enough for the next phase
  // (indexing / ghost-worker embedding) to appear and inherit the panel.
  const TERMINAL_CLEANUP_DELAY_MS = 60000;

  const clearTimer = (
    timersRef: React.MutableRefObject<Record<string, ReturnType<typeof setTimeout>>>,
    jobId: string
  ) => {
    const timer = timersRef.current[jobId];
    if (timer) {
      clearTimeout(timer);
      delete timersRef.current[jobId];
    }
  };

  const scheduleTerminalCleanup = (jobId: string) => {
    clearTimer(cleanupTimersRef, jobId);
    cleanupTimersRef.current[jobId] = setTimeout(() => {
      const currentJob = useUploadStore.getState().jobs[jobId];
      if (
        currentJob &&
        (currentJob.status === 'COMPLETED' || currentJob.status === 'FAILED')
      ) {
        clearTerminalJobs();
      }
      delete cleanupTimersRef.current[jobId];
    }, TERMINAL_CLEANUP_DELAY_MS);
  };

  const resetReconnectState = (jobId: string) => {
    reconnectAttemptsRef.current[jobId] = 0;
    clearTimer(reconnectTimersRef, jobId);
  };

  const markTerminalAndCleanup = (
    jobId: string,
    updates: Parameters<typeof updateJob>[1]
  ) => {
    updateJob(jobId, updates);
    resetReconnectState(jobId);
    scheduleTerminalCleanup(jobId);
  };

  useEffect(() => {
    // Lapis 2 GC: Sync controllers and abort SSE for jobs that are no longer in state or are completed/failed
    Object.keys(controllersRef.current).forEach((activeJobId) => {
      const job = visibleJobs[activeJobId];
      if (!job || job.status === 'COMPLETED' || job.status === 'FAILED') {
        controllersRef.current[activeJobId].abort();
        delete controllersRef.current[activeJobId];
        resetReconnectState(activeJobId);
        clearTimer(cleanupTimersRef, activeJobId);
      }
    });

    // Check all jobs to see if we need to start an SSE connection for them
    jobKeys.forEach((jobId) => {
      const job = visibleJobs[jobId];

      // Bypass SSE connection for virtual indexing jobs injected from frontend UI
      if (jobId.startsWith('indexing-')) return;

      // Only connect if it's in a processing state and we don't already have an active controller
      if (
        (job.status === 'INITIALIZING' ||
          job.status === 'PROCESSING' ||
          job.status === 'UPLOADING') &&
        !controllersRef.current[jobId]
      ) {
        const connectSSE = async () => {
          const controller = new AbortController();
          controllersRef.current[jobId] = controller;

          try {
            const url = `/api/ingestion/upload/stream?job_id=${encodeURIComponent(jobId)}&project_id=${encodeURIComponent(job.projectId)}`;

            await fetchEventSource(url, {
              method: 'GET',
              headers: {
                Accept: 'text/event-stream',
              },
              signal: controller.signal,
              openWhenHidden: true,

              async onopen(response) {
                if (
                  response.ok &&
                  response.headers
                    .get('content-type')
                    ?.includes('text/event-stream')
                ) {
                  // Connection successful
                  resetReconnectState(jobId);
                  return;
                } else if (
                  response.status >= 400 &&
                  response.status < 500 &&
                  response.status !== 429
                ) {
                  // Client error (e.g. 401, 403, 404). Don't retry.
                  throw new Error(
                    `Failed to connect to progress stream: ${response.status}`
                  );
                }
                // Server error or rate limit, library will retry
              },

              onmessage(msg) {
                // Parse the message
                try {
                  if (!msg.data || msg.data.trim() === '') return;
                  // msg.data is stringified JSON
                  const data = JSON.parse(msg.data);
                  resetReconnectState(jobId);

                  // Expected payload: { stage: string, progress: number, message: string, done: boolean, error: string }

                  if (data.stage === 'COMPLETED' || data.done === true) {
                    markTerminalAndCleanup(jobId, {
                      progress: 100,
                      stage: 'COMPLETED',
                      status: 'COMPLETED',
                      message:
                        data.message || 'Process completed successfully.',
                    });
                    // Once completed, we can close the connection
                    if (controllersRef.current[jobId]) {
                      controllersRef.current[jobId].abort();
                      delete controllersRef.current[jobId];
                    }
                  } else if (data.stage === 'FAILED' || data.error) {
                    markTerminalAndCleanup(jobId, {
                      status: 'FAILED',
                      stage: 'FAILED',
                      error:
                        data.error ||
                        data.message ||
                        'An error occurred during processing.',
                    });
                    if (controllersRef.current[jobId]) {
                      controllersRef.current[jobId].abort();
                      delete controllersRef.current[jobId];
                    }
                  } else {
                    // Regular progress update
                    updateJob(jobId, {
                      progress: data.progress || 0,
                      stage: data.stage || 'PROCESSING',
                      status: 'PROCESSING',
                      message: data.message,
                    });
                  }
                } catch (e) {
                  console.error('Failed to parse SSE message:', e);
                }
              },

              onclose() {
                // The server closed the connection.
                const currentJob = useUploadStore.getState().jobs[jobId];
                const isTerminal =
                  !currentJob ||
                  currentJob.status === 'COMPLETED' ||
                  currentJob.status === 'FAILED';

                if (controller.signal.aborted || isTerminal) {
                  return;
                }

                const attempts = reconnectAttemptsRef.current[jobId] ?? 0;
                if (attempts < MAX_RECONNECT_ATTEMPTS) {
                  reconnectAttemptsRef.current[jobId] = attempts + 1;
                  updateJob(jobId, {
                    status: 'PROCESSING',
                    message: 'Connection lost, reconnecting progress stream...',
                  });
                  if (controllersRef.current[jobId]) {
                    controllersRef.current[jobId].abort();
                    delete controllersRef.current[jobId];
                  }
                  clearTimer(reconnectTimersRef, jobId);
                  reconnectTimersRef.current[jobId] = setTimeout(() => {
                    const latestJob = useUploadStore.getState().jobs[jobId];
                    const stillActive =
                      latestJob &&
                      (latestJob.status === 'INITIALIZING' ||
                        latestJob.status === 'PROCESSING' ||
                        latestJob.status === 'UPLOADING');
                    if (stillActive && !controllersRef.current[jobId]) {
                      connectSSE();
                    }
                    delete reconnectTimersRef.current[jobId];
                  }, RECONNECT_DELAY_MS);
                  return;
                }

                markTerminalAndCleanup(jobId, {
                  status: 'FAILED',
                  error: 'Connection to server closed before completion.',
                });

                if (controllersRef.current[jobId]) {
                  controllersRef.current[jobId].abort();
                  delete controllersRef.current[jobId];
                }
              },

              onerror(err) {
                console.error(`SSE Error for job ${jobId}:`, err);
                markTerminalAndCleanup(jobId, {
                  status: 'FAILED',
                  error: 'Connection to server lost.',
                });
                if (controllersRef.current[jobId]) {
                  controllersRef.current[jobId].abort();
                  delete controllersRef.current[jobId];
                }
                throw err;
              },
            });
          } catch (err) {
            console.error(`Failed to start SSE for job ${jobId}:`, err);
            markTerminalAndCleanup(jobId, {
              status: 'FAILED',
              error: 'Failed to establish connection.',
            });
            if (controllersRef.current[jobId]) {
              controllersRef.current[jobId].abort();
              delete controllersRef.current[jobId];
            }
          }
        };

        connectSSE();
      }
    });

    // We don't automatically cleanup controllers on unmount because we want them to survive brief unmounts if possible,
    // or rather, we DO want to cleanup on unmount to avoid memory leaks, but Zustand persists the job.
    // When the component remounts, the useEffect will re-run and reconnect.

    return () => {
      // If you want to abort connections when this panel unmounts:
      // Object.values(controllersRef.current).forEach(c => c.abort());
      // controllersRef.current = {};
      //
      // However, since this component might be placed inside the canvas and unmounted if the canvas unmounts,
      // it's a design choice. For now, let's keep them alive, or clean them up.
      // We will clean them up to be safe and avoid dangling fetch requests. The store will remember the job is 'PROCESSING'.
      // When remounted, it will reconnect.
    };
  }, [jobKeys, projectId, updateJob, visibleJobs]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      Object.values(controllersRef.current).forEach((c) => c.abort());
      controllersRef.current = {};
      Object.values(reconnectTimersRef.current).forEach((timer) =>
        clearTimeout(timer)
      );
      reconnectTimersRef.current = {};
      Object.values(cleanupTimersRef.current).forEach((timer) =>
        clearTimeout(timer)
      );
      cleanupTimersRef.current = {};
    };
  }, []);

  if (!hasActiveJobs) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 100,
        width: 320,
        pointerEvents: 'none',
      }}
    >
      <Group className="progressPanelHeader" justify="space-between" mb="xs">
        <Text size="xs" fw={600} c="dimmed">
          Background Tasks ({jobKeys.length})
        </Text>
        <Tooltip label="Clear completed/failed">
          <ActionIcon
            variant="subtle"
            size="sm"
            color="gray"
            onClick={clearCompleted}
          >
            <IconClearAll size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <ScrollArea.Autosize mah={400} type="scroll" offsetScrollbars>
        <Stack gap="sm">
          {jobKeys.reverse().map((id) => (
            <ProgressItem
              key={id}
              job={visibleJobs[id]}
              onDismiss={removeJob}
            />
          ))}
        </Stack>
      </ScrollArea.Autosize>
    </div>
  );
}

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type JobStatus =
  | 'INITIALIZING'
  | 'UPLOADING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED';

export interface UploadJob {
  id: string;
  filename: string;
  projectId: string;
  progress: number;
  stage: string;
  status: JobStatus;
  message?: string;
  error?: string;
  createdAt: number;
}

interface UploadState {
  jobs: Record<string, UploadJob>;
  addJob: (id: string, filename: string, projectId: string) => void;
  updateJob: (id: string, updates: Partial<UploadJob>) => void;
  removeJob: (id: string) => void;
  clearTerminalJobs: () => void;
  clearCompleted: () => void;
}

export const useUploadStore = create<UploadState>()(
  persist(
    (set) => ({
      jobs: {},

      addJob: (id: string, filename: string, projectId: string) =>
        set((state) => ({
          jobs: {
            ...state.jobs,
            [id]: {
              id,
              filename,
              projectId,
              progress: 0,
              stage: 'INITIALIZING',
              status: 'INITIALIZING',
              createdAt: Date.now(),
            },
          },
        })),

      updateJob: (id: string, updates: Partial<UploadJob>) =>
        set((state) => {
          const job = state.jobs[id];
          if (!job) return state; // Ignore updates for non-existent jobs

          return {
            jobs: {
              ...state.jobs,
              [id]: { ...job, ...updates },
            },
          };
        }),

      removeJob: (id: string) =>
        set((state) => {
          const newJobs = { ...state.jobs };
          delete newJobs[id];
          return { jobs: newJobs };
        }),

      clearTerminalJobs: () =>
        set((state) => {
          const newJobs = { ...state.jobs };
          Object.keys(newJobs).forEach((id) => {
            if (
              newJobs[id].status === 'COMPLETED' ||
              newJobs[id].status === 'FAILED'
            ) {
              delete newJobs[id];
            }
          });
          return { jobs: newJobs };
        }),

      clearCompleted: () => useUploadStore.getState().clearTerminalJobs(),
    }),
    {
      name: 'upload-progress-storage', // name of the item in the storage (must be unique)
      version: 1,
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          if (
            persistedState &&
            typeof persistedState === 'object' &&
            persistedState.jobs
          ) {
            persistedState.jobs = Object.fromEntries(
              Object.entries(persistedState.jobs).filter(
                ([_, job]: [string, any]) => job.projectId !== undefined
              )
            );
          }
        }
        return persistedState;
      },
      // Only persist jobs that are not completed/failed, or maybe persist them all but handle cleanup on mount
    }
  )
);

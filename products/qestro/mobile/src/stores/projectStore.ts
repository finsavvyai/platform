import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Project } from '../types';
import { projectsApi } from '../lib/api';

const storage = createMMKV({ id: 'qestro-projects' });

const mmkvStorage = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.remove(key),
};

interface ProjectState {
  projects: Project[];
  activeProject: Project | null;
  isLoading: boolean;
  fetchProjects: () => Promise<void>;
  setActiveProject: (project: Project) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      projects: [],
      activeProject: null,
      isLoading: false,

      fetchProjects: async () => {
        set({ isLoading: true });
        try {
          const res = await projectsApi.getProjects();
          if (res.data) {
            set({ projects: res.data.items, isLoading: false });
          } else {
            set({ isLoading: false });
          }
        } catch {
          set({ isLoading: false });
        }
      },

      setActiveProject: (project) => set({ activeProject: project }),
    }),
    {
      name: 'qestro-projects',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({ activeProject: state.activeProject }),
    },
  ),
);

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Project {
    id: string;
    name: string;
    description?: string;
    createdAt?: string;
    // additional project metadata
}

interface ProjectState {
    projects: Project[];
    activeProjectId: string | null;
    isLoading: boolean;

    setProjects: (projects: Project[]) => void;
    setActiveProject: (projectId: string) => void;
    addProject: (project: Project) => void;
    updateProject: (id: string, updates: Partial<Project>) => void;
    removeProject: (id: string) => void;
    setLoading: (isLoading: boolean) => void;
}

export const useProjectStore = create<ProjectState>()(
    persist(
        (set) => ({
            projects: [],
            activeProjectId: null,
            isLoading: false,

            setProjects: (projects) => set((state) => ({
                projects,
                // Auto-select first project if none is currently active
                activeProjectId: state.activeProjectId || (projects.length > 0 ? projects[0].id : null)
            })),

            setActiveProject: (projectId) => set({ activeProjectId: projectId }),

            addProject: (project) => set((state) => ({
                projects: [...state.projects, project],
                activeProjectId: state.activeProjectId || project.id
            })),

            updateProject: (id, updates) => set((state) => ({
                projects: state.projects.map(p => p.id === id ? { ...p, ...updates } : p)
            })),

            removeProject: (id) => set((state) => {
                const remaining = state.projects.filter(p => p.id !== id);
                return {
                    projects: remaining,
                    activeProjectId: state.activeProjectId === id
                        ? (remaining.length > 0 ? remaining[0].id : null)
                        : state.activeProjectId
                };
            }),

            setLoading: (isLoading) => set({ isLoading })
        }),
        {
            name: 'qestro-project-storage',
            partialize: (state) => ({
                projects: state.projects,
                activeProjectId: state.activeProjectId
            })
        }
    )
);

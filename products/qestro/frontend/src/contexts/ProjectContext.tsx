/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState } from 'react';
import { zero, useQuery } from '../lib/zero';
import type { User } from '../lib/zero';


export type Platform = 'web' | 'mobile' | 'api' | 'desktop';

export interface Project {
    id: string;
    name: string;
    platforms: Platform[];
    icon?: React.ReactNode;
}

interface ProjectContextType {
    projects: Project[];
    currentProject: Project | null;
    setCurrentProject: (project: Project) => void;
    addProject: (project: Project) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const useProject = () => {
    const context = useContext(ProjectContext);
    if (!context) {
        throw new Error('useProject must be used within a ProjectProvider');
    }
    return context;
};

const MOCK_PROJECTS: Project[] = [
    { id: 'proj-opensyber', name: 'OpenSyber', platforms: ['web', 'api'] },
    { id: 'demo', name: 'Demo Showcase', platforms: ['web', 'mobile', 'api', 'desktop'] },
    { id: '1', name: 'Qestro Platform', platforms: ['web', 'api'] },
];

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(MOCK_PROJECTS[0]?.id ?? null);

    // Sync last active project from Zero (database)
    const [userData] = useQuery(zero.query.user);
    const savedProjectId = userData ? (userData as User).lastActiveProjectId : null;
    const activeProjectId = savedProjectId || currentProjectId;
    const currentProject = projects.find(project => project.id === activeProjectId) || null;

    const handleSetCurrentProject = (project: Project) => {
        setCurrentProjectId(project.id);
        // Optimistic update via Zero
        zero.mutate.user.update({ lastActiveProjectId: project.id });
    };

    const addProject = (project: Project) => {
        setProjects(prev => [...prev, project]);
        if (!activeProjectId) {
            setCurrentProjectId(project.id);
        }
    };

    return (
        <ProjectContext.Provider value={{ projects, currentProject, setCurrentProject: handleSetCurrentProject, addProject }}>
            {children}
        </ProjectContext.Provider>
    );
};

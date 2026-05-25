import { useProjectStore } from '@/stores/projectStore';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  useProjectStore.setState({ projects: [], activeProject: null, isLoading: false });
});

describe('projectStore', () => {
  it('should have correct initial state', () => {
    const state = useProjectStore.getState();
    expect(state.projects).toEqual([]);
    expect(state.activeProject).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it('should set active project', () => {
    const project = { id: '1', name: 'Test Project', type: 'web' as const, status: 'active' as const, createdAt: '', updatedAt: '' };
    useProjectStore.getState().setActiveProject(project);
    expect(useProjectStore.getState().activeProject).toEqual(project);
  });

  it('should fetch projects successfully', async () => {
    const projects = [
      { id: '1', name: 'Project A', type: 'web', status: 'active', createdAt: '', updatedAt: '' },
      { id: '2', name: 'Project B', type: 'mobile', status: 'active', createdAt: '', updatedAt: '' },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { items: projects } }),
    });

    await useProjectStore.getState().fetchProjects();
    expect(useProjectStore.getState().projects).toEqual(projects);
    expect(useProjectStore.getState().isLoading).toBe(false);
  });

  it('should handle fetch failure gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    await useProjectStore.getState().fetchProjects();
    expect(useProjectStore.getState().projects).toEqual([]);
    expect(useProjectStore.getState().isLoading).toBe(false);
  });
});

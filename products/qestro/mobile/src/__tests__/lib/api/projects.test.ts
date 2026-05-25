import { getProjects, createProject } from '@/lib/api/projects';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true, data: {} }) });
});

describe('projectsApi', () => {
  it('should fetch projects', async () => {
    await getProjects();
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/projects'), expect.any(Object));
  });

  it('should create a project', async () => {
    const data = { name: 'New Project', type: 'web' as const, status: 'active' as const };
    await createProject(data);
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual(data);
  });
});

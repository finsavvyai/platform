import {
  getTestCases,
  getTestCase,
  createTestCase,
  updateTestCase,
  deleteTestCase,
} from '../../../lib/api/testCases';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue('test-token'),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('Test Cases API', () => {
  it('should fetch test cases list', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: { items: [{ id: '1', title: 'Test Login' }], total: 1 },
        }),
    });

    const result = await getTestCases();
    expect(result.data?.items).toHaveLength(1);
  });

  it('should fetch test cases with filters', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: { items: [], total: 0 },
        }),
    });

    await getTestCases({ projectId: 'p1', status: 'active' });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('projectId=p1'),
      expect.anything(),
    );
  });

  it('should fetch a single test case', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ success: true, data: { id: '1', title: 'Test' } }),
    });

    const result = await getTestCase('1');
    expect(result.data?.id).toBe('1');
  });

  it('should create a test case', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: { id: 'new-1', title: 'New TC' },
        }),
    });

    const result = await createTestCase({
      title: 'New TC',
      status: 'draft',
      priority: 'medium',
      type: 'manual',
      projectId: 'p1',
    });

    expect(result.data?.title).toBe('New TC');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/test-cases'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('should update a test case', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ success: true, data: { id: '1', title: 'Updated' } }),
    });

    await updateTestCase('1', { title: 'Updated' });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/test-cases/1'),
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('should delete a test case', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    await deleteTestCase('1');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/test-cases/1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

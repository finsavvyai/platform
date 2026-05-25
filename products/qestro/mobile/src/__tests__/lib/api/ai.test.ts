import { aiApi } from '../../../lib/api';

const mockFetch = jest.fn();
jest.mock('../../../lib/api/client', () => ({
  apiFetch: (...args: unknown[]) => mockFetch(...args),
}));

describe('aiApi', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('generateTest sends description, framework, type', async () => {
    mockFetch.mockResolvedValue({ success: true, data: { code: 'test()' } });
    const res = await aiApi.generateTest({ description: 'login test', framework: 'playwright', type: 'e2e' });
    expect(mockFetch).toHaveBeenCalledWith('/api/ai/generate-test', expect.objectContaining({ method: 'POST' }));
    expect(res.data?.code).toBe('test()');
  });

  it('startConversation posts context', async () => {
    mockFetch.mockResolvedValue({ success: true, data: { conversationId: 'c1', question: 'What URL?' } });
    const res = await aiApi.startConversation({ context: 'login flow' });
    expect(mockFetch).toHaveBeenCalledWith('/api/testgen/conversations/start', expect.objectContaining({ method: 'POST' }));
    expect(res.data?.conversationId).toBe('c1');
  });

  it('answerQuestion sends answer for conversation', async () => {
    mockFetch.mockResolvedValue({ success: true, data: { done: false, question: 'Next?' } });
    const res = await aiApi.answerQuestion('c1', 'yes');
    expect(mockFetch).toHaveBeenCalledWith('/api/testgen/conversations/c1/answer', expect.objectContaining({ method: 'POST' }));
    expect(res.data?.done).toBe(false);
  });

  it('approveConversation calls POST', async () => {
    mockFetch.mockResolvedValue({ success: true });
    await aiApi.approveConversation('c1');
    expect(mockFetch).toHaveBeenCalledWith('/api/testgen/conversations/c1/approve', expect.objectContaining({ method: 'POST' }));
  });

  it('cancelConversation calls POST', async () => {
    mockFetch.mockResolvedValue({ success: true });
    await aiApi.cancelConversation('c1');
    expect(mockFetch).toHaveBeenCalledWith('/api/testgen/conversations/c1/cancel', expect.objectContaining({ method: 'POST' }));
  });

  it('getOpenClawStatus fetches status', async () => {
    mockFetch.mockResolvedValue({ success: true, data: { status: 'active' } });
    const res = await aiApi.getOpenClawStatus();
    expect(mockFetch).toHaveBeenCalledWith('/api/openclaw/status');
    expect(res.data).toEqual({ status: 'active' });
  });

  it('sendOpenClawCommand posts data', async () => {
    mockFetch.mockResolvedValue({ success: true });
    await aiApi.sendOpenClawCommand({ type: 'start' });
    expect(mockFetch).toHaveBeenCalledWith('/api/openclaw/incoming', expect.objectContaining({ method: 'POST' }));
  });
});

import { notificationsApi } from '../../../lib/api';

const mockFetch = jest.fn();
jest.mock('../../../lib/api/client', () => ({
  apiFetch: (...args: unknown[]) => mockFetch(...args),
}));

describe('notificationsApi', () => {
  beforeEach(() => mockFetch.mockReset());

  it('getNotificationRules fetches rules', async () => {
    mockFetch.mockResolvedValue({ success: true, data: [{ id: 'r1', name: 'Run Failed' }] });
    const res = await notificationsApi.getNotificationRules();
    expect(mockFetch).toHaveBeenCalledWith('/api/notifications/rules');
    expect(res.data).toHaveLength(1);
  });

  it('toggleNotificationRule sends PUT', async () => {
    mockFetch.mockResolvedValue({ success: true });
    await notificationsApi.toggleNotificationRule('r1');
    expect(mockFetch).toHaveBeenCalledWith('/api/notifications/rules/r1/toggle', expect.objectContaining({ method: 'PUT' }));
  });

  it('deleteNotificationRule sends DELETE', async () => {
    mockFetch.mockResolvedValue({ success: true });
    await notificationsApi.deleteNotificationRule('r1');
    expect(mockFetch).toHaveBeenCalledWith('/api/notifications/rules/r1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('testNotification sends POST', async () => {
    mockFetch.mockResolvedValue({ success: true });
    await notificationsApi.testNotification({ channel: 'email', recipient: 'test@test.com' });
    expect(mockFetch).toHaveBeenCalledWith('/api/notifications/test', expect.objectContaining({ method: 'POST' }));
  });
});

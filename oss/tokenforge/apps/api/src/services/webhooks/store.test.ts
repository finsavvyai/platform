import { describe, it, expect } from 'vitest';
import { InMemoryWebhookStore } from './store.js';

describe('InMemoryWebhookStore', () => {
  it('inserts a webhook with secret + enabled by default', async () => {
    const s = new InMemoryWebhookStore();
    const w = await s.insert({
      appId: 'app_a',
      url: 'https://hook.test',
      events: ['risk_signal'],
    });
    expect(w.id.startsWith('whk_')).toBe(true);
    expect(w.secret.startsWith('whsec_')).toBe(true);
    expect(w.enabled).toBe(true);
  });

  it('lists by appId only', async () => {
    const s = new InMemoryWebhookStore();
    await s.insert({ appId: 'a', url: 'https://x', events: ['risk_signal'] });
    await s.insert({ appId: 'b', url: 'https://y', events: ['risk_signal'] });
    expect(await s.listForApp('a')).toHaveLength(1);
  });

  it('setEnabled toggles the row', async () => {
    const s = new InMemoryWebhookStore();
    const w = await s.insert({ appId: 'a', url: 'https://x', events: ['risk_signal'] });
    await s.setEnabled(w.id, false);
    expect((await s.get(w.id))?.enabled).toBe(false);
  });

  it('delete removes the row', async () => {
    const s = new InMemoryWebhookStore();
    const w = await s.insert({ appId: 'a', url: 'https://x', events: ['risk_signal'] });
    await s.delete(w.id);
    expect(await s.get(w.id)).toBeNull();
  });

  it('setEnabled / get on missing id are no-ops', async () => {
    const s = new InMemoryWebhookStore();
    await s.setEnabled('whk_missing', false);
    expect(await s.get('whk_missing')).toBeNull();
  });
});

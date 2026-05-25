import { describe, it, expect, vi } from 'vitest';
import handler from '../pages/api/llms-txt';

function createMocks(method: string, body?: any) {
  const req = { method, body: body || {} } as any;
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const res = { status, json } as any;
  return { req, res, status, json };
}

describe('POST /api/llms-txt', () => {
  it('rejects non-POST methods', () => {
    const { req, res, status } = createMocks('GET');
    handler(req, res);
    expect(status).toHaveBeenCalledWith(405);
  });

  it('rejects missing title', () => {
    const { req, res, status } = createMocks('POST', { description: 'd', sections: [] });
    handler(req, res);
    expect(status).toHaveBeenCalledWith(400);
  });

  it('rejects invalid section (no heading)', () => {
    const { req, res, status } = createMocks('POST', {
      title: 'T', description: 'D', sections: [{ links: [] }],
    });
    handler(req, res);
    expect(status).toHaveBeenCalledWith(400);
  });

  it('rejects incomplete link', () => {
    const { req, res, status } = createMocks('POST', {
      title: 'T', description: 'D',
      sections: [{ heading: 'H', links: [{ title: 'x' }] }],
    });
    handler(req, res);
    expect(status).toHaveBeenCalledWith(400);
  });

  it('generates llms.txt for valid config', () => {
    const { req, res, status, json } = createMocks('POST', {
      title: 'My Site',
      description: 'A test site',
      sections: [{
        heading: 'Pages',
        links: [{ title: 'Home', url: 'https://x.com/', description: 'Home page' }],
      }],
    });
    handler(req, res);
    expect(status).toHaveBeenCalledWith(200);
    const output = json.mock.calls[0][0].output;
    expect(output).toContain('# My Site');
    expect(output).toContain('## Pages');
    expect(output).toContain('[Home](https://x.com/)');
  });
});

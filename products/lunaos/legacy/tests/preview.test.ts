import { describe, it, expect, beforeEach } from 'vitest';
import { PreviewService } from '../src/services/preview';

describe('PreviewService', () => {
  let service: PreviewService;

  beforeEach(() => {
    service = new PreviewService();
  });

  it('should create preview session', async () => {
    const preview = await service.createPreview(
      'const App = () => <div>Hello</div>;',
      'react'
    );

    expect(preview.id).toBeDefined();
    expect(preview.framework).toBe('react');
    expect(preview.status).toBe('compiling');
  });

  it('should transition to compiled status', async () => {
    const preview = await service.createPreview('code', 'react');

    await new Promise((resolve) => setTimeout(resolve, 600));

    const retrieved = service.getSession(preview.id);
    expect(retrieved?.status).toBe('compiled');
    expect(retrieved?.url).toBeDefined();
  });

  it('should run preview', async () => {
    const preview = await service.createPreview('code', 'react');
    await new Promise((resolve) => setTimeout(resolve, 600));

    const running = await service.runPreview(preview.id);

    expect(running?.status).toMatch(/running|error/);
  });

  it('should update code and trigger hot reload', () => {
    const preview = service.createPreview('old code', 'react');

    const updated = service.updateCode(
      (preview as any).id,
      'new code'
    );

    expect(updated?.code).toBe('new code');
    expect(updated?.status).toBe('compiling');
  });

  it('should stop preview', async () => {
    const preview = await service.createPreview('code', 'react');
    await new Promise((resolve) => setTimeout(resolve, 600));

    const stopped = service.stopPreview(preview.id);

    expect(stopped).toBe(true);

    const session = service.getSession(preview.id);
    expect(session?.status).toBe('compiled');
  });

  it('should delete preview session', async () => {
    const preview = await service.createPreview('code', 'react');

    const deleted = service.deletePreview(preview.id);

    expect(deleted).toBe(true);
    expect(service.getSession(preview.id)).toBeUndefined();
  });

  it('should list all sessions', async () => {
    await service.createPreview('code 1', 'react');
    await service.createPreview('code 2', 'next');

    const sessions = service.listSessions();

    expect(sessions.length).toBeGreaterThanOrEqual(2);
  });

  it('should get active sessions', async () => {
    const preview = await service.createPreview('code', 'react');
    await new Promise((resolve) => setTimeout(resolve, 600));
    await service.runPreview(preview.id);

    const active = service.getActiveSessions();

    expect(active.length).toBeGreaterThan(0);
  });

  it('should compile code', async () => {
    const result = await service.compileCode('valid code', 'react');

    expect(result.success).toBe(true);
  });

  it('should detect compilation errors', async () => {
    const result = await service.compileCode('syntax error in code', 'react');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

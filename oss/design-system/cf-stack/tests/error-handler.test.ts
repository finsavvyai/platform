import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createErrorHandler } from '../src/middleware/error-handler';
import type { Context } from 'hono';

describe('error-handler middleware', () => {
  let mockContext: Partial<Context>;

  beforeEach(() => {
    mockContext = {
      status: vi.fn().mockReturnValue(mockContext),
      json: vi.fn().mockReturnValue('response'),
    };
  });

  it('should catch and handle Error instances', async () => {
    const handler = createErrorHandler();
    const error = new Error('Test error');
    const next = vi.fn().mockRejectedValueOnce(error);

    await handler(mockContext as Context, next);

    expect(mockContext.status).toHaveBeenCalledWith(500);
    expect(mockContext.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Test error',
        status: 500,
      }),
    );
  });

  it('should handle non-Error thrown values', async () => {
    const handler = createErrorHandler();
    const next = vi.fn().mockRejectedValueOnce('String error');

    await handler(mockContext as Context, next);

    expect(mockContext.status).toHaveBeenCalledWith(500);
    expect(mockContext.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 500,
      }),
    );
  });

  it('should use custom status from error object', async () => {
    const handler = createErrorHandler();
    const error = new Error('Bad request');
    (error as any).status = 400;
    const next = vi.fn().mockRejectedValueOnce(error);

    await handler(mockContext as Context, next);

    expect(mockContext.status).toHaveBeenCalledWith(400);
  });

  it('should pass through successful next calls', async () => {
    const handler = createErrorHandler();
    const next = vi.fn().mockResolvedValueOnce(undefined);

    await handler(mockContext as Context, next);

    expect(next).toHaveBeenCalled();
    expect(mockContext.status).not.toHaveBeenCalled();
  });

  it('should log error details', async () => {
    const handler = createErrorHandler();
    const error = new Error('Test error');
    const next = vi.fn().mockRejectedValueOnce(error);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation();

    await handler(mockContext as Context, next);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[Error]',
      expect.objectContaining({
        status: 500,
        message: 'Test error',
      }),
    );

    consoleSpy.mockRestore();
  });
});

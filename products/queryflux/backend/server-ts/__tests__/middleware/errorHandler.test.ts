import { AppError, errorHandler, notFoundHandler } from '../../middleware/errorHandler';

describe('AppError', () => {
  it('creates an error with status code and message', () => {
    const err = new AppError(400, 'Bad request', 'BAD_REQUEST');
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('Bad request');
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.name).toBe('AppError');
  });
});

describe('errorHandler', () => {
  const mockRes = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  it('handles AppError with correct status and body', () => {
    const err = new AppError(422, 'Validation failed', 'VALIDATION');
    const res = mockRes();
    errorHandler(err, {} as any, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION',
    }));
  });

  it('handles generic Error with 500 status', () => {
    const err = new Error('Something broke');
    const res = mockRes();
    errorHandler(err, {} as any, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      code: 'INTERNAL_ERROR',
    }));
  });
});

describe('notFoundHandler', () => {
  it('returns 404 with route info', () => {
    const req = { method: 'GET', path: '/unknown' } as any;
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    notFoundHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      code: 'NOT_FOUND',
    }));
  });
});

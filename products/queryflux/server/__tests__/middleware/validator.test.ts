import { z } from 'zod';
import { validate } from '../../middleware/validator';
import { AppError } from '../../middleware/errorHandler';

describe('validate middleware', () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive(),
  });

  const mockReqRes = (body: unknown) => {
    const req = { body, params: {}, query: {} } as any;
    const res = {} as any;
    const next = jest.fn();
    return { req, res, next };
  };

  it('passes valid body and calls next', () => {
    const { req, res, next } = mockReqRes({ name: 'Alice', age: 30 });
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ name: 'Alice', age: 30 });
  });

  it('throws AppError for invalid body', () => {
    const { req, res, next } = mockReqRes({ name: '', age: -1 });
    expect(() => validate(schema)(req, res, next)).toThrow(AppError);
  });

  it('validates params when location is params', () => {
    const paramSchema = z.object({ id: z.string().min(1) });
    const req = { body: {}, params: { id: 'abc' }, query: {} } as any;
    const next = jest.fn();
    validate(paramSchema, 'params')(req, {} as any, next);
    expect(next).toHaveBeenCalled();
  });
});

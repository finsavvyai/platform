import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nlpAPI } from './api';

const mockAxiosPost = vi.fn();
const mockAxiosGet = vi.fn();

vi.mock('axios', () => ({
    default: {
        post: (...args: unknown[]) => mockAxiosPost(...args),
        get: (...args: unknown[]) => mockAxiosGet(...args),
        create: () => ({
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
            interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
        }),
    },
}));

describe('nlpAPI', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generateSQL', () => {
        it('should POST to NLP endpoint and return response', async () => {
            const response = { sql: 'SELECT COUNT(*) FROM users', confidence: 0.9, explanation: 'Counts users' };
            mockAxiosPost.mockResolvedValue({ data: response });

            const result = await nlpAPI.generateSQL({ question: 'how many users' });

            expect(mockAxiosPost).toHaveBeenCalledWith(
                expect.stringContaining('/api/v1/nlp/query'),
                { question: 'how many users' }
            );
            expect(result).toEqual(response);
        });

        it('should pass schema when provided', async () => {
            const response = { sql: 'SELECT 1', confidence: 0.8, explanation: '' };
            mockAxiosPost.mockResolvedValue({ data: response });

            await nlpAPI.generateSQL({ question: 'test', schema: 'public' });

            expect(mockAxiosPost).toHaveBeenCalledWith(
                expect.stringContaining('/api/v1/nlp/query'),
                { question: 'test', schema: 'public' }
            );
        });

        it('should pass dialect when provided', async () => {
            const response = { sql: 'SELECT 1', confidence: 0.9, explanation: '' };
            mockAxiosPost.mockResolvedValue({ data: response });

            await nlpAPI.generateSQL({ question: 'test', dialect: 'mysql' });

            expect(mockAxiosPost).toHaveBeenCalledWith(
                expect.stringContaining('/api/v1/nlp/query'),
                { question: 'test', dialect: 'mysql' }
            );
        });

        it('should pass all fields together', async () => {
            const response = { sql: 'SELECT 1', confidence: 0.95, explanation: '' };
            mockAxiosPost.mockResolvedValue({ data: response });

            await nlpAPI.generateSQL({
                question: 'top customers',
                schema: 'ecommerce',
                databaseId: 'db-1',
                dialect: 'postgresql',
            });

            expect(mockAxiosPost).toHaveBeenCalledWith(
                expect.stringContaining('/api/v1/nlp/query'),
                { question: 'top customers', schema: 'ecommerce', databaseId: 'db-1', dialect: 'postgresql' }
            );
        });

        it('should propagate errors', async () => {
            mockAxiosPost.mockRejectedValue(new Error('Network error'));

            await expect(nlpAPI.generateSQL({ question: 'fail' })).rejects.toThrow('Network error');
        });
    });

    describe('health', () => {
        it('should GET NLP health endpoint', async () => {
            mockAxiosGet.mockResolvedValue({ data: 'OK' });

            const result = await nlpAPI.health();

            expect(mockAxiosGet).toHaveBeenCalledWith(expect.stringContaining('/api/v1/nlp/health'));
            expect(result).toBe('OK');
        });

        it('should propagate health check errors', async () => {
            mockAxiosGet.mockRejectedValue(new Error('Service unavailable'));

            await expect(nlpAPI.health()).rejects.toThrow('Service unavailable');
        });
    });
});

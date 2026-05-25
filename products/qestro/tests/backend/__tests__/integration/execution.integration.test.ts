import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import testExecutionRoute from '../../../../backend/src/routes/testExecution';

const app = express();
app.use(express.json());
// Mount the execution route
app.use('/api/test-execution', testExecutionRoute);

describe('Test Execution Pipeline Integration Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/test-execution/statistics', () => {
        it('should return initial statistics', async () => {
            const response = await request(app).get('/api/test-execution/statistics');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.engine).toBeDefined();
            expect(response.body.coordinator).toBeDefined();
        });
    });

    describe('POST /api/test-execution/execute', () => {
        it('should fail if missing required fields', async () => {
            const response = await request(app)
                .post('/api/test-execution/execute')
                .send({
                    name: 'inchoate test case'
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toMatch(/Missing required fields/);
        });

        it('should successfully execute a valid test case', async () => {
            const validTest = { id: 'test-1', name: 'Valid Test Case', type: 'api', config: {} };
            const response = await request(app)
                .post('/api/test-execution/execute')
                .send(validTest);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.result).toBeDefined();
        });
    });

    describe('POST /api/test-execution/execute-suite', () => {
        it('should fail with empty testCases', async () => {
            const response = await request(app)
                .post('/api/test-execution/execute-suite')
                .send({ testCases: [] });

            expect(response.status).toBe(400);
            expect(response.body.error).toMatch(/testCases must be a non-empty array/);
        });

        it('should execute a suite of test cases', async () => {
            const suite = [
                { id: 'test-1', name: 'Suite Test 1', type: 'api' },
                { id: 'test-2', name: 'Suite Test 2', type: 'e2e' }
            ];
            const response = await request(app)
                .post('/api/test-execution/execute-suite')
                .send({ testCases: suite, config: {} });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.report).toBeDefined();
        });
    });

    describe('POST /api/test-execution/execute-parallel', () => {
        it('should execute a parallel suite of test cases', async () => {
            const suite = [
                { id: 'p-test-1', name: 'Parallel Test 1', type: 'api' },
                { id: 'p-test-2', name: 'Parallel Test 2', type: 'database' }
            ];
            const response = await request(app)
                .post('/api/test-execution/execute-parallel')
                .send({ testCases: suite, config: {} });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.workerStatus).toBeDefined();
        });
    });

    describe('GET /api/test-execution/results', () => {
        it('should return all execution results', async () => {
            const response = await request(app).get('/api/test-execution/results');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.results)).toBe(true);
        });
    });

    describe('GET /api/test-execution/workers', () => {
        it('should return the current status of all workers', async () => {
            const response = await request(app).get('/api/test-execution/workers');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.workers).toBeDefined();
        });
    });

    describe('POST /api/test-execution/cancel', () => {
        it('should cancel all running test executions and clear the engine', async () => {
            const response = await request(app).post('/api/test-execution/cancel');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('All tests cancelled');
        });
    });

    describe('DELETE /api/test-execution/results', () => {
        it('should clear all results', async () => {
            const response = await request(app).delete('/api/test-execution/results');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('All results cleared');
        });
    });
});

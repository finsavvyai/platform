import { jest } from '@jest/globals';
import { Hono } from 'hono';

import filesRoute from '../../../../backend/src/routes/files.route';
import { signJWT } from '../../../../backend/src/auth/jwt';
import { fileService } from '../../../../backend/src/services/FileService';
import fs from 'fs/promises';

const app = new Hono<any>();
app.route('/api/files', filesRoute);

// Instead of jest.mock or prototype patching, we can now spyOn the singleton directly.
// This will be done in the beforeEach block to ensure cleanly reset spies.
import { fileService as fileServiceSingleton } from '../../../../backend/src/services/FileService';

jest.mock('fs/promises', () => {
    const actualFs: any = jest.requireActual('fs/promises');
    return {
        ...actualFs,
        readFile: jest.fn().mockResolvedValue(Buffer.from('hello world')),
        mkdir: jest.fn().mockResolvedValue(undefined)
    };
});

describe('Files API Integration Tests', () => {
    const JWT_SECRET = 'test-secret';
    let token: string;

    beforeAll(async () => {
        token = await signJWT({ userId: 'user-001', email: 'test@questro.io', role: 'admin' }, JWT_SECRET, 3600);
    });

    beforeEach(() => {
        jest.clearAllMocks();

        jest.spyOn(fileServiceSingleton, 'uploadFile').mockResolvedValue({
            id: 'file-123',
            originalName: 'test.txt',
            filename: '12345-test.txt',
            mimeType: 'text/plain',
            size: 11,
            path: '/fake/uploads/12345-test.txt',
            url: '/uploads/12345-test.txt',
            uploadedBy: 'user-001',
            uploadedAt: new Date()
        } as any);

        jest.spyOn(fileServiceSingleton, 'getFile').mockImplementation(async (id: any) => {
            if (id === 'file-123') {
                return {
                    id: 'file-123',
                    originalName: 'test.txt',
                    filename: '12345-test.txt',
                    mimeType: 'text/plain',
                    size: 11,
                    path: '/fake/uploads/12345-test.txt',
                    url: '/uploads/12345-test.txt',
                    uploadedBy: 'user-001',
                    uploadedAt: new Date()
                } as any;
            }
            return null;
        });

        jest.spyOn(fileServiceSingleton, 'getFileContent').mockResolvedValue(Buffer.from('hello world') as any);
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    describe('POST /api/files/upload', () => {
        it('should successfully upload a file with multipart/form-data', async () => {
            const formData = new FormData();
            const blob = new Blob(['hello world'], { type: 'text/plain' });
            formData.append('file', blob, 'test.txt');

            const env = { ENVIRONMENT: 'test', JWT_SECRET };
            const response = await app.request('/api/files/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            }, env);

            const body: any = await response.json();
            if (response.status !== 201) {
                console.error('Upload Failed!', response.status, body);
            }
            expect(response.status).toBe(201);
            expect(body.success).toBe(true);
            expect(body.data.id).toBe('file-123');
            expect(body.data.originalName).toBe('test.txt');
        });

        it('should fail with missing file field', async () => {
            const formData = new FormData();
            formData.append('data', 'something-else');

            const env = { ENVIRONMENT: 'test', JWT_SECRET };
            const response = await app.request('/api/files/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            }, env);

            expect(response.status).toBe(400);
        });
    });

    describe('GET /api/files/:id', () => {
        it('should retrieve a file metadata', async () => {
            const env = { ENVIRONMENT: 'test', JWT_SECRET };

            const response = await app.request('/api/files/file-123', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            }, env);

            const body: any = await response.json();
            if (response.status !== 200) {
                console.error('Get File Failed!', response.status, body);
            }
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.originalName).toBe('test.txt');
        });

        it('should return 404 for unknown file metadata', async () => {
            const env = { ENVIRONMENT: 'test', JWT_SECRET };
            const response = await app.request('/api/files/unknown', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            }, env);

            expect(response.status).toBe(404);
        });
    });

    describe('GET /api/files/download/:id', () => {
        it('should stream the file for download', async () => {
            const env = { ENVIRONMENT: 'test', JWT_SECRET };

            const response = await app.request('/api/files/download/file-123', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            }, env);

            if (response.status !== 200) {
                const body: any = await response.json();
                console.error('Download Failed!', response.status, body);
            }

            expect(response.status).toBe(200);
            expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="test.txt"');
            expect(response.headers.get('Content-Type')).toBe('text/plain');

            const buffer = await response.arrayBuffer();
            expect(new TextDecoder().decode(buffer)).toBe('hello world');
        });
    });
});

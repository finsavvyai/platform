import { Hono } from 'hono';
import { requireAuth } from '../middleware/honoAuth';
import { fileService } from '../services/FileService';

const filesRoute = new Hono<any>();

// POST /api/files/upload - Upload a new file
filesRoute.post('/upload', requireAuth, async (c) => {
    try {
        const body = await c.req.parseBody();
        const file = body['file'];

        if (!file || typeof file === 'string') {
            return c.json({ success: false, error: 'No file provided' }, 400);
        }

        const userId = c.get('userId');
        const buffer = await file.arrayBuffer();
        const nodeBuffer = Buffer.from(buffer);

        const uploaded = await fileService.uploadFile(
            nodeBuffer,
            file.name,
            file.type || 'application/octet-stream',
            userId
        );

        return c.json({ success: true, data: uploaded }, 201);
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 500);
    }
});

// GET /api/files/:id - Get a file by ID
filesRoute.get('/:id', requireAuth, async (c) => {
    try {
        const id = c.req.param('id');
        const fileInfo = await fileService.getFile(id);

        if (!fileInfo) {
            return c.json({ success: false, error: 'File not found' }, 404);
        }

        return c.json({ success: true, data: fileInfo }, 200);
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 500);
    }
});

// GET /api/files/download/:id - Raw file download
filesRoute.get('/download/:id', requireAuth, async (c) => {
    try {
        const id = c.req.param('id');
        const fileInfo = await fileService.getFile(id);

        if (!fileInfo) {
            return c.json({ success: false, error: 'File not found' }, 404);
        }

        const buffer = await fileService.getFileContent(fileInfo.path);

        c.header('Content-Type', fileInfo.mimeType);
        c.header('Content-Disposition', `attachment; filename="${fileInfo.originalName}"`);

        return c.body(buffer as any);
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 500);
    }
});

export default filesRoute;

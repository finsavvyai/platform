/**
 * API Testing Routes
 * 
 * Postman-like API testing functionality with collection management,
 * request execution, environment handling, and test scripting.
 * Uses Drizzle ORM with PostgreSQL for persistence.
 * 
 * @version 2.0.0
 */

import { Router, Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import db from '../lib/db.js';
import { apiTestingCollections, apiTestingRequests, apiTestingEnvironments, apiTestingHistory } from '../schema/index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Helper to format response
const formatResponse = (data: any, message?: string) => ({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
});

// ===========================
// Collection Management
// ===========================

/**
 * GET /api/api-testing/collections
 * List all collections
 */
router.get('/collections', authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { projectId } = req.query;

        const conditions: any[] = [];
        if (userId) {
            conditions.push(eq(apiTestingCollections.userId, userId));
        }
        if (projectId) {
            conditions.push(eq(apiTestingCollections.projectId, projectId as string));
        }

        const collections = await db.select()
            .from(apiTestingCollections)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(apiTestingCollections.createdAt));

        // Get request count for each collection
        const collectionsWithCounts = await Promise.all(collections.map(async (coll) => {
            const requests = await db.select()
                .from(apiTestingRequests)
                .where(eq(apiTestingRequests.collectionId, coll.id));

            return {
                ...coll,
                requests,
                requestCount: requests.length
            };
        }));

        res.json(formatResponse(collectionsWithCounts));
    } catch (error) {
        console.error('Failed to list collections:', error);
        res.json(formatResponse([]));
    }
});

/**
 * POST /api/api-testing/collections
 * Create a new collection
 */
router.post('/collections', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { name, description, projectId, variables, tags } = req.body;
        const userId = (req as any).user?.id || 'anonymous';

        if (!name) {
            return res.status(400).json({ success: false, error: 'Collection name is required' });
        }

        const [collection] = await db.insert(apiTestingCollections)
            .values({
                userId,
                projectId,
                name,
                description,
                variables: variables || {},
                tags: tags || []
            })
            .returning();

        res.status(201).json(formatResponse({ ...collection, requests: [] }));
    } catch (error) {
        console.error('Failed to create collection:', error);
        res.status(500).json({ success: false, error: 'Failed to create collection' });
    }
});

/**
 * GET /api/api-testing/collections/:id
 * Get collection by ID
 */
router.get('/collections/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const [collection] = await db.select()
            .from(apiTestingCollections)
            .where(eq(apiTestingCollections.id, req.params.id));

        if (!collection) {
            return res.status(404).json({ success: false, error: 'Collection not found' });
        }

        const requests = await db.select()
            .from(apiTestingRequests)
            .where(eq(apiTestingRequests.collectionId, collection.id))
            .orderBy(apiTestingRequests.sortOrder);

        res.json(formatResponse({ ...collection, requests }));
    } catch (error) {
        console.error('Failed to get collection:', error);
        res.status(500).json({ success: false, error: 'Failed to get collection' });
    }
});

/**
 * PUT /api/api-testing/collections/:id
 * Update a collection
 */
router.put('/collections/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const [collection] = await db.select()
            .from(apiTestingCollections)
            .where(eq(apiTestingCollections.id, req.params.id));

        if (!collection) {
            return res.status(404).json({ success: false, error: 'Collection not found' });
        }

        const { name, description, variables, tags } = req.body;

        const [updated] = await db.update(apiTestingCollections)
            .set({
                name: name || collection.name,
                description: description !== undefined ? description : collection.description,
                variables: variables || collection.variables,
                tags: tags || collection.tags,
                updatedAt: new Date()
            })
            .where(eq(apiTestingCollections.id, req.params.id))
            .returning();

        res.json(formatResponse(updated));
    } catch (error) {
        console.error('Failed to update collection:', error);
        res.status(500).json({ success: false, error: 'Failed to update collection' });
    }
});

/**
 * DELETE /api/api-testing/collections/:id
 * Delete a collection
 */
router.delete('/collections/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const [collection] = await db.select()
            .from(apiTestingCollections)
            .where(eq(apiTestingCollections.id, req.params.id));

        if (!collection) {
            return res.status(404).json({ success: false, error: 'Collection not found' });
        }

        await db.delete(apiTestingCollections)
            .where(eq(apiTestingCollections.id, req.params.id));

        res.json({ success: true, message: 'Collection deleted' });
    } catch (error) {
        console.error('Failed to delete collection:', error);
        res.status(500).json({ success: false, error: 'Failed to delete collection' });
    }
});

// ===========================
// Request Management
// ===========================

/**
 * POST /api/api-testing/collections/:id/requests
 * Add request to collection
 */
router.post('/collections/:id/requests', authenticateToken, async (req: Request, res: Response) => {
    try {
        const collectionId = req.params.id;
        const userId = (req as any).user?.id || 'anonymous';

        const [collection] = await db.select()
            .from(apiTestingCollections)
            .where(eq(apiTestingCollections.id, collectionId));

        if (!collection) {
            return res.status(404).json({ success: false, error: 'Collection not found' });
        }

        const { name, method = 'GET', url, headers, body, bodyType, auth, description, preRequestScript, testScript } = req.body;

        if (!name || !url) {
            return res.status(400).json({ success: false, error: 'Request name and URL are required' });
        }

        // Get current max sort order
        const existingRequests = await db.select()
            .from(apiTestingRequests)
            .where(eq(apiTestingRequests.collectionId, collectionId));
        const maxOrder = existingRequests.reduce((max, r) => Math.max(max, r.sortOrder || 0), 0);

        const [request] = await db.insert(apiTestingRequests)
            .values({
                collectionId,
                userId,
                name,
                method: method.toUpperCase(),
                url,
                headers: headers || {},
                body,
                bodyType: bodyType || 'json',
                auth,
                description,
                preRequestScript,
                testScript,
                sortOrder: maxOrder + 1
            })
            .returning();

        res.status(201).json(formatResponse(request));
    } catch (error) {
        console.error('Failed to add request:', error);
        res.status(500).json({ success: false, error: 'Failed to add request' });
    }
});

/**
 * PUT /api/api-testing/requests/:id
 * Update a request
 */
router.put('/requests/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const [request] = await db.select()
            .from(apiTestingRequests)
            .where(eq(apiTestingRequests.id, req.params.id));

        if (!request) {
            return res.status(404).json({ success: false, error: 'Request not found' });
        }

        const { name, method, url, headers, body, bodyType, auth, description, preRequestScript, testScript } = req.body;

        const [updated] = await db.update(apiTestingRequests)
            .set({
                name: name || request.name,
                method: method ? method.toUpperCase() : request.method,
                url: url || request.url,
                headers: headers !== undefined ? headers : request.headers,
                body: body !== undefined ? body : request.body,
                bodyType: bodyType || request.bodyType,
                auth: auth !== undefined ? auth : request.auth,
                description: description !== undefined ? description : request.description,
                preRequestScript: preRequestScript !== undefined ? preRequestScript : request.preRequestScript,
                testScript: testScript !== undefined ? testScript : request.testScript,
                updatedAt: new Date()
            })
            .where(eq(apiTestingRequests.id, req.params.id))
            .returning();

        res.json(formatResponse(updated));
    } catch (error) {
        console.error('Failed to update request:', error);
        res.status(500).json({ success: false, error: 'Failed to update request' });
    }
});

/**
 * DELETE /api/api-testing/requests/:id
 * Delete a request
 */
router.delete('/requests/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const [request] = await db.select()
            .from(apiTestingRequests)
            .where(eq(apiTestingRequests.id, req.params.id));

        if (!request) {
            return res.status(404).json({ success: false, error: 'Request not found' });
        }

        await db.delete(apiTestingRequests)
            .where(eq(apiTestingRequests.id, req.params.id));

        res.json({ success: true, message: 'Request deleted' });
    } catch (error) {
        console.error('Failed to delete request:', error);
        res.status(500).json({ success: false, error: 'Failed to delete request' });
    }
});

// ===========================
// Request Execution
// ===========================

/**
 * POST /api/api-testing/execute
 * Execute an API request
 */
router.post('/execute', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { method, url, headers, body, auth, environmentId, collectionId, requestId } = req.body;
        const userId = (req as any).user?.id || 'anonymous';

        if (!method || !url) {
            return res.status(400).json({ success: false, error: 'Method and URL are required' });
        }

        // Apply environment variables if environmentId provided
        let finalUrl = url;
        let finalHeaders = { ...headers };

        if (environmentId) {
            const [env] = await db.select()
                .from(apiTestingEnvironments)
                .where(eq(apiTestingEnvironments.id, environmentId));

            if (env && env.variables) {
                const vars = env.variables as Record<string, string>;
                // Replace {{variable}} placeholders
                finalUrl = replaceVariables(url, vars);
                finalHeaders = JSON.parse(replaceVariables(JSON.stringify(finalHeaders), vars));
            }
        }

        // Build request options
        const requestOptions: RequestInit = {
            method: method.toUpperCase(),
            headers: {
                'Content-Type': 'application/json',
                ...finalHeaders
            }
        };

        // Apply authentication
        if (auth?.type === 'bearer' && auth?.token) {
            requestOptions.headers = { ...requestOptions.headers, 'Authorization': `Bearer ${auth.token}` };
        } else if (auth?.type === 'basic' && auth?.username && auth?.password) {
            const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
            requestOptions.headers = { ...requestOptions.headers, 'Authorization': `Basic ${credentials}` };
        } else if (auth?.type === 'apiKey' && auth?.apiKey) {
            const location = auth.apiKeyLocation || 'header';
            const keyName = auth.apiKeyName || 'X-API-Key';
            if (location === 'header') {
                requestOptions.headers = { ...requestOptions.headers, [keyName]: auth.apiKey };
            } else {
                finalUrl += (finalUrl.includes('?') ? '&' : '?') + `${keyName}=${auth.apiKey}`;
            }
        }

        // Add body for non-GET requests
        if (body && !['GET', 'HEAD'].includes(method.toUpperCase())) {
            requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        // Execute request
        const startTime = Date.now();
        let responseData: any = {};
        let responseStatus = 0;
        const responseHeaders: Record<string, string> = {};

        try {
            const response = await fetch(finalUrl, requestOptions);
            responseStatus = response.status;

            // Capture response headers
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });

            // Try to parse response body
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                responseData = await response.json();
            } else {
                responseData = await response.text();
            }
        } catch (fetchError: any) {
            responseStatus = 0;
            responseData = { error: fetchError.message };
        }

        const responseTime = Date.now() - startTime;
        const responseSize = JSON.stringify(responseData).length;

        // Save to history
        await db.insert(apiTestingHistory)
            .values({
                requestId,
                userId,
                method: method.toUpperCase(),
                url: finalUrl,
                requestHeaders: finalHeaders,
                requestBody: body,
                responseStatus,
                responseHeaders,
                responseBody: responseData,
                responseTime,
                responseSize
            });

        res.json(formatResponse({
            url: finalUrl,
            method: method.toUpperCase(),
            status: responseStatus,
            responseTime,
            responseSize,
            headers: responseHeaders,
            body: responseData
        }));
    } catch (error) {
        console.error('Failed to execute request:', error);
        res.status(500).json({ success: false, error: 'Failed to execute request' });
    }
});

// ===========================
// Environment Management
// ===========================

/**
 * GET /api/api-testing/environments
 * List all environments
 */
router.get('/environments', authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;

        const environments = await db.select()
            .from(apiTestingEnvironments)
            .where(userId ? eq(apiTestingEnvironments.userId, userId) : undefined)
            .orderBy(desc(apiTestingEnvironments.createdAt));

        res.json(formatResponse(environments));
    } catch (error) {
        console.error('Failed to list environments:', error);
        res.json(formatResponse([]));
    }
});

/**
 * POST /api/api-testing/environments
 * Create a new environment
 */
router.post('/environments', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { name, variables, isActive } = req.body;
        const userId = (req as any).user?.id || 'anonymous';

        if (!name) {
            return res.status(400).json({ success: false, error: 'Environment name is required' });
        }

        // Deactivate other environments if this one is active
        if (isActive) {
            await db.update(apiTestingEnvironments)
                .set({ isActive: false })
                .where(eq(apiTestingEnvironments.userId, userId));
        }

        const [environment] = await db.insert(apiTestingEnvironments)
            .values({
                userId,
                name,
                variables: variables || {},
                isActive: isActive || false
            })
            .returning();

        res.status(201).json(formatResponse(environment));
    } catch (error) {
        console.error('Failed to create environment:', error);
        res.status(500).json({ success: false, error: 'Failed to create environment' });
    }
});

/**
 * PUT /api/api-testing/environments/:id
 * Update an environment
 */
router.put('/environments/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { name, variables, isActive } = req.body;

        const [environment] = await db.select()
            .from(apiTestingEnvironments)
            .where(eq(apiTestingEnvironments.id, req.params.id));

        if (!environment) {
            return res.status(404).json({ success: false, error: 'Environment not found' });
        }

        // Deactivate other environments if this one is being activated
        if (isActive && userId) {
            await db.update(apiTestingEnvironments)
                .set({ isActive: false })
                .where(eq(apiTestingEnvironments.userId, userId));
        }

        const [updated] = await db.update(apiTestingEnvironments)
            .set({
                name: name || environment.name,
                variables: variables !== undefined ? variables : environment.variables,
                isActive: isActive !== undefined ? isActive : environment.isActive,
                updatedAt: new Date()
            })
            .where(eq(apiTestingEnvironments.id, req.params.id))
            .returning();

        res.json(formatResponse(updated));
    } catch (error) {
        console.error('Failed to update environment:', error);
        res.status(500).json({ success: false, error: 'Failed to update environment' });
    }
});

/**
 * DELETE /api/api-testing/environments/:id
 * Delete an environment
 */
router.delete('/environments/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const [environment] = await db.select()
            .from(apiTestingEnvironments)
            .where(eq(apiTestingEnvironments.id, req.params.id));

        if (!environment) {
            return res.status(404).json({ success: false, error: 'Environment not found' });
        }

        await db.delete(apiTestingEnvironments)
            .where(eq(apiTestingEnvironments.id, req.params.id));

        res.json({ success: true, message: 'Environment deleted' });
    } catch (error) {
        console.error('Failed to delete environment:', error);
        res.status(500).json({ success: false, error: 'Failed to delete environment' });
    }
});

// ===========================
// Request History
// ===========================

/**
 * GET /api/api-testing/history
 * Get request execution history
 */
router.get('/history', authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { limit = 50 } = req.query;

        const history = await db.select()
            .from(apiTestingHistory)
            .where(userId ? eq(apiTestingHistory.userId, userId) : undefined)
            .orderBy(desc(apiTestingHistory.executedAt))
            .limit(Number(limit));

        res.json(formatResponse(history));
    } catch (error) {
        console.error('Failed to get history:', error);
        res.json(formatResponse([]));
    }
});

// ===========================
// Helper Functions
// ===========================

function replaceVariables(text: string, variables: Record<string, string>): string {
    let result = text;
    for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
}

export default router;

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc } from 'drizzle-orm';
import * as schema from './db/schema';
import { v4 as uuidv4 } from 'uuid';

type Bindings = {
    DB: D1Database;
};

const virtualizationRoutes = new Hono<{ Bindings: Bindings }>();

// 1. Get all Stubs (Mapped to legacy WireMock format for UI compatibility)
virtualizationRoutes.get('/stubs', async (c) => {
    try {
        const db = drizzle(c.env.DB);
        const services = await db.select().from(schema.virtualServices).orderBy(desc(schema.virtualServices.createdAt));

        // Format to legacy WireMock `mappings` payload array expected by ServiceVirtualization.tsx
        const mappings = services.map(srv => {
            const reqHeaders = srv.headers ? JSON.parse(srv.headers) : {};
            const resBody = srv.jsonBody ? JSON.parse(srv.jsonBody) : { message: "Mock Default" };

            return {
                id: srv.id,
                name: srv.name,
                request: {
                    method: srv.method,
                    urlPath: srv.urlPath,
                    headers: reqHeaders
                },
                response: {
                    status: srv.status,
                    jsonBody: resBody
                }
            };
        });

        return c.json({ mappings });
    } catch (err: any) {
        console.error('Failed fetching Virtual Services:', err);
        return c.json({ error: 'Failed to fetch stubs' }, 500);
    }
});

// 2. Create a new Stub
virtualizationRoutes.post('/stubs', async (c) => {
    try {
        const payload = await c.req.json();

        // Parse legacy format
        const { name, request, response } = payload;
        if (!request || !response) {
            return c.json({ error: 'Invalid stub format. Must include request and response objects.' }, 400);
        }

        const method = request.method || 'GET';
        const urlPath = request.urlPattern || request.urlPath || request.url || '/api/mock/unknown';
        const headersJson = request.headers ? JSON.stringify(request.headers) : null;

        const status = response.status || 200;
        let bodyJson = null;
        if (response.jsonBody) {
            bodyJson = JSON.stringify(response.jsonBody);
        } else if (response.body) {
            bodyJson = response.body;
        }

        const id = `stub_${Date.now()}_${uuidv4().substring(0, 4)}`;

        const db = drizzle(c.env.DB);
        const result = await db.insert(schema.virtualServices).values({
            id,
            name: name || `Auto-Stub ${method} ${urlPath}`,
            method,
            urlPath,
            status,
            jsonBody: bodyJson,
            headers: headersJson,
            createdAt: new Date()
        }).returning();

        return c.json(result[0], 201);
    } catch (err: any) {
        console.error('Failed creating Virtual Service stub:', err);
        return c.json({ error: 'Failed to create stub' }, 500);
    }
});

// 3. Delete a Stub
virtualizationRoutes.delete('/stubs/:id', async (c) => {
    try {
        const { id } = c.req.param();
        const db = drizzle(c.env.DB);

        // Cascade manually if needed or just clear out the request logs attached to it
        await db.delete(schema.virtualServiceRequests).where(eq(schema.virtualServiceRequests.virtualServiceId, id));
        await db.delete(schema.virtualServices).where(eq(schema.virtualServices.id, id));

        return c.json({ success: true, message: `Stub ${id} deleted` });
    } catch (err: any) {
        console.error('Failed deleting stub:', err);
        return c.json({ error: 'Failed to delete stub' }, 500);
    }
});

// 4. Reset All Stubs
virtualizationRoutes.post('/reset', async (c) => {
    try {
        const db = drizzle(c.env.DB);
        await db.delete(schema.virtualServiceRequests);
        await db.delete(schema.virtualServices);

        return c.json({ success: true, message: 'All virtual services reset' });
    } catch (err: any) {
        return c.json({ error: 'Failed to reset stubs' }, 500);
    }
});

// 5. Get recent API invocations (WireMock request log equivalent)
virtualizationRoutes.get('/requests', async (c) => {
    try {
        const db = drizzle(c.env.DB);
        const requestsLog = await db.select().from(schema.virtualServiceRequests).orderBy(desc(schema.virtualServiceRequests.createdAt)).limit(100);

        // Map D1 rows back to legacy UI payload
        const requests = requestsLog.map(r => ({
            id: r.id,
            request: {
                method: r.method,
                url: r.url,
                absoluteUrl: r.absoluteUrl,
                headers: r.headers ? JSON.parse(r.headers) : {},
                body: r.body || undefined,
                queryParams: r.queryParams ? JSON.parse(r.queryParams) : undefined
            },
            responseDefinition: {
                // If it matched, we don't have exact status without joining, but 200 is fine for display
                status: r.wasMatched ? 200 : 404
            },
            wasMatched: r.wasMatched,
            matchedStubId: r.virtualServiceId,
            timing: {
                totalTime: r.timingTotal,
                serveTime: r.timingServe
            }
        }));

        return c.json({ requests });
    } catch (err: any) {
        console.error('Failed fetching Virtual Service Request Log:', err);
        return c.json({ error: 'Failed to fetch request log' }, 500);
    }
});

export default virtualizationRoutes;

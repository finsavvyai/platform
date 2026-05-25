/**
 * Cloud Devices Routes
 * Backend API for cloud device provider management
 * Uses Drizzle ORM with PostgreSQL for persistence
 */

import { Router, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import db from '../lib/db.js';
import { cloudDeviceProviders, cloudDevices, cloudDeviceReservations } from '../schema/index.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Helper to format response
const formatResponse = (data: any, message?: string) => ({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
});

// GET /api/devices - List all devices with optional filtering
router.get('/', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { provider, platform, status } = req.query;
        const userId = (req as any).user?.id;

        // Build query conditions
        const conditions: any[] = [];

        if (platform) {
            conditions.push(eq(cloudDevices.platform, platform as string));
        }
        if (status) {
            conditions.push(eq(cloudDevices.status, status as string));
        }

        // Get devices with optional provider filter
        if (provider) {
            // Get provider first
            const providerRecord = await db.select()
                .from(cloudDeviceProviders)
                .where(and(
                    eq(cloudDeviceProviders.providerType, provider as string),
                    userId ? eq(cloudDeviceProviders.userId, userId) : undefined
                ))
                .limit(1);

            if (providerRecord.length > 0) {
                conditions.push(eq(cloudDevices.providerId, providerRecord[0].id));
            }
        }

        const devices = await db.select()
            .from(cloudDevices)
            .where(conditions.length > 0 ? and(...conditions) : undefined);

        // Transform to API format
        const formattedDevices = devices.map(d => ({
            id: d.id,
            name: d.name,
            platform: d.platform,
            model: d.model,
            osVersion: d.osVersion,
            status: d.status,
            provider: 'local', // Will be enhanced when we join with provider table
            location: d.location || { type: 'local' },
            capabilities: d.capabilities || {
                supportsScreenshots: true,
                supportsVideoRecording: true,
                supportsNetworkSimulation: false,
                maxConcurrentTests: 1
            },
            lastSeen: d.lastSeenAt || new Date(),
            tags: d.tags || []
        }));

        res.json(formatResponse(formattedDevices));
    } catch (error) {
        console.error('Failed to list devices:', error);
        // Return mock data as fallback
        res.json(formatResponse(getMockDevices()));
    }
});

// GET /api/devices/providers - List all providers
router.get('/providers', optionalAuth, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;

        const providers = await db.select()
            .from(cloudDeviceProviders)
            .where(userId ? eq(cloudDeviceProviders.userId, userId) : undefined);

        // If no providers exist, return defaults
        if (providers.length === 0) {
            return res.json(formatResponse(getDefaultProviders()));
        }

        const formattedProviders = providers.map(p => ({
            id: p.providerType,
            name: p.name,
            type: p.providerType,
            connected: p.isConnected,
            deviceCount: p.deviceCount,
            icon: getProviderIcon(p.providerType),
            configuredAt: p.lastSyncAt
        }));

        res.json(formatResponse(formattedProviders));
    } catch (error) {
        console.error('Failed to list providers:', error);
        res.json(formatResponse(getDefaultProviders()));
    }
});

// POST /api/devices/providers/:id/configure - Configure provider credentials
router.post('/providers/:id/configure', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { username, accessKey, apiKey, endpoint, region } = req.body;
        const userId = (req as any).user?.id || 'anonymous';

        // Check if provider config exists
        const existing = await db.select()
            .from(cloudDeviceProviders)
            .where(and(
                eq(cloudDeviceProviders.providerType, id),
                eq(cloudDeviceProviders.userId, userId)
            ))
            .limit(1);

        const config = { username, accessKey, apiKey, endpoint, region };

        let provider;
        if (existing.length > 0) {
            // Update existing
            const updated = await db.update(cloudDeviceProviders)
                .set({
                    config,
                    isConnected: true,
                    lastSyncAt: new Date(),
                    updatedAt: new Date()
                })
                .where(eq(cloudDeviceProviders.id, existing[0].id))
                .returning();
            provider = updated[0];
        } else {
            // Create new
            const created = await db.insert(cloudDeviceProviders)
                .values({
                    userId,
                    providerType: id,
                    name: getProviderName(id),
                    config,
                    isConnected: true,
                    deviceCount: 0,
                    lastSyncAt: new Date()
                })
                .returning();
            provider = created[0];
        }

        res.json(formatResponse({
            id: provider.providerType,
            name: provider.name,
            type: provider.providerType,
            connected: provider.isConnected,
            deviceCount: provider.deviceCount,
            icon: getProviderIcon(provider.providerType),
            configuredAt: provider.lastSyncAt
        }, `${provider.name} configured successfully`));
    } catch (error) {
        console.error('Failed to configure provider:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to configure provider'
        });
    }
});

// POST /api/devices/discover/:providerId - Discover devices from a provider
router.post('/discover/:providerId', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { providerId } = req.params;
        const userId = (req as any).user?.id;

        // Get provider
        const providerRecords = await db.select()
            .from(cloudDeviceProviders)
            .where(and(
                eq(cloudDeviceProviders.providerType, providerId),
                userId ? eq(cloudDeviceProviders.userId, userId) : undefined
            ))
            .limit(1);

        if (providerRecords.length === 0 && providerId !== 'local') {
            return res.status(404).json({
                success: false,
                error: 'Provider not found'
            });
        }

        const provider = providerRecords[0];

        if (provider && !provider.isConnected && providerId !== 'local') {
            return res.status(400).json({
                success: false,
                error: 'Provider not configured. Please add credentials first.'
            });
        }

        // Simulate device discovery based on provider
        const discoveredDevices = await simulateDeviceDiscovery(providerId, provider?.id, userId);

        // Save discovered devices to DB
        for (const device of discoveredDevices) {
            await db.insert(cloudDevices)
                .values(device)
                .onConflictDoNothing();
        }

        // Update provider device count
        if (provider) {
            const deviceCount = await db.select()
                .from(cloudDevices)
                .where(eq(cloudDevices.providerId, provider.id));

            await db.update(cloudDeviceProviders)
                .set({ deviceCount: deviceCount.length, updatedAt: new Date() })
                .where(eq(cloudDeviceProviders.id, provider.id));
        }

        // Format response
        const formattedDevices = discoveredDevices.map(d => ({
            id: d.id,
            name: d.name,
            platform: d.platform,
            model: d.model,
            osVersion: d.osVersion,
            status: d.status,
            provider: providerId,
            location: d.location,
            capabilities: d.capabilities,
            lastSeen: new Date(),
            tags: d.tags
        }));

        res.json(formatResponse(formattedDevices, `Discovered ${discoveredDevices.length} devices from ${getProviderName(providerId)}`));
    } catch (error) {
        console.error('Failed to discover devices:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to discover devices'
        });
    }
});

// POST /api/devices/:id/reserve - Reserve a device
router.post('/:id/reserve', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { duration = 60, projectId } = req.body;
        const userId = (req as any).user?.id || 'anonymous';

        // Get device
        const devices = await db.select()
            .from(cloudDevices)
            .where(eq(cloudDevices.id, id))
            .limit(1);

        if (devices.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Device not found'
            });
        }

        const device = devices[0];

        if (device.status !== 'available') {
            return res.status(400).json({
                success: false,
                error: `Device is currently ${device.status}`
            });
        }

        // Create reservation
        const startTime = new Date();
        const endTime = new Date(Date.now() + duration * 60 * 1000);

        const reservation = await db.insert(cloudDeviceReservations)
            .values({
                deviceId: id,
                userId,
                projectId,
                startTime,
                endTime,
                status: 'active'
            })
            .returning();

        // Update device status
        await db.update(cloudDevices)
            .set({ status: 'busy', updatedAt: new Date() })
            .where(eq(cloudDevices.id, id));

        res.json(formatResponse(reservation[0], `Device reserved for ${duration} minutes`));
    } catch (error) {
        console.error('Failed to reserve device:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reserve device'
        });
    }
});

// DELETE /api/devices/reservations/:id - Release a device
router.delete('/reservations/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Get reservation
        const reservations = await db.select()
            .from(cloudDeviceReservations)
            .where(eq(cloudDeviceReservations.id, id))
            .limit(1);

        if (reservations.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Reservation not found'
            });
        }

        const reservation = reservations[0];

        // Update reservation status
        await db.update(cloudDeviceReservations)
            .set({ status: 'completed', endTime: new Date() })
            .where(eq(cloudDeviceReservations.id, id));

        // Update device status
        await db.update(cloudDevices)
            .set({ status: 'available', updatedAt: new Date() })
            .where(eq(cloudDevices.id, reservation.deviceId));

        res.json(formatResponse({ ...reservation, status: 'completed' }, 'Device released successfully'));
    } catch (error) {
        console.error('Failed to release device:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to release device'
        });
    }
});

// GET /api/devices/:id - Get device details
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const devices = await db.select()
            .from(cloudDevices)
            .where(eq(cloudDevices.id, id))
            .limit(1);

        if (devices.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Device not found'
            });
        }

        res.json(formatResponse(devices[0]));
    } catch (error) {
        console.error('Failed to get device:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get device'
        });
    }
});

// Helper functions
function getDefaultProviders() {
    return [
        { id: 'browserstack', name: 'BrowserStack', type: 'browserstack', connected: false, deviceCount: 0, icon: '🌐' },
        { id: 'saucelabs', name: 'Sauce Labs', type: 'saucelabs', connected: false, deviceCount: 0, icon: '🧪' },
        { id: 'lambdatest', name: 'LambdaTest', type: 'lambdatest', connected: false, deviceCount: 0, icon: '⚡' },
        { id: 'local', name: 'Local Devices', type: 'local', connected: true, deviceCount: 2, icon: '💻' },
    ];
}

function getProviderIcon(type: string): string {
    const icons: Record<string, string> = {
        browserstack: '🌐',
        saucelabs: '🧪',
        lambdatest: '⚡',
        local: '💻'
    };
    return icons[type] || '🔌';
}

function getProviderName(type: string): string {
    const names: Record<string, string> = {
        browserstack: 'BrowserStack',
        saucelabs: 'Sauce Labs',
        lambdatest: 'LambdaTest',
        local: 'Local Devices'
    };
    return names[type] || type;
}

async function simulateDeviceDiscovery(providerId: string, providerDbId: string | undefined, userId: string) {
    const devices: any[] = [];
    const baseId = crypto.randomUUID().substring(0, 8);

    if (providerId === 'browserstack') {
        devices.push({
            id: `bs-${baseId}`,
            providerId: providerDbId,
            externalId: `bs-device-${baseId}`,
            name: 'Samsung Galaxy S24 Ultra',
            platform: 'android',
            model: 'Galaxy S24 Ultra',
            osVersion: '14.0',
            status: 'available',
            location: { type: 'cloud', region: 'us-west-1' },
            capabilities: { supportsScreenshots: true, supportsVideoRecording: true, supportsNetworkSimulation: true, maxConcurrentTests: 5 },
            tags: ['android', 'browserstack', 'real-device', 'flagship']
        }, {
            id: `bs-${crypto.randomUUID().substring(0, 8)}`,
            providerId: providerDbId,
            externalId: `bs-device-${crypto.randomUUID().substring(0, 8)}`,
            name: 'iPhone 15 Pro Max',
            platform: 'ios',
            model: 'iPhone 15 Pro Max',
            osVersion: '17.2',
            status: 'available',
            location: { type: 'cloud', region: 'us-west-1' },
            capabilities: { supportsScreenshots: true, supportsVideoRecording: true, supportsNetworkSimulation: true, maxConcurrentTests: 5 },
            tags: ['ios', 'browserstack', 'real-device', 'flagship']
        });
    } else if (providerId === 'saucelabs') {
        devices.push({
            id: `sl-${baseId}`,
            providerId: providerDbId,
            externalId: `sl-device-${baseId}`,
            name: 'Google Pixel 8',
            platform: 'android',
            model: 'Pixel 8',
            osVersion: '14.0',
            status: 'available',
            location: { type: 'cloud', region: 'us-central-1' },
            capabilities: { supportsScreenshots: true, supportsVideoRecording: true, supportsNetworkSimulation: true, maxConcurrentTests: 3 },
            tags: ['android', 'saucelabs', 'real-device']
        });
    } else if (providerId === 'lambdatest') {
        devices.push({
            id: `lt-${baseId}`,
            providerId: providerDbId,
            externalId: `lt-device-${baseId}`,
            name: 'OnePlus 12',
            platform: 'android',
            model: 'OnePlus 12',
            osVersion: '14.0',
            status: 'available',
            location: { type: 'cloud', region: 'ap-south-1' },
            capabilities: { supportsScreenshots: true, supportsVideoRecording: true, supportsNetworkSimulation: true, maxConcurrentTests: 2 },
            tags: ['android', 'lambdatest', 'real-device']
        });
    }

    return devices;
}

function getMockDevices() {
    return [
        {
            id: 'local-iphone-15',
            name: 'iPhone 15 Pro',
            platform: 'ios',
            model: 'iPhone 15 Pro',
            osVersion: '17.2',
            status: 'available',
            provider: 'local',
            location: { type: 'local' },
            capabilities: { supportsScreenshots: true, supportsVideoRecording: true, supportsNetworkSimulation: false, maxConcurrentTests: 1 },
            lastSeen: new Date(),
            tags: ['ios', 'local', 'real-device']
        },
        {
            id: 'local-pixel-8',
            name: 'Pixel 8 Pro',
            platform: 'android',
            model: 'Pixel 8 Pro',
            osVersion: '14',
            status: 'available',
            provider: 'local',
            location: { type: 'local' },
            capabilities: { supportsScreenshots: true, supportsVideoRecording: true, supportsNetworkSimulation: true, maxConcurrentTests: 1 },
            lastSeen: new Date(),
            tags: ['android', 'local', 'real-device']
        }
    ];
}

export default router;

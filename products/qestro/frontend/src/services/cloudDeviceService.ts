/**
 * Cloud Device Service
 * Frontend API client for the Cloud Device Hub module
 */

import { LOCAL_API_ORIGIN } from '../config/devDefaults';

const API_BASE = import.meta.env.VITE_API_URL || LOCAL_API_ORIGIN;
const ALLOW_MOCK_FALLBACKS = import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCK_FALLBACKS === 'true';

export interface CloudDevice {
    id: string;
    name: string;
    platform: 'ios' | 'android' | 'chrome';
    model: string;
    osVersion: string;
    status: 'available' | 'busy' | 'offline' | 'maintenance';
    provider: 'browserstack' | 'saucelabs' | 'lambdatest' | 'local';
    location?: {
        type: 'cloud' | 'local';
        region?: string;
    };
    capabilities: {
        supportsScreenshots: boolean;
        supportsVideoRecording: boolean;
        supportsNetworkSimulation: boolean;
        maxConcurrentTests: number;
    };
    lastSeen: Date;
    tags: string[];
}

export interface CloudProvider {
    id: string;
    name: string;
    type: 'browserstack' | 'saucelabs' | 'lambdatest' | 'local';
    connected: boolean;
    deviceCount: number;
    icon: string;
    configuredAt?: Date;
}

export interface ProviderConfig {
    username?: string;
    accessKey?: string;
    apiKey?: string;
    endpoint?: string;
    region?: string;
}

export interface DeviceReservation {
    id: string;
    deviceId: string;
    userId: string;
    projectId: string;
    startTime: Date;
    endTime: Date;
    status: 'scheduled' | 'active' | 'completed' | 'cancelled';
}

const getAuthHeader = (): HeadersInit => {
    const token = localStorage.getItem('access_token')
        || localStorage.getItem('auth_token')
        || localStorage.getItem('authToken');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const apiError = async (res: Response, fallback: string) => {
    let message = fallback;
    try {
        const body = await res.json();
        message = body?.error || body?.message || message;
    } catch {
        // Keep fallback when the backend does not return JSON.
    }
    return new Error(`${message} (${res.status})`);
};

export const cloudDeviceService = {
    async getDevices(filters?: {
        provider?: string;
        platform?: string;
        status?: string;
    }): Promise<CloudDevice[]> {
        const params = new URLSearchParams();
        if (filters?.provider) params.set('provider', filters.provider);
        if (filters?.platform) params.set('platform', filters.platform);
        if (filters?.status) params.set('status', filters.status);

        try {
            const res = await fetch(`${API_BASE}/api/devices?${params}`, {
                headers: getAuthHeader()
            });

            if (!res.ok) throw new Error(`Failed to fetch devices: ${res.statusText}`);
            const data = await res.json();
            return data.data;
        } catch (error) {
            if (!ALLOW_MOCK_FALLBACKS) {
                throw error;
            }

            console.warn('Backend unavailable, using local development mock devices');
            return [
                { id: '1', name: 'iPhone 15 Pro', platform: 'ios', model: 'iPhone 15 Pro', osVersion: '17.0', status: 'available', provider: 'browserstack', capabilities: { supportsScreenshots: true, supportsVideoRecording: true, supportsNetworkSimulation: true, maxConcurrentTests: 1 }, lastSeen: new Date(), tags: ['mobile', 'ios'] },
                { id: '2', name: 'Pixel 8', platform: 'android', model: 'Pixel 8', osVersion: '14.0', status: 'available', provider: 'saucelabs', capabilities: { supportsScreenshots: true, supportsVideoRecording: true, supportsNetworkSimulation: true, maxConcurrentTests: 1 }, lastSeen: new Date(), tags: ['mobile', 'android'] },
                { id: '3', name: 'Chrome Desktop', platform: 'chrome', model: 'Windows 11', osVersion: '11', status: 'busy', provider: 'lambdatest', capabilities: { supportsScreenshots: true, supportsVideoRecording: true, supportsNetworkSimulation: false, maxConcurrentTests: 5 }, lastSeen: new Date(), tags: ['desktop', 'windows'] }
            ] as CloudDevice[];
        }
    },

    // Providers
    async getProviders(): Promise<CloudProvider[]> {
        try {
            const res = await fetch(`${API_BASE}/api/devices/providers`, {
                headers: getAuthHeader()
            });
            if (!res.ok) throw new Error('Failed to fetch providers');
            const data = await res.json();
            return data.data;
        } catch (error) {
            if (!ALLOW_MOCK_FALLBACKS) {
                throw error;
            }

            console.warn('Backend unavailable, using local development mock providers');
            return [
                { id: 'browserstack', name: 'BrowserStack', type: 'browserstack', connected: true, deviceCount: 154, icon: 'bs' },
                { id: 'saucelabs', name: 'SauceLabs', type: 'saucelabs', connected: true, deviceCount: 89, icon: 'sl' },
                { id: 'local', name: 'Local Simulator', type: 'local', connected: true, deviceCount: 2, icon: 'local' }
            ] as CloudProvider[];
        }
    },

    async configureProvider(providerId: string, config: ProviderConfig): Promise<CloudProvider> {
        const res = await fetch(`${API_BASE}/api/devices/providers/${providerId}/configure`, {
            method: 'POST',
            headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        if (!res.ok) {
            throw await apiError(res, 'Failed to configure provider');
        }
        const data = await res.json();
        return data.data;
    },

    async discoverDevices(providerId: string): Promise<CloudDevice[]> {
        const res = await fetch(`${API_BASE}/api/devices/discover/${providerId}`, {
            method: 'POST',
            headers: getAuthHeader()
        });
        if (!res.ok) {
            throw await apiError(res, 'Failed to discover devices');
        }
        const data = await res.json();
        return data.data;
    },

    // Reservations
    async reserveDevice(deviceId: string, duration: number = 60): Promise<DeviceReservation> {
        const res = await fetch(`${API_BASE}/api/devices/${deviceId}/reserve`, {
            method: 'POST',
            headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ duration })
        });
        if (!res.ok) {
            throw await apiError(res, 'Failed to reserve device');
        }
        const data = await res.json();
        return data.data;
    },

    async releaseDevice(reservationId: string): Promise<void> {
        const res = await fetch(`${API_BASE}/api/devices/reservations/${reservationId}`, {
            method: 'DELETE',
            headers: getAuthHeader()
        });
        if (!res.ok) {
            throw await apiError(res, 'Failed to release device');
        }
    }
};

export default cloudDeviceService;

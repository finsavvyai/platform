// Cloud devices API methods
import type { ApiFetchFn } from './types';

export function createDevicesApi(fetchFn: ApiFetchFn) {
  return {
    async getCloudDevices(filters?: {
      provider?: string;
      platform?: string;
      status?: string;
    }) {
      const params = new URLSearchParams();
      if (filters?.provider) params.append('provider', filters.provider);
      if (filters?.platform) params.append('platform', filters.platform);
      if (filters?.status) params.append('status', filters.status);
      return fetchFn(`/api/devices?${params.toString()}`);
    },

    async getCloudDevice(id: string) {
      return fetchFn(`/api/devices/${id}`);
    },

    async getCloudDeviceProviders() {
      return fetchFn('/api/devices/providers');
    },

    async configureCloudProvider(
      providerId: string,
      config: {
        username?: string;
        accessKey?: string;
        apiKey?: string;
        endpoint?: string;
        region?: string;
      }
    ) {
      return fetchFn(`/api/devices/providers/${providerId}/configure`, {
        method: 'POST',
        body: JSON.stringify(config),
      });
    },

    async discoverCloudDevices(providerId: string) {
      return fetchFn(`/api/devices/discover/${providerId}`, {
        method: 'POST',
      });
    },

    async reserveCloudDevice(
      deviceId: string,
      options?: {
        duration?: number;
        projectId?: string;
      }
    ) {
      return fetchFn(`/api/devices/${deviceId}/reserve`, {
        method: 'POST',
        body: JSON.stringify(options || {}),
      });
    },

    async releaseCloudDevice(reservationId: string) {
      return fetchFn(`/api/devices/reservations/${reservationId}`, {
        method: 'DELETE',
      });
    },
  };
}

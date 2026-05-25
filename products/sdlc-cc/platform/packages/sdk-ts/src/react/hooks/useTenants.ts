// Tenants hook for React

import * as React from 'react';
import { useSDLC } from '../providers/SDLCProvider';
import type { Tenant, CreateTenantRequest } from '../../types';

export function useTenants() {
  const { client } = useSDLC();
  const [tenants, setTenants] = React.useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const list = React.useCallback(async () => {
    if (!client) throw new Error('Client not initialized');
    setIsLoading(true);
    setError(null);
    try {
      const response = await client.tenants.list();
      setTenants(response.items);
      return response;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  const create = React.useCallback(async (data: CreateTenantRequest) => {
    if (!client) throw new Error('Client not initialized');
    setError(null);
    try {
      return await client.tenants.create(data);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [client]);

  return { tenants, isLoading, error, list, create };
}

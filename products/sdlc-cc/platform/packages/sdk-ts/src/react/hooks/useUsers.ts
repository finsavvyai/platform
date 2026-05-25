// Users hook for React

import * as React from 'react';
import { useSDLC } from '../providers/SDLCProvider';
import type { User, CreateUserRequest, UpdateUserRequest } from '../../types';

export function useUsers() {
  const { client } = useSDLC();
  const [users, setUsers] = React.useState<User[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const list = React.useCallback(async (params?: {
    search?: string;
    roles?: string[];
    isActive?: boolean;
  }) => {
    if (!client) throw new Error('Client not initialized');
    setIsLoading(true);
    setError(null);
    try {
      const response = await client.users.list(params);
      setUsers(response.items);
      return response;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  const create = React.useCallback(async (data: CreateUserRequest) => {
    if (!client) throw new Error('Client not initialized');
    setError(null);
    try {
      return await client.users.create(data);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [client]);

  const update = React.useCallback(async (id: string, data: UpdateUserRequest) => {
    if (!client) throw new Error('Client not initialized');
    setError(null);
    try {
      return await client.users.update(id, data);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [client]);

  return { users, isLoading, error, list, create, update };
}

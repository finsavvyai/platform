/**
 * React Query Provider Setup
 *
 * Configures TanStack Query with:
 * - Automatic refetching strategies
 * - Retry logic for failed requests
 * - Cache configuration
 * - DevTools integration
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode } from 'react';
import { queryKeys } from '../lib/queryKeys';

interface QueryProviderProps {
  children: ReactNode;
}

/**
 * Create configured QueryClient instance
 */
function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Refetch on window focus (useful for multi-tab apps)
        refetchOnWindowFocus: true,

        // Refetch on component mount
        refetchOnMount: true,

        // Refetch on reconnect
        refetchOnReconnect: true,

        // Keep data fresh for 5 minutes
        staleTime: 5 * 60 * 1000,

        // Cache data for 30 minutes
        gcTime: 30 * 60 * 1000,

        // Retry failed requests 3 times
        retry: 3,

        // Retry delay with exponential backoff
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

        // Don't refetch if offline
        networkMode: 'online',

        // Throw errors to be caught by error boundaries
        throwOnError: false,
      },
      mutations: {
        // Retry mutations once (e.g., for temporary network issues)
        retry: 1,

        // Don't retry mutations on network errors
        networkMode: 'online',

        // Throw errors to be caught by error boundaries
        throwOnError: false,
      },
    },
  });
}

/**
 * QueryProvider Component
 *
 * Wraps the app with React Query provider and dev tools
 */
export function QueryProvider({ children }: QueryProviderProps) {
  // Create a new QueryClient for each render to avoid cache pollution during tests
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {import.meta.env.DEV && (
        <ReactQueryDevtools
          initialIsOpen={false}
          position="bottom"
          buttonPosition="bottom-right"
        />
      )}
    </QueryClientProvider>
  );
}

export { queryKeys };

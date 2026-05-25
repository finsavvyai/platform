// Auth module types

import type { SDLCConfig } from '../types';

export interface AuthClientConfig extends SDLCConfig {
  storageKey?: string;
  tokenRefreshBuffer?: number;
  autoRefresh?: boolean;
}

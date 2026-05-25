/**
 * Shared types for API
 */

import type { AppVariables, Env } from './app/types';

export type Context = {
	Bindings: Env;
	Variables: AppVariables;
};

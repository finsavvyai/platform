/**
 * MSW server instance for LunaOS Mobile tests.
 *
 * Uses the React Native / Node adapter for msw v2.
 * Started in jest.setup.ts before all tests.
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** MSW server with default handlers */
export const server = setupServer(...handlers);

/**
 * AI Assistant Commands for TenantIQ OpenClaw Skill
 *
 * Re-exports all AI commands so the rest of the codebase can
 * keep importing from 'commands/ai'.
 */

import type { Command } from '../../types';
import { askCommand, recommendCommand } from './ask';
import { aiScanCommand, aiOptimizeCommand } from './scan';
import { aiChainCommand, aiStatusCommand } from './chain';

export {
	askCommand,
	recommendCommand,
	aiScanCommand,
	aiOptimizeCommand,
	aiChainCommand,
	aiStatusCommand,
};

export const aiCommands: Command[] = [
	askCommand,
	recommendCommand,
	aiScanCommand,
	aiOptimizeCommand,
	aiChainCommand,
	aiStatusCommand,
];

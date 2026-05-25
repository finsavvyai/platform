import { createApp } from './app/create-app';
import type { Env } from './app/types';
import { setupLogging } from './lib/logger';
import { queueHandler, scheduledHandler } from './app/worker-handlers';

const loggingReady = setupLogging();
const app = createApp();

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		await loggingReady;
		return app.fetch(request, env, ctx);
	},
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
		await loggingReady;
		await scheduledHandler(event, env, ctx);
	},
	async queue(batch: MessageBatch, env: Env) {
		await loggingReady;
		await queueHandler(batch, env);
	}
};

export { TenantEvents } from './durable-objects/tenant-events';
export type { AppEnv, AppVariables, Env } from './app/types';

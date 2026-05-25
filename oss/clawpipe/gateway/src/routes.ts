/** Subroute dispatchers — prompts, observability, analytics. */
import type { Env } from './types';
import { handleOverview, handleProviders, handleCacheAnalytics, handleRouteAnalytics, handleCostTrend, handleSavingsByTask } from './analytics';
import { handleLogsList, handleLogDetail } from './logs';
import { handleWebhookCreate, handleWebhookList, handleWebhookDelete } from './webhooks';
import { listPrompts, createPrompt, createVersion, listVersions, renderPrompt } from './prompts';
import { handlePostQuality, handleGetQualityTrend } from './quality';

export async function routeAnalytics(path: string, env: Env, projectId: string): Promise<Response> {
  const endpoint = path.replace('/v1/analytics/', '');
  switch (endpoint) {
    case 'overview': return handleOverview(env, projectId);
    case 'providers': return handleProviders(env, projectId);
    case 'cache': return handleCacheAnalytics(env, projectId);
    case 'routes': return handleRouteAnalytics(env, projectId);
    case 'cost-trend': return handleCostTrend(env, projectId);
    case 'savings-by-task': return handleSavingsByTask(env, projectId);
    case 'quality': return handleGetQualityTrend(new Request('https://api.clawpipe.ai/v1/analytics/quality'), env, projectId);
    default: return Response.json({ error: 'Unknown analytics endpoint' }, { status: 404 });
  }
}

export async function routeObservability(
  request: Request, env: Env, path: string, projectId: string,
): Promise<Response | null> {
  const method = request.method;
  if (path === '/v1/logs' && method === 'GET') return handleLogsList(request, env, projectId);
  const logMatch = path.match(/^\/v1\/logs\/([^/]+)$/);
  if (logMatch && method === 'GET') return handleLogDetail(env, projectId, logMatch[1]);
  if (path === '/v1/webhooks' && method === 'POST') return handleWebhookCreate(request, env, projectId);
  if (path === '/v1/webhooks' && method === 'GET') return handleWebhookList(env, projectId);
  const hookMatch = path.match(/^\/v1\/webhooks\/([^/]+)$/);
  if (hookMatch && method === 'DELETE') return handleWebhookDelete(env, projectId, hookMatch[1]);
  return null;
}

export async function routePrompts(
  request: Request, env: Env, path: string, projectId: string,
): Promise<Response | null> {
  const method = request.method;
  if (path === '/v1/prompts' && method === 'GET') return listPrompts(env, projectId);
  if (path === '/v1/prompts' && method === 'POST') return createPrompt(request, env, projectId);
  const versionMatch = path.match(/^\/v1\/prompts\/([^/]+)\/versions$/);
  if (versionMatch && method === 'GET') return listVersions(env, projectId, versionMatch[1]);
  if (versionMatch && method === 'POST') return createVersion(request, env, projectId, versionMatch[1]);
  const renderMatch = path.match(/^\/v1\/prompts\/([^/]+)\/render$/);
  if (renderMatch && method === 'POST') return renderPrompt(request, env, projectId, renderMatch[1]);
  return null;
}

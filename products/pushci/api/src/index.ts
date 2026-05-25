// PushCI API — route registry and middleware wiring.

import { Hono } from "hono";
import type { Env } from "./types";
import { handleBadge } from "./badge";
import { handleOgCard } from "./og-card";
import { handlePipelineCard } from "./pipeline-card";
import { costRoutes } from "./cost-calculator";
import { aiRoutes } from "./ai-gateway";
import { cloudRoutes, runnerProtocolRoutes } from "./cloud-runners";
import { nlpRoutes } from "./nlp";
import { autofixRoutes, pipelineRoutes } from "./autofix";
import { chatActionRoutes } from "./chat-actions";
import { billingRoutes } from "./billing";
import { entitlementRoutes } from "./entitlements";
import { contactRoutes } from "./contact";
import { governanceRoutes } from "./governance";
import { skillRoutes } from "./skills";
import { skillExplainRoutes } from "./skill-explain";
import { skillReviewRoutes } from "./skill-reviews";
import { skillSocialRoutes } from "./skill-social";
import { ssoRoutes } from "./sso";
import { samlRoutes } from "./saml-routes";
import { scimRoutes } from "./scim";
import { artifactRoutes } from "./artifacts";
import { workspaceRoutes } from "./workspaces";
import { channelRoutes } from "./channels";
import { channelTestRoute } from "./channel-test";
import { bridgeRoutes } from "./channel-bridge";
import { auditRoutes } from "./pipeline-audit";
import { skillSubmitRoutes } from "./skill-submit";
import { logRoutes } from "./pipeline-logs";
import { remediateRoutes } from "./auto-remediate";
import { recommendRoutes } from "./recommend";
import { promoteRoutes } from "./promote";
import { buildRoutes } from "./build-number";
import { widgetRoutes } from "./build-widget";
import { registerRoutes } from "./register-local";
import { statsRoutes } from "./project-stats";
import { settingsRoutes } from "./project-settings";
import { teamRoutes } from "./team";
import { auditApiRoutes } from "./audit-api";
import { complianceRoutes } from "./compliance";
import { enterpriseRoutes } from "./enterprise-dora";
import { impactRoutes } from "./impact-analysis";
import { intelRoutes } from "./intel-routes";
import { newsletterRoutes } from "./newsletter";
import { fleetRoutes } from "./managed-fleet";
import { projectGroupRoutes } from "./project-groups";
import { notificationRoutes } from "./notification-preferences";
import { achievementRoutes } from "./achievements";
import { logStreamRoutes } from "./log-stream";
import { pipelineConfigRoutes } from "./pipeline-config";
import { openApiRoutes } from "./openapi";
import { cacheRoutes } from "./build-cache";
import { pipelineVizRoutes } from "./pipeline-viz";
import { secretsScanRoutes } from "./secrets-scan";
import { aiReviewRoutes } from "./ai-review";
import { awsRoutes } from "./aws-routes";
import { getAvailableGateways } from "./gateway-dispatch";
import { coreRoutes, internalRoutes, authRoutes, userRoutes } from "./core-routes";
import { gerritRoutes } from "./gerrit-routes";
import { gerritWebhookRoutes } from "./gerrit-webhook";
import { jenkinsRoutes } from "./jenkins-routes";
import { gitlabRoutes } from "./gitlab-routes";
import { bitbucketRoutes } from "./bitbucket-routes";
import { circleCIRoutes } from "./circleci-routes";
import { azureDevOpsRoutes } from "./azure-devops-routes";
import { githubActionsRoutes } from "./github-actions-routes";
import { cepienRoutes } from "./cepien-routes";
import { mavenRoutes } from "./maven-routes";
import { gradleRoutes } from "./gradle-routes";
import { terraformRoutes } from "./terraform-routes";
import { policyRoutes } from "./policy-routes";
import { authTestRoutes } from "./auth-test";
import { projectEnvRoutes } from "./project-env-routes";
import { companyRegistryRoutes } from "./company-registry-routes";
import { marketplaceRoutes } from "./marketplace-routes";
import { migrateRoutes } from "./migrate-routes";
import { mfaRoutes } from "./mfa-routes";
import { auditChainRoutes } from "./audit-chain";
import { siemRoutes } from "./audit-siem";
import { serviceAccountRoutes, apiTokenRoutes } from "./service-accounts";
import {
  corsMiddleware,
  rateLimitMiddleware,
  rateLimitMiddlewareDO,
  authRateLimitMiddleware,
  requestLogger,
  errorHandler,
  requireAuth,
  BRIDGE_RATE_LIMIT,
  GENERAL_RATE_LIMIT,
} from "./middleware";
import { requireAiQuota, requirePlan } from "./usage";
import { migrateDb } from "./db";

type Bindings = Env;
const app = new Hono<{ Bindings: Bindings }>();

// --- Global middleware ---
app.use("*", corsMiddleware);
app.use("*", errorHandler);
app.use("*", requestLogger);
app.use("/api/*", rateLimitMiddleware);

// --- DO-backed rate limiting (I-002 fix). Strongly consistent across
// CF pops for the highest-value bridge routes — integrations, webhooks,
// run submission, AWS. Lighter /api/* routes keep the KV path above.
app.use("/api/integrations/*", rateLimitMiddlewareDO(BRIDGE_RATE_LIMIT));
app.use("/api/webhook/*", rateLimitMiddlewareDO(BRIDGE_RATE_LIMIT));
app.use("/api/runs", rateLimitMiddlewareDO(BRIDGE_RATE_LIMIT));
app.use("/api/runs/*", rateLimitMiddlewareDO(BRIDGE_RATE_LIMIT));
app.use("/api/aws/*", rateLimitMiddlewareDO(BRIDGE_RATE_LIMIT));
app.use("/api/jenkins/*", rateLimitMiddlewareDO(BRIDGE_RATE_LIMIT));
app.use("/api/gitlab/*", rateLimitMiddlewareDO(BRIDGE_RATE_LIMIT));
app.use("/api/bitbucket/*", rateLimitMiddlewareDO(BRIDGE_RATE_LIMIT));
app.use("/api/circleci/*", rateLimitMiddlewareDO(BRIDGE_RATE_LIMIT));
app.use("/api/azure-devops/*", rateLimitMiddlewareDO(BRIDGE_RATE_LIMIT));
app.use("/api/github-actions/*", rateLimitMiddlewareDO(BRIDGE_RATE_LIMIT));
// Silence unused-export false positive when GENERAL_RATE_LIMIT isn't
// directly applied yet — still exported for callers outside this file.
void GENERAL_RATE_LIMIT;

// --- Auth guards ---
app.use("/api/ai/*", requireAuth);
app.use("/api/ai/*", requireAiQuota());
app.use("/api/cloud/*", requireAuth);
app.use("/api/cloud/*", requirePlan("pro", "team"));
app.use("/api/nlp/*", requireAuth);
app.use("/api/nlp/*", requireAiQuota());
app.use("/api/autofix/*", requireAuth);
app.use("/api/autofix/*", requireAiQuota());
app.use("/api/pipeline/*", requireAuth);
app.use("/api/governance/*", requireAuth);
app.use("/api/governance/*", requirePlan("team"));
app.use("/api/sso/config/*", requireAuth);
app.use("/api/sso/config/*", requirePlan("team"));
app.use("/api/artifacts/*", requireAuth);
app.use("/api/artifacts/*", requirePlan("pro", "team"));
app.use("/api/workspaces/*", requireAuth);
app.use("/api/workspaces/*", requirePlan("team"));
app.use("/api/channels/*", requireAuth);
app.use("/api/skills/submit*", requireAuth);
app.use("/api/skills/submissions*", requireAuth);
app.use("/api/skills/*/explain", requireAuth);
app.use("/api/skills/*/explain", requireAiQuota());
app.use("/api/logs/*", requireAuth);
app.use("/api/remediate/*", requireAuth);
app.use("/api/remediate/*", requireAiQuota());
app.use("/api/runs/report", requireAuth);
app.use("/api/runners/register-local", requireAuth);
app.use("/api/repos/*", requireAuth);
app.use("/api/stats/*", requireAuth);
app.use("/api/settings/*", requireAuth);
app.use("/api/promote", requireAuth);
app.use("/api/impact/*", requireAuth);
app.use("/api/intel/*", requireAuth);
app.use("/api/fleet/*", requireAuth);
app.use("/api/groups/*", requireAuth);
app.use("/api/groups", requireAuth);
app.use("/api/team/*", requireAuth);
app.use("/api/team", requireAuth);
app.use("/api/notifications/*", requireAuth);
app.use("/api/audit/*", requireAuth);
app.use("/api/audit/*", requirePlan("team"));
app.use("/api/compliance/*", requireAuth);
app.use("/api/compliance/*", requirePlan("team"));
app.use("/api/enterprise/*", requireAuth);
app.use("/api/enterprise/*", requirePlan("team"));
app.use("/api/achievements/*", requireAuth);
app.use("/api/pipeline-config/*", requireAuth);
app.use("/api/cache/*", requireAuth);
app.use("/api/viz/*", requireAuth);
app.use("/api/secrets/*", requireAuth);
app.use("/api/review/*", requireAuth);
app.use("/api/review/*", requireAiQuota());
app.use("/scim/v2/*", requireAuth);
app.use("/scim/v2/*", requirePlan("team"));
app.use("/api/scim/v2/*", requireAuth);
app.use("/api/scim/v2/*", requirePlan("team"));
app.use("/api/aws/*", requireAuth);
app.use("/api/aws/*", requirePlan("pro", "team"));
app.use("/api/gerrit/*", requireAuth);
app.use("/api/jenkins/*", requireAuth);
app.use("/api/gitlab/*", requireAuth);
app.use("/api/bitbucket/*", requireAuth);
app.use("/api/circleci/*", requireAuth);
app.use("/api/azure-devops/*", requireAuth);
app.use("/api/github-actions/*", requireAuth);
// Cepien: I-001 feature flag (v1.6.6 audit). Speculative integration —
// Cepien hasn't published their production webhook schema yet. Mount the
// routes only when ENABLE_CEPIEN is explicitly set; otherwise respond 404
// so any stray webhook learns the endpoint doesn't exist (rather than
// seeing a 401 and retrying with a different HMAC signature).
//
// /webhook is HMAC-gated (Cepien calls it), /callback is internal runner
// only (no JWT). Gate /connect and /connections with requireAuth so only the
// logged-in user can register or list their Cepien workspaces.
const cepienEnabled = (env: Env): boolean =>
  env.ENABLE_CEPIEN === "1" || env.ENABLE_CEPIEN === "true";
app.use("/api/integrations/cepien/*", async (c, next) => {
  if (!cepienEnabled(c.env)) return c.notFound();
  await next();
});
app.use("/api/integrations/cepien/connect", requireAuth);
app.use("/api/integrations/cepien/connections", requireAuth);
app.use("/api/integrations/cepien/connections/*", requireAuth);
app.use("/api/maven/*", requireAuth);
app.use("/api/gradle/*", requireAuth);
app.use("/api/terraform/*", requireAuth);
app.use("/api/policy/*", requireAuth);
app.use("/api/projects/:projectId/environments/*", requireAuth);
app.use("/api/registries/*", requireAuth);
app.use("/api/marketplace/*", requireAuth);
app.use("/api/migrate/*", requireAuth);
// Enterprise gap closures (v1.7.0): MFA/TOTP enrollment requires auth on
// every route (status through disable). The audit hash-chain and SIEM
// export sit under /api/audit/* so the existing guard at line 157 picks
// them up automatically — no extra middleware needed.
app.use("/api/mfa/*", requireAuth);
// Service accounts + scoped API tokens mount under /api/orgs/:orgId/...
// The handlers authenticate via getAuthUser themselves (the membership
// lookup doubles as the authz check) so we don't need a blanket
// requireAuth here — see service-accounts.ts for the pattern.

// --- Root ---
app.get("/", (c) =>
  c.json({
    name: "PushCI API",
    version: "1.2.0",
    docs: "https://pushci.dev/docs#api",
    health: "/health",
    plans: "/api/billing/plans",
  })
);

// --- Health ---
app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// --- Gateway status ---
app.get("/api/gateways", (c) => {
  const gateways = getAvailableGateways(c.env);
  return c.json({ gateways: gateways.map(g => ({ name: g.name, connected: true })), count: gateways.length });
});

// --- Core inline routes (runs, projects, webhooks, telemetry) ---
app.route("/", coreRoutes);
app.route("/internal", internalRoutes);
app.use("/api/auth/*", authRateLimitMiddleware);
app.route("/api/auth", authRoutes);
app.route("/api/auth", authTestRoutes);
app.route("/api/user", userRoutes);

// --- Public endpoints ---
app.get("/badge/:owner/:repo", (c) => handleBadge(c));
app.get("/api/card/:owner/:repo", (c) => handleOgCard(c));
app.get("/api/card/:owner/:repo/pipeline", (c) => handlePipelineCard(c));

// --- Feature routes ---
app.route("/api/tools", costRoutes);
app.route("/api/ai", aiRoutes);
app.route("/api/cloud", cloudRoutes);
app.route("/", runnerProtocolRoutes);
app.route("/api/nlp", nlpRoutes);
app.route("/api/chat", chatActionRoutes);
app.route("/api/autofix", autofixRoutes);
app.route("/api/pipeline", pipelineRoutes);
app.route("/api/pipeline", auditRoutes);
app.route("/api/billing", billingRoutes);
app.route("/api", entitlementRoutes);
app.route("/api", contactRoutes);
app.route("/api/governance", governanceRoutes);
app.route("/api/sso", ssoRoutes);
app.route("/api/saml", samlRoutes);
app.route("/scim/v2", scimRoutes);
app.route("/api/scim/v2", scimRoutes); // alias — matches commit 6fe7e74 body claim
app.route("/api/artifacts", artifactRoutes);
app.route("/api/workspaces", workspaceRoutes);
app.route("/api/skills", skillRoutes);
app.route("/api/skills", skillExplainRoutes);
app.route("/api/skills", skillReviewRoutes);
app.route("/api/skills", skillSocialRoutes);
app.route("/api/skills", skillSubmitRoutes);
app.route("/api/channels", channelRoutes);
app.route("/api/channels", channelTestRoute);
app.route("/channels", bridgeRoutes);
app.route("/api/logs", logRoutes);
app.route("/api/remediate", remediateRoutes);
app.route("/api", recommendRoutes);
app.route("/api", promoteRoutes);
app.route("/api", buildRoutes);
app.route("/", widgetRoutes);
app.route("/api", registerRoutes);
app.route("/api", statsRoutes);
app.route("/api", settingsRoutes);
app.route("/api/team", teamRoutes);
app.route("/api/impact", impactRoutes);
app.route("/api/intel", intelRoutes);
app.route("/api", newsletterRoutes);
app.route("/api/fleet", fleetRoutes);
app.route("/api/groups", projectGroupRoutes);
app.route("/api/notifications", notificationRoutes);
app.route("/api/achievements", achievementRoutes);
app.route("/api/audit", auditApiRoutes);
// Hash-chain verification (/verify, /tip) and SIEM export (/export,
// /destinations) mount under the same /api/audit prefix so a single auth
// guard + single audit surface serves compliance tooling. Hono merges
// overlapping .route() registrations.
app.route("/api/audit", auditChainRoutes);
app.route("/api/audit", siemRoutes);
app.route("/api/mfa", mfaRoutes);
app.route("/api", serviceAccountRoutes);
app.route("/api", apiTokenRoutes);
app.route("/api/compliance", complianceRoutes);
app.route("/api/enterprise", enterpriseRoutes);
app.route("/api/log-stream", logStreamRoutes);
app.route("/api/pipeline-config", pipelineConfigRoutes);
app.route("/api/openapi", openApiRoutes);
app.route("/api/cache", cacheRoutes);
app.route("/api/viz", pipelineVizRoutes);
app.route("/api/secrets", secretsScanRoutes);
app.route("/api/review", aiReviewRoutes);
app.route("/api/aws", awsRoutes);
app.route("/api/gerrit", gerritRoutes);
app.route("/", gerritWebhookRoutes);
app.route("/api/jenkins", jenkinsRoutes);
app.route("/api/gitlab", gitlabRoutes);
app.route("/api/bitbucket", bitbucketRoutes);
app.route("/api/circleci", circleCIRoutes);
app.route("/api/azure-devops", azureDevOpsRoutes);
app.route("/api/github-actions", githubActionsRoutes);
app.route("/api/integrations/cepien", cepienRoutes);
app.route("/api/maven", mavenRoutes);
app.route("/api/gradle", gradleRoutes);
app.route("/api/terraform", terraformRoutes);
app.route("/api/policy", policyRoutes);
app.route("/api/projects/:projectId/environments", projectEnvRoutes);
app.route("/api/registries", companyRegistryRoutes);
app.route("/api/marketplace", marketplaceRoutes);
app.route("/api/migrate", migrateRoutes);

// --- Dev-only ---
app.post("/api/migrate", async (c) => {
  if (c.env.ENVIRONMENT !== "development") return c.json({ error: "forbidden" }, 403);
  await migrateDb(c.env.DB);
  return c.json({ status: "migrated" });
});

import { handleScheduled } from "./seo-cron";
import { pollAllGerritProjects } from "./gerrit-poll";

// Re-export the Durable Object class so wrangler finds it (binding
// `RATE_LIMITER`, class `RateLimiterDO` — see wrangler.toml migration v1).
export { RateLimiterDO } from "./rate-limit-do";

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext) {
    await handleScheduled();
    try { await pollAllGerritProjects(env); } catch { /* never fail the cron */ }
  },
};

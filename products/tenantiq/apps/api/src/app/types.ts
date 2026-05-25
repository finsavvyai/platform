export interface Env {
	KV: KVNamespace;
	R2: R2Bucket;
	SCAN_QUEUE: Queue;
	REMEDIATION_QUEUE: Queue;
	NOTIFICATION_QUEUE: Queue;
	TENANT_EVENTS: DurableObjectNamespace;
	DB: D1Database;
	AZURE_CLIENT_ID?: string;
	AZURE_CLIENT_SECRET?: string;
	AZURE_TENANT_ID?: string;
	LINKEDIN_CLIENT_ID?: string;
	LINKEDIN_CLIENT_SECRET?: string;
	JWT_SECRET: string;
	RS256_PRIVATE_KEY?: string;
	RS256_PUBLIC_KEY?: string;
	ANTHROPIC_API_KEY?: string;
	DEEPSEEK_API_KEY?: string;
	GROQ_API_KEY?: string;
	GEMINI_API_KEY?: string;
	AI_ENGINE?: Fetcher;
	OPENCLAW_URL?: string;
	OPENCLAW_SERVICE_KEY?: string;
	VAPID_PUBLIC_KEY?: string;
	VAPID_PRIVATE_KEY?: string;
	VAPID_CONTACT?: string;
	RESEND_API_KEY?: string;
	TWILIO_SID?: string;
	TWILIO_AUTH_TOKEN?: string;
	TWILIO_FROM?: string;
	SUPERAGENT_API_KEY?: string;
	CLAW_API_KEY?: string;
	CLAW_PROJECT_ID?: string;
	CLAW_GATEWAY_URL?: string;
	SENTRY_DSN?: string;
	SENTRY_RELEASE?: string;
	FRONTEND_URL?: string;
	ENVIRONMENT: string;
	APP_VERSION?: string;
	LEMONSQUEEZY_API_KEY?: string;
	LEMONSQUEEZY_STORE_ID?: string;
	LEMONSQUEEZY_WEBHOOK_SECRET?: string;
	LEMONSQUEEZY_VARIANT_CORE?: string;
	LEMONSQUEEZY_VARIANT_PROFESSIONAL?: string;
	LEMONSQUEEZY_VARIANT_SECURITY_SUITE?: string;
	LEMONSQUEEZY_VARIANT_ENTERPRISE?: string;
	LEMONSQUEEZY_VARIANT_CORE_ANNUAL?: string;
	LEMONSQUEEZY_VARIANT_PROFESSIONAL_ANNUAL?: string;
	LEMONSQUEEZY_VARIANT_SECURITY_SUITE_ANNUAL?: string;
	HEALTHCHECK_PING_KEY?: string;
	WORKOS_API_KEY?: string;
	WORKOS_CLIENT_ID?: string;
	API_BASE_URL?: string;
	R2_PUBLIC_BASE_URL?: string;
	SDLC_CC_BASE_URL?: string;
	SDLC_CC_API_KEY?: string;
	SDLC_CC_ADMIN_BEARER?: string;
}

export interface AppVariables {
	user: {
		sub: string;
		email: string;
		name: string;
		orgId: string;
		tenantIds: string[];
		role: string;
	};
	tenantId: string;
	requestId: string;
	traceId?: string;
	spanId?: string;
	userId?: string;
	userEmail?: string;
	userRole?: 'viewer' | 'operator' | 'admin' | 'super_admin';
	validatedBody?: unknown;
}

export type AppEnv = { Bindings: Env; Variables: AppVariables };

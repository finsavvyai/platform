import { nanoid } from 'nanoid';
import type { Env } from '../../index';
import { getDb, schema } from '../../lib/db';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../../lib/auth';
import type { ProvisionTenantParams, ProvisionedTenant } from './types';
import { TIER_CONFIG } from './types';
import { validateProvisioningParams } from './validation';
import { sendInvitationEmail } from '../../lib/email-service';

/**
 * Provision a new customer tenant
 *
 * This is a comprehensive operation that:
 * 1. Creates the organization record
 * 2. Sets up the subscription
 * 3. Creates the tenant admin user
 * 4. Optionally sends invitation email
 * 5. Initializes default settings
 */
export async function provisionTenant(env: Env, params: ProvisionTenantParams): Promise<ProvisionedTenant> {
	const db = getDb(env);
	const now = new Date();
	const nowISO = now.toISOString();

	await validateProvisioningParams(db, params);

	const tierConfig = TIER_CONFIG[params.subscriptionTier];
	const billingInterval = params.billingInterval || 'monthly';
	const price = billingInterval === 'annual' ? tierConfig.annualPrice : tierConfig.monthlyPrice;

	const trialDays = params.trialDays ?? 14;
	const trialEndsAt = new Date(now);
	trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

	const subscriptionStatus = trialDays > 0 ? 'trial' : 'active';
	const periodStart = now;
	const periodEnd = new Date(now);
	if (billingInterval === 'monthly') {
		periodEnd.setMonth(periodEnd.getMonth() + 1);
	} else {
		periodEnd.setFullYear(periodEnd.getFullYear() + 1);
	}

	const organizationId = nanoid();
	const userId = nanoid();
	const subscriptionId = nanoid();

	try {
		await createOrganization(db, params, organizationId, tierConfig, subscriptionStatus, trialEndsAt, nowISO);
		await createSubscription(db, subscriptionId, organizationId, params, price, billingInterval, subscriptionStatus, tierConfig, periodStart, periodEnd, nowISO);

		const userStatus = params.adminPassword ? 'active' : 'invited';
		await createAdminUser(db, userId, organizationId, params, userStatus, nowISO);

		const invitation = await createInvitationIfNeeded(db, env, organizationId, params, nowISO);
		await initializeUsageMetrics(db, organizationId, now, nowISO);
		await createProvisioningAuditLog(db, organizationId, params, nowISO);

		return {
			organization: { id: organizationId, name: params.organizationName, slug: params.slug, status: 'active' },
			adminUser: { id: userId, email: params.adminEmail, name: params.adminName, role: 'tenant_admin', status: userStatus },
			subscription: { id: subscriptionId, tier: params.subscriptionTier, status: subscriptionStatus, currentPeriodEnd: periodEnd.toISOString() },
			invitation,
		};
	} catch (error) {
		console.error('Failed to provision tenant:', error);
		try {
			await db
				.update(schema.organizations)
				.set({ status: 'deleted', deletedAt: nowISO })
				.where(eq(schema.organizations.id, organizationId));
		} catch (rollbackError) {
			console.error('Failed to rollback organization creation:', rollbackError);
		}
		throw new Error(`Tenant provisioning failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

async function createOrganization(
	db: ReturnType<typeof getDb>, params: ProvisionTenantParams, orgId: string,
	tierConfig: typeof TIER_CONFIG[keyof typeof TIER_CONFIG],
	subscriptionStatus: string, trialEndsAt: Date, nowISO: string
): Promise<void> {
	await db.insert(schema.organizations).values({
		id: orgId, name: params.organizationName, slug: params.slug, domain: params.domain,
		primaryContactEmail: params.adminEmail, primaryContactName: params.adminName,
		phone: params.phone, addressLine1: params.addressLine1, addressLine2: params.addressLine2,
		city: params.city, state: params.state, zipCode: params.zipCode, country: params.country,
		subscriptionTier: params.subscriptionTier, subscriptionStatus, billingEmail: params.adminEmail,
		industry: params.industry, companySize: params.companySize, websiteUrl: params.websiteUrl,
		maxUsers: tierConfig.maxUsers, maxScansPerMonth: tierConfig.maxScansPerMonth,
		maxAlerts: tierConfig.maxAlerts, maxStorageGB: tierConfig.maxStorageGB,
		status: 'active', createdAt: nowISO, createdBy: params.createdBy, updatedAt: nowISO,
		trialStartedAt: subscriptionStatus === 'trial' ? nowISO : null,
		trialEndsAt: subscriptionStatus === 'trial' ? trialEndsAt.toISOString() : null,
	});
}

async function createSubscription(
	db: ReturnType<typeof getDb>, subscriptionId: string, orgId: string,
	params: ProvisionTenantParams, price: number, billingInterval: string,
	subscriptionStatus: string, tierConfig: typeof TIER_CONFIG[keyof typeof TIER_CONFIG],
	periodStart: Date, periodEnd: Date, nowISO: string
): Promise<void> {
	await db.insert(schema.subscriptions).values({
		id: subscriptionId, organizationId: orgId, tier: params.subscriptionTier,
		status: subscriptionStatus, monthlyPrice: price, currency: 'USD', billingInterval,
		currentPeriodStart: periodStart.toISOString(), currentPeriodEnd: periodEnd.toISOString(),
		maxUsers: tierConfig.maxUsers, maxScansPerMonth: tierConfig.maxScansPerMonth,
		maxAlerts: tierConfig.maxAlerts, maxStorageGB: tierConfig.maxStorageGB,
		features: JSON.stringify(tierConfig.features), createdAt: nowISO, updatedAt: nowISO,
	});
}

async function createAdminUser(
	db: ReturnType<typeof getDb>, userId: string, orgId: string,
	params: ProvisionTenantParams, userStatus: string, nowISO: string
): Promise<void> {
	await db.insert(schema.platformUsers).values({
		id: userId, organizationId: orgId, email: params.adminEmail, name: params.adminName,
		role: 'tenant_admin', passwordHash: params.adminPassword ? await hashPassword(params.adminPassword) : null,
		status: userStatus, emailVerified: 0, authProvider: 'email',
		createdAt: nowISO, createdBy: params.createdBy, updatedAt: nowISO,
		invitedAt: userStatus === 'invited' ? nowISO : null,
		invitedBy: userStatus === 'invited' ? params.createdBy : null,
	});
}

async function createInvitationIfNeeded(
	db: ReturnType<typeof getDb>, env: Env, orgId: string,
	params: ProvisionTenantParams, nowISO: string
): Promise<{ token: string; expiresAt: string; invitationUrl: string } | undefined> {
	if (params.adminPassword) return undefined;

	const invitationToken = nanoid(32);
	const invitationExpiresAt = new Date();
	invitationExpiresAt.setDate(invitationExpiresAt.getDate() + 7);

	await db.insert(schema.invitations).values({
		id: nanoid(), organizationId: orgId, email: params.adminEmail,
		role: 'tenant_admin', token: invitationToken, status: 'pending',
		invitedBy: params.createdBy, invitedAt: nowISO, expiresAt: invitationExpiresAt.toISOString(),
	});

	const invitationUrl = `${env.FRONTEND_URL || 'https://app.tenantiq.app'}/accept-invitation?token=${invitationToken}`;

	await sendInvitationEmail(env, {
		to: params.adminEmail,
		invitedBy: params.createdBy,
		invitationUrl,
	});

	return {
		token: invitationToken,
		expiresAt: invitationExpiresAt.toISOString(),
		invitationUrl,
	};
}

async function initializeUsageMetrics(
	db: ReturnType<typeof getDb>, orgId: string, now: Date, nowISO: string
): Promise<void> {
	await db.insert(schema.usageMetrics).values({
		id: nanoid(), organizationId: orgId,
		periodStart: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
		periodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString(),
		scansExecuted: 0, alertsGenerated: 0, remediationsExecuted: 0,
		apiCallsCount: 0, storageUsedMB: 0, m365UsersMonitored: 0,
		m365LicensesTracked: 0, createdAt: nowISO,
	});
}

async function createProvisioningAuditLog(
	db: ReturnType<typeof getDb>, orgId: string, params: ProvisionTenantParams, nowISO: string
): Promise<void> {
	await db.insert(schema.auditLogs).values({
		id: nanoid(), tenantId: orgId, eventType: 'tenant_provisioned',
		actorId: params.createdBy, actorType: 'platform_admin',
		resourceId: orgId, resourceType: 'organization', action: 'create', result: 'success',
		details: JSON.stringify({
			organizationName: params.organizationName,
			tier: params.subscriptionTier,
			adminEmail: params.adminEmail,
		}),
		timestamp: nowISO, complianceCategory: 'administrative',
	});
}

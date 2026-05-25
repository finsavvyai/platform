#!/usr/bin/env tsx
/**
 * Qestro Enterprise Onboarding Script
 * 
 * Automates the provisioning of new enterprise tenants including:
 * - Tenant creation
 * - Admin account setup
 * - Default quota configuration
 * - SSO/SAML preparation
 * - Welcome email dispatch
 * 
 * Usage:
 *   tsx scripts/enterprise-onboarding.ts --company "Acme Corp" --admin-email "admin@acme.com"
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

// Enterprise onboarding configuration
interface EnterpriseOnboardingConfig {
    companyName: string;
    adminEmail: string;
    customDomain?: string;
    planTier: 'team' | 'enterprise';
    ssoProvider?: 'azure_ad' | 'okta' | 'google' | 'saml';
    quotas?: {
        testRuns?: number | 'unlimited';
        storage?: string;
        teamMembers?: number;
        aiGenerations?: number | 'unlimited';
    };
    branding?: {
        primaryColor?: string;
        logo?: string;
    };
}

interface OnboardingResult {
    success: boolean;
    tenantId: string;
    adminUserId: string;
    tempPassword?: string;
    ssoConfigUrl?: string;
    dashboardUrl: string;
    errors: string[];
}

// Default enterprise quotas
const DEFAULT_ENTERPRISE_QUOTAS = {
    testRuns: 'unlimited' as const,
    storage: '500GB',
    teamMembers: 500,
    aiGenerations: 'unlimited' as const,
};

const DEFAULT_TEAM_QUOTAS = {
    testRuns: 25000,
    storage: '50GB',
    teamMembers: 50,
    aiGenerations: 5000,
};

async function createEnterpriseTenant(config: EnterpriseOnboardingConfig): Promise<OnboardingResult> {
    const errors: string[] = [];
    const tenantId = randomUUID();
    const adminUserId = randomUUID();

    console.log('🏢 Starting Enterprise Onboarding for:', config.companyName);
    console.log('━'.repeat(60));

    // Database connection
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });

    const db = drizzle(pool);

    try {
        // Step 1: Create Organization
        console.log('\n📋 Step 1/7: Creating organization...');
        const orgResult = await pool.query(`
      INSERT INTO organizations (id, name, slug, plan, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING id
    `, [
            tenantId,
            config.companyName,
            config.companyName.toLowerCase().replace(/\s+/g, '-'),
            config.planTier,
        ]);
        console.log('   ✅ Organization created:', tenantId);

        // Step 2: Generate admin credentials
        console.log('\n🔐 Step 2/7: Creating admin account...');
        const tempPassword = generateSecurePassword();
        const hashedPassword = await bcrypt.hash(tempPassword, 12);

        await pool.query(`
      INSERT INTO users (id, email, password_hash, role, organization_id, created_at, updated_at)
      VALUES ($1, $2, $3, 'org_admin', $4, NOW(), NOW())
    `, [adminUserId, config.adminEmail, hashedPassword, tenantId]);
        console.log('   ✅ Admin account created:', config.adminEmail);

        // Step 3: Configure quotas
        console.log('\n📊 Step 3/7: Setting up quotas...');
        const quotas = config.planTier === 'enterprise'
            ? { ...DEFAULT_ENTERPRISE_QUOTAS, ...config.quotas }
            : { ...DEFAULT_TEAM_QUOTAS, ...config.quotas };

        await pool.query(`
      INSERT INTO organization_quotas (organization_id, test_runs, storage, team_members, ai_generations, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [
            tenantId,
            quotas.testRuns === 'unlimited' ? -1 : quotas.testRuns,
            quotas.storage,
            quotas.teamMembers,
            quotas.aiGenerations === 'unlimited' ? -1 : quotas.aiGenerations,
        ]);
        console.log('   ✅ Quotas configured:', JSON.stringify(quotas));

        // Step 4: Initialize subscription
        console.log('\n💳 Step 4/7: Initializing subscription...');
        const subscriptionId = randomUUID();
        await pool.query(`
      INSERT INTO subscriptions (id, organization_id, plan, status, period_start, period_end, created_at)
      VALUES ($1, $2, $3, 'active', NOW(), NOW() + INTERVAL '1 year', NOW())
    `, [subscriptionId, tenantId, config.planTier]);
        console.log('   ✅ Subscription activated (annual)');

        // Step 5: SSO Configuration (if applicable)
        let ssoConfigUrl: string | undefined;
        if (config.ssoProvider) {
            console.log('\n🔑 Step 5/7: Preparing SSO configuration...');
            const ssoConfigId = randomUUID();
            await pool.query(`
        INSERT INTO sso_configurations (id, organization_id, provider, status, config, created_at)
        VALUES ($1, $2, $3, 'pending', '{}', NOW())
      `, [ssoConfigId, tenantId, config.ssoProvider]);
            ssoConfigUrl = `https://app.qestro.ai/admin/sso/${ssoConfigId}/configure`;
            console.log('   ✅ SSO setup prepared:', config.ssoProvider);
            console.log('   📎 Configuration URL:', ssoConfigUrl);
        } else {
            console.log('\n🔑 Step 5/7: SSO configuration skipped (not requested)');
        }

        // Step 6: Branding configuration
        if (config.branding) {
            console.log('\n🎨 Step 6/7: Applying custom branding...');
            await pool.query(`
        INSERT INTO organization_branding (organization_id, primary_color, logo_url, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (organization_id) DO UPDATE SET primary_color = $2, logo_url = $3
      `, [tenantId, config.branding.primaryColor || '#1a56db', config.branding.logo || null]);
            console.log('   ✅ Branding applied');
        } else {
            console.log('\n🎨 Step 6/7: Using default branding');
        }

        // Step 7: Create default project
        console.log('\n📁 Step 7/7: Creating default project...');
        const projectId = randomUUID();
        await pool.query(`
      INSERT INTO projects (id, organization_id, name, slug, created_by, created_at)
      VALUES ($1, $2, 'Getting Started', 'getting-started', $3, NOW())
    `, [projectId, tenantId, adminUserId]);
        console.log('   ✅ Default project created');

        // Generate onboarding tasks
        await seedOnboardingTasks(pool, adminUserId);

        console.log('\n' + '━'.repeat(60));
        console.log('🎉 ENTERPRISE ONBOARDING COMPLETE!');
        console.log('━'.repeat(60));
        console.log('\n📋 Summary:');
        console.log(`   Company:      ${config.companyName}`);
        console.log(`   Tenant ID:    ${tenantId}`);
        console.log(`   Admin Email:  ${config.adminEmail}`);
        console.log(`   Temp Password: ${tempPassword}`);
        console.log(`   Plan:         ${config.planTier.toUpperCase()}`);
        console.log(`   Dashboard:    https://app.qestro.ai/login`);
        if (ssoConfigUrl) {
            console.log(`   SSO Config:   ${ssoConfigUrl}`);
        }

        // Send welcome email (placeholder)
        await sendWelcomeEmail(config.adminEmail, config.companyName, tempPassword);
        console.log('\n📧 Welcome email sent to:', config.adminEmail);

        return {
            success: true,
            tenantId,
            adminUserId,
            tempPassword,
            ssoConfigUrl,
            dashboardUrl: 'https://app.qestro.ai/login',
            errors: [],
        };

    } catch (error) {
        console.error('\n❌ Onboarding failed:', error);
        errors.push(error instanceof Error ? error.message : 'Unknown error');

        return {
            success: false,
            tenantId,
            adminUserId,
            dashboardUrl: '',
            errors,
        };
    } finally {
        await pool.end();
    }
}

async function seedOnboardingTasks(pool: Pool, userId: string): Promise<void> {
    const tasks = [
        { id: 'create_test_case', title: 'Create your first test case', order: 1 },
        { id: 'create_run', title: 'Create a test run', order: 2 },
        { id: 'complete_run', title: 'Complete a test run', order: 3 },
        { id: 'generate_report', title: 'Generate a report', order: 4 },
        { id: 'share_run', title: 'Share results with team', order: 5 },
        { id: 'create_test_plan', title: 'Create a test plan', order: 6 },
        { id: 'add_plan_component', title: 'Add components to plan', order: 7 },
        { id: 'export_plan_pdf', title: 'Export plan as PDF', order: 8 },
        { id: 'share_test_plan', title: 'Share test plan', order: 9 },
    ];

    for (const task of tasks) {
        await pool.query(`
      INSERT INTO onboarding_tasks (id, user_id, task_key, title, task_order, completed, created_at)
      VALUES ($1, $2, $3, $4, $5, false, NOW())
      ON CONFLICT DO NOTHING
    `, [randomUUID(), userId, task.id, task.title, task.order]);
    }
}

function generateSecurePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 16; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

async function sendWelcomeEmail(email: string, companyName: string, tempPassword: string): Promise<void> {
    // In production, this would use SendGrid, Resend, or similar
    console.log(`   [EMAIL] Subject: Welcome to Qestro, ${companyName}!`);
    console.log(`   [EMAIL] To: ${email}`);
    console.log(`   [EMAIL] Body: Your temporary password is: ${tempPassword}`);
    console.log(`   [EMAIL] (In production, this sends via email provider)`);
}

// CLI execution
async function main() {
    const args = process.argv.slice(2);

    const getArg = (name: string): string | undefined => {
        const index = args.findIndex(a => a === `--${name}`);
        return index !== -1 ? args[index + 1] : undefined;
    };

    const companyName = getArg('company');
    const adminEmail = getArg('admin-email');
    const planTier = (getArg('plan') || 'enterprise') as 'team' | 'enterprise';
    const ssoProvider = getArg('sso') as EnterpriseOnboardingConfig['ssoProvider'];

    if (!companyName || !adminEmail) {
        console.log(`
Usage: tsx scripts/enterprise-onboarding.ts [options]

Required:
  --company      Company name (e.g., "Acme Corporation")
  --admin-email  Primary admin email address

Optional:
  --plan         Subscription tier: team | enterprise (default: enterprise)
  --sso          SSO provider: azure_ad | okta | google | saml

Example:
  tsx scripts/enterprise-onboarding.ts \\
    --company "Acme Corp" \\
    --admin-email "admin@acme.com" \\
    --plan enterprise \\
    --sso azure_ad
    `);
        process.exit(1);
    }

    const result = await createEnterpriseTenant({
        companyName,
        adminEmail,
        planTier,
        ssoProvider,
    });

    process.exit(result.success ? 0 : 1);
}

main().catch(console.error);

export { createEnterpriseTenant, EnterpriseOnboardingConfig, OnboardingResult };

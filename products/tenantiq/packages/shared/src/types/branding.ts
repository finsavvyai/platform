/**
 * White-label branding types for per-org customization.
 */

export interface OrgBranding {
	orgId: string;
	logoUrl: string | null;
	faviconUrl: string | null;
	primaryColor: string;
	secondaryColor: string;
	companyName: string;
	customDomain: string | null;
	emailFromName: string | null;
}

export interface OrgBrandingRow {
	id: string;
	org_id: string;
	logo_url: string | null;
	favicon_url: string | null;
	primary_color: string;
	secondary_color: string;
	company_name: string;
	custom_domain: string | null;
	email_from_name: string | null;
	created_at: number;
	updated_at: number;
}

/**
 * Azure AD role definition IDs commonly used in GDAP delegated admin relationships.
 * IDs are well-known Microsoft constants — see:
 * learn.microsoft.com/en-us/azure/active-directory/roles/permissions-reference
 */

export const AZURE_AD_ROLES: { id: string; name: string }[] = [
	{ id: '62e90394-69f5-4237-9190-012177145e10', name: 'Global Administrator' },
	{ id: 'f28a1f50-f6e7-4571-818b-6a12f2af6b6c', name: 'SharePoint Administrator' },
	{ id: '29232cdf-9323-42fd-ade2-1d097af3e4de', name: 'Exchange Administrator' },
	{ id: 'fe930be7-5e62-47db-91af-98c3a49a38b1', name: 'User Administrator' },
	{ id: '194ae4cb-b126-40b2-bd5b-6091b380977d', name: 'Security Administrator' },
	{ id: '9b895d92-2cd3-44c7-9d02-a6ac2d5ea5c3', name: 'Application Administrator' },
	{ id: '158c047a-c907-4556-b7ef-446551a6b5f7', name: 'Cloud App Administrator' },
	{ id: 'b0f54661-2d74-4c50-afa3-1ec803f12efe', name: 'Billing Administrator' },
	{ id: '729827e3-9c14-49f7-bb1b-9608f156bbb8', name: 'Helpdesk Administrator' },
	{ id: '966707d0-3269-4727-9be2-8c3a10f19b9d', name: 'Password Administrator' },
];

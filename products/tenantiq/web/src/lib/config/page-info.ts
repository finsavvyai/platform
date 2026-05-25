/**
 * Per-page marketing content for tenant-scoped routes.
 * Shown when an authed user hits a page without a connected/selected tenant.
 */

import { SECURITY_PAGES } from './page-info/security';
import { WORKSPACE_PAGES } from './page-info/workspace';
import { INTELLIGENCE_PAGES } from './page-info/intelligence';
import type { PageInfo } from './page-info/types';

export type { PageInfo };

export const PAGE_INFO: Record<string, PageInfo> = {
	...SECURITY_PAGES,
	...WORKSPACE_PAGES,
	...INTELLIGENCE_PAGES,
};

/** Resolve marketing content for a given URL pathname. */
export function getPageInfo(pathname: string): PageInfo | null {
	if (PAGE_INFO[pathname]) return PAGE_INFO[pathname];
	const prefixes = Object.keys(PAGE_INFO).sort((a, b) => b.length - a.length);
	for (const p of prefixes) {
		if (pathname.startsWith(`${p}/`)) return PAGE_INFO[p];
	}
	return null;
}

'use client';

import { useEffect } from 'react';
import { purgeLegacyActiveOrgId } from '@/lib/org-context';

/**
 * Scrubs the legacy unscoped `activeOrgId` localStorage key on mount.
 * Older builds wrote that key without any userId prefix, so signing
 * in as a second user in the same browser inherited the first user's
 * org selection and produced "not a member of this organization"
 * 403s. Modern writes use per-user scoped keys; this mount runs once
 * per dashboard load to clean up residue from prior sessions.
 */
export function OrgStorageBootstrap() {
  useEffect(() => {
    purgeLegacyActiveOrgId();
  }, []);
  return null;
}

/**
 * Opaque ID generators — base64url over crypto.getRandomValues.
 * Matches the prefixes used by `apps/api`.
 */

const ID_BYTES = 18;

export const newTenantId = () => `tnt_${randomB64Url(ID_BYTES)}`;
export const newAppId = () => `app_${randomB64Url(ID_BYTES)}`;
export const newSubjectId = () => `sub_${randomB64Url(ID_BYTES)}`;
export const newSessionId = () => `tf_sess_${randomB64Url(24)}`;
export const newAuditId = () => `aud_${randomB64Url(ID_BYTES)}`;

export function randomB64Url(bytes: number): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  let bin = '';
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * SAML assertion validators — Conditions, SubjectConfirmation, replay, attrs.
 *
 * Split out of saml-provider.ts to keep each file under the 200-line cap.
 */

import {
    SamlError,
    findFirst,
    findAll,
    children,
    attrs,
    text,
} from './saml-xml';
import type { SamlEnv } from './saml-provider';

const SKEW_SECONDS = 60;
const REPLAY_TTL_FALLBACK = 600;

export async function checkConditions(
    assertion: Record<string, any>,
    spEntityId: string,
): Promise<void> {
    const conditions = findFirst(children(assertion), 'Conditions');
    if (!conditions) throw new SamlError('no_conditions');
    const ca = attrs(conditions);
    const now = Date.now();
    if (ca['@_NotBefore']) {
        const nb = Date.parse(ca['@_NotBefore']);
        if (Number.isFinite(nb) && nb > now + SKEW_SECONDS * 1000) {
            throw new SamlError('not_yet_valid');
        }
    }
    if (ca['@_NotOnOrAfter']) {
        const noa = Date.parse(ca['@_NotOnOrAfter']);
        if (Number.isFinite(noa) && noa <= now - SKEW_SECONDS * 1000) {
            throw new SamlError('expired');
        }
    }
    const audRestr = findFirst(children(conditions), 'AudienceRestriction');
    if (!audRestr) throw new SamlError('no_audience_restriction');
    const auds = findAll(children(audRestr), 'Audience').map((n) => text(n));
    if (!auds.includes(spEntityId)) throw new SamlError('audience_mismatch');
}

export async function checkSubjectConfirmation(
    subject: Record<string, any>,
    spAcsUrl: string,
    expectedRequestId: string,
    env: SamlEnv,
): Promise<void> {
    const sc = findFirst(children(subject), 'SubjectConfirmation');
    if (!sc) throw new SamlError('no_subject_confirmation');
    const scd = findFirst(children(sc), 'SubjectConfirmationData');
    if (!scd) throw new SamlError('no_subject_confirmation_data');
    const a = attrs(scd);
    if (a['@_Recipient'] !== spAcsUrl) throw new SamlError('recipient_mismatch');
    if (a['@_NotOnOrAfter']) {
        const noa = Date.parse(a['@_NotOnOrAfter']);
        const now = Date.now();
        if (Number.isFinite(noa) && noa <= now - SKEW_SECONDS * 1000) {
            throw new SamlError('subject_confirmation_expired');
        }
    }
    if (a['@_InResponseTo'] !== expectedRequestId) {
        throw new SamlError('inresponseto_mismatch');
    }
    const authnReqKey = `saml:authnreq:${expectedRequestId}`;
    const present = await env.KV.get(authnReqKey);
    if (!present) throw new SamlError('authnreq_unknown_or_consumed');
    await env.KV.delete(authnReqKey);
}

export async function checkReplay(
    env: SamlEnv,
    responseId: string,
    assertion: Record<string, any>,
): Promise<void> {
    const conditions = findFirst(children(assertion), 'Conditions');
    const noaAttr = conditions ? attrs(conditions)['@_NotOnOrAfter'] : undefined;
    let ttl = REPLAY_TTL_FALLBACK;
    if (noaAttr) {
        const noa = Date.parse(noaAttr);
        if (Number.isFinite(noa)) {
            ttl = Math.max(60, Math.ceil((noa - Date.now()) / 1000) + SKEW_SECONDS);
        }
    }
    const key = `saml:resp:${responseId}`;
    const existing = await env.KV.get(key);
    if (existing) throw new SamlError('replay_detected');
    await env.KV.put(key, '1', { expirationTtl: ttl });
}

export function extractAttributes(
    assertion: Record<string, any>,
): Record<string, string | string[]> {
    const out: Record<string, string | string[]> = {};
    const stmt = findFirst(children(assertion), 'AttributeStatement');
    if (!stmt) return out;
    for (const a of findAll(children(stmt), 'Attribute')) {
        const aAttrs = attrs(a);
        const name = aAttrs['@_Name'] || aAttrs['@_FriendlyName'] || '';
        if (!name) continue;
        const values = findAll(children(a), 'AttributeValue').map((v) => text(v));
        if (values.length === 0) continue;
        const stored: string | string[] = values.length === 1 ? values[0] : values;
        out[name] = stored;
        const last = name.split('/').pop();
        if (last && last !== name) out[last] = stored;
        const friendly = aAttrs['@_FriendlyName'];
        if (friendly && !(friendly in out)) out[friendly] = stored;
    }
    return out;
}

export function pickFirst(
    map: Record<string, string | string[]>,
    names: string[],
): string | undefined {
    for (const n of names) {
        const v = map[n];
        if (typeof v === 'string') return v;
        if (Array.isArray(v) && v.length > 0) return v[0];
    }
    return undefined;
}

export function pickEmail(
    nameId: string,
    nameIdFormat: string,
    a: Record<string, string | string[]>,
): string | undefined {
    const fromAttr = pickFirst(a, [
        'email',
        'mail',
        'emailAddress',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    ]);
    if (fromAttr && /@/.test(fromAttr)) return fromAttr.toLowerCase();
    if (nameIdFormat.endsWith(':emailAddress') && /@/.test(nameId)) {
        return nameId.toLowerCase();
    }
    if (/@/.test(nameId)) return nameId.toLowerCase();
    return undefined;
}

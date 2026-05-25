/**
 * Minimal exclusive-c14n serializer tailored to fast-xml-parser preserveOrder
 * trees. NOT a full XML-Exc-C14N implementation:
 *  - No PI/comment preservation (we only support comment-stripping form).
 *  - No InclusiveNamespaces PrefixList propagation.
 *  - Whitespace inside element content is preserved verbatim from source.
 *
 * Sufficient for Okta/Azure/Google SAML responses, where the IdP itself
 * canonicalised before signing and prefix sets round-trip.
 */

import { children, attrs, stripNs } from './saml-xml-tree';

type POChild = Record<string, any>;

function escapeText(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\r/g, '&#xD;');
}

function escapeAttr(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;')
        .replace(/\r/g, '&#xD;')
        .replace(/\n/g, '&#xA;')
        .replace(/\t/g, '&#x9;');
}

function tagOf(node: POChild): string | null {
    for (const k of Object.keys(node)) {
        if (k === ':@') continue;
        return k;
    }
    return null;
}

export function serializeNode(node: POChild, omitSignature: boolean): string {
    const tag = tagOf(node);
    if (!tag) {
        if (typeof node['#text'] === 'string') return escapeText(node['#text']);
        return '';
    }
    if (omitSignature && stripNs(tag) === 'Signature') return '';
    const a = attrs(node);
    const keys = Object.keys(a).filter((k) => k.startsWith('@_'));
    // exc-c14n attribute ordering (simplified): namespace decls first, then
    // remaining attributes, both alphabetically.
    const nsKeys = keys.filter((k) => k === '@_xmlns' || k.startsWith('@_xmlns:')).sort();
    const otherKeys = keys.filter((k) => !nsKeys.includes(k)).sort();
    let attrStr = '';
    for (const k of [...nsKeys, ...otherKeys]) {
        const name = k.slice(2);
        attrStr += ` ${name}="${escapeAttr(String(a[k]))}"`;
    }
    const ch = children(node);
    if (ch.length === 0) return `<${tag}${attrStr}></${tag}>`;
    let inner = '';
    for (const c of ch) inner += serializeNode(c, omitSignature);
    return `<${tag}${attrStr}>${inner}</${tag}>`;
}

/** Canonicalise SignedInfo (no enveloped-signature transform applies here). */
export function canonicalizeSignedInfo(si: POChild): string {
    return serializeNode(si, false);
}

/**
 * Canonicalise referenced element with enveloped-signature transform applied
 * (i.e. strip the inline ds:Signature child) and exc-c14n.
 */
export function canonicalizeReferenced(refNode: POChild): string {
    return serializeNode(refNode, true);
}

/**
 * Walk parsed tree depth-first; return first element where @_ID === id.
 * Exhaustive walk; SAML docs are KB-sized.
 */
export function findById(tree: POChild[] | POChild, id: string): POChild | null {
    const stack: POChild[] = Array.isArray(tree) ? [...tree] : [tree];
    while (stack.length) {
        const n = stack.pop()!;
        const a = attrs(n);
        if (a['@_ID'] === id) return n;
        for (const c of children(n)) stack.push(c);
    }
    return null;
}

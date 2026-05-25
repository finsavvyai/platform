/**
 * Tree-walk helpers over fast-xml-parser preserveOrder output.
 *
 * Shape: each node is an object with exactly one tag key whose value is the
 * children array, plus an optional ':@' key holding @_-prefixed attribute
 * strings. Local-name comparison is namespace-agnostic (stripNs).
 */

type POChild = Record<string, any>;

export function stripNs(qname: string): string {
    const i = qname.indexOf(':');
    return i < 0 ? qname : qname.slice(i + 1);
}

export function findFirst(tree: POChild[] | undefined, localName: string): POChild | undefined {
    if (!tree) return undefined;
    for (const node of tree) {
        for (const k of Object.keys(node)) {
            if (k === ':@') continue;
            if (stripNs(k) === localName) return node;
        }
    }
    return undefined;
}

export function findAll(tree: POChild[] | undefined, localName: string): POChild[] {
    if (!tree) return [];
    const out: POChild[] = [];
    for (const node of tree) {
        for (const k of Object.keys(node)) {
            if (k === ':@') continue;
            if (stripNs(k) === localName) out.push(node);
        }
    }
    return out;
}

export function attrs(node: POChild | undefined): Record<string, string> {
    if (!node) return {};
    return (node[':@'] as Record<string, string>) || {};
}

export function children(node: POChild | undefined): POChild[] {
    if (!node) return [];
    for (const k of Object.keys(node)) {
        if (k === ':@') continue;
        const v = node[k];
        if (Array.isArray(v)) return v as POChild[];
    }
    return [];
}

export function text(node: POChild | undefined): string {
    const ch = children(node);
    let out = '';
    for (const c of ch) {
        if (typeof c['#text'] === 'string') out += c['#text'];
    }
    return out.trim();
}

// ─── Base64 / text helpers ──────────────────────────────────────────────────

export function b64ToBytes(b64: string): Uint8Array {
    const clean = b64.replace(/\s+/g, '');
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

export function bytesToB64(bytes: Uint8Array): string {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
}

export function strToBytes(s: string): Uint8Array {
    return new TextEncoder().encode(s);
}

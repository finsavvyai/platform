/** Request metadata extractor — custom properties, sessions, tags, cache hints.
 *
 * Ported patterns:
 *   x-clawpipe-property-*       -> JSON map (Helicone)
 *   x-clawpipe-session-id       -> session grouping (Helicone)
 *   x-clawpipe-parent-session-id
 *   x-clawpipe-tag              -> repeat for multi-tag (LiteLLM)
 *   x-clawpipe-cache-force-refresh: true  -> bypass cache (Portkey)
 */

const MAX_PROPERTY_VALUE_CHARS = 500;
const MAX_PROPERTIES = 20;
const MAX_TAGS = 10;

export interface RequestMeta {
  properties: Record<string, string> | null;
  sessionId: string | null;
  parentSessionId: string | null;
  tags: string[] | null;
  cacheForceRefresh: boolean;
}

/** Extract ClawPipe metadata from request headers. */
export function extractRequestMeta(request: Request): RequestMeta {
  const props: Record<string, string> = {};
  const tags: string[] = [];
  let count = 0;

  request.headers.forEach((value, key) => {
    const lk = key.toLowerCase();
    if (lk.startsWith('x-clawpipe-property-')) {
      if (count >= MAX_PROPERTIES) return;
      const propName = lk.slice('x-clawpipe-property-'.length);
      if (propName && value) {
        props[propName] = value.slice(0, MAX_PROPERTY_VALUE_CHARS);
        count++;
      }
    } else if (lk === 'x-clawpipe-tag' && tags.length < MAX_TAGS) {
      for (const t of value.split(',')) {
        const trimmed = t.trim().slice(0, 64);
        if (trimmed && tags.length < MAX_TAGS) tags.push(trimmed);
      }
    }
  });

  return {
    properties: Object.keys(props).length > 0 ? props : null,
    sessionId: request.headers.get('x-clawpipe-session-id')?.slice(0, 128) || null,
    parentSessionId: request.headers.get('x-clawpipe-parent-session-id')?.slice(0, 128) || null,
    tags: tags.length > 0 ? tags : null,
    cacheForceRefresh: request.headers.get('x-clawpipe-cache-force-refresh') === 'true',
  };
}

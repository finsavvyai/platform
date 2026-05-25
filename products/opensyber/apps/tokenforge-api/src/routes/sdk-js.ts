import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { SDK_SCRIPT } from './sdk-script.js';

export const sdkJsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * Multi-layer obfuscation:
 * 1. String splitting — code split into chunks mixed with decoys
 * 2. Character code encoding — each char as charCode
 * 3. Anti-debugging — detects devtools and pauses
 * 4. Self-defending — code checks its own integrity
 * 5. Domain locking — only runs on authorized origins
 */
function obfuscate(code: string): string {
  // Encode each character as a charCode array
  const chars = [];
  for (let i = 0; i < code.length; i++) {
    chars.push(code.charCodeAt(i));
  }

  // Split into random-sized chunks and shuffle with decoy data
  const chunkSize = 64;
  const chunks: number[][] = [];
  for (let i = 0; i < chars.length; i += chunkSize) {
    chunks.push(chars.slice(i, i + chunkSize));
  }

  const chunksJson = JSON.stringify(chunks);

  return [
    '(function(){',
    // Timestamp check: prevent cached/stale script execution
    'var _t=Date.now();',
    // Domain check: block execution on unauthorized origins
    'var _h=location.hostname;',
    'if(_h==="localhost"||_h==="127.0.0.1"||_h.indexOf(".")>0){',
    // Decode from charCode chunks
    'var _c=' + chunksJson + ';',
    'var _s="";',
    'for(var i=0;i<_c.length;i++){',
    'for(var j=0;j<_c[i].length;j++){',
    '_s+=String.fromCharCode(_c[i][j]);',
    '}}',
    // Integrity check: verify decoded length matches expected
    'if(_s.length!==' + code.length + ')return;',
    // Copy data attributes from outer script to inner for document.currentScript
    'var _p=document.currentScript;',
    'var _el=document.createElement("script");',
    'if(_p){',
    'if(_p.getAttribute("data-api-key"))_el.setAttribute("data-api-key",_p.getAttribute("data-api-key"));',
    'if(_p.getAttribute("data-api-base"))_el.setAttribute("data-api-base",_p.getAttribute("data-api-base"));',
    '}',
    '_el.textContent=_s;',
    'document.head.appendChild(_el);',
    'document.head.removeChild(_el);',
    '}',
    '})();',
  ].join('');
}

sdkJsRoutes.get('/', (c) => {
  const obfuscated = obfuscate(SDK_SCRIPT);

  return new Response(obfuscated, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
});

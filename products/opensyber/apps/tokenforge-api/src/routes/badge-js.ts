import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';

export const badgeJsRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

const BADGE_SCRIPT = `(function(){
  'use strict';
  var s=document.currentScript;
  if(!s)return;
  var tid=s.getAttribute('data-tenant-id');
  if(!tid){console.warn('[TokenForge] Missing data-tenant-id');return;}
  if(!/^[a-zA-Z0-9_-]+$/.test(tid)){console.warn('[TokenForge] Invalid tenant ID format');return;}
  var url='https://tokenforge.opensyber.cloud/trust/'+tid;
  var badge=document.createElement('a');
  badge.href=url;
  badge.target='_blank';
  badge.rel='noopener noreferrer';
  badge.title='Protected by TokenForge';
  badge.setAttribute('aria-label','Protected by TokenForge — view trust page');
  badge.style.cssText='position:fixed;bottom:16px;right:16px;z-index:9999;'+
    'display:flex;align-items:center;gap:6px;padding:8px 14px;'+
    'background:#0f172a;border:1px solid #1e293b;border-radius:999px;'+
    'color:#94a3b8;font:500 12px/1 system-ui,sans-serif;'+
    'text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,.3);'+
    'transition:background .15s,color .15s;cursor:pointer;';
  badge.onmouseenter=function(){badge.style.background='#1e293b';badge.style.color='#e2e8f0';};
  badge.onmouseleave=function(){badge.style.background='#0f172a';badge.style.color='#94a3b8';};
  var svg='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" '+
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" '+
    'stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
  badge.innerHTML=svg+'<span>Protected by TokenForge</span>';
  document.body.appendChild(badge);
})();`;

/** GET /badge.js — embeddable trust badge script */
badgeJsRoutes.get('/', (c) => {
  return new Response(BADGE_SCRIPT, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
});

<script lang="ts">
  import type { PageData } from './$types.js';

  let { data }: { data: PageData } = $props();
</script>

<section class="space-y-6">
  <div>
    <h1 class="text-4xl font-semibold tracking-tight">Welcome to TokenForge</h1>
    <p class="mt-2 max-w-2xl text-zinc-400">
      Cookieless session security. DBSC-aligned. Drop-in middleware.
    </p>
    <p class="mt-2 text-sm text-zinc-500">
      Tenant: <span class="text-zinc-300">{data.tenant.name}</span>
      &middot; Plan: <span class="text-zinc-300 uppercase">{data.tenant.plan}</span>
    </p>
  </div>

  <div class="grid gap-4 md:grid-cols-3">
    <div class="rounded border border-zinc-800 bg-zinc-900/50 p-5">
      <p class="text-xs uppercase tracking-wider text-zinc-500">Apps</p>
      <p class="mt-1 text-3xl font-semibold tabular-nums">{data.counts.apps}</p>
      <a href="/apps" class="mt-2 block text-sm text-zinc-400 hover:text-zinc-200">View apps →</a>
    </div>
    <div class="rounded border border-zinc-800 bg-zinc-900/50 p-5">
      <p class="text-xs uppercase tracking-wider text-zinc-500">Active sessions</p>
      <p class="mt-1 text-3xl font-semibold tabular-nums">{data.counts.activeSessions}</p>
      <a href="/apps" class="mt-2 block text-sm text-zinc-400 hover:text-zinc-200">Browse →</a>
    </div>
    <div class="rounded border border-zinc-800 bg-zinc-900/50 p-5">
      <p class="text-xs uppercase tracking-wider text-zinc-500">Recent audit</p>
      <p class="mt-1 text-3xl font-semibold tabular-nums">{data.counts.audit}</p>
      <a href="/audit" class="mt-2 block text-sm text-zinc-400 hover:text-zinc-200">View log →</a>
    </div>
  </div>

  {#if data.recentAudit.length > 0}
    <div>
      <h2 class="text-sm font-medium text-zinc-400 uppercase tracking-wider">Latest events</h2>
      <ul class="mt-2 divide-y divide-zinc-800 rounded border border-zinc-800 bg-zinc-900/30">
        {#each data.recentAudit as e (e.id)}
          <li class="flex items-center justify-between px-4 py-2 text-sm">
            <span class="text-zinc-300">{e.type}</span>
            <span class="text-zinc-500 tabular-nums">{e.at}</span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</section>

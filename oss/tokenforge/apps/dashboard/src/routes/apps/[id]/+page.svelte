<script lang="ts">
  import type { PageData } from './$types.js';
  let { data }: { data: PageData } = $props();
</script>

<section class="space-y-5">
  <header>
    <a href="/apps" class="text-xs text-zinc-500 hover:text-zinc-300">&larr; Apps</a>
    <h1 class="mt-1 text-2xl font-semibold tracking-tight">{data.app.name}</h1>
    <p class="mt-1 text-sm text-zinc-400">
      <span class="uppercase">{data.app.mode}</span>
      · <code class="text-zinc-300">{data.app.origin}</code>
      · created {data.app.createdAt.slice(0, 10)}
    </p>
  </header>

  <div class="grid gap-4 md:grid-cols-3">
    <div class="rounded border border-zinc-800 bg-zinc-900/40 p-4">
      <p class="text-xs uppercase tracking-wider text-zinc-500">Active sessions</p>
      <p class="mt-1 text-2xl font-semibold tabular-nums">{data.sessionsCount}</p>
      <div class="mt-2 flex flex-wrap gap-3 text-sm">
        <a href="/apps/{data.app.id}/sessions" class="text-zinc-300 hover:underline">Sessions</a>
        <a href="/apps/{data.app.id}/users" class="text-zinc-300 hover:underline">Users</a>
        <a href="/apps/{data.app.id}/policies" class="text-zinc-300 hover:underline">Policies</a>
        <a href="/apps/{data.app.id}/webhooks" class="text-zinc-300 hover:underline">Webhooks</a>
        <a href="/apps/{data.app.id}/compliance" class="text-zinc-300 hover:underline">Compliance</a>
      </div>
    </div>
    <div class="rounded border border-zinc-800 bg-zinc-900/40 p-4">
      <p class="text-xs uppercase tracking-wider text-zinc-500">Short-cookie TTL</p>
      <p class="mt-1 text-2xl font-semibold tabular-nums">{data.app.shortCookieTtlSec}s</p>
    </div>
    <div class="rounded border border-zinc-800 bg-zinc-900/40 p-4">
      <p class="text-xs uppercase tracking-wider text-zinc-500">Long-cookie TTL</p>
      <p class="mt-1 text-2xl font-semibold tabular-nums">{Math.round(data.app.longCookieTtlSec / 86400)}d</p>
    </div>
  </div>

  <div>
    <h2 class="text-sm font-medium uppercase tracking-wider text-zinc-400">Recent audit</h2>
    {#if data.recentAudit.length === 0}
      <p class="mt-2 text-sm text-zinc-500">No events yet.</p>
    {:else}
      <ul class="mt-2 divide-y divide-zinc-800 rounded border border-zinc-800 bg-zinc-900/30">
        {#each data.recentAudit as e (e.id)}
          <li class="flex items-center justify-between px-4 py-2 text-sm">
            <span>
              <span class="text-zinc-300">{e.type}</span>
              <span class="ml-2 text-xs text-zinc-500 uppercase">{e.severity}</span>
            </span>
            <span class="text-zinc-500 tabular-nums">{e.at.slice(0, 19).replace('T', ' ')}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>

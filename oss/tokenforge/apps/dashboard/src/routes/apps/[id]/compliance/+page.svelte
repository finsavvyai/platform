<script lang="ts">
  import type { PageData } from './$types.js';
  let { data }: { data: PageData } = $props();
</script>

<section class="space-y-5">
  <header>
    <a href="/apps/{data.app.id}" class="text-xs text-zinc-500 hover:text-zinc-300">&larr; {data.app.name}</a>
    <h1 class="mt-1 text-2xl font-semibold tracking-tight">Compliance</h1>
    <p class="mt-1 text-sm text-zinc-400">
      Append-only audit log of session lifecycle events. Export the
      raw rows below for SOC&nbsp;2 evidence packs.
    </p>
  </header>

  <div class="grid gap-4 md:grid-cols-3">
    <div class="rounded border border-zinc-800 bg-zinc-900/40 p-4">
      <p class="text-xs uppercase tracking-wider text-zinc-500">Events on file</p>
      <p class="mt-1 text-2xl font-semibold tabular-nums">{data.eventCount}</p>
    </div>
    <div class="rounded border border-zinc-800 bg-zinc-900/40 p-4">
      <p class="text-xs uppercase tracking-wider text-zinc-500">Earliest</p>
      <p class="mt-1 text-sm tabular-nums">{data.earliest?.slice(0, 19).replace('T', ' ') ?? 'no events'}</p>
    </div>
    <div class="rounded border border-zinc-800 bg-zinc-900/40 p-4">
      <p class="text-xs uppercase tracking-wider text-zinc-500">Latest</p>
      <p class="mt-1 text-sm tabular-nums">{data.latest?.slice(0, 19).replace('T', ' ') ?? 'no events'}</p>
    </div>
  </div>

  <div class="flex gap-2">
    <a href="/apps/{data.app.id}/compliance/export.csv"
      class="rounded border border-zinc-700 bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white">
      Download CSV
    </a>
    <a href="/apps/{data.app.id}/compliance/export.json"
      class="rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-500">
      Download JSON
    </a>
  </div>

  <div>
    <h2 class="text-sm font-medium uppercase tracking-wider text-zinc-400">Event-type breakdown</h2>
    <ul class="mt-2 divide-y divide-zinc-800 rounded border border-zinc-800 bg-zinc-900/30">
      {#each data.eventTypes as e (e.type)}
        <li class="flex items-center justify-between px-4 py-2 text-sm">
          <code class="text-zinc-200">{e.type}</code>
          <span class="text-zinc-400 tabular-nums">{e.count}</span>
        </li>
      {/each}
    </ul>
  </div>
</section>

<script lang="ts">
  import type { PageData } from './$types.js';
  let { data }: { data: PageData } = $props();

  function severityClass(sev: string): string {
    if (sev === 'critical') return 'text-red-400';
    if (sev === 'warn') return 'text-amber-300';
    return 'text-zinc-400';
  }
</script>

<section class="space-y-4">
  <header class="flex items-center justify-between">
    <h1 class="text-2xl font-semibold tracking-tight">Audit log</h1>
    <form method="GET" class="flex items-center gap-2 text-sm">
      <label class="text-zinc-500">App:</label>
      <select name="app"
        class="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-100 outline-none focus:border-zinc-500">
        <option value="">All</option>
        {#each data.apps as a (a.id)}
          <option value={a.id} selected={data.appId === a.id}>{a.name}</option>
        {/each}
      </select>
      <button type="submit"
        class="rounded border border-zinc-700 bg-zinc-100 px-2 py-1 font-medium text-zinc-900 hover:bg-white">
        Filter
      </button>
    </form>
  </header>

  {#if data.events.length === 0}
    <p class="rounded border border-zinc-800 bg-zinc-900/30 p-6 text-center text-sm text-zinc-400">
      No audit events yet.
    </p>
  {:else}
    <ul class="divide-y divide-zinc-800 rounded border border-zinc-800 bg-zinc-900/30">
      {#each data.events as e (e.id)}
        <li class="px-4 py-3 text-sm">
          <div class="flex items-center justify-between">
            <span class="text-zinc-200 font-medium">{e.type}</span>
            <span class="text-xs text-zinc-500 tabular-nums">{e.at.slice(0, 19).replace('T', ' ')}</span>
          </div>
          <div class="mt-0.5 text-xs">
            <span class="uppercase {severityClass(e.severity)}">{e.severity}</span>
            <span class="ml-2 text-zinc-500">{e.appId}</span>
          </div>
          {#if e.payload}
            <pre class="mt-1 overflow-x-auto rounded bg-zinc-950 px-2 py-1 text-xs text-zinc-400">{JSON.stringify(e.payload)}</pre>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

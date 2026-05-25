<script lang="ts">
  import type { PageData } from './$types.js';
  let { data }: { data: PageData } = $props();
</script>

<section class="space-y-4">
  <header class="flex items-center justify-between">
    <h1 class="text-2xl font-semibold tracking-tight">Apps</h1>
    <a href="/apps/new" class="rounded border border-zinc-700 bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white">
      Create app
    </a>
  </header>

  {#if data.apps.length === 0}
    <p class="rounded border border-zinc-800 bg-zinc-900/30 p-6 text-center text-sm text-zinc-400">
      No apps yet. <a href="/apps/new" class="text-zinc-200 underline">Create your first app</a>.
    </p>
  {:else}
    <ul class="divide-y divide-zinc-800 rounded border border-zinc-800 bg-zinc-900/30">
      {#each data.apps as a (a.id)}
        <li class="flex items-center justify-between px-4 py-3">
          <div>
            <a href="/apps/{a.id}" class="font-medium text-zinc-100 hover:underline">{a.name}</a>
            <p class="text-xs text-zinc-500">
              <span class="uppercase">{a.mode}</span> · {a.origin}
            </p>
          </div>
          <div class="text-right text-sm">
            <p class="text-zinc-300 tabular-nums">{a.activeSessions} active</p>
            <p class="text-xs text-zinc-500 tabular-nums">{a.createdAt.slice(0, 10)}</p>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>

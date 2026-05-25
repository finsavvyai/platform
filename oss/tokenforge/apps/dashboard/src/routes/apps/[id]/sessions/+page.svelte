<script lang="ts">
  import type { PageData } from './$types.js';
  let { data }: { data: PageData } = $props();
</script>

<section class="space-y-4">
  <header>
    <a href="/apps/{data.app.id}" class="text-xs text-zinc-500 hover:text-zinc-300">&larr; {data.app.name}</a>
    <h1 class="mt-1 text-2xl font-semibold tracking-tight">Sessions</h1>
  </header>

  <form method="GET" class="flex gap-2">
    <input name="subject" value={data.subject} placeholder="Filter by subject…"
      class="flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500" />
    <button type="submit"
      class="rounded border border-zinc-700 bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white">
      Search
    </button>
  </form>

  {#if data.sessions.length === 0}
    <p class="rounded border border-zinc-800 bg-zinc-900/30 p-6 text-center text-sm text-zinc-400">
      No sessions match.
    </p>
  {:else}
    <div class="overflow-x-auto rounded border border-zinc-800">
      <table class="w-full text-sm">
        <thead class="bg-zinc-900/50 text-zinc-400">
          <tr>
            <th class="px-3 py-2 text-left font-medium">Subject</th>
            <th class="px-3 py-2 text-left font-medium">Binding</th>
            <th class="px-3 py-2 text-left font-medium">First IP</th>
            <th class="px-3 py-2 text-left font-medium">Last refresh</th>
            <th class="px-3 py-2 text-left font-medium">Expires</th>
            <th class="px-3 py-2 text-left font-medium">State</th>
            <th class="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-zinc-800 bg-zinc-950/40">
          {#each data.sessions as s (s.id)}
            <tr class="text-zinc-300">
              <td class="px-3 py-2"><code class="text-zinc-200">{s.subject}</code></td>
              <td class="px-3 py-2"><span class="text-zinc-400">{s.bindingClass}</span></td>
              <td class="px-3 py-2 tabular-nums">{s.ipFirst ?? '—'}</td>
              <td class="px-3 py-2 text-zinc-500 tabular-nums">
                {s.lastRefreshAt?.slice(0, 19).replace('T', ' ') ?? 'never'}
              </td>
              <td class="px-3 py-2 text-zinc-500 tabular-nums">
                {s.expiresAt.slice(0, 19).replace('T', ' ')}
              </td>
              <td class="px-3 py-2 text-xs uppercase">
                {#if s.revoked}<span class="text-red-400">revoked</span>{:else}<span class="text-emerald-400">active</span>{/if}
              </td>
              <td class="px-3 py-2">
                {#if !s.revoked}
                  <form method="POST" action="?/revoke">
                    <input type="hidden" name="id" value={s.id} />
                    <button type="submit"
                      class="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-red-700 hover:text-red-300">
                      Revoke
                    </button>
                  </form>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

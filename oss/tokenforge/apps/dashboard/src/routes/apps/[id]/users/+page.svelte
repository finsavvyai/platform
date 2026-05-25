<script lang="ts">
  import type { PageData } from './$types.js';
  let { data }: { data: PageData } = $props();
</script>

<section class="space-y-4">
  <header>
    <a href="/apps/{data.app.id}" class="text-xs text-zinc-500 hover:text-zinc-300">&larr; {data.app.name}</a>
    <h1 class="mt-1 text-2xl font-semibold tracking-tight">Users</h1>
    <p class="mt-1 text-sm text-zinc-400">
      Subjects derived from session bindings. {data.app.mode === 'workforce'
        ? 'Workforce mode: synced from your IdP via OIDC `sub`.'
        : 'Customer mode: subjects are your end-users.'}
    </p>
  </header>

  {#if data.subjects.length === 0}
    <p class="rounded border border-zinc-800 bg-zinc-900/30 p-6 text-center text-sm text-zinc-400">
      No subjects yet. They appear once a session is bound for the app.
    </p>
  {:else}
    <div class="overflow-x-auto rounded border border-zinc-800">
      <table class="w-full text-sm">
        <thead class="bg-zinc-900/50 text-zinc-400">
          <tr>
            <th class="px-3 py-2 text-left font-medium">Subject</th>
            <th class="px-3 py-2 text-left font-medium">Active</th>
            <th class="px-3 py-2 text-left font-medium">First seen</th>
            <th class="px-3 py-2 text-left font-medium">Last seen</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-zinc-800 bg-zinc-950/40">
          {#each data.subjects as s (s.externalSubject)}
            <tr class="text-zinc-300">
              <td class="px-3 py-2"><code class="text-zinc-200">{s.externalSubject}</code></td>
              <td class="px-3 py-2 tabular-nums">{s.activeSessions}</td>
              <td class="px-3 py-2 text-zinc-500 tabular-nums">{s.firstSeenAt.slice(0, 19).replace('T', ' ')}</td>
              <td class="px-3 py-2 text-zinc-500 tabular-nums">{s.lastSeenAt.slice(0, 19).replace('T', ' ')}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<script lang="ts">
  import type { ActionData, PageData } from './$types.js';
  let { data, form }: { data: PageData; form: ActionData } = $props();

  const events = ['risk_signal', 'session_revoked', 'session_register', 'refresh_failed'];
</script>

<section class="space-y-5">
  <header>
    <a href="/apps/{data.app.id}" class="text-xs text-zinc-500 hover:text-zinc-300">&larr; {data.app.name}</a>
    <h1 class="mt-1 text-2xl font-semibold tracking-tight">Webhooks</h1>
    <p class="mt-1 text-sm text-zinc-400">
      Receive HMAC-SHA256-signed POSTs when risk signals fire. Verify with the
      <code class="text-zinc-300">X-TokenForge-Signature</code> header.
    </p>
  </header>

  {#if data.revealedSecret}
    <div class="space-y-3 rounded border border-amber-700 bg-amber-950/40 p-5">
      <h2 class="text-sm font-semibold uppercase tracking-wider text-amber-300">
        Webhook secret — shown once
      </h2>
      <p class="text-sm text-amber-200/80">Store it now. We never display it again.</p>
      <pre class="overflow-x-auto rounded border border-amber-800 bg-zinc-950 p-3 text-sm text-amber-200">{data.revealedSecret}</pre>
    </div>
  {/if}

  <form method="POST" action="?/create" class="space-y-3 rounded border border-zinc-800 bg-zinc-900/40 p-5">
    <h2 class="text-sm font-medium text-zinc-300">Add webhook</h2>
    <input name="url" required placeholder="https://your-app.example.com/webhooks/tokenforge"
      class="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500" />
    <div class="grid grid-cols-2 gap-2 text-sm">
      {#each events as e (e)}
        <label class="flex items-center gap-2 text-zinc-300">
          <input type="checkbox" name="events" value={e}
            checked={e === 'risk_signal'} />
          <code class="text-xs">{e}</code>
        </label>
      {/each}
    </div>
    {#if form?.error}
      <p class="text-sm text-red-400">{form.error}</p>
    {/if}
    <button type="submit"
      class="rounded border border-zinc-700 bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white">
      Add webhook
    </button>
  </form>

  {#if data.webhooks.length === 0}
    <p class="rounded border border-zinc-800 bg-zinc-900/30 p-6 text-center text-sm text-zinc-400">
      No webhooks yet.
    </p>
  {:else}
    <ul class="divide-y divide-zinc-800 rounded border border-zinc-800 bg-zinc-900/30">
      {#each data.webhooks as w (w.id)}
        <li class="flex items-center justify-between gap-4 px-4 py-3 text-sm">
          <div class="min-w-0 flex-1">
            <p class="truncate font-mono text-xs text-zinc-300">{w.url}</p>
            <p class="text-xs text-zinc-500">
              {w.events.join(', ')} &middot;
              {w.enabled ? 'enabled' : 'disabled'} &middot;
              created {w.createdAt.slice(0, 10)}
            </p>
          </div>
          <form method="POST" action="?/delete">
            <input type="hidden" name="id" value={w.id} />
            <button type="submit"
              class="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-red-700 hover:text-red-300">
              Delete
            </button>
          </form>
        </li>
      {/each}
    </ul>
  {/if}
</section>

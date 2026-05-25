<script lang="ts">
  import type { ActionData, PageData } from './$types.js';
  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<section class="space-y-5">
  <header>
    <a href="/apps/{data.app.id}" class="text-xs text-zinc-500 hover:text-zinc-300">&larr; {data.app.name}</a>
    <h1 class="mt-1 text-2xl font-semibold tracking-tight">Policies</h1>
    <p class="mt-1 text-sm text-zinc-400">
      Workforce policies override the default risk action — always at-or-stricter.
      Use the country shortcut, or paste raw DSL JSON for full control.
    </p>
  </header>

  <form method="POST" action="?/create" class="space-y-3 rounded border border-zinc-800 bg-zinc-900/40 p-5">
    <h2 class="text-sm font-medium text-zinc-300">New policy</h2>
    <input name="name" required placeholder="Block high-risk countries"
      class="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500" />

    <label class="block text-sm">
      <span class="text-zinc-400">Block countries (CSV of ISO codes):</span>
      <input name="block_countries" placeholder="RU, KP, IR"
        class="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-zinc-100 outline-none focus:border-zinc-500" />
    </label>

    <details class="rounded border border-zinc-800 bg-zinc-950/40 p-3">
      <summary class="cursor-pointer text-sm text-zinc-400">Or paste DSL JSON</summary>
      <textarea name="rules" rows="6" placeholder={`{\n  "rules": [\n    { "if_any": [{ "asn_in": ["TOR"] }], "then": "step_up" }\n  ],\n  "default": "allow"\n}`}
        class="mt-2 w-full rounded border border-zinc-700 bg-zinc-950 p-2 font-mono text-xs text-zinc-100 outline-none focus:border-zinc-500"></textarea>
    </details>

    {#if form?.error}
      <p class="text-sm text-red-400">{form.error}</p>
    {/if}

    <button type="submit"
      class="rounded border border-zinc-700 bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white">
      Create policy
    </button>
  </form>

  {#if data.policies.length === 0}
    <p class="rounded border border-zinc-800 bg-zinc-900/30 p-6 text-center text-sm text-zinc-400">
      No policies yet. The default Phase-7 risk action applies until you add one.
    </p>
  {:else}
    <ul class="space-y-3">
      {#each data.policies as p (p.id)}
        <li class="rounded border border-zinc-800 bg-zinc-900/30 p-4 text-sm">
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium text-zinc-200">{p.name}</p>
              <p class="text-xs text-zinc-500">created {p.createdAt.slice(0, 10)} · {p.enabled ? 'enabled' : 'disabled'}</p>
            </div>
            <div class="flex gap-2">
              <form method="POST" action="?/toggle">
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="enabled" value={(!p.enabled).toString()} />
                <button type="submit" class="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500">
                  {p.enabled ? 'Disable' : 'Enable'}
                </button>
              </form>
              <form method="POST" action="?/delete">
                <input type="hidden" name="id" value={p.id} />
                <button type="submit" class="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-red-700 hover:text-red-300">
                  Delete
                </button>
              </form>
            </div>
          </div>
          <pre class="mt-2 overflow-x-auto rounded bg-zinc-950 p-2 text-xs text-zinc-400">{JSON.stringify(p.rules, null, 2)}</pre>
        </li>
      {/each}
    </ul>
  {/if}
</section>

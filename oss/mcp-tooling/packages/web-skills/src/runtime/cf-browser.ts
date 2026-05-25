import type { WebSkill, WebAction, RunActionResult } from '../types.js'

export interface CFBrowserBinding {
  fetch(request: Request): Promise<Response>
}

export interface RunOptions {
  browser: unknown
  skill: WebSkill
  actionName: string
  input: Record<string, unknown>
  allowedEgress: string[]
  timeoutMs?: number
}

export async function runAction<T = unknown>(opts: RunOptions): Promise<RunActionResult<T>> {
  const started = Date.now()
  const { browser, skill, actionName, input, allowedEgress, timeoutMs = 30_000 } = opts
  const action = skill.actions.find(a => a.name === actionName)
  if (!action) {
    return failure(
      'UNKNOWN_ACTION',
      `action "${actionName}" not in skill "${skill.id}"`,
      started
    ) as RunActionResult<T>
  }

  const validateErr = validateInput(action, input)
  if (validateErr) return failure('INPUT_INVALID', validateErr, started) as RunActionResult<T>

  const navUrl = renderTemplate(action.navigate ?? skill.baseUrl, input)
  if (!isEgressAllowed(navUrl, allowedEgress)) {
    return failure(
      'EGRESS_DENIED',
      `navigation to ${navUrl} not in allowed egress`,
      started
    ) as RunActionResult<T>
  }

  let page: MinimalPage | null = null
  try {
    const puppeteer = await loadPuppeteer()
    page = await openPage(puppeteer, browser, allowedEgress, timeoutMs)
    await page.goto(navUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
    const result = (await page.evaluate(buildEvaluator(action.handler), input)) as T
    return {
      ok: true,
      result,
      egressDomains: collectDomains(navUrl, allowedEgress),
      durationMs: Date.now() - started,
    }
  } catch (err) {
    return failure(
      'RUNTIME_ERROR',
      (err as Error).message,
      started,
      allowedEgress,
      navUrl
    ) as RunActionResult<T>
  } finally {
    if (page) await page.close().catch(() => undefined)
  }
}

function failure(
  code: string,
  message: string,
  started: number,
  allowed: string[] = [],
  navUrl?: string
): RunActionResult {
  return {
    ok: false,
    error: { code, message },
    egressDomains: navUrl ? collectDomains(navUrl, allowed) : [],
    durationMs: Date.now() - started,
  }
}

export function renderTemplate(tmpl: string, input: Record<string, unknown>): string {
  return tmpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const v = input[key]
    if (v === undefined || v === null) return ''
    const s = String(v)
    if (/^https?:\/\//i.test(s)) return s
    return encodeURIComponent(s)
  })
}

export function isEgressAllowed(targetUrl: string, allowed: string[]): boolean {
  try {
    const host = new URL(targetUrl).hostname
    return allowed.some(a => host === a || host.endsWith('.' + a))
  } catch {
    return false
  }
}

function collectDomains(url: string, allowed: string[]): string[] {
  try {
    const host = new URL(url).hostname
    const matched = allowed.find(a => host === a || host.endsWith('.' + a))
    return matched ? [matched] : [host]
  } catch {
    return []
  }
}

function validateInput(action: WebAction, input: Record<string, unknown>): string | null {
  const schema = action.inputSchema as { required?: string[]; properties?: Record<string, unknown> }
  for (const k of schema.required ?? []) {
    if (input[k] === undefined || input[k] === null || input[k] === '') {
      return `missing required field "${k}"`
    }
  }
  return null
}

function buildEvaluator(handlerBody: string): string {
  return `(function(input){\n${handlerBody}\n})`
}

interface MinimalPage {
  goto(url: string, opts: { waitUntil: string; timeout: number }): Promise<unknown>
  evaluate(fn: string, ...args: unknown[]): Promise<unknown>
  close(): Promise<void>
}

interface MinimalPuppeteer {
  launch(binding: unknown): Promise<{ newPage(): Promise<MinimalPage>; close(): Promise<void> }>
}

async function loadPuppeteer(): Promise<MinimalPuppeteer> {
  const mod = (await import('@cloudflare/puppeteer' as string).catch(() => null)) as {
    default?: MinimalPuppeteer
    launch?: MinimalPuppeteer['launch']
  } | null
  if (!mod) throw new Error('@cloudflare/puppeteer not installed; required for browse mode')
  if (mod.default) return mod.default
  if (mod.launch) return mod as unknown as MinimalPuppeteer
  throw new Error('@cloudflare/puppeteer export shape unexpected')
}

async function openPage(
  puppeteer: MinimalPuppeteer,
  binding: unknown,
  allowedEgress: string[],
  timeoutMs: number
): Promise<MinimalPage> {
  const browser = await puppeteer.launch(binding)
  const page = await browser.newPage()
  const setRequestInterception = (
    page as unknown as {
      setRequestInterception?(v: boolean): Promise<void>
    }
  ).setRequestInterception
  if (typeof setRequestInterception === 'function') {
    await setRequestInterception.call(page, true)
    ;(page as unknown as { on(ev: string, fn: (req: unknown) => void): void }).on(
      'request',
      (req: unknown) => {
        const r = req as { url(): string; continue(): void; abort(): void }
        if (isEgressAllowed(r.url(), allowedEgress)) r.continue()
        else r.abort()
      }
    )
  }
  void timeoutMs
  return page
}

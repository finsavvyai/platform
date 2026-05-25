interface Env {
  SANCTIONS_KV: KVNamespace
  SANCTIONS_R2: R2Bucket
  INGEST_QUEUE: Queue
  GO_SERVICE_URL: string
  INTERNAL_SECRET: string
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)

    if (url.pathname === '/health')
      return Response.json({ status: 'ok', ts: Date.now() })

    if (url.pathname === '/screen' && req.method === 'POST')
      return handleScreen(req, env)

    if (url.pathname === '/screen/batch' && req.method === 'POST')
      return handleBatch(req, env)

    return new Response('Not found', { status: 404 })
  },

  // Nightly continuous monitoring sweep
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await env.INGEST_QUEUE.send({ type: 'monitoring_sweep', ts: Date.now() })
  }
}

async function handleScreen(req: Request, env: Env): Promise<Response> {
  const body = await req.json<{ name: string; dob?: string; nationality?: string }>()
  if (!body.name) return Response.json({ error: 'name required' }, { status: 400 })

  const normalized = normalizeName(body.name)

  // 1. Negative cache — confirmed clean in last 24h
  const neg = await env.SANCTIONS_KV.get(`neg:${normalized}`)
  if (neg) return Response.json({ score: 0, status: 'clean', source: 'edge' })

  // 2. Exact match
  const exact = await env.SANCTIONS_KV.get(`exact:${normalized}`)
  if (exact) return Response.json({ score: 1.0, status: 'block', hits: JSON.parse(exact), source: 'edge' })

  // 3. Phonetic match (pre-computed codes stored at ingest time)
  const codes = doubleMetaphoneSimple(normalized)
  for (const code of codes) {
    const hit = await env.SANCTIONS_KV.get(`ph:${code}`)
    if (hit) {
      // Phonetic hit — forward to Go for full Jaro-Winkler scoring
      return forwardToGo(req, env, body)
    }
  }

  // 4. Forward to Go for full fuzzy search
  const result: any = await forwardToGo(req, env, body)
  const data = await (result as Response).clone().json<any>()

  // Cache clean results at edge for 24h — prevents repeat hits to Render
  if (data.score < 0.6) {
    await env.SANCTIONS_KV.put(`neg:${normalized}`, '1', { expirationTtl: 86400 })
  }

  return result
}

async function handleBatch(req: Request, env: Env): Promise<Response> {
  const { names } = await req.json<{ names: { name: string; dob?: string; ref?: string }[] }>()
  if (!names?.length) return Response.json({ error: 'names array required' }, { status: 400 })

  // Enqueue for async processing — returns a job ID immediately
  const jobId = crypto.randomUUID()
  await env.INGEST_QUEUE.send({ type: 'batch_screen', jobId, names })

  return Response.json({ jobId, status: 'queued', count: names.length })
}

async function forwardToGo(req: Request, env: Env, body: object): Promise<Response> {
  return fetch(`${env.GO_SERVICE_URL}/internal/screen`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Key': env.INTERNAL_SECRET,
      'CF-Connecting-IP': req.headers.get('CF-Connecting-IP') ?? '',
    },
    body: JSON.stringify(body),
  })
}

function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ')
}

// Lightweight Double Metaphone approximation for the edge
// Full implementation handled server-side — this is the pre-screen
function doubleMetaphoneSimple(s: string): string[] {
  const codes: string[] = []
  const vowels = new Set(['a', 'e', 'i', 'o', 'u'])
  let code = ''
  for (let i = 0; i < s.length && code.length < 6; i++) {
    const c = s[i]
    if (vowels.has(c) && i === 0) code += 'A'
    else if ('bfpv'.includes(c)) code += 'F'
    else if ('cgjkqsxyz'.includes(c)) code += 'S'
    else if ('dt'.includes(c)) code += 'T'
    else if (c === 'l') code += 'L'
    else if ('mn'.includes(c)) code += 'N'
    else if (c === 'r') code += 'R'
  }
  if (code) codes.push(code)
  return codes
}

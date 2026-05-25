import { Hono } from 'hono'
import type { Env } from '../types.js'

const health = new Hono<{ Bindings: Env }>()

health.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'claw-gateway',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  })
})

export { health }

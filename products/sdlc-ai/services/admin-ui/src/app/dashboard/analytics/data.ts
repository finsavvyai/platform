export const topEndpoints = [
  { method: 'POST', path: '/api/v1/documents/ingest', calls: 12840, avgMs: 142 },
  { method: 'GET', path: '/api/v1/search/query', calls: 9621, avgMs: 89 },
  { method: 'POST', path: '/api/v1/auth/token', calls: 8453, avgMs: 34 },
  { method: 'GET', path: '/api/v1/policies/evaluate', calls: 6712, avgMs: 67 },
  { method: 'POST', path: '/api/v1/embeddings/generate', calls: 5390, avgMs: 203 },
]

export const errorBreakdown = [
  { type: '400 Bad Request', count: 342, pct: 38 },
  { type: '401 Unauthorized', count: 271, pct: 30 },
  { type: '429 Rate Limited', count: 156, pct: 17 },
  { type: '500 Internal Error', count: 89, pct: 10 },
  { type: '503 Unavailable', count: 45, pct: 5 },
]

export const requestVolumeData = [
  { hour: '00:00', requests: 4200 },
  { hour: '01:00', requests: 3100 },
  { hour: '02:00', requests: 2400 },
  { hour: '03:00', requests: 1800 },
  { hour: '04:00', requests: 1500 },
  { hour: '05:00', requests: 2100 },
  { hour: '06:00', requests: 3800 },
  { hour: '07:00', requests: 5600 },
  { hour: '08:00', requests: 8200 },
  { hour: '09:00', requests: 11400 },
  { hour: '10:00', requests: 12800 },
  { hour: '11:00', requests: 13200 },
  { hour: '12:00', requests: 11900 },
  { hour: '13:00', requests: 12600 },
  { hour: '14:00', requests: 13800 },
  { hour: '15:00', requests: 12400 },
  { hour: '16:00', requests: 10800 },
  { hour: '17:00', requests: 8900 },
  { hour: '18:00', requests: 7200 },
  { hour: '19:00', requests: 5800 },
  { hour: '20:00', requests: 4900 },
  { hour: '21:00', requests: 4200 },
  { hour: '22:00', requests: 3800 },
  { hour: '23:00', requests: 3400 },
]

export const responseTimeData = [
  { range: '0-10', count: 3200 },
  { range: '10-25', count: 5800 },
  { range: '25-50', count: 4100 },
  { range: '50-100', count: 2400 },
  { range: '100-200', count: 890 },
  { range: '200-500', count: 340 },
  { range: '500+', count: 120 },
]

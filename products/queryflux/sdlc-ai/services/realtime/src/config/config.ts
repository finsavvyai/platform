import { config } from '@/config/config'

export interface Config {
  server: {
    port: number
    host: string
  }
  redis: {
    url: string
  }
  auth: {
    jwtSecret: string
  }
  cors: {
    allowedOrigins: string[]
  }
  collaboration: {
    maxSessionDuration: number
    maxParticipants: number
  }
  presence: {
    heartbeatInterval: number
    offlineTimeout: number
  }
}

export const config: Config = {
  server: {
    port: parseInt(process.env.PORT || '3001'),
    host: process.env.HOST || '0.0.0.0'
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key'
  },
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173']
  },
  collaboration: {
    maxSessionDuration: 24 * 60 * 60 * 1000, // 24 hours
    maxParticipants: 50
  },
  presence: {
    heartbeatInterval: 30000, // 30 seconds
    offlineTimeout: 120000 // 2 minutes
  }
}

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export type RateLimitResult = {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

export type RateLimiter = {
  limit(identifier: string): Promise<RateLimitResult>
}

const hasUpstashConfig = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
)

if (!hasUpstashConfig) {
  console.warn('[rate-limit] Upstash is not configured; using in-memory token-bucket rate limiter.')
}

// In-memory token bucket fallback for 30 req / 60s per IP
const memoryStore = new Map<string, { count: number; resetTime: number }>()

function checkInMemoryLimit(identifier: string, limit = 30, windowMs = 60_000): RateLimitResult {
  const isLocal =
    identifier === '127.0.0.1' ||
    identifier === '::1' ||
    identifier === 'localhost' ||
    identifier === 'test' ||
    process.env.NODE_ENV === 'test'

  if (isLocal) {
    return { success: true, limit, remaining: limit, reset: Date.now() + windowMs }
  }

  const now = Date.now()
  const record = memoryStore.get(identifier)

  if (!record || now > record.resetTime) {
    memoryStore.set(identifier, { count: 1, resetTime: now + windowMs })
    return { success: true, limit, remaining: limit - 1, reset: now + windowMs }
  }

  if (record.count >= limit) {
    return { success: false, limit, remaining: 0, reset: record.resetTime }
  }

  record.count += 1
  return { success: true, limit, remaining: limit - record.count, reset: record.resetTime }
}

export const rateLimiter: RateLimiter = hasUpstashConfig
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(30, '60 s'),
      prefix: 'rvc:qr-public-rate-limit',
    })
  : {
      async limit(identifier: string): Promise<RateLimitResult> {
        return checkInMemoryLimit(identifier, 30, 60_000)
      },
    }

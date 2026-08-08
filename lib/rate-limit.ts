import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

type RateLimitResult = {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

type RateLimiter = {
  limit(identifier: string): Promise<RateLimitResult>
}

const hasUpstashConfig = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
)

if (!hasUpstashConfig) {
  console.warn('[rate-limit] Upstash is not configured; public API rate limiting is disabled locally.')
}

export const rateLimiter: RateLimiter = hasUpstashConfig
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(10, '10 s'),
      prefix: 'rvc:public-menu',
    })
  : {
      async limit(): Promise<RateLimitResult> {
        return { success: true, limit: 10, remaining: 10, reset: Date.now() + 10_000 }
      },
    }

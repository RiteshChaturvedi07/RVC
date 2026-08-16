import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const startTime = Date.now()
  let dbStatus = 'healthy'
  let dbLatencyMs = 0

  try {
    const supabase = await createClient()
    const { error } = await supabase.from('tenants').select('id').limit(1)
    dbLatencyMs = Date.now() - startTime
    if (error) {
      dbStatus = 'degraded'
    }
  } catch {
    dbStatus = 'unreachable'
    dbLatencyMs = Date.now() - startTime
  }

  const memoryUsage = process.memoryUsage()
  const uptimeSeconds = Math.floor(process.uptime())

  const isHealthy = dbStatus === 'healthy'

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      system: {
        uptimeSeconds,
        memory: {
          rssMb: Math.round(memoryUsage.rss / (1024 * 1024)),
          heapTotalMb: Math.round(memoryUsage.heapTotal / (1024 * 1024)),
          heapUsedMb: Math.round(memoryUsage.heapUsed / (1024 * 1024)),
        },
      },
    },
    { status: isHealthy ? 200 : 503 }
  )
}

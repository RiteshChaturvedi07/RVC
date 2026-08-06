import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // This project also exposes graphql_public. RVC's tables and RPCs live in
    // public, so select it explicitly for every browser request.
    { db: { schema: 'public' } }
  )
}

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// PgBouncer transaction mode requires prepare: false
// max: 5 gives enough concurrency for parallel middleware queries without exhausting PgBouncer
// connect_timeout: 4 — fail fast so middleware's 5s Promise.race can win cleanly;
// the old 10s timeout meant middleware could block for the full Vercel function lifetime.
const queryClient = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  max: 5,
  idle_timeout: 20,
  connect_timeout: 4,
})

export const db = drizzle(queryClient, { schema })
export type DB = typeof db

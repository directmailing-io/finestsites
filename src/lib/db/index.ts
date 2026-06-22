import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// PgBouncer transaction mode requires prepare: false
const queryClient = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  max: 1,
})

export const db = drizzle(queryClient, { schema })
export type DB = typeof db

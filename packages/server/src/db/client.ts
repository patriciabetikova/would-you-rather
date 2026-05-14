import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// `prepare: false` is required for Supabase's transaction-mode pooler,
// and harmless on direct connections. Safe default.
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client);

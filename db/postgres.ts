import { neon } from "@neondatabase/serverless";

export function postgres() {
  const connectionString = process.env.DATABASE_URL;
  return connectionString ? neon(connectionString) : null;
}

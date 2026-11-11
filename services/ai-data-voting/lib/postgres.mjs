import { neon } from '@neondatabase/serverless';

export function createPostgresQuery(connectionString) {
  const sql = neon(connectionString);
  return (text, values = []) => sql.query(text, values, { fetchOptions: { signal: AbortSignal.timeout(15000) } });
}

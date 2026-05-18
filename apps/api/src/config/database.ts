import { Pool, PoolClient } from 'pg';
import { env } from './env';
import { logger } from '../utils/logger';

// ── Connection Pool ───────────────────────────────────────────────────────────
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max:              20,   // max connections in pool
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  // SSL required for Railway production
  ssl: env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected PostgreSQL pool error');
});

// ── Health check ─────────────────────────────────────────────────────────────
export async function checkDatabaseConnection(): Promise<void> {
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query('SELECT 1');
    logger.info('✅ PostgreSQL connection established');
  } catch (err) {
    logger.error({ err }, '❌ PostgreSQL connection failed');
    throw err;
  } finally {
    client?.release();
  }
}

// ── Transaction helper ───────────────────────────────────────────────────────
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * migrate.ts — Run all SQL migration files in order.
 *
 * Usage: npm run migrate
 *
 * Migrations are idempotent (all use IF NOT EXISTS / ON CONFLICT).
 * Safe to run multiple times.
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { pool } from '../config/database';
import { logger } from '../utils/logger';

async function migrate(): Promise<void> {
  const migrationsDir = join(__dirname, '../../migrations');
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort(); // lexicographic order ensures 001_ before 002_

  logger.info(`Found ${files.length} migration file(s)`);

  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), 'utf-8');
    logger.info(`Running: ${file}`);
    try {
      await pool.query(sql);
      logger.info(`✅ ${file} complete`);
    } catch (err) {
      logger.error({ err, file }, `❌ Migration failed: ${file}`);
      throw err;
    }
  }

  logger.info('All migrations complete');
  await pool.end();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});

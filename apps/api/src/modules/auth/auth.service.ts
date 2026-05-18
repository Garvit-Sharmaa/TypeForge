import { pool } from '../../config/database';
import { hashPassword, verifyPassword } from '../../utils/crypto';
import { issueTokenPair }               from '../../utils/jwt';
import { createError }                  from '../../middleware/errorHandler';
import type { AuthTokens }              from '@typing-master/shared';

interface RegisterInput { email: string; username: string; password: string; }
interface LoginInput    { email: string; password: string; }

// ── Register ──────────────────────────────────────────────────────────────────
export async function registerUser(
  input: RegisterInput,
): Promise<AuthTokens & { userId: string }> {
  // Check email/username uniqueness
  const existing = await pool.query(
    'SELECT id FROM users WHERE email=$1 OR username=$2 LIMIT 1',
    [input.email.toLowerCase(), input.username],
  );
  if (existing.rows.length) {
    throw createError('Email or username already taken', 409, 'CONFLICT');
  }

  const passwordHash = await hashPassword(input.password);

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (email, username, password_hash, oauth_provider)
     VALUES ($1, $2, $3, 'local') RETURNING id`,
    [input.email.toLowerCase(), input.username, passwordHash],
  );
  const user = rows[0];

  // Create statistics row
  await pool.query(
    'INSERT INTO user_statistics (user_id) VALUES ($1) ON CONFLICT DO NOTHING',
    [user.id],
  );
  // Create streak row
  await pool.query(
    'INSERT INTO user_streaks (user_id) VALUES ($1) ON CONFLICT DO NOTHING',
    [user.id],
  );

  const tokens = issueTokenPair({
    id:       user.id,
    email:    input.email.toLowerCase(),
    username: input.username,
    rank:     'bronze',
  });

  return { ...tokens, userId: user.id };
}

// ── Login ─────────────────────────────────────────────────────────────────────
export async function loginUser(input: LoginInput): Promise<AuthTokens & { userId: string }> {
  const { rows } = await pool.query(
    `SELECT id, username, password_hash,
            COALESCE(s.rank, 'bronze') AS rank
     FROM users u
     LEFT JOIN user_statistics s ON s.user_id = u.id
     WHERE u.email = $1 AND u.is_active = true
     LIMIT 1`,
    [input.email.toLowerCase()],
  );

  const user = rows[0];
  if (!user?.password_hash) {
    // Timing-safe: still verify a dummy hash
    await verifyPassword(input.password, '$2b$12$dummyhashtopreventtimingattack');
    throw createError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  const valid = await verifyPassword(input.password, user.password_hash);
  if (!valid) {
    throw createError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  const tokens = issueTokenPair({
    id:       user.id,
    email:    input.email.toLowerCase(),
    username: user.username,
    rank:     user.rank,
  });

  return { ...tokens, userId: user.id };
}

// ── Refresh ───────────────────────────────────────────────────────────────────
export async function refreshTokens(userId: string): Promise<AuthTokens> {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.username,
            COALESCE(s.rank, 'bronze') AS rank
     FROM users u
     LEFT JOIN user_statistics s ON s.user_id = u.id
     WHERE u.id = $1 AND u.is_active = true`,
    [userId],
  );

  if (!rows.length) throw createError('User not found', 404, 'NOT_FOUND');

  return issueTokenPair(rows[0]);
}

import { pool } from '../../config/database';

// ── Dashboard summary + WPM history ──────────────────────────────────────────
export async function getDashboardData(userId: string) {
  const [statsResult, historyResult] = await Promise.all([
    // Denormalized stats row — instant read
    pool.query(
      `SELECT us.total_sessions, us.avg_wpm, us.best_wpm, us.avg_raw_wpm,
              us.avg_accuracy, us.avg_consistency, us.total_time_ms,
              us.streak_days, us.last_activity_at,
              u.xp, u.level
       FROM user_statistics us
       JOIN users u ON u.id = us.user_id
       WHERE us.user_id = $1`,
      [userId],
    ),
    // Last 30 sessions for WPM progression chart
    pool.query(
      `SELECT
         ROW_NUMBER() OVER (ORDER BY completed_at ASC) AS session_index,
         wpm, accuracy, completed_at
       FROM (
         SELECT wpm, accuracy, completed_at
         FROM typing_sessions
         WHERE user_id = $1 AND is_flagged = false
         ORDER BY completed_at DESC
         LIMIT 30
       ) sub
       ORDER BY completed_at ASC`,
      [userId],
    ),
  ]);

  const stats = statsResult.rows[0] ?? {
    total_sessions: 0, avg_wpm: 0, best_wpm: 0, avg_accuracy: 0,
    streak_days: 0, xp: 0, level: 1,
  };

  return {
    stats: {
      totalSessions: stats.total_sessions,
      avgWpm:        Math.round(stats.avg_wpm),
      bestWpm:       stats.best_wpm,
      avgRawWpm:     Math.round(stats.avg_raw_wpm ?? 0),
      avgAccuracy:   Math.round(stats.avg_accuracy * 10) / 10,
      avgConsistency:Math.round(stats.avg_consistency ?? 0),
      totalTimeMs:   stats.total_time_ms ?? 0,
      streakDays:    stats.streak_days,
      xp:            stats.xp,
      rank:          `Level ${stats.level}`, // Map level to the UI rank field
    },
    wpmHistory: historyResult.rows.map((r) => ({
      sessionIndex: Number(r.session_index),
      wpm:          r.wpm,
      accuracy:     Math.round(r.accuracy),
      completedAt:  r.completed_at,
    })),
  };
}

// ── Weak keys for heatmap ─────────────────────────────────────────────────────
export async function getWeakKeys(userId: string) {
  const { rows } = await pool.query(
    `SELECT key_char, error_rate, avg_latency_ms, total_count AS sample_count
     FROM weak_keys
     WHERE user_id = $1
     ORDER BY error_rate DESC`,
    [userId],
  );

  return rows.map((r) => ({
    keyChar:       r.key_char as string,
    errorRate:     parseFloat(r.error_rate),
    avgLatencyMs:  parseFloat(r.avg_latency_ms),
    sampleCount:   r.sample_count,
  }));
}

-- ============================================================
-- Migration 003: user_statistics
--
-- Denormalized fast-read table. Updated by analyticsWorker
-- after every session. Components read from this table —
-- never aggregate typing_sessions at query time.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_statistics (
  user_id          UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Session counters
  total_sessions   INTEGER     NOT NULL DEFAULT 0,
  total_time_ms    BIGINT      NOT NULL DEFAULT 0,

  -- WPM stats
  avg_wpm          NUMERIC(6,2) NOT NULL DEFAULT 0,
  best_wpm         SMALLINT    NOT NULL DEFAULT 0,
  avg_raw_wpm      NUMERIC(6,2) NOT NULL DEFAULT 0,

  -- Quality stats
  avg_accuracy     NUMERIC(5,2) NOT NULL DEFAULT 0,
  avg_consistency  NUMERIC(5,2) NOT NULL DEFAULT 0,

  -- Gamification
  xp               INTEGER     NOT NULL DEFAULT 0,
  rank             VARCHAR(20) NOT NULL DEFAULT 'bronze',
  streak_days      SMALLINT    NOT NULL DEFAULT 0,

  last_activity_at TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_user_stats_updated_at
  BEFORE UPDATE ON user_statistics
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Function: upsert user stats after session ────────────────────────────
-- Called by SQL in analyticsWorker (or directly via service).
-- Uses incremental averages to avoid full re-aggregation on each session.
CREATE OR REPLACE FUNCTION update_user_statistics(
  p_user_id      UUID,
  p_wpm          SMALLINT,
  p_raw_wpm      SMALLINT,
  p_accuracy     NUMERIC,
  p_consistency  NUMERIC,
  p_duration_ms  INTEGER,
  p_xp_gained    INTEGER
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_n INTEGER;
BEGIN
  -- Upsert row if first session
  INSERT INTO user_statistics (user_id) VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Fetch current session count BEFORE incrementing
  SELECT total_sessions INTO v_n FROM user_statistics WHERE user_id = p_user_id;

  UPDATE user_statistics SET
    total_sessions   = total_sessions + 1,
    total_time_ms    = total_time_ms  + p_duration_ms,
    -- Incremental mean: new_avg = (old_avg × n + new_val) / (n + 1)
    avg_wpm          = (avg_wpm     * v_n + p_wpm)         / (v_n + 1),
    avg_raw_wpm      = (avg_raw_wpm * v_n + p_raw_wpm)     / (v_n + 1),
    avg_accuracy     = (avg_accuracy * v_n + p_accuracy)   / (v_n + 1),
    avg_consistency  = (avg_consistency * v_n + p_consistency) / (v_n + 1),
    best_wpm         = GREATEST(best_wpm, p_wpm),
    xp               = xp + p_xp_gained,
    last_activity_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;

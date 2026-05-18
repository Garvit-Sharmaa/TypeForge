-- ============================================================
-- Migration 004: weak_keys
--
-- Aggregated per-user per-key error analytics.
-- Populated/updated by analyticsWorker from keystroke_payload.
-- This is the PERMANENT record — keystroke_payload is ephemeral.
-- ============================================================

CREATE TABLE IF NOT EXISTS weak_keys (
  user_id       UUID       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_char      CHAR(1)    NOT NULL,

  -- Running totals (additive — analyticsWorker increments these)
  error_count   INTEGER    NOT NULL DEFAULT 0,
  total_count   INTEGER    NOT NULL DEFAULT 0,

  -- Derived (recomputed on each update)
  error_rate    NUMERIC(6,5) NOT NULL DEFAULT 0
                CHECK (error_rate >= 0 AND error_rate <= 1),

  -- Exponentially weighted moving average latency (ms)
  avg_latency_ms NUMERIC(8,2) NOT NULL DEFAULT 0,

  last_updated  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (user_id, key_char)
);

CREATE INDEX IF NOT EXISTS idx_weak_keys_user_error
  ON weak_keys (user_id, error_rate DESC);

-- ── Function: upsert weak key stats ─────────────────────────────────────────
-- Called by analyticsWorker after each session's keystroke_payload is processed.
CREATE OR REPLACE FUNCTION upsert_weak_key(
  p_user_id      UUID,
  p_key_char     CHAR(1),
  p_new_errors   INTEGER,
  p_new_total    INTEGER,
  p_new_latency  NUMERIC
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_alpha CONSTANT NUMERIC := 0.2; -- EWMA smoothing factor
BEGIN
  INSERT INTO weak_keys (user_id, key_char, error_count, total_count, avg_latency_ms)
  VALUES (p_user_id, p_key_char, p_new_errors, p_new_total, p_new_latency)
  ON CONFLICT (user_id, key_char) DO UPDATE SET
    error_count    = weak_keys.error_count + p_new_errors,
    total_count    = weak_keys.total_count + p_new_total,
    error_rate     = (weak_keys.error_count + p_new_errors)::NUMERIC
                   / NULLIF(weak_keys.total_count + p_new_total, 0),
    -- EWMA for latency: new_avg = α × new + (1 − α) × old
    avg_latency_ms = v_alpha * p_new_latency
                   + (1 - v_alpha) * weak_keys.avg_latency_ms,
    last_updated   = NOW();
END;
$$;

-- ============================================================
-- Migration 005: achievements
-- ============================================================

CREATE TABLE IF NOT EXISTS achievements (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           VARCHAR(100) UNIQUE NOT NULL,
  name           VARCHAR(100) NOT NULL,
  description    TEXT        NOT NULL,
  icon_url       TEXT,
  xp_reward      INTEGER     NOT NULL DEFAULT 0,
  -- JSON condition evaluated by achievementWorker
  condition_json JSONB       NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id),
  unlocked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user
  ON user_achievements (user_id, unlocked_at DESC);

-- Seed the achievement catalog
INSERT INTO achievements (slug, name, description, xp_reward, condition_json) VALUES
  ('first_session',    'First Keystrokes',  'Complete your first typing session.',             50,   '{"type":"sessions_count","threshold":1}'),
  ('wpm_50',           'Speed Runner',      'Reach 50 WPM in a single session.',             100,   '{"type":"wpm_milestone","threshold":50}'),
  ('wpm_80',           'Fast Fingers',      'Reach 80 WPM in a single session.',             200,   '{"type":"wpm_milestone","threshold":80}'),
  ('wpm_100',          'Century Club',      'Break 100 WPM. You are elite.',                 400,   '{"type":"wpm_milestone","threshold":100}'),
  ('accuracy_95',      'Perfectionist',     'Finish a session with 95%+ accuracy.',           150,   '{"type":"accuracy_milestone","threshold":95}'),
  ('streak_7',         'Week Warrior',      'Maintain a 7-day typing streak.',               300,   '{"type":"streak_days","threshold":7}'),
  ('streak_30',        'Iron Fingers',      'Maintain a 30-day typing streak.',             1000,   '{"type":"streak_days","threshold":30}'),
  ('sessions_100',     'Devoted',           'Complete 100 typing sessions.',                 500,   '{"type":"sessions_count","threshold":100}')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Migration 006: user_streaks
-- ============================================================

CREATE TABLE IF NOT EXISTS user_streaks (
  user_id          UUID  PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak   INTEGER  NOT NULL DEFAULT 0,
  longest_streak   INTEGER  NOT NULL DEFAULT 0,
  last_active_date DATE,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_user_streaks_updated_at
  BEFORE UPDATE ON user_streaks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

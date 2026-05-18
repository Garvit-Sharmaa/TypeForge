-- ============================================================
-- Migration 002: typing_sessions
--
-- ARCHIVAL CONTRACT (per engineering directive):
--   This table stores ONLY aggregated session metadata.
--   Raw keystroke arrays are NOT persisted indefinitely.
--
--   `keystroke_payload` stores a compact JSONB array:
--     [{"k":"a","e":"a","c":1,"l":85,"p":0}, ...]
--     (key, expected, correct, latencyMs, position)
--   This column is NULLed by archivalWorker after 30 days,
--   once the data has been aggregated into weak_keys.
-- ============================================================

CREATE TABLE IF NOT EXISTS typing_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- ── Performance metrics (aggregated, permanent) ───────────────────────
  wpm             SMALLINT    NOT NULL CHECK (wpm >= 0 AND wpm <= 400),
  raw_wpm         SMALLINT    NOT NULL CHECK (raw_wpm >= 0 AND raw_wpm <= 400),
  accuracy        NUMERIC(5,2) NOT NULL CHECK (accuracy >= 0 AND accuracy <= 100),
  consistency     NUMERIC(5,2) NOT NULL DEFAULT 0
                              CHECK (consistency >= 0 AND consistency <= 100),

  -- ── Session config (permanent) ────────────────────────────────────────
  duration_ms     INTEGER     NOT NULL CHECK (duration_ms > 0),
  mode            VARCHAR(20) NOT NULL CHECK (mode IN ('time','words','quote','zen')),
  language        VARCHAR(20) NOT NULL DEFAULT 'english',
  lesson_id       UUID        REFERENCES lessons(id) ON DELETE SET NULL,

  -- ── Char/word counts (permanent) ─────────────────────────────────────
  word_count      SMALLINT    NOT NULL DEFAULT 0,
  correct_words   SMALLINT    NOT NULL DEFAULT 0,
  correct_chars   INTEGER     NOT NULL DEFAULT 0,
  total_chars     INTEGER     NOT NULL DEFAULT 0,

  -- ── Anti-cheat flags ─────────────────────────────────────────────────
  is_flagged      BOOLEAN     NOT NULL DEFAULT false,
  flag_reason     VARCHAR(100),

  -- ── Ephemeral keystroke payload (NULLed after 30-day archival) ───────
  -- Format: [{"k":"a","e":"a","c":1,"l":85,"p":0}, ...]
  -- NOTE: this column is intentionally NOT indexed — it is write-once, read-once.
  keystroke_payload JSONB,
  payload_archived  BOOLEAN   NOT NULL DEFAULT false,

  completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User timeline index (dashboard queries)
CREATE INDEX IF NOT EXISTS idx_sessions_user_time
  ON typing_sessions (user_id, completed_at DESC);

-- Leaderboard index (best WPM queries)
CREATE INDEX IF NOT EXISTS idx_sessions_wpm
  ON typing_sessions (wpm DESC)
  WHERE is_flagged = false;

-- Archival worker: find sessions ready to archive
CREATE INDEX IF NOT EXISTS idx_sessions_archive_eligible
  ON typing_sessions (completed_at)
  WHERE keystroke_payload IS NOT NULL AND payload_archived = false;

-- Lessons table stub (required for FK above)
CREATE TABLE IF NOT EXISTS lessons (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(255) NOT NULL,
  slug        VARCHAR(100) UNIQUE NOT NULL,
  content     TEXT        NOT NULL,
  difficulty  VARCHAR(20) NOT NULL DEFAULT 'beginner',
  language    VARCHAR(20) NOT NULL DEFAULT 'english',
  focus_keys  VARCHAR(100),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

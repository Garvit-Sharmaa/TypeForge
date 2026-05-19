-- ============================================================
-- Migration 008: user_lesson_progress
--
-- Tracks which curriculum lessons each user has completed.
-- Uses TEXT lesson slugs (e.g. 'lesson-01-home-core') instead of
-- UUID FKs because the curriculum lives in code, not in the DB.
--
-- Completion criteria enforced by the API (see sessions.service.ts):
--   accuracy >= 80%  (configurable via LESSON_PASS_ACCURACY constant)
--   wpm      >= 10   (configurable via LESSON_PASS_WPM constant)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_lesson_progress (
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_slug   TEXT        NOT NULL,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (user_id, lesson_slug)   -- one row per user+lesson; idempotent upsert
);

-- Fast lookup: "what's the highest stage this user has completed?"
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user
  ON user_lesson_progress (user_id, completed_at DESC);

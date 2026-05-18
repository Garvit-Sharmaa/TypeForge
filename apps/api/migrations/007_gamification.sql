-- ============================================================
-- Migration 007: Gamification fields on users
--
-- Adds XP and Level columns to the users table.
-- XP is the canonical value; level is derived and cached here
-- to avoid recomputing it on every API read.
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS xp    INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1);

-- Fast leaderboard queries by XP
CREATE INDEX IF NOT EXISTS idx_users_xp ON users (xp DESC);

-- ── Function: award XP and auto-level-up ─────────────────────────────────────
-- Called inside the session submission transaction so XP updates are atomic.
--
-- Level formula: level = FLOOR(SQRT(xp / 100)) + 1
--   XP 0–99   → level 1
--   XP 100–399 → level 2  (100 * (n-1)^2)
--   XP 400–899 → level 3
--   XP 900–1599→ level 4
--   XP 40000+  → level 21 (soft cap — future seasons can raise it)
--
-- Returns: (new_xp INT, new_level INT, leveled_up BOOL)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION award_xp(
  p_user_id UUID,
  p_xp_delta INTEGER
) RETURNS TABLE (new_xp INT, new_level INT, leveled_up BOOL)
LANGUAGE plpgsql AS $$
DECLARE
  v_old_level INTEGER;
  v_new_xp    INTEGER;
  v_new_level INTEGER;
BEGIN
  -- Atomic increment and read
  UPDATE users
     SET xp = xp + p_xp_delta
   WHERE id = p_user_id
  RETURNING xp, level INTO v_new_xp, v_old_level;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', p_user_id;
  END IF;

  -- Derive level from new XP total
  v_new_level := FLOOR(SQRT(v_new_xp::NUMERIC / 100))::INTEGER + 1;

  -- Persist if changed
  IF v_new_level <> v_old_level THEN
    UPDATE users SET level = v_new_level WHERE id = p_user_id;
  END IF;

  RETURN QUERY SELECT v_new_xp, v_new_level, (v_new_level > v_old_level);
END;
$$;

-- ── Function: check and unlock achievements (called post-session) ─────────────
-- Evaluates the session stats against each achievement's condition_json
-- and inserts into user_achievements if not already earned.
-- Returns the slugs of any newly unlocked achievements.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_session_achievements(
  p_user_id      UUID,
  p_wpm          INTEGER,
  p_accuracy     NUMERIC,
  p_total_sessions INTEGER
) RETURNS TABLE (slug VARCHAR, xp_reward INTEGER)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH eligible AS (
    SELECT a.id, a.slug, a.xp_reward, a.condition_json
      FROM achievements a
     WHERE NOT EXISTS (
       SELECT 1 FROM user_achievements ua
        WHERE ua.user_id = p_user_id AND ua.achievement_id = a.id
     )
  ),
  unlocked AS (
    SELECT e.id, e.slug, e.xp_reward
      FROM eligible e
     WHERE
       (e.condition_json->>'type' = 'wpm_milestone'
        AND p_wpm >= (e.condition_json->>'threshold')::INTEGER)
    OR
       (e.condition_json->>'type' = 'accuracy_milestone'
        AND p_accuracy >= (e.condition_json->>'threshold')::NUMERIC)
    OR
       (e.condition_json->>'type' = 'sessions_count'
        AND p_total_sessions >= (e.condition_json->>'threshold')::INTEGER)
  ),
  inserted AS (
    INSERT INTO user_achievements (user_id, achievement_id)
    SELECT p_user_id, u.id FROM unlocked u
    ON CONFLICT DO NOTHING
    RETURNING achievement_id
  )
  SELECT u.slug, u.xp_reward
    FROM unlocked u
    JOIN inserted i ON i.achievement_id = u.id;
END;
$$;

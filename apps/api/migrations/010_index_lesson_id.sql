-- ============================================================
-- Migration 010: Index lesson_id
--
-- Adds an index to the lesson_id column in typing_sessions
-- to prevent O(N) sequential scans when querying stats per lesson.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_sessions_lesson ON typing_sessions (lesson_id);

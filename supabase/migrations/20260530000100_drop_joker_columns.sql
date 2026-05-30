-- ============================================================
-- 20260530000100_drop_joker_columns.sql
-- Audit-Fix 2026-05-30 (P2-1 / Hausregel feedback_dealbuddy_no_joker)
-- Joker existiert nicht. Entfernt alle Joker-Legacy-Spalten.
-- Idempotent (IF EXISTS).
-- ============================================================

-- tip_groups: Joker-Scoring-Konfiguration
ALTER TABLE public.tip_groups
  DROP COLUMN IF EXISTS joker_enabled,
  DROP COLUMN IF EXISTS joker_multiplier,
  DROP COLUMN IF EXISTS joker_per_matchday;

-- tip_answers: per-Tip Joker-Flag
ALTER TABLE public.tip_answers
  DROP COLUMN IF EXISTS is_joker;

-- tip_group_members: per-Member Joker-Tracking
ALTER TABLE public.tip_group_members
  DROP COLUMN IF EXISTS jokers_remaining,
  DROP COLUMN IF EXISTS jokers_used_matchdays;

-- Migration: relax legacy-data NOT NULL constraints and add provenance.
-- Apply on Railway Postgres (DATABASE_URL) before deploying the waitlist
-- admin UI. Idempotent: safe to re-run.
--
-- Why this is needed
--   The original waitlist_signups schema required phone_number and a
--   platform_preference of either 'ios' or 'android'. The historical Google
--   Sheet has rows that pre-date those requirements (missing phone, missing
--   OS, etc.). Rather than throw the data away during migration we relax the
--   constraints so legacy rows can land in the table, and we record where
--   each row came from via the new `source` column.
--
-- The /api/waitlist endpoint still enforces all fields via Zod for new
-- signups; the looser constraints only matter for back-filled and admin-
-- inserted rows.

ALTER TABLE waitlist_signups ALTER COLUMN phone_number DROP NOT NULL;
ALTER TABLE waitlist_signups ALTER COLUMN platform_preference DROP NOT NULL;

ALTER TABLE waitlist_signups
  DROP CONSTRAINT IF EXISTS waitlist_signups_platform_preference_check;
ALTER TABLE waitlist_signups
  ADD CONSTRAINT waitlist_signups_platform_preference_check
  CHECK (platform_preference IS NULL OR platform_preference IN ('ios','android'));

ALTER TABLE waitlist_signups
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'web';

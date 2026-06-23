-- Migration: email unsubscribe ledger for transactional welcome emails.
-- Apply on the web Postgres (WEB_DATABASE_URL; falls back to DATABASE_URL).
-- Idempotent: safe to re-run.
--
-- Why: the welcome email is sent via Resend emails.send() (transactional), so
-- Resend's hosted {{{RESEND_UNSUBSCRIBE_URL}}} (a Broadcasts-only feature) is
-- not available. We host our own one-click unsubscribe (/api/unsubscribe) and
-- record opt-outs here so future sends can suppress them.

CREATE TABLE IF NOT EXISTS email_unsubscribes (
  email           TEXT PRIMARY KEY,
  unsubscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source          TEXT NOT NULL DEFAULT 'email_link'
);

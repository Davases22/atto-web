-- Migration: A2P 10DLC consent ledger + waitlist signups
-- Apply on Railway Postgres (DATABASE_URL) before deploying feat/sms-compliance-opt-in.
-- Idempotent: safe to re-run.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Waitlist signups table (new — historically the form wrote to a Google Sheet)
CREATE TABLE IF NOT EXISTS waitlist_signups (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  email               TEXT NOT NULL UNIQUE,
  phone_number        TEXT NOT NULL,
  platform_preference TEXT NOT NULL CHECK (platform_preference IN ('ios','android')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_signups_phone ON waitlist_signups (phone_number);

-- 2. Enums for sms_consent_records (Postgres has no IF NOT EXISTS for CREATE TYPE)
DO $$ BEGIN
  CREATE TYPE sms_consent_type AS ENUM ('transactional','marketing');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sms_revoked_via AS ENUM ('sms_stop','web_form','support_request');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Consent ledger
CREATE TABLE IF NOT EXISTS sms_consent_records (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID REFERENCES waitlist_signups(id) ON DELETE SET NULL,
  phone_number         TEXT NOT NULL,
  email                TEXT NOT NULL,
  consent_type         sms_consent_type NOT NULL,
  consent_given        BOOLEAN NOT NULL,
  consent_text_version TEXT NOT NULL,
  consent_text_hash    TEXT NOT NULL,
  consent_text_full    TEXT NOT NULL,
  ip_address           TEXT,
  user_agent           TEXT,
  form_url             TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at           TIMESTAMPTZ,
  revoked_via          sms_revoked_via
);

CREATE INDEX IF NOT EXISTS idx_consent_phone ON sms_consent_records (phone_number);
CREATE INDEX IF NOT EXISTS idx_consent_email ON sms_consent_records (email);
CREATE INDEX IF NOT EXISTS idx_consent_active
  ON sms_consent_records (phone_number, consent_type)
  WHERE revoked_at IS NULL;

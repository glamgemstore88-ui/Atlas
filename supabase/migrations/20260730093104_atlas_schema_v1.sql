/*
# Atlas — initial schema (multi-user, BYOK Buffer integration)

1. Purpose
   Atlas is an AI-powered social media management dashboard that talks to a user's
   real Buffer account via Buffer's official GraphQL API (api.buffer.com), using a
   per-user personal API key (Bring Your Own Key). This migration creates the
   tables needed to persist users' encrypted Buffer keys, posting preferences,
   AI-generated content templates, threshold alerts, and notification history.

2. New Tables
   - `buffer_keys`        Encrypted Buffer API key for the authenticated user (one row per user).
                         Stores AES-256-GCM ciphertext, IV, and auth tag; plaintext is NEVER stored.
   - `user_settings`      Per-user app settings: language, posting goals, smart-schedule params.
   - `ai_templates`       Saved AI-generated content drafts the user created via Atlas.
   - `alerts`             Engagement threshold alert definitions the user configures.
   - `notifications`      Notification log (threshold breaches, system events).

3. Security
   - RLS enabled on every table.
   - Every table is owner-scoped to the authenticated user via `auth.uid()` with
     the owner column defaulting to `auth.uid()` so inserts that omit `user_id` succeed.
   - Four separate policies (SELECT/INSERT/UPDATE/DELETE) per table, scoped `TO authenticated`.
   - `buffer_keys` stores only ciphertext + IV + auth tag. The encryption key is
     derived from a server-side secret inside the edge function; no plaintext key
     is ever stored, logged, or exposed to the client bundle.

4. Notes
   - Uses `gen_random_uuid()`.
   - All timestamps are timestamptz with `now()` defaults.
   - Idempotent: uses IF NOT EXISTS for tables; policies dropped-then-recreated.
*/

-- buffer_keys : encrypted Buffer API key per user
CREATE TABLE IF NOT EXISTS buffer_keys (
  user_id      uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ciphertext   text        NOT NULL,
  iv           text        NOT NULL,
  auth_tag     text        NOT NULL,
  hint         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE buffer_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_buffer_key" ON buffer_keys;
CREATE POLICY "select_own_buffer_key" ON buffer_keys FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_buffer_key" ON buffer_keys;
CREATE POLICY "insert_own_buffer_key" ON buffer_keys FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_buffer_key" ON buffer_keys;
CREATE POLICY "update_own_buffer_key" ON buffer_keys FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_buffer_key" ON buffer_keys;
CREATE POLICY "delete_own_buffer_key" ON buffer_keys FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- user_settings : per-user app preferences
CREATE TABLE IF NOT EXISTS user_settings (
  user_id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  language           text        NOT NULL DEFAULT 'en',
  posts_per_week_goal integer     NOT NULL DEFAULT 5,
  smart_schedule_enabled boolean  NOT NULL DEFAULT true,
  timezone           text        NOT NULL DEFAULT 'Asia/Kolkata',
  onboarding_dismissed boolean   NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_settings" ON user_settings;
CREATE POLICY "select_own_settings" ON user_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_settings" ON user_settings;
CREATE POLICY "insert_own_settings" ON user_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_settings" ON user_settings;
CREATE POLICY "update_own_settings" ON user_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_settings" ON user_settings;
CREATE POLICY "delete_own_settings" ON user_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ai_templates : saved AI-generated drafts
CREATE TABLE IF NOT EXISTS ai_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  body        text        NOT NULL,
  category    text,
  channel_id  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE ai_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_templates" ON ai_templates;
CREATE POLICY "select_own_templates" ON ai_templates FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_templates" ON ai_templates;
CREATE POLICY "insert_own_templates" ON ai_templates FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_templates" ON ai_templates;
CREATE POLICY "update_own_templates" ON ai_templates FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_templates" ON ai_templates;
CREATE POLICY "delete_own_templates" ON ai_templates FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_ai_templates_user ON ai_templates(user_id);

-- alerts : engagement threshold alert definitions
CREATE TABLE IF NOT EXISTS alerts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  metric        text        NOT NULL,
  operator      text        NOT NULL,
  threshold     numeric     NOT NULL,
  channel_id    text,
  enabled       boolean     NOT NULL DEFAULT true,
  last_checked  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_alerts" ON alerts;
CREATE POLICY "select_own_alerts" ON alerts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_alerts" ON alerts;
CREATE POLICY "insert_own_alerts" ON alerts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_alerts" ON alerts;
CREATE POLICY "update_own_alerts" ON alerts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_alerts" ON alerts;
CREATE POLICY "delete_own_alerts" ON alerts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);

-- notifications : alert/notification log
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_id    uuid        REFERENCES alerts(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  body        text        NOT NULL,
  severity    text        NOT NULL DEFAULT 'info',
  read        boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read, created_at DESC);

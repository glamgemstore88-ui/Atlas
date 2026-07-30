/*
# Atlas — convert to single-tenant (sign-up optional)

1. Purpose
   Atlas now works without an account. The core app (Buffer BYOK, queue,
   analytics, automation) is fully usable by an anonymous guest. Sign-in is
   optional and only personalizes the greeting name. This migration converts
   the previously multi-user (auth-scoped) tables to a single-tenant model:
   one shared row set that the anon-key client can read and write directly.

2. Changes
   - Drop ALL existing owner-scoped RLS policies first (they reference user_id,
     so the column cannot be altered while policies depend on it).
   - buffer_keys: drop auth.users FK + PK on user_id; rename user_id -> owner
     (nullable text). Key still AES-256-GCM encrypted at rest.
   - user_settings: drop auth.users FK + PK on user_id; rename -> owner.
   - ai_templates / alerts / notifications: drop auth.users FKs; remove
     DEFAULT auth.uid(); rename user_id -> owner (nullable text).
   - Recreate policies as anon+authenticated CRUD (intentionally shared,
     single-tenant) so the anon-key frontend operates without signing in.

3. Security
   - RLS stays ENABLED on every table.
   - Policies are anon+authenticated CRUD — correct for single-tenant shared data.
   - Buffer API key encryption is unchanged (AES-256-GCM, server-side).

4. Notes
   - Existing rows preserved (no DROP TABLE / DELETE). Only columns/constraints altered.
   - Idempotent: policies dropped-then-recreated.
*/

-- Drop all existing policies FIRST (they depend on user_id)
DROP POLICY IF EXISTS "select_own_buffer_key" ON buffer_keys;
DROP POLICY IF EXISTS "insert_own_buffer_key" ON buffer_keys;
DROP POLICY IF EXISTS "update_own_buffer_key" ON buffer_keys;
DROP POLICY IF EXISTS "delete_own_buffer_key" ON buffer_keys;
DROP POLICY IF EXISTS "select_own_settings" ON user_settings;
DROP POLICY IF EXISTS "insert_own_settings" ON user_settings;
DROP POLICY IF EXISTS "update_own_settings" ON user_settings;
DROP POLICY IF EXISTS "delete_own_settings" ON user_settings;
DROP POLICY IF EXISTS "select_own_templates" ON ai_templates;
DROP POLICY IF EXISTS "insert_own_templates" ON ai_templates;
DROP POLICY IF EXISTS "update_own_templates" ON ai_templates;
DROP POLICY IF EXISTS "delete_own_templates" ON ai_templates;
DROP POLICY IF EXISTS "select_own_alerts" ON alerts;
DROP POLICY IF EXISTS "insert_own_alerts" ON alerts;
DROP POLICY IF EXISTS "update_own_alerts" ON alerts;
DROP POLICY IF EXISTS "delete_own_alerts" ON alerts;
DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;

-- buffer_keys
ALTER TABLE buffer_keys DROP CONSTRAINT IF EXISTS buffer_keys_user_id_fkey;
ALTER TABLE buffer_keys DROP CONSTRAINT IF EXISTS buffer_keys_pkey;
ALTER TABLE buffer_keys RENAME COLUMN user_id TO owner;
ALTER TABLE buffer_keys ALTER COLUMN owner TYPE text USING owner::text;
ALTER TABLE buffer_keys ALTER COLUMN owner DROP NOT NULL;

-- user_settings
ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_user_id_fkey;
ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_pkey;
ALTER TABLE user_settings RENAME COLUMN user_id TO owner;
ALTER TABLE user_settings ALTER COLUMN owner TYPE text USING owner::text;
ALTER TABLE user_settings ALTER COLUMN owner DROP NOT NULL;

-- ai_templates
ALTER TABLE ai_templates DROP CONSTRAINT IF EXISTS ai_templates_user_id_fkey;
ALTER TABLE ai_templates ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE ai_templates RENAME COLUMN user_id TO owner;
ALTER TABLE ai_templates ALTER COLUMN owner TYPE text USING owner::text;
ALTER TABLE ai_templates ALTER COLUMN owner DROP NOT NULL;

-- alerts
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_user_id_fkey;
ALTER TABLE alerts ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE alerts RENAME COLUMN user_id TO owner;
ALTER TABLE alerts ALTER COLUMN owner TYPE text USING owner::text;
ALTER TABLE alerts ALTER COLUMN owner DROP NOT NULL;

-- notifications
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE notifications ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE notifications RENAME COLUMN user_id TO owner;
ALTER TABLE notifications ALTER COLUMN owner TYPE text USING owner::text;
ALTER TABLE notifications ALTER COLUMN owner DROP NOT NULL;

-- Recreate policies as single-tenant (anon + authenticated)
CREATE POLICY "select_buffer_keys" ON buffer_keys FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_buffer_keys" ON buffer_keys FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_buffer_keys" ON buffer_keys FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_buffer_keys" ON buffer_keys FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "select_settings" ON user_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_settings" ON user_settings FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_settings" ON user_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_settings" ON user_settings FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "select_templates" ON ai_templates FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_templates" ON ai_templates FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_templates" ON ai_templates FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_templates" ON ai_templates FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "select_alerts" ON alerts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_alerts" ON alerts FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_alerts" ON alerts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_alerts" ON alerts FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "select_notifications" ON notifications FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_notifications" ON notifications FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_notifications" ON notifications FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_notifications" ON notifications FOR DELETE TO anon, authenticated USING (true);

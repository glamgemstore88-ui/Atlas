-- ChatGPT Bright Data scrape results.
-- Secrets stay in Supabase Edge Function environment variables; never expose them in the browser.
CREATE TABLE IF NOT EXISTS chatgpt_scrapes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt text NOT NULL,
  response text NOT NULL DEFAULT '',
  response_time numeric,
  ai_name text NOT NULL DEFAULT 'ChatGPT',
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chatgpt_scrapes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chatgpt_scrapes_read" ON chatgpt_scrapes;
CREATE POLICY "chatgpt_scrapes_read" ON chatgpt_scrapes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "chatgpt_scrapes_insert" ON chatgpt_scrapes;
CREATE POLICY "chatgpt_scrapes_insert" ON chatgpt_scrapes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_chatgpt_scrapes_created_at ON chatgpt_scrapes(created_at DESC);

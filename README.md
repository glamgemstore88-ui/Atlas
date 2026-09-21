# Atlas

## Bright Data ChatGPT scraper

The scraper is implemented as the `chatgpt-scrape` Supabase Edge Function. It keeps both provider credentials server-side, forces `web_search: true`, normalizes response text/citations/URLs/response time, and inserts completed rows into `chatgpt_scrapes`.

Set these Supabase Edge Function secrets (do not put them in Vite env vars):

```bash
supabase secrets set BRIGHTDATA_API_KEY=... SUPABASE_SERVICE_ROLE_KEY=...
supabase db push
supabase functions deploy chatgpt-scrape
```

Run the frontend locally with `npm install && npm run dev`. Add the public Supabase URL and anon key to `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

For Vercel, import this repository, set those two public Vite variables, and deploy the Vite project. Never commit provider, Supabase service-role, or Vercel tokens; rotate any credentials that have been posted in chat or source control.

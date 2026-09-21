// Bright Data ChatGPT scraper. Deploy with: supabase functions deploy chatgpt-scrape
// Required server-side secrets: BRIGHTDATA_API_KEY, SUPABASE_SERVICE_ROLE_KEY.
// The Bright Data key is deliberately never sent to the browser.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const DATASET_ID = "gd_m7aof0k82r803d5bjm";
const BRIGHTDATA_URL = `https://api.brightdata.com/datasets/v3/scrape?dataset_id=${DATASET_ID}&notify=false&include_errors=true`;

type Input = { prompt: string; country?: string; additional_prompt?: string; web_search?: boolean };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function text(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) if (row[key] !== undefined && row[key] !== null) return String(row[key]);
  return "";
}
function sources(row: Record<string, unknown>): string[] {
  const value = row.sources ?? row.citations ?? row.urls ?? row.source_urls;
  if (Array.isArray(value)) return value.map(String).filter((url) => /^https?:\/\//i.test(url));
  if (typeof value === "string") {
    try { return sources({ value: JSON.parse(value) }); } catch { return [...value.matchAll(/https?:\/\/[^\s\]"')>]+/gi)].map((m) => m[0]); }
  }
  return [...text(row, "response", "answer").matchAll(/https?:\/\/[^\s\]"')>]+/gi)].map((m) => m[0]);
}
function normalize(raw: unknown, fallbackPrompt: string, elapsed: number) {
  const rows = array(raw).length ? array(raw) : (raw && typeof raw === "object" ? [raw] : []);
  return rows.map((item) => {
    const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
    return {
      prompt: text(row, "prompt") || fallbackPrompt,
      response: text(row, "response", "answer", "content", "text"),
      response_time: Number(text(row, "response_time", "responseTime")) || Number((elapsed / 1000).toFixed(2)),
      ai_name: text(row, "ai_name", "aiName", "model") || "ChatGPT",
      sources: sources(row),
      metadata: { ...metadata, dataset_id: DATASET_ID, bright_data_triggered: true, web_search: true, status: "completed" },
      snapshot: text(row, "snapshot", "snapshot_id") || null,
    };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  try {
    const key = Deno.env.get("BRIGHTDATA_API_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!key || !serviceKey) return json({ error: "Server is not configured. Add Bright Data and Supabase secrets." }, 500);
    const body = await req.json();
    const prompts: Input[] = Array.isArray(body?.prompts) ? body.prompts : body?.prompt ? [{ prompt: body.prompt }] : [];
    if (!prompts.length || prompts.some((p) => !p?.prompt?.trim())) return json({ error: "Provide at least one prompt." }, 400);
    if (prompts.length > 25) return json({ error: "A maximum of 25 prompts is allowed per request." }, 400);

    const started = performance.now();
    const upstream = await fetch(BRIGHTDATA_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ input: prompts.map((p) => ({ url: "https://chatgpt.com/", prompt: p.prompt.trim(), country: p.country ?? "", web_search: true, additional_prompt: p.additional_prompt ?? "" })), limit_per_input: null }),
    });
    const rawText = await upstream.text();
    let raw: unknown;
    try { raw = JSON.parse(rawText); } catch { raw = { error: rawText }; }
    if (!upstream.ok) return json({ error: "Bright Data request failed", status: upstream.status, detail: raw }, upstream.status);

    const results = normalize(raw, prompts[0].prompt, performance.now() - started);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
    const { data, error } = await supabase.from("chatgpt_scrapes").insert(results).select("*");
    if (error) return json({ error: "Supabase insert failed", detail: error.message, results }, 500);
    return json({ results: data ?? [], count: data?.length ?? 0 });
  } catch (error) {
    return json({ error: "Internal scraper error", detail: error instanceof Error ? error.message : String(error) }, 500);
  }
});

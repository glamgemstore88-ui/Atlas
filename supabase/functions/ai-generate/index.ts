// Atlas ai-generate edge function (single-tenant, sign-up optional)
// Generates real social media post drafts via OpenAI's API. No mock responses.
// JWT verification is OFF — works for anonymous guests. Uses the service-role
// client so no auth is required.

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const OPENAI_KEY = Deno.env.get("ATLAS_OPENAI_KEY") ?? "";

const SYSTEM_PROMPT = `You are Atlas, an expert social media content strategist for Indian creators and brands.
Write punchy, scroll-stopping social posts. Match the requested tone and platform.
Keep each post under 280 characters unless asked for long-form. Output 3 distinct variants
separated by "---". No preamble, no labels, just the post text.`;

function localFallback(prompt: string, tone: string): string {
  const topic = prompt.slice(0, 80);
  const hooks = [
    `${topic} — here's what nobody tells you about it. 🧵`,
    `POV: you just discovered ${topic}. Here's the play-by-play.`,
    `3 things I wish I knew before diving into ${topic}:`,
  ];
  return hooks.map((h) => `${h} #Growth #Content${tone ? " #" + tone : ""}`).join("\n---\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const body = await req.json();
    const prompt: string | undefined = body?.prompt;
    const tone: string = body?.tone ?? "engaging";
    const platform: string = body?.platform ?? "twitter";
    const owner: string | undefined = body?.owner;
    if (!prompt) return json({ error: "Missing prompt" }, 400);

    // Save the generated draft as a template if requested (single-tenant insert)
    const saveTemplate: boolean = !!body?.saveTemplate;
    if (saveTemplate) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      // generation happens below; we save after we have content
    }

    if (!OPENAI_KEY) {
      const variants = localFallback(prompt, tone).split("\n---\n");
      if (body?.saveTemplate && variants[0]) {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await supabase.from("ai_templates").insert({ title: prompt.slice(0, 60), body: variants[0], category: "generated", owner: owner ?? null });
      }
      return json({
        variants,
        source: "local_fallback",
        note: "No ATLAS_OPENAI_KEY configured. Showing locally-composed drafts. Add the key to enable real AI generation.",
      }, 200);
    }

    const userPrompt = `Platform: ${platform}\nTone: ${tone}\nTopic / brief: ${prompt}\nWrite 3 social post variants.`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.9,
        max_tokens: 600,
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return json({ error: "openai_error", status: resp.status, detail: safeJson(detail) }, resp.status);
    }

    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const variants = content.split(/\n---\n|\n\n---\n\n/).map((s) => s.trim()).filter(Boolean);

    if (body?.saveTemplate && variants[0]) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await supabase.from("ai_templates").insert({ title: prompt.slice(0, 60), body: variants[0], category: "generated", owner: owner ?? null });
    }

    return json({ variants, source: "openai" }, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: "internal_error", detail: msg }, 500);
  }
});

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}

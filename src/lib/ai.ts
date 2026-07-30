// Atlas AI client — calls the ai-generate edge function for real generation.
import { supabase, EDGE_BASE } from "./supabase";
import type { AIGenerateResponse } from "./types";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  };
  if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;
  return headers;
}

export async function generateContent(
  prompt: string,
  opts: { tone?: string; platform?: string } = {},
): Promise<{ data: AIGenerateResponse | null; error: string | null }> {
  const headers = await getAuthHeaders();
  const resp = await fetch(`${EDGE_BASE}/ai-generate`, {
    method: "POST",
    headers,
    body: JSON.stringify({ prompt, tone: opts.tone ?? "engaging", platform: opts.platform ?? "twitter" }),
  });
  const parsed = await resp.json().catch(() => ({ error: "Invalid response" }));
  if (!resp.ok) return { data: null, error: parsed?.error ?? `Failed (${resp.status})` };
  return { data: parsed as AIGenerateResponse, error: null };
}

export async function checkAlerts(): Promise<{ checked?: number; notifications?: number; error?: string }> {
  const headers = await getAuthHeaders();
  const resp = await fetch(`${EDGE_BASE}/alerts-check`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  const parsed = await resp.json().catch(() => ({ error: "Invalid response" }));
  if (!resp.ok) return { error: parsed?.error ?? `Failed (${resp.status})` };
  return { checked: parsed.checked, notifications: parsed.notifications };
}

// Atlas buffer-proxy edge function (single-tenant, sign-up optional)
// Proxies all authentic Buffer GraphQL API calls (api.buffer.com) using the
// decrypted personal API key (BYOK). The key is stored AES-256-GCM encrypted
// in a single shared buffer_keys row. Performs real HTTP requests to Buffer
// and returns the real response. No mock data, no simulated timeouts.
//
// JWT verification is OFF — the app works for anonymous guests. We use the
// service-role client to read/decrypt the single shared key row (bypassing
// RLS). The key itself is still encrypted at rest; only ciphertext is stored.

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ENCRYPTION_KEY = Deno.env.get("ATLAS_ENCRYPTION_KEY") ?? "atlas-default-encryption-key-32b!!"; // 32+ bytes fallback for dev

function toBytes(str: string): Uint8Array { return new TextEncoder().encode(str); }
function fromBytes(bytes: Uint8Array): string { return new TextDecoder().decode(bytes); }
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function deriveKey(): Promise<CryptoKey> {
  const km = await crypto.subtle.importKey("raw", toBytes(ENCRYPTION_KEY), { name: "PBKDF2" }, false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: toBytes("atlas-buffer-key-salt"), iterations: 100000, hash: "SHA-256" },
    km, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  );
}

async function decryptKey(ciphertextB64: string, ivB64: string, authTagB64: string): Promise<string> {
  const key = await deriveKey();
  const iv = base64ToBytes(ivB64);
  const ct = base64ToBytes(ciphertextB64);
  const tag = base64ToBytes(authTagB64);
  const combined = new Uint8Array(ct.length + tag.length);
  combined.set(ct, 0); combined.set(tag, ct.length);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, combined);
  return fromBytes(new Uint8Array(plain));
}

async function encryptKey(plaintext: string): Promise<{ ciphertext: string; iv: string; auth_tag: string }> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, toBytes(plaintext));
  const combined = new Uint8Array(enc);
  const ciphertext = combined.slice(0, combined.length - 16);
  const authTag = combined.slice(combined.length - 16);
  return { ciphertext: bytesToBase64(ciphertext), iv: bytesToBase64(iv), auth_tag: bytesToBase64(authTag) };
}

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabase = adminClient();
    const body = await req.json();
    const action: string = body?.action ?? "graphql";

    // ---- SAVE-KEY: encrypt + upsert the single shared key row ----
    if (action === "save-key") {
      const plaintext: string | undefined = body?.apiKey;
      const owner: string | undefined = body?.owner; // optional: email if signed in
      if (!plaintext) return json({ error: "Missing apiKey" }, 400);
      // Validate the key is real by making a live Buffer API call before saving.
      const verify = await fetch("https://api.buffer.com", {
        method: "POST",
        headers: { "Authorization": `Bearer ${plaintext}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: "query { account { id email name } }" }),
      });
      if (!verify.ok) {
        const detail = await verify.text();
        return json({ error: "invalid_buffer_key", status: verify.status, detail: safeJson(detail) }, 400);
      }
      const enc = await encryptKey(plaintext);
      const hint = plaintext.length > 6 ? plaintext.slice(0, 4) + "…" : "…";
      // Single shared row: clear any existing rows, then insert one fresh row.
      await supabase.from("buffer_keys").delete().gte("created_at", "1970-01-01T00:00:00Z");
      const { error: insErr } = await supabase
        .from("buffer_keys")
        .insert({ ciphertext: enc.ciphertext, iv: enc.iv, auth_tag: enc.auth_tag, hint, owner: owner ?? null });
      if (insErr) return json({ error: "Failed to save key: " + insErr.message }, 500);
      const acctJson = await verify.json();
      return json({ ok: true, account: acctJson?.data?.account ?? null }, 200);
    }

    // ---- DELETE-KEY ----
    if (action === "delete-key") {
      await supabase.from("buffer_keys").delete().gte("created_at", "1970-01-01T00:00:00Z");
      return json({ ok: true }, 200);
    }

    // ---- KEY-STATUS ----
    if (action === "key-status") {
      const { data: kr } = await supabase
        .from("buffer_keys").select("hint, created_at, updated_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
      return json({ linked: !!kr, hint: kr?.hint ?? null, updated_at: kr?.updated_at ?? null }, 200);
    }

    // ---- default: GraphQL proxy ----
    const { data: keyRow, error: keyErr } = await supabase
      .from("buffer_keys")
      .select("ciphertext, iv, auth_tag")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (keyErr) return json({ error: "Failed to load key: " + keyErr.message }, 500);
    if (!keyRow) return json({ error: "no_buffer_key" }, 400);

    let bufferKey: string;
    try { bufferKey = await decryptKey(keyRow.ciphertext, keyRow.iv, keyRow.auth_tag); }
    catch { return json({ error: "Failed to decrypt Buffer key" }, 500); }

    const query: string | undefined = body?.query;
    const variables: Record<string, unknown> | undefined = body?.variables;
    if (!query) return json({ error: "Missing GraphQL query" }, 400);

    const resp = await fetch("https://api.buffer.com", {
      method: "POST",
      headers: { "Authorization": `Bearer ${bufferKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });

    const text = await resp.text();
    if (!resp.ok) {
      return json({ error: "buffer_api_error", status: resp.status, detail: safeJson(text) }, resp.status);
    }
    return new Response(text, { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

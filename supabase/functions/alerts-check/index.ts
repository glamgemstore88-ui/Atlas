// Atlas alerts-check edge function (single-tenant, sign-up optional)
// Runs real engagement-threshold checks against the live Buffer posts.
// Uses the service-role client (no JWT required) to read the single shared
// buffer_keys row, decrypt it, fetch sent posts from Buffer, aggregate metrics,
// and create real notification rows when thresholds are crossed. No mock alerts.

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ENCRYPTION_KEY = Deno.env.get("ATLAS_ENCRYPTION_KEY") ?? "atlas-default-encryption-key-32b!!";

function toBytes(str: string): Uint8Array { return new TextEncoder().encode(str); }
function fromBytes(bytes: Uint8Array): string { return new TextDecoder().decode(bytes); }
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function deriveKey(): Promise<CryptoKey> {
  const km = await crypto.subtle.importKey("raw", toBytes(ENCRYPTION_KEY), { name: "PBKDF2" }, false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: toBytes("atlas-buffer-key-salt"), iterations: 100000, hash: "SHA-256" },
    km, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  );
}
async function decryptKey(c: string, iv: string, tag: string): Promise<string> {
  const key = await deriveKey();
  const ivB = base64ToBytes(iv);
  const ct = base64ToBytes(c);
  const tg = base64ToBytes(tag);
  const combined = new Uint8Array(ct.length + tg.length);
  combined.set(ct, 0); combined.set(tg, ct.length);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivB }, key, combined);
  return fromBytes(new Uint8Array(plain));
}

async function bufferGraphQL(bufferKey: string, query: string, variables?: Record<string, unknown>): Promise<any> {
  const resp = await fetch("https://api.buffer.com", {
    method: "POST",
    headers: { "Authorization": `Bearer ${bufferKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`Buffer API ${resp.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

interface AlertRow {
  id: string; owner: string | null; name: string; metric: string; operator: string;
  threshold: number; channel_id: string | null; enabled: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Load + decrypt the single shared Buffer key
    const { data: keyRow } = await supabase
      .from("buffer_keys").select("ciphertext, iv, auth_tag").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!keyRow) return json({ error: "no_buffer_key" }, 400);
    let bufferKey: string;
    try { bufferKey = await decryptKey(keyRow.ciphertext, keyRow.iv, keyRow.auth_tag); }
    catch { return json({ error: "decrypt_failed" }, 500); }

    // Get account + organizations
    const acct = await bufferGraphQL(bufferKey, `query { account { organizations { id name } } }`);
    const orgs = acct?.data?.account?.organizations ?? [];
    if (!orgs.length) return json({ checked: 0, notifications: 0, reason: "no_organizations" });

    // Load all enabled alerts (single-tenant)
    const { data: alerts } = await supabase
      .from("alerts").select("*").eq("enabled", true);
    if (!alerts || alerts.length === 0) return json({ checked: 0, notifications: 0 });

    let checked = 0;
    let created = 0;

    for (const org of orgs) {
      const orgId: string = org.id;
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const postsQuery = `query($org: OrganizationId!, $since: DateTime) {
        posts(first: 50, input: { organizationId: $org, filter: { status: [sent], startDate: $since } }) {
          edges { node { id text sentAt channelId channel { id service name avatar } metrics { name value } } }
        }
      }`;
      let postsData: any;
      try { postsData = await bufferGraphQL(bufferKey, postsQuery, { org: orgId, since }); }
      catch { continue; }
      const edges = postsData?.data?.posts?.edges ?? [];
      const posts = edges.map((e: any) => e.node);

      for (const alert of alerts as AlertRow[]) {
        const scoped = alert.channel_id ? posts.filter((p: any) => p.channelId === alert.channel_id) : posts;
        if (!scoped.length) { checked++; continue; }

        const total = scoped.reduce((sum: number, p: any) => {
          const m = (p.metrics ?? []).find((x: any) => String(x.name).toLowerCase() === alert.metric.toLowerCase());
          return sum + (m ? Number(m.value) || 0 : 0);
        }, 0);

        const breached = alert.operator === "gte" ? total >= alert.threshold : total <= alert.threshold;
        checked++;

        if (breached) {
          const since24 = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
          const { data: existing } = await supabase
            .from("notifications").select("id").eq("alert_id", alert.id)
            .gte("created_at", since24).maybeSingle();
          if (existing) continue;

          const title = `Alert: ${alert.name}`;
          const body = `Metric "${alert.metric}" reached ${total} (${alert.operator} ${alert.threshold})${alert.channel_id ? " on a channel" : " across all channels"}.`;
          await supabase.from("notifications").insert({
            alert_id: alert.id, title, body, severity: "warning", read: false, owner: alert.owner ?? null,
          });
          await supabase.from("alerts").update({ last_checked: new Date().toISOString() }).eq("id", alert.id);
          created++;
        } else {
          await supabase.from("alerts").update({ last_checked: new Date().toISOString() }).eq("id", alert.id);
        }
      }
    }

    return json({ checked, notifications: created }, 200);
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

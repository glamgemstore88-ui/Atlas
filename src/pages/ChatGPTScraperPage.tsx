import { useEffect, useState } from "react";
import { Loader2, Search, ExternalLink, Clock3, Database, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Scrape = { id: string; prompt: string; response: string; response_time: number | null; ai_name: string; sources: string[]; snapshot: string | null; created_at: string };

export function ChatGPTScraperPage() {
  const [prompt, setPrompt] = useState("");
  const [results, setResults] = useState<Scrape[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => { loadRecent(); }, []);
  async function loadRecent() {
    const { data } = await supabase.from("chatgpt_scrapes").select("*").order("created_at", { ascending: false }).limit(20);
    setResults((data ?? []) as Scrape[]);
  }
  async function scrape() {
    if (!prompt.trim()) return;
    setBusy(true); setError(null); setNotice(null);
    const { data, error: invokeError } = await supabase.functions.invoke("chatgpt-scrape", { body: { prompt: prompt.trim() } });
    setBusy(false);
    if (invokeError || data?.error) { setError(invokeError?.message ?? data.error); return; }
    setPrompt(""); setNotice(`Saved ${data.count} result${data.count === 1 ? "" : "s"} to Supabase.`);
    await loadRecent();
  }
  return <div className="space-y-6">
    <div><h1 className="text-xl font-semibold text-white">ChatGPT Web Scraper</h1><p className="text-sm text-white/50 mt-1">Bright Data live web search is enabled for every prompt. Results and citations are saved automatically.</p></div>
    <div className="card p-5">
      <label className="label block mb-2">Ask ChatGPT</label>
      <textarea className="input min-h-32 resize-y" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. What are the latest business trends?" onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") scrape(); }} />
      <div className="mt-3 flex items-center justify-between"><span className="text-xs text-accent">Live web search: ON</span><button onClick={scrape} disabled={busy || !prompt.trim()} className="btn-primary">{busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} {busy ? "Scraping…" : "Search ChatGPT"}</button></div>
      {notice && <p className="mt-3 flex items-center gap-2 text-xs text-accent"><CheckCircle2 size={14} />{notice}</p>}
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </div>
    <div className="space-y-3"><div className="flex items-center gap-2 text-sm font-semibold text-white"><Database size={15} className="text-atlas-300" />Recent saved responses</div>
      {results.length === 0 ? <div className="card p-8 text-center text-sm text-white/40">No scrape results yet.</div> : results.map((item) => <article key={item.id} className="card p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-medium text-white">{item.prompt}</h2><span className="flex items-center gap-1 text-xs text-white/40"><Clock3 size={13} />{item.response_time ?? "—"}s</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/70">{item.response}</p><div className="mt-4 flex flex-wrap gap-2">{(item.sources ?? []).map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-white/[0.08] px-2.5 py-1 text-xs text-atlas-300 hover:text-white"><ExternalLink size={11} />{url}</a>)}</div></article>)}
    </div>
  </div>;
}

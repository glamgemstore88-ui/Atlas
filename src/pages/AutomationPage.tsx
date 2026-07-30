// Automation page — smart scheduling recommendations + threshold alerts (real).

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Bell, Plus, Trash2, Loader2, Play, Clock, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAtlas } from "@/lib/context";
import { computeBestTimes } from "@/lib/analytics";
import { checkAlerts } from "@/lib/ai";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/components/Modal";
import { ServiceIcon } from "@/components/ServiceIcon";
import type { AlertRow, NotificationRow } from "@/lib/types";
import { EmptyState } from "@/components/EmptyState";

export function AutomationPage() {
  const { t, posts, channels, keyLinked, user, dataLoading } = useAtlas();
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);

  async function loadAlerts() {
    const { data } = await supabase.from("alerts").select("*").order("created_at", { ascending: false });
    setAlerts((data ?? []) as AlertRow[]);
    const { data: notifs } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(20);
    setNotifications((notifs ?? []) as NotificationRow[]);
  }

  useEffect(() => { if (keyLinked) loadAlerts(); }, [keyLinked]);

  const bestTimes = computeBestTimes(posts);

  if (!keyLinked) return <EmptyState variant="nokey" onNavigate={() => {}} />;

  async function runCheck() {
    setChecking(true); setCheckResult(null);
    const res = await checkAlerts();
    setChecking(false);
    if (res.error) setCheckResult(`Check failed: ${res.error}`);
    else setCheckResult(`Checked ${res.checked} alert${res.checked === 1 ? "" : "s"} · ${res.notifications} new notification${res.notifications === 1 ? "" : "s"}.`);
    await loadAlerts();
  }

  async function toggleAlert(a: AlertRow) {
    await supabase.from("alerts").update({ enabled: !a.enabled }).eq("id", a.id);
    await loadAlerts();
  }
  async function deleteAlert(id: string) {
    await supabase.from("alerts").delete().eq("id", id);
    await loadAlerts();
  }
  async function markAllRead() {
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    await loadAlerts();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">{t("automation.title")}</h1>
        <p className="text-sm text-white/50 mt-0.5">{t("automation.subtitle")}</p>
      </div>

      {/* smart scheduling */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Zap size={16} className="text-accent" />
          <h3 className="text-sm font-semibold text-white">{t("automation.smartSchedule")}</h3>
        </div>
        <p className="text-xs text-white/50 mb-4">{t("automation.smartScheduleDesc")}</p>
        {dataLoading && posts.length === 0 ? (
          <div className="skeleton h-24 w-full" />
        ) : bestTimes.length === 0 ? (
          <div className="text-sm text-white/40 py-6 text-center">Not enough sent-post history yet. Post a few times and Atlas will compute your best windows.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {bestTimes.slice(0, 6).map((bt, i) => (
              <motion.div
                key={bt.hour}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-white">{formatHour(bt.hour)}</span>
                  {i === 0 && <span className="text-[9px] uppercase tracking-wide text-accent">Best</span>}
                </div>
                <div className="text-xs text-white/40">{bt.posts} posts · {bt.score} eng.</div>
                <div className="mt-2 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-atlas-400 to-accent" style={{ width: `${(bt.score / bestTimes[0].score) * 100}%` }} />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* alerts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-atlas-300" />
                <h3 className="text-sm font-semibold text-white">{t("automation.alerts")}</h3>
              </div>
              <button onClick={() => setAddOpen(true)} className="btn-secondary text-xs px-3 py-1.5">
                <Plus size={14} /> {t("automation.addAlert")}
              </button>
            </div>
            <p className="text-xs text-white/50 mb-4">{t("automation.alertsDesc")}</p>

            {alerts.length === 0 ? (
              <div className="text-sm text-white/40 py-6 text-center">No alerts configured yet.</div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence>
                  {alerts.map((a) => (
                    <motion.div
                      key={a.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                    >
                      <button onClick={() => toggleAlert(a)} className={`h-5 w-9 rounded-full transition-colors ${a.enabled ? "bg-accent" : "bg-white/15"}`}>
                        <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${a.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white/90">{a.name}</div>
                        <div className="text-xs text-white/40">
                          {a.metric} {a.operator === "gte" ? "≥" : "≤"} {a.threshold}
                          {a.channel_id && " · specific channel"}
                        </div>
                      </div>
                      <button onClick={() => deleteAlert(a.id)} className="rounded-md p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-white/[0.08]">
              <button onClick={runCheck} disabled={checking || alerts.length === 0} className="btn-secondary w-full text-xs">
                {checking ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {t("automation.runCheck")}
              </button>
              {checkResult && <p className="mt-2 text-xs text-white/50 text-center">{checkResult}</p>}
            </div>
          </div>
        </div>

        {/* notifications */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">{t("notifications.title")}</h3>
            {notifications.some((n) => !n.read) && (
              <button onClick={markAllRead} className="text-xs text-atlas-300 hover:text-atlas-200">{t("notifications.markRead")}</button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="text-sm text-white/40 py-6 text-center">{t("notifications.empty")}</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {notifications.map((n) => (
                <div key={n.id} className={`rounded-lg border p-3 ${n.read ? "border-white/[0.04] bg-transparent" : "border-amber-500/15 bg-amber-500/5"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`h-1.5 w-1.5 rounded-full ${severityColor(n.severity)}`} />
                    <span className="text-xs font-medium text-white/90">{n.title}</span>
                    {!n.read && <span className="ml-auto text-[9px] uppercase tracking-wide text-amber-400">new</span>}
                  </div>
                  <p className="text-xs text-white/50">{n.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AddAlertModal open={addOpen} onClose={() => setAddOpen(false)} channels={channels} onSaved={loadAlerts} />
    </div>
  );
}

function AddAlertModal({ open, onClose, channels, onSaved }: { open: boolean; onClose: () => void; channels: any[]; onSaved: () => Promise<void> }) {
  const { t } = useAtlas();
  const [name, setName] = useState("");
  const [metric, setMetric] = useState("reactions");
  const [operator, setOperator] = useState<"gte" | "lte">("gte");
  const [threshold, setThreshold] = useState(100);
  const [channelId, setChannelId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null); setBusy(true);
    const owner = (await supabase.auth.getUser()).data.user?.email ?? null;
    const { error } = await supabase.from("alerts").insert({
      owner, name: name || `${metric} alert`, metric, operator, threshold,
      channel_id: channelId || null, enabled: true,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setName(""); setThreshold(100); setChannelId("");
    await onSaved();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={t("automation.addAlert")} subtitle="Get notified when a metric crosses a threshold" maxWidth="max-w-md">
      <div className="space-y-4">
        <div>
          <label className="label block mb-1.5">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. High engagement" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label block mb-1.5">Metric</label>
            <select className="input" value={metric} onChange={(e) => setMetric(e.target.value)}>
              <option value="reactions">Reactions</option>
              <option value="comments">Comments</option>
              <option value="clicks">Clicks</option>
              <option value="impressions">Impressions</option>
              <option value="reach">Reach</option>
            </select>
          </div>
          <div>
            <label className="label block mb-1.5">Condition</label>
            <select className="input" value={operator} onChange={(e) => setOperator(e.target.value as "gte" | "lte")}>
              <option value="gte">≥ at least</option>
              <option value="lte">≤ at most</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label block mb-1.5">Threshold</label>
          <input type="number" className="input" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
        </div>
        <div>
          <label className="label block mb-1.5">Channel (optional)</label>
          <select className="input" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
            <option value="">All channels</option>
            {channels.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.service}</option>)}
          </select>
        </div>
        {err && <div className="flex items-center gap-2 text-sm text-red-400"><AlertCircle size={14} />{err}</div>}
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">{t("common.cancel")}</button>
          <button onClick={save} disabled={busy} className="btn-primary flex-1">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {t("common.save")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function formatHour(h: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${ampm}`;
}

function severityColor(s: string): string {
  return { info: "bg-atlas-400", warning: "bg-amber-400", error: "bg-red-400", success: "bg-accent" }[s] ?? "bg-white/40";
}

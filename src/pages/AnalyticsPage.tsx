// Analytics page — real charts powered by Buffer post metrics + aggregated metrics.

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { TrendingUp, Eye, Heart, MessageSquare, FileText, AlertCircle } from "lucide-react";
import { useAtlas } from "@/lib/context";
import {
  recentSentPosts, perChannelMetrics, dailyEngagementSeries, metricValue, aggregatedTotal,
} from "@/lib/analytics";
import { getAggregatedMetrics } from "@/lib/buffer";
import { useEffect, useState } from "react";
import type { AggregatedMetric } from "@/lib/types";
import { ServiceIcon } from "@/components/ServiceIcon";
import { EmptyState } from "@/components/EmptyState";

const PIE_COLORS = ["#0091ff", "#00E5A0", "#f5a623", "#a78bfa", "#ee1d52", "#6364ff"];

export function AnalyticsPage() {
  const { t, posts, channels, dataLoading, keyLinked, account, dataError } = useAtlas();
  const [agg, setAgg] = useState<AggregatedMetric[]>([]);
  const [aggLoading, setAggLoading] = useState(false);

  useEffect(() => {
    if (!keyLinked || !account?.organizations?.length) return;
    setAggLoading(true);
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    Promise.all(
      account.organizations.map((o) => getAggregatedMetrics({ organizationId: o.id, startDate: since })),
    ).then((results) => {
      // merge by metric name
      const merged: Record<string, number> = {};
      for (const r of results) {
        for (const m of r.metrics) merged[m.name] = (merged[m.name] ?? 0) + (Number(m.value) || 0);
      }
      setAgg(Object.entries(merged).map(([name, value]) => ({ name, value })));
    }).finally(() => setAggLoading(false));
  }, [keyLinked, account]);

  const sent = useMemo(() => recentSentPosts(posts, 30), [posts]);
  const byChannel = useMemo(() => perChannelMetrics(sent, channels).filter((c) => c.posts > 0), [sent, channels]);
  const series = useMemo(() => dailyEngagementSeries(posts, 14), [posts]);

  if (!keyLinked) return <EmptyState variant="nokey" onNavigate={() => {}} />;

  const totalPosts = sent.length || aggregatedTotal(agg, "postCount");
  const totalReactions = byChannel.reduce((s, c) => s + c.reactions, 0) || aggregatedTotal(agg, "reactions");
  const totalComments = byChannel.reduce((s, c) => s + c.comments, 0) || aggregatedTotal(agg, "comments");
  const totalImpressions = byChannel.reduce((s, c) => s + c.impressions, 0) || aggregatedTotal(agg, "impressions") || aggregatedTotal(agg, "reach");

  const loading = (dataLoading && posts.length === 0) || aggLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">{t("analytics.title")}</h1>
        <p className="text-sm text-white/50 mt-0.5">{t("analytics.subtitle")}</p>
      </div>

      {dataError && posts.length === 0 && !aggLoading ? (
        <div className="card p-8 text-center">
          <AlertCircle size={24} className="text-red-400/60 mx-auto mb-2" />
          <p className="text-sm text-white/50">{dataError}</p>
        </div>
      ) : sent.length === 0 && !loading ? (
        <EmptyState variant="nodata" />
      ) : (
        <>
          {/* summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Metric icon={FileText} label={t("analytics.totalPosts")} value={totalPosts} delay={0} loading={loading} />
            <Metric icon={Eye} label={t("analytics.reach")} value={fmt(totalImpressions)} delay={0.05} loading={loading} />
            <Metric icon={Heart} label={t("analytics.reactions")} value={fmt(totalReactions)} delay={0.1} loading={loading} />
            <Metric icon={MessageSquare} label={t("analytics.comments")} value={fmt(totalComments)} delay={0.15} loading={loading} />
          </div>

          {/* engagement over time */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
            <h3 className="text-sm font-semibold text-white mb-1">{t("analytics.overTime")}</h3>
            <p className="text-xs text-white/40 mb-4">Last 14 days</p>
            {loading ? <div className="skeleton h-64 w-full" /> : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={series} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00E5A0" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#00E5A0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="engagement" stroke="#00E5A0" strokeWidth={2} dot={{ r: 3, fill: "#00E5A0" }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* by channel */}
          <div className="grid lg:grid-cols-2 gap-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-1">{t("analytics.byChannel")}</h3>
              <p className="text-xs text-white/40 mb-4">Engagement distribution</p>
              {loading || byChannel.length === 0 ? (
                <div className="h-64 grid place-items-center text-sm text-white/30">No channel data</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={byChannel.map((c) => ({ name: c.channel.name, value: c.reactions + c.comments + c.clicks }))} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                      {byChannel.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#0A0A0A" strokeWidth={2} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-1">Posts per channel</h3>
              <p className="text-xs text-white/40 mb-4">Sent in last 30 days</p>
              {loading || byChannel.length === 0 ? (
                <div className="h-64 grid place-items-center text-sm text-white/30">No channel data</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={byChannel.map((c) => ({ name: c.channel.name, posts: c.posts, reactions: c.reactions }))} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Bar dataKey="posts" fill="#0091ff" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </motion.div>
          </div>

          {/* channel list with service icons */}
          {byChannel.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Channel breakdown</h3>
              <div className="space-y-2">
                {byChannel.map((c) => (
                  <div key={c.channel.id} className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <img src={c.channel.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm text-white/90">
                        <ServiceIcon service={c.channel.service} size={12} />
                        <span className="truncate">{c.channel.name}</span>
                      </div>
                      <div className="text-xs text-white/40 mt-0.5">{c.posts} posts · {fmt(c.impressions)} reach</div>
                    </div>
                    <div className="flex gap-4 text-right">
                      <MiniStat label="reactions" value={fmt(c.reactions)} />
                      <MiniStat label="comments" value={fmt(c.comments)} />
                      <MiniStat label="clicks" value={fmt(c.clicks)} />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value, delay, loading }: { icon: typeof TrendingUp; label: string; value: string | number; delay: number; loading?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/50">{label}</span>
        <Icon size={15} className="text-atlas-300" />
      </div>
      {loading ? <div className="skeleton h-6 w-16" /> : <div className="text-xl font-semibold text-white tabular-nums">{value}</div>}
    </motion.div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm font-medium text-white tabular-nums">{value}</div>
      <div className="text-[10px] text-white/30 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/[0.1] bg-ink-900/95 backdrop-blur px-3 py-2 shadow-card">
      {label && <div className="text-xs text-white/50 mb-1">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="text-sm text-white font-medium tabular-nums" style={{ color: p.color }}>
          {p.name}: {fmt(Number(p.value))}
        </div>
      ))}
    </div>
  );
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(Math.round(n));
}

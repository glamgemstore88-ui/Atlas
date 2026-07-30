// Reusable stat card for the Overview header.

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  icon: Icon, label, value, sub, accent = "atlas", delay = 0, loading,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  accent?: "atlas" | "accent" | "amber" | "violet";
  delay?: number;
  loading?: boolean;
}) {
  const accentColor = {
    atlas: "text-atlas-300",
    accent: "text-accent",
    amber: "text-amber-400",
    violet: "text-violet-400",
  }[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] }}
      className="card card-hover p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-white/50">{label}</span>
        <Icon size={16} className={accentColor} />
      </div>
      {loading ? (
        <div className="skeleton h-7 w-20" />
      ) : (
        <div className="text-2xl font-semibold text-white tabular-nums">{value}</div>
      )}
      {sub && !loading && <div className="text-xs text-white/40 mt-1">{sub}</div>}
    </motion.div>
  );
}

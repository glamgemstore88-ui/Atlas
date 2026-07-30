// Vercel-style left sidebar navigation for Atlas.

import { motion } from "framer-motion";
import { LayoutDashboard, ListChecks, BarChart3, Zap, Settings as SettingsIcon, Sparkles, LogIn, LogOut, Crown } from "lucide-react";
import { useAtlas } from "@/lib/context";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { PricingModal } from "./PricingModal";
import type { Session } from "@supabase/supabase-js";

export type Page = "overview" | "queue" | "analytics" | "automation" | "settings";

interface NavItem { key: Page; icon: typeof LayoutDashboard; labelKey: string }

const NAV: NavItem[] = [
  { key: "overview", icon: LayoutDashboard, labelKey: "nav.overview" },
  { key: "queue", icon: ListChecks, labelKey: "nav.queue" },
  { key: "analytics", icon: BarChart3, labelKey: "nav.analytics" },
  { key: "automation", icon: Zap, labelKey: "nav.automation" },
  { key: "settings", icon: SettingsIcon, labelKey: "nav.settings" },
];

export function Sidebar({
  page, onNavigate, onShowAuth, session, userEmail, onSignOut,
}: {
  page: Page; onNavigate: (p: Page) => void;
  onShowAuth: () => void;
  session: Session | null;
  userEmail: string | null;
  onSignOut: () => Promise<void>;
}) {
  const { t, keyLinked } = useAtlas();
  const [unread, setUnread] = useState(0);
  const [pricingOpen, setPricingOpen] = useState(false);

  useEffect(() => {
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("read", false)
      .then(({ count }) => setUnread(count ?? 0));
  }, [page]);

  return (
    <>
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-white/[0.08] bg-ink-900/60 backdrop-blur-xl">
      {/* brand */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/[0.08]">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-gradient-to-br from-atlas-400 to-accent">
          <Sparkles size={16} className="text-black" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">Atlas</div>
          <div className="text-[10px] text-white/40">Social AI Agent</div>
        </div>
      </div>

      {/* nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map((item) => {
          const active = page === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-150 ${
                active ? "text-white bg-white/[0.06]" : "text-white/55 hover:text-white hover:bg-white/[0.03]"
              }`}
            >
              {active && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon size={16} className={active ? "text-accent" : "text-white/50 group-hover:text-white/80"} />
              <span className="flex-1 text-left">{t(item.labelKey)}</span>
              {item.key === "automation" && unread > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-500/20 px-1.5 text-[10px] font-semibold text-red-400">
                  {unread}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* upgrade card */}
      <div className="px-3 pb-2">
        <button
          onClick={() => setPricingOpen(true)}
          className="group relative flex w-full items-center gap-3 overflow-hidden rounded-lg border border-white/[0.08] bg-gradient-to-br from-atlas-500/10 via-white/[0.02] to-accent/10 px-3 py-2.5 text-left transition-all hover:border-white/[0.18] hover:from-atlas-500/15 hover:to-accent/15"
        >
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-gradient-to-br from-atlas-400 to-accent">
            <Crown size={15} className="text-black" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white">Upgrade</div>
            <div className="text-[10px] text-white/50">4 plans · from ₹0</div>
          </div>
        </button>
      </div>

      {/* key status + account */}
      <div className="border-t border-white/[0.08] p-3 space-y-3">
        <div className="flex items-center gap-2 rounded-md bg-white/[0.03] px-3 py-2">
          <span className={`h-1.5 w-1.5 rounded-full ${keyLinked ? "bg-accent animate-pulseDot" : "bg-white/30"}`} />
          <span className="text-xs text-white/60">{keyLinked ? "Buffer connected" : "Buffer not linked"}</span>
        </div>
        {session && userEmail ? (
          <button
            onClick={onSignOut}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-white/55 hover:text-white hover:bg-white/[0.03] transition-all"
          >
            <div className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-[10px] font-semibold text-white/70 uppercase">
              {userEmail.slice(0, 2)}
            </div>
            <span className="flex-1 text-left truncate text-xs text-white/50">{userEmail}</span>
            <LogOut size={14} className="text-white/40" />
          </button>
        ) : (
          <button
            onClick={onShowAuth}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-white/55 hover:text-white hover:bg-white/[0.03] transition-all"
          >
            <div className="grid h-6 w-6 place-items-center rounded-full bg-white/10">
              <LogIn size={13} className="text-white/60" />
            </div>
            <span className="flex-1 text-left text-xs text-white/50">Sign in (optional)</span>
          </button>
        )}
      </div>
    </aside>

      <PricingModal open={pricingOpen} onClose={() => setPricingOpen(false)} />
    </>
  );
}

export function MobileNav({ page, onNavigate }: { page: Page; onNavigate: (p: Page) => void }) {
  const { t } = useAtlas();
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-center justify-around border-t border-white/[0.08] bg-ink-900/90 backdrop-blur-xl px-2 py-2">
      {NAV.map((item) => {
        const active = page === item.key;
        const Icon = item.icon;
        return (
          <button key={item.key} onClick={() => onNavigate(item.key)} className="flex flex-col items-center gap-0.5 px-3 py-1">
            <Icon size={18} className={active ? "text-accent" : "text-white/50"} />
            <span className={`text-[9px] ${active ? "text-white" : "text-white/40"}`}>{t(item.labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}

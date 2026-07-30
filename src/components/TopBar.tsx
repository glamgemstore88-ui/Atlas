// Top bar — page title area + live clock + refresh + notification bell.

import { RefreshCw, Bell, Loader2 } from "lucide-react";
import { useAtlas } from "@/lib/context";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { NotificationRow } from "@/lib/types";
import { ServiceIcon } from "./ServiceIcon";

const PAGE_TITLES: Record<string, string> = {
  overview: "Overview",
  queue: "Queue",
  analytics: "Analytics",
  automation: "Automation",
  settings: "Settings",
};

export function TopBar({ page }: { page: string }) {
  const { dataLoading, refreshAll, account, channels } = useAtlas();
  const [unread, setUnread] = useState(0);
  const [notifs, setNotifs] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);

  async function loadNotifs() {
    const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("read", false);
    setUnread(count ?? 0);
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(10);
    setNotifs((data ?? []) as NotificationRow[]);
  }

  useEffect(() => { loadNotifs(); }, [page]);

  async function markAllRead() {
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    await loadNotifs();
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/[0.08] bg-ink-950/80 backdrop-blur-xl px-5">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium text-white">{PAGE_TITLES[page] ?? page}</h2>
        {account && channels.length > 0 && (
          <div className="hidden sm:flex items-center -space-x-2 ml-2">
            {channels.slice(0, 5).map((c) => (
              <img key={c.id} src={c.avatar} alt={c.name} title={c.name} className="h-6 w-6 rounded-full border-2 border-ink-950 object-cover" />
            ))}
            {channels.length > 5 && (
              <div className="grid h-6 w-6 place-items-center rounded-full border-2 border-ink-950 bg-white/10 text-[10px] text-white/60">
                +{channels.length - 5}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={refreshAll}
          className="rounded-md p-2 text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
          title="Refresh"
        >
          {dataLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        </button>

        <div className="relative">
          <button
            onClick={() => { setOpen((v) => !v); if (!open) loadNotifs(); }}
            className="relative rounded-md p-2 text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <Bell size={16} />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {unread}
              </span>
            )}
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="absolute right-0 top-12 z-50 w-80 card shadow-card overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
                  <span className="text-sm font-medium text-white">Notifications</span>
                  {unread > 0 && <button onClick={markAllRead} className="text-xs text-atlas-300 hover:text-atlas-200">Mark all read</button>}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifs.length === 0 ? (
                    <div className="py-8 text-center text-sm text-white/40">No notifications yet.</div>
                  ) : (
                    notifs.map((n) => (
                      <div key={n.id} className={`px-4 py-3 border-b border-white/[0.04] ${!n.read ? "bg-amber-500/5" : ""}`}>
                        <div className="text-sm text-white/90">{n.title}</div>
                        <div className="text-xs text-white/50 mt-0.5">{n.body}</div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

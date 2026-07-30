// Queue page — full post queue management with a composer that creates real posts.

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Send, CalendarClock, Loader2, AlertCircle, Filter } from "lucide-react";
import { useAtlas } from "@/lib/context";
import { upNextQueue, recentSentPosts } from "@/lib/analytics";
import { createPost } from "@/lib/buffer";
import { ServiceIcon } from "@/components/ServiceIcon";
import { Modal } from "@/components/Modal";
import { format, parseISO } from "date-fns";
import type { BufferPost } from "@/lib/types";
import { EmptyState } from "@/components/EmptyState";

type Tab = "scheduled" | "sent";

export function QueuePage() {
  const { t, posts, channels, dataLoading, keyLinked, refreshAll } = useAtlas();
  const [tab, setTab] = useState<Tab>("scheduled");
  const [composeOpen, setComposeOpen] = useState(false);

  if (!keyLinked) return <EmptyState variant="nokey" onNavigate={() => {}} />;

  const scheduled = upNextQueue(posts);
  const sent = recentSentPosts(posts, 30);
  const list = tab === "scheduled" ? scheduled : sent;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">{t("queue.title")}</h1>
          <p className="text-sm text-white/50 mt-0.5">{t("queue.subtitle")}</p>
        </div>
        <button onClick={() => setComposeOpen(true)} className="btn-primary">
          <Plus size={16} /> New post
        </button>
      </div>

      {/* tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.08]">
        <TabBtn active={tab === "scheduled"} onClick={() => setTab("scheduled")} count={scheduled.length}>
          <CalendarClock size={14} /> Scheduled
        </TabBtn>
        <TabBtn active={tab === "sent"} onClick={() => setTab("sent")} count={sent.length}>
          <Send size={14} /> Sent
        </TabBtn>
      </div>

      {dataLoading && posts.length === 0 ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-20 w-full" />)}</div>
      ) : list.length === 0 ? (
        <div className="card p-10 text-center">
          <Filter size={28} className="text-white/20 mx-auto mb-3" />
          <p className="text-sm text-white/40">{tab === "scheduled" ? t("queue.empty") : "No posts sent in the last 30 days."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((post, i) => (
            <PostListRow key={post.id} post={post} delay={i * 0.03} />
          ))}
        </div>
      )}

      <ComposerModal open={composeOpen} onClose={() => setComposeOpen(false)} channels={channels} onCreated={refreshAll} />
    </div>
  );
}

function TabBtn({ active, onClick, count, children }: { active: boolean; onClick: () => void; count: number; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
        active ? "text-white" : "text-white/50 hover:text-white/80"
      }`}
    >
      {children}
      <span className={`text-xs tabular-nums ${active ? "text-white/70" : "text-white/30"}`}>{count}</span>
      {active && <motion.div layoutId="queue-tab" className="absolute bottom-0 inset-x-0 h-0.5 bg-accent" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
    </button>
  );
}

function PostListRow({ post, delay }: { post: BufferPost; delay: number }) {
  const date = post.dueAt ? parseISO(post.dueAt) : post.sentAt ? parseISO(post.sentAt) : null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="card card-hover p-4"
    >
      <div className="flex items-start gap-3">
        {post.channel?.avatar ? (
          <img src={post.channel.avatar} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
        ) : (
          <div className="h-9 w-9 rounded-full bg-white/10 grid place-items-center shrink-0">
            {post.channel && <ServiceIcon service={post.channel.service} size={15} />}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/90 whitespace-pre-wrap break-words line-clamp-3">{post.text}</p>
          <div className="flex items-center gap-2 mt-2 text-xs text-white/40">
            {post.channel && <ServiceIcon service={post.channel.service} size={12} />}
            <span>{post.channel?.name}</span>
            {date && (<><span>·</span><span>{format(date, "d MMM yyyy, HH:mm")}</span></>)}
            <span className="ml-auto rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/50">{post.status}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ComposerModal({ open, onClose, channels, onCreated }: {
  open: boolean; onClose: () => void; channels: BufferPost["channel"][] | any[]; onCreated: () => Promise<void>;
}) {
  const { t } = useAtlas();
  const [text, setText] = useState("");
  const [channelId, setChannelId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [shareNowFlag, setShareNowFlag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const activeChannels = (channels as any[]).filter((c) => !c.isDisconnected && !c.isLocked);

  async function submit() {
    setErr(null);
    if (!text.trim()) { setErr("Write some post text first."); return; }
    if (!shareNowFlag && !channelId) { setErr("Pick a channel or enable Post Now."); return; }
    setBusy(true);
    const target = channelId || activeChannels[0]?.id;
    if (!target) { setErr("No usable channel found."); setBusy(false); return; }
    const res = shareNowFlag
      ? await createPost({ channelId: target, text, mode: "shareNow" })
      : await createPost({ channelId: target, text, dueAt: dueAt ? new Date(dueAt).toISOString() : null });
    setBusy(false);
    if (!res.ok) { setErr(res.error ?? "Failed to create post."); return; }
    setText(""); setDueAt(""); setShareNowFlag(false);
    await onCreated();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="New post" subtitle="Create and schedule a real Buffer post" maxWidth="max-w-lg">
      <div className="space-y-4">
        <div>
          <label className="label block mb-1.5">Post text</label>
          <textarea className="input min-h-[120px] resize-y" value={text} onChange={(e) => setText(e.target.value)} placeholder="What do you want to share?" />
          <div className="mt-1 text-right text-xs text-white/30">{text.length} chars</div>
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={shareNowFlag} onChange={(e) => setShareNowFlag(e.target.checked)} className="h-4 w-4 rounded accent-accent" />
          <span className="text-sm text-white/80">Post now (skip scheduling)</span>
        </label>

        {!shareNowFlag && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block mb-1.5">Channel</label>
              <select className="input" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
                <option value="">Auto-select</option>
                {activeChannels.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name} · {c.service}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label block mb-1.5">Schedule for</label>
              <input type="datetime-local" className="input" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
          </div>
        )}

        {err && <div className="flex items-center gap-2 text-sm text-red-400"><AlertCircle size={14} />{err}</div>}

        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">{t("common.cancel")}</button>
          <button onClick={submit} disabled={busy} className="btn-primary flex-1">
            {busy ? <Loader2 size={16} className="animate-spin" /> : shareNowFlag ? <Send size={16} /> : <CalendarClock size={16} />}
            {shareNowFlag ? "Post now" : "Schedule"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// "Up Next" post queue — real scheduled posts from Buffer with live mutations.

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Pencil, Trash2, Send, ArrowUpToLine, ArrowDownToLine, Clock, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useAtlas } from "@/lib/context";
import { upNextQueue } from "@/lib/analytics";
import { editPost, deletePost, movePostInQueue, shareNow } from "@/lib/buffer";
import { ServiceIcon } from "./ServiceIcon";
import { Modal } from "./Modal";
import type { BufferPost } from "@/lib/types";

export function UpNextQueue() {
  const { posts, t, dataLoading, dataError, refreshAll } = useAtlas();
  const queue = upNextQueue(posts);

  if (dataLoading && posts.length === 0) {
    return (
      <div className="card p-5">
        <div className="skeleton h-5 w-32 mb-4" />
        {[0, 1, 2].map((i) => <div key={i} className="skeleton h-16 w-full mb-2" />)}
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">{t("queue.title")}</h3>
          <p className="text-xs text-white/50 mt-0.5">{t("queue.subtitle")}</p>
        </div>
        <span className="text-xs text-white/40 tabular-nums">{queue.length}</span>
      </div>

      {dataError && posts.length === 0 ? (
        <ErrorRow error={dataError} onRetry={refreshAll} />
      ) : queue.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Clock size={28} className="text-white/20 mb-3" />
          <p className="text-sm text-white/40">{t("queue.empty")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {queue.slice(0, 8).map((post) => (
              <QueueRow key={post.id} post={post} onRefresh={refreshAll} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function QueueRow({ post, onRefresh }: { post: BufferPost; onRefresh: () => Promise<void> }) {
  const { t } = useAtlas();
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, then?: () => void) {
    setBusy(true); setErr(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) { setErr(res.error ?? "Action failed"); return; }
    await onRefresh();
    then?.();
  }

  const due = post.dueAt ? parseISO(post.dueAt) : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="group rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 hover:border-white/[0.12] transition-colors"
    >
      <div className="flex items-start gap-3">
        {post.channel?.avatar ? (
          <img src={post.channel.avatar} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
        ) : (
          <div className="h-8 w-8 rounded-full bg-white/10 grid place-items-center shrink-0">
            {post.channel && <ServiceIcon service={post.channel.service} size={14} />}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/90 line-clamp-2 break-words">{post.text}</p>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-white/40">
            {post.channel && <ServiceIcon service={post.channel.service} size={12} />}
            <span>{post.channel?.name ?? "Unknown"}</span>
            {due && (
              <>
                <span>·</span>
                <Clock size={11} />
                <span>{format(due, "EEE, d MMM · HH:mm")}</span>
              </>
            )}
            {post.externalLink && (
              <a href={post.externalLink} target="_blank" rel="noreferrer" className="ml-auto text-atlas-300 hover:text-atlas-200">
                <ExternalLink size={12} />
              </a>
            )}
          </div>
          {err && <div className="mt-1.5 text-xs text-red-400 flex items-center gap-1"><AlertCircle size={11} />{err}</div>}
        </div>
      </div>

      <div className="flex items-center gap-1 mt-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <ActionBtn icon={Pencil} label={t("queue.edit")} onClick={() => setEditOpen(true)} disabled={busy} />
        <ActionBtn icon={Send} label={t("queue.postNow")} onClick={() => run(() => shareNow(post.channelId, post.text))} disabled={busy} loading={busy} />
        <ActionBtn icon={ArrowUpToLine} label={t("queue.moveToTop")} onClick={() => run(() => movePostInQueue(post.id, "top"))} disabled={busy} />
        <ActionBtn icon={ArrowDownToLine} label={t("queue.moveToBottom")} onClick={() => run(() => movePostInQueue(post.id, "bottom"))} disabled={busy} />
        <ActionBtn icon={Trash2} label={t("queue.delete")} danger onClick={() => setConfirmDelete(true)} disabled={busy} />
      </div>

      <EditPostModal open={editOpen} onClose={() => setEditOpen(false)} post={post} onRefresh={onRefresh} />
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete post?" maxWidth="max-w-sm">
        <p className="text-sm text-white/60 mb-4">This permanently removes the post from your Buffer queue.</p>
        <div className="flex gap-2">
          <button onClick={() => setConfirmDelete(false)} className="btn-secondary flex-1">{t("common.cancel")}</button>
          <button onClick={() => run(() => deletePost(post.id), () => setConfirmDelete(false))} className="btn-danger flex-1">
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {t("queue.delete")}
          </button>
        </div>
      </Modal>
    </motion.div>
  );
}

function ActionBtn({ icon: Icon, label, onClick, disabled, loading, danger }: {
  icon: typeof Pencil; label: string; onClick: () => void; disabled?: boolean; loading?: boolean; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors disabled:opacity-40 ${
        danger ? "text-red-400/80 hover:bg-red-500/10" : "text-white/50 hover:text-white hover:bg-white/[0.06]"
      }`}
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
      {label}
    </button>
  );
}

function EditPostModal({ open, onClose, post, onRefresh }: { open: boolean; onClose: () => void; post: BufferPost; onRefresh: () => Promise<void> }) {
  const { t } = useAtlas();
  const [text, setText] = useState(post.text);
  const [dueAt, setDueAt] = useState(post.dueAt ? post.dueAt.slice(0, 16) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true); setErr(null);
    const iso = dueAt ? new Date(dueAt).toISOString() : null;
    const res = await editPost({ id: post.id, text, dueAt: iso });
    setBusy(false);
    if (!res.ok) { setErr(res.error ?? "Failed to update"); return; }
    await onRefresh();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={t("queue.edit")} subtitle={t("queue.reschedule")} maxWidth="max-w-md">
      <div className="space-y-4">
        <div>
          <label className="label block mb-1.5">Post text</label>
          <textarea className="input min-h-[100px] resize-y" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div>
          <label className="label block mb-1.5">Scheduled at</label>
          <input type="datetime-local" className="input" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </div>
        {err && <div className="text-sm text-red-400 flex items-center gap-1"><AlertCircle size={14} />{err}</div>}
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">{t("common.cancel")}</button>
          <button onClick={save} disabled={busy} className="btn-primary flex-1">
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {t("common.save")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ErrorRow({ error, onRetry }: { error: string; onRetry: () => Promise<void> }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <AlertCircle size={24} className="text-red-400/60 mb-2" />
      <p className="text-sm text-white/50 mb-3 max-w-xs">{error}</p>
      <button onClick={onRetry} className="btn-secondary text-xs">Retry</button>
    </div>
  );
}

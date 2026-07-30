// Buffer API key connection modal — real BYOK flow.
// Sends the plaintext key over HTTPS to the buffer-proxy edge function's
// save-key action, which validates it against Buffer's live API, encrypts it
// (AES-256-GCM) server-side, and stores the ciphertext. The plaintext never
// touches the database.

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, KeyRound, ExternalLink, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { Modal } from "./Modal";
import { useAtlas } from "@/lib/context";
import { saveBufferKey, deleteBufferKey } from "@/lib/buffer";

export function BufferKeyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, keyLinked, keyHint, refreshAll } = useAtlas();
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function save() {
    setError(null);
    setSuccess(false);
    if (!apiKey.trim()) { setError("Enter your Buffer API key."); return; }
    setLoading(true);
    try {
      const res = await saveBufferKey(apiKey.trim());
      if (!res.ok) {
        setError(res.error === "invalid_buffer_key" ? t("key.invalid") : (res.error ?? "Failed to save key."));
      } else {
        setSuccess(true);
        setApiKey("");
        await refreshAll();
        setTimeout(onClose, 900);
      }
    } finally {
      setLoading(false);
    }
  }

  async function disconnect() {
    setLoading(true);
    try {
      await deleteBufferKey();
      await refreshAll();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t("settings.bufferKey")} subtitle={t("settings.bufferKeyDesc")} maxWidth="max-w-md">
      {keyLinked ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-accent/20 bg-accent/5 px-4 py-3">
            <CheckCircle2 size={18} className="text-accent" />
            <div className="flex-1">
              <div className="text-sm font-medium text-white">{t("settings.keyLinked")}</div>
              {keyHint && <div className="text-xs text-white/40 mt-0.5">Key prefix: {keyHint}</div>}
            </div>
          </div>
          <button onClick={disconnect} disabled={loading} className="btn-danger w-full">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            {t("settings.deleteKey")}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-sm text-white/70 mb-2">
              <KeyRound size={15} className="text-atlas-400" />
              <span className="font-medium">How to get your key</span>
            </div>
            <ol className="list-decimal list-inside text-xs text-white/50 space-y-1">
              <li>Log in to your Buffer account</li>
              <li>Open Settings → API</li>
              <li>Create a new API key and copy it</li>
            </ol>
            <a href="https://publish.buffer.com/settings/api" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-atlas-300 hover:text-atlas-200">
              Open Buffer API settings <ExternalLink size={12} />
            </a>
          </div>

          <div>
            <label className="label block mb-1.5">Buffer API Key</label>
            <input
              type="password"
              className="input font-mono"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="buf_… / your personal access token"
              autoFocus
            />
          </div>

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {success && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 rounded-lg border border-accent/20 bg-accent/10 px-3 py-2 text-sm text-accent">
              <CheckCircle2 size={16} /> {t("key.verified")}
            </motion.div>
          )}

          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary flex-1">{t("common.cancel")}</button>
            <button onClick={save} disabled={loading} className="btn-primary flex-1">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
              {t("settings.saveKey")}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

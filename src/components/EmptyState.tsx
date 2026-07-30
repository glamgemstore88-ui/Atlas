// Empty states shown when the Buffer key isn't linked or there's no data.

import { motion } from "framer-motion";
import { KeyRound, ArrowRight, BarChart3, Inbox } from "lucide-react";
import { useAtlas } from "@/lib/context";
import { useState } from "react";
import { BufferKeyModal } from "./BufferKeyModal";

export function EmptyState({
  variant, onNavigate,
}: {
  variant: "nokey" | "nodata";
  onNavigate?: (p: "queue" | "settings" | "analytics" | "automation") => void;
}) {
  const { t } = useAtlas();
  const [keyModal, setKeyModal] = useState(false);

  if (variant === "nokey") {
    return (
      <>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-16 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-atlas-400/20 to-accent/20 mb-5">
            <KeyRound size={28} className="text-atlas-300" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Connect your Buffer account</h2>
          <p className="text-sm text-white/50 max-w-md mb-6">
            Atlas uses your personal Buffer API key to pull live channels, manage your queue, and surface real analytics — all securely encrypted.
          </p>
          <button onClick={() => setKeyModal(true)} className="btn-primary">
            <KeyRound size={16} /> {t("settings.saveKey")}
          </button>
          <a href="https://publish.buffer.com/settings/api" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs text-white/40 hover:text-white/60">
            Get your key at Buffer Settings → API <ArrowRight size={12} />
          </a>
        </motion.div>
        <BufferKeyModal open={keyModal} onClose={() => setKeyModal(false)} />
      </>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/[0.04] mb-5">
        <Inbox size={28} className="text-white/30" />
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">No data yet</h2>
      <p className="text-sm text-white/50 max-w-md mb-6">Once you have posts in Buffer, your {onNavigate ? "dashboard" : "analytics"} will fill in here.</p>
      {onNavigate && (
        <button onClick={() => onNavigate("queue")} className="btn-secondary">
          <BarChart3 size={16} /> View Queue
        </button>
      )}
    </motion.div>
  );
}

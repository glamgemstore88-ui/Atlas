// Onboarding checklist — tracks real completion state from the DB + Buffer data.

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, KeyRound, Share2, Clock, X } from "lucide-react";
import { useAtlas } from "@/lib/context";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { BufferKeyModal } from "./BufferKeyModal";

export function OnboardingChecklist({ onConnectKey }: { onConnectKey: () => void }) {
  const { t, keyLinked, channels, settings, refreshSettings } = useAtlas();
  const [dismissed, setDismissed] = useState(settings?.onboarding_dismissed ?? false);
  const [keyModal, setKeyModal] = useState(false);

  if (dismissed) return null;

  const steps = [
    { done: keyLinked, label: t("onboarding.connectKey"), icon: KeyRound, action: () => setKeyModal(true) },
    { done: channels.length > 0, label: t("onboarding.addChannel"), icon: Share2, action: undefined },
    { done: !!settings?.smart_schedule_enabled, label: t("onboarding.smartSchedule"), icon: Clock, action: undefined },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  async function dismiss() {
    setDismissed(true);
    await supabase.from("user_settings").update({ onboarding_dismissed: true }).gte("created_at", "1970-01-01T00:00:00Z");
    await refreshSettings();
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-5"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">{t("onboarding.title")}</h3>
            <p className="text-xs text-white/50 mt-0.5">{t("onboarding.subtitle")}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/40 tabular-nums">{doneCount}/{steps.length}</span>
            <button onClick={dismiss} className="rounded-md p-1 text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="space-y-1">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.button
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={s.action}
                disabled={!s.action}
                className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  s.action ? "hover:bg-white/[0.04] cursor-pointer" : "cursor-default"
                }`}
              >
                <AnimatePresence mode="wait">
                  {s.done ? (
                    <motion.span key="done" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}>
                      <CheckCircle2 size={18} className="text-accent" />
                    </motion.span>
                  ) : (
                    <motion.span key="todo" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}>
                      <Circle size={18} className="text-white/25" />
                    </motion.span>
                  )}
                </AnimatePresence>
                <Icon size={15} className={s.done ? "text-white/30" : "text-white/50"} />
                <span className={`text-sm flex-1 ${s.done ? "text-white/40 line-through" : "text-white/80"}`}>{s.label}</span>
                {s.action && !s.done && (
                  <span className="text-xs text-atlas-300 opacity-0 group-hover:opacity-100 transition-opacity">{t("common.save")}</span>
                )}
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      <BufferKeyModal open={keyModal} onClose={() => setKeyModal(false)} />
    </>
  );
}

// Settings page — Buffer key connection, language, posting goal, timezone, sign out.

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { KeyRound, Globe, Target, Clock, LogOut, Check, Loader2, Shield, ChevronRight } from "lucide-react";
import { useAtlas } from "@/lib/context";
import { supabase } from "@/lib/supabase";
import { BufferKeyModal } from "@/components/BufferKeyModal";
import { LANG_LABELS } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

export function SettingsPage() {
  const { t, user, settings, lang, setLang, keyLinked, keyHint, refreshSettings, signOut } = useAtlas();
  const [keyModal, setKeyModal] = useState(false);
  const [postsGoal, setPostsGoal] = useState(settings?.posts_per_week_goal ?? 5);
  const [timezone, setTimezone] = useState(settings?.timezone ?? "Asia/Kolkata");
  const [saving, setSaving] = useState(false);
  const [savedFlag, setSavedFlag] = useState(false);

  useEffect(() => {
    setPostsGoal(settings?.posts_per_week_goal ?? 5);
    setTimezone(settings?.timezone ?? "Asia/Kolkata");
  }, [settings]);

  async function savePrefs() {
    setSaving(true);
    const owner = (await supabase.auth.getUser()).data.user?.email ?? null;
    const existing = await supabase.from("user_settings").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existing.data) {
      await supabase.from("user_settings").update({ posts_per_week_goal: postsGoal, timezone, owner }).eq("created_at", existing.data.created_at);
    } else {
      await supabase.from("user_settings").insert({ posts_per_week_goal: postsGoal, timezone, owner });
    }
    await refreshSettings();
    setSaving(false);
    setSavedFlag(true);
    setTimeout(() => setSavedFlag(false), 1800);
  }

  const timezones = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "America/New_York", "America/Los_Angeles", "Europe/London", "Australia/Sydney"];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-white">{t("settings.title")}</h1>
        <p className="text-sm text-white/50 mt-0.5">{t("settings.subtitle")}</p>
      </div>

      {/* Buffer key */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
        <div className="flex items-start gap-4">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-atlas-500/10">
            <KeyRound size={18} className="text-atlas-300" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white">{t("settings.bufferKey")}</h3>
            <p className="text-xs text-white/50 mt-1 mb-3">{t("settings.bufferKeyDesc")}</p>
            <div className="flex items-center gap-2 mb-3">
              <span className={`h-1.5 w-1.5 rounded-full ${keyLinked ? "bg-accent" : "bg-white/30"}`} />
              <span className="text-sm text-white/70">{keyLinked ? t("settings.keyLinked") : t("settings.keyNotLinked")}</span>
              {keyLinked && keyHint && <span className="text-xs text-white/40">({keyHint})</span>}
            </div>
            <button onClick={() => setKeyModal(true)} className={keyLinked ? "btn-secondary" : "btn-primary"}>
              <KeyRound size={15} /> {keyLinked ? "Manage key" : t("settings.saveKey")}
            </button>
          </div>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <Shield size={14} className="text-accent mt-0.5 shrink-0" />
          <p className="text-xs text-white/50">Your key is encrypted with AES-256-GCM before storage. Plaintext is never logged or sent to the browser.</p>
        </div>
      </motion.div>

      {/* language */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card p-5">
        <div className="flex items-start gap-4">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/[0.06]">
            <Globe size={18} className="text-white/70" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white">{t("settings.language")}</h3>
            <p className="text-xs text-white/50 mt-1 mb-3">Choose your preferred language. Changes save instantly.</p>
            <div className="flex gap-2">
              {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`rounded-lg border px-4 py-2 text-sm transition-all ${
                    lang === l
                      ? "border-accent/40 bg-accent/10 text-white"
                      : "border-white/[0.08] bg-white/[0.02] text-white/60 hover:text-white hover:border-white/[0.14]"
                  }`}
                >
                  {LANG_LABELS[l]}
                  {lang === l && <Check size={13} className="inline ml-1.5 text-accent" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* posting goal + timezone */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-5">
        <div className="flex items-start gap-4 mb-4">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/[0.06]">
            <Target size={18} className="text-white/70" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white">{t("settings.postingGoal")}</h3>
            <p className="text-xs text-white/50 mt-1">Atlas tracks your weekly progress against this goal.</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label block mb-1.5">{t("settings.postingGoal")}</label>
            <input type="number" min={1} max={50} className="input" value={postsGoal} onChange={(e) => setPostsGoal(Number(e.target.value))} />
          </div>
          <div>
            <label className="label block mb-1.5 flex items-center gap-1"><Clock size={11} /> {t("settings.timezone")}</label>
            <select className="input" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {timezones.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={savePrefs} disabled={saving} className="btn-primary">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {t("common.save")}
          </button>
          {savedFlag && <span className="text-xs text-accent flex items-center gap-1"><Check size={13} /> {t("common.saved")}</span>}
        </div>
      </motion.div>

      {/* account / sign out (optional) */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-sm font-semibold text-white/70 uppercase">
              {(user?.email ?? "?").slice(0, 2)}
            </div>
            <div>
              <div className="text-sm text-white/90">{user?.email ?? "Guest"}</div>
              <div className="text-xs text-white/40">{user ? "Account" : "Using Atlas without an account"}</div>
            </div>
          </div>
          {user ? (
            <button onClick={signOut} className="btn-danger">
              <LogOut size={15} /> {t("settings.signOut")}
            </button>
          ) : (
            <span className="text-xs text-white/40">Sign in is optional</span>
          )}
        </div>
      </motion.div>

      <BufferKeyModal open={keyModal} onClose={() => setKeyModal(false)} />
    </div>
  );
}

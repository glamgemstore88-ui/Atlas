// Atlas auth screen — sign in / sign up via Supabase email+password.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Mail, Lock, User as UserIcon, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function AuthScreen({ onBack }: { onBack?: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: name || email.split("@")[0] } },
        });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Authentication failed";
      setError(humanizeAuthError(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* ambient glow */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-atlas-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md"
      >
        <div className="card p-8 shadow-card">
          <div className="flex items-center gap-3 mb-6">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-atlas-400 to-accent">
              <Sparkles size={20} className="text-black" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Atlas</h1>
              <p className="text-xs text-white/40">AI social media command center</p>
            </div>
          </div>

          <h2 className="text-xl font-semibold text-white mb-1">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="text-sm text-white/50 mb-6">
            {mode === "signin" ? "Sign in to manage your Buffer queue." : "Start managing your social presence with AI."}
          </p>

          <form onSubmit={submit} className="space-y-4">
            <AnimatePresence initial={false}>
              {mode === "signup" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <Field label="Name" icon={<UserIcon size={16} />}>
                    <input className="input pl-9" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
                  </Field>
                </motion.div>
              )}
            </AnimatePresence>

            <Field label="Email" icon={<Mail size={16} />}>
              <input type="email" required className="input pl-9" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </Field>

            <Field label="Password" icon={<Lock size={16} />}>
              <input type="password" required minLength={6} className="input pl-9" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </Field>

            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </motion.div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-white/50">
            {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
              className="text-white hover:text-atlas-300 font-medium transition-colors"
            >
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </div>
        </div>
        {onBack && (
          <div className="mt-4 text-center">
            <button onClick={onBack} className="text-xs text-white/40 hover:text-white/60 transition-colors">
              ← Continue without an account
            </button>
          </div>
        )}
        <p className="mt-4 text-center text-xs text-white/30">
          Signing in is optional. Your Buffer API key is encrypted (AES-256-GCM) and stored securely.
        </p>
      </motion.div>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="label block mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30">{icon}</span>
        {children}
      </div>
    </div>
  );
}

function humanizeAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "Incorrect email or password.";
  if (m.includes("already registered") || m.includes("already been registered")) return "An account with this email already exists. Try signing in.";
  if (m.includes("rate limit")) return "Too many attempts. Please wait a moment and try again.";
  if (m.includes("password")) return "Password must be at least 6 characters.";
  return msg;
}

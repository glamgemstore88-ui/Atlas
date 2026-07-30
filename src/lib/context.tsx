// App-data context for Atlas (sign-up optional).
// Holds the optional Supabase session (for greeting personalization), the
// shared single-tenant settings row, language, and live Buffer data so every
// page shares one source of truth. The core app works without signing in.

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { getAccount, getAllChannels, getAllPosts, getBufferKeyStatus } from "./buffer";
import type { BufferAccount, BufferChannel, BufferPost, UserSettings } from "./types";
import type { Lang } from "./i18n";
import { t as translate } from "./i18n";

interface AtlasContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  settings: UserSettings | null;
  lang: Lang;
  t: (key: string) => string;
  setLang: (l: Lang) => void;
  account: BufferAccount | null;
  channels: BufferChannel[];
  posts: BufferPost[];
  keyLinked: boolean;
  keyHint: string | null;
  dataLoading: boolean;
  dataError: string | null;
  refreshAll: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AtlasContext = createContext<AtlasContextValue | undefined>(undefined);

// Single-tenant: the one shared settings row.
async function loadSettingsRow(): Promise<UserSettings | null> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    // create a default shared settings row
    const { data: created } = await supabase
      .from("user_settings")
      .insert({})
      .select("*")
      .maybeSingle();
    return (created as UserSettings) ?? null;
  }
  return data as UserSettings;
}

export function AtlasProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [lang, setLangState] = useState<Lang>("en");
  const [account, setAccount] = useState<BufferAccount | null>(null);
  const [channels, setChannels] = useState<BufferChannel[]>([]);
  const [posts, setPosts] = useState<BufferPost[]>([]);
  const [keyLinked, setKeyLinked] = useState(false);
  const [keyHint, setKeyHint] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const t = useCallback((key: string) => translate(lang, key), [lang]);

  const refreshSettings = useCallback(async () => {
    const s = await loadSettingsRow();
    setSettings(s);
    if (s) setLangState(s.language as Lang);
  }, []);

  const refreshAll = useCallback(async () => {
    setDataLoading(true);
    setDataError(null);
    try {
      const ks = await getBufferKeyStatus();
      setKeyLinked(ks.linked);
      setKeyHint(ks.hint ?? null);
      if (!ks.linked) {
        setAccount(null); setChannels([]); setPosts([]);
        setDataLoading(false);
        return;
      }
      const { account: acct, error: acctErr } = await getAccount();
      if (acctErr && !acct) {
        setDataError(acctErr);
        setAccount(null); setChannels([]); setPosts([]);
        setDataLoading(false);
        return;
      }
      setAccount(acct);
      const orgs = acct?.organizations ?? [];
      const [chRes, postsRes] = await Promise.all([
        getAllChannels(orgs),
        getAllPosts(orgs, { first: 100 }),
      ]);
      setChannels(chRes.channels);
      setPosts(postsRes.posts);
      if (chRes.error && !chRes.channels.length) setDataError(chRes.error);
    } catch (e) {
      setDataError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setDataLoading(false);
    }
  }, []);

  // initial: load settings + session, then Buffer data (no sign-in required)
  useEffect(() => {
    let mounted = true;
    (async () => {
      await refreshSettings();
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
      // load Buffer data regardless of auth state
      await refreshAll();
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      (async () => {
        setSession(sess);
        setUser(sess?.user ?? null);
        await refreshSettings();
        await refreshAll();
      })();
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [refreshSettings, refreshAll]);

  const setLang = useCallback(async (l: Lang) => {
    setLangState(l);
    const owner = (await supabase.auth.getUser()).data.user?.email ?? null;
    // upsert the single shared settings row's language
    const existing = await loadSettingsRow();
    if (existing) {
      await supabase.from("user_settings").update({ language: l, owner }).eq("created_at", existing.created_at);
    } else {
      await supabase.from("user_settings").insert({ language: l, owner });
    }
    await refreshSettings();
  }, [refreshSettings]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null); setSession(null);
    await refreshAll();
  }, [refreshAll]);

  const value: AtlasContextValue = {
    session, user, loading, settings, lang, t, setLang,
    account, channels, posts, keyLinked, keyHint,
    dataLoading, dataError, refreshAll, refreshSettings, signOut,
  };

  return <AtlasContext.Provider value={value}>{children}</AtlasContext.Provider>;
}

export function useAtlas(): AtlasContextValue {
  const ctx = useContext(AtlasContext);
  if (!ctx) throw new Error("useAtlas must be used within AtlasProvider");
  return ctx;
}

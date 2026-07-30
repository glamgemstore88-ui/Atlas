// Atlas — AI-powered Buffer management dashboard (sign-up optional).

import { useState } from "react";
import { AtlasProvider, useAtlas } from "@/lib/context";
import { AuthScreen } from "@/components/AuthScreen";
import { Sidebar, MobileNav, type Page } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { OverviewPage } from "@/pages/OverviewPage";
import { QueuePage } from "@/pages/QueuePage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { AutomationPage } from "@/pages/AutomationPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { Sparkles } from "lucide-react";

function Shell() {
  const { loading, session, user, signOut } = useAtlas();
  const [page, setPage] = useState<Page>("overview");
  const [showAuth, setShowAuth] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-black grid place-items-center">
        <div className="flex flex-col items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-atlas-400 to-accent animate-pulse">
            <Sparkles size={22} className="text-black" />
          </div>
          <span className="text-sm text-white/40">Loading Atlas…</span>
        </div>
      </div>
    );
  }

  // Optional sign-in modal (launched from the shell), never a hard gate.
  if (showAuth && !session) {
    return (
      <div className="relative">
        <AuthScreen onBack={() => setShowAuth(false)} />
      </div>
    );
  }

  const navigate = (p: Page) => setPage(p);

  return (
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar
        page={page}
        onNavigate={navigate}
        onShowAuth={() => setShowAuth(true)}
        session={session}
        userEmail={user?.email ?? null}
        onSignOut={signOut}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar page={page} />
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 pb-24 md:pb-6 max-w-6xl w-full mx-auto">
          {page === "overview" && <OverviewPage onNavigate={navigate} />}
          {page === "queue" && <QueuePage />}
          {page === "analytics" && <AnalyticsPage />}
          {page === "automation" && <AutomationPage />}
          {page === "settings" && <SettingsPage />}
        </main>
      </div>
      <MobileNav page={page} onNavigate={navigate} />
    </div>
  );
}

export default function App() {
  return (
    <AtlasProvider>
      <Shell />
    </AtlasProvider>
  );
}

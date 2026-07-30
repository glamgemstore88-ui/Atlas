// Atlas Overview page — greeting, quick stats, onboarding, up-next queue, content templates.

import { motion } from "framer-motion";
import { Flame, Target, CalendarClock, TrendingUp, Bell } from "lucide-react";
import { useAtlas } from "@/lib/context";
import { computeWeekStreak, computePostingGoals, computeScheduledQueue, computeEngagementScore } from "@/lib/analytics";
import { StatCard } from "@/components/StatCard";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { UpNextQueue } from "@/components/UpNextQueue";
import { ContentTemplates } from "@/components/ContentTemplates";
import { EmptyState } from "@/components/EmptyState";

function greetingKey(): string {
  const h = new Date().getHours();
  if (h < 12) return "greeting.morning";
  if (h < 17) return "greeting.afternoon";
  return "greeting.evening";
}

export function OverviewPage({ onNavigate }: { onNavigate: (p: "queue" | "settings" | "analytics" | "automation") => void }) {
  const { t, account, user, posts, dataLoading, keyLinked, settings } = useAtlas();

  if (!keyLinked) {
    return <EmptyState variant="nokey" onNavigate={onNavigate} />;
  }

  const name = (user?.user_metadata?.name as string) || account?.name || (user?.email ?? "").split("@")[0];
  const streak = computeWeekStreak(posts);
  const goals = computePostingGoals(posts, settings?.posts_per_week_goal ?? 5);
  const queued = computeScheduledQueue(posts);
  const score = computeEngagementScore(posts);

  return (
    <div className="space-y-6">
      {/* greeting header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">{t(greetingKey())}, {name}</h1>
          <p className="text-sm text-white/50 mt-1">
            {dataLoading ? t("common.loading") : `You have ${queued} post${queued === 1 ? "" : "s"} queued and a ${streak}-week streak.`}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulseDot" />
          <span className="text-xs text-white/60">Live from Buffer</span>
        </div>
      </motion.div>

      {/* stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Flame} label={t("stats.weekStreak")} value={streak} sub={`${streak} consecutive weeks`} accent="accent" delay={0} loading={dataLoading && posts.length === 0} />
        <StatCard icon={Target} label={t("stats.postingGoals")} value={`${goals.sent}/${goals.goal}`} sub={`this week`} accent="atlas" delay={0.05} loading={dataLoading && posts.length === 0} />
        <StatCard icon={CalendarClock} label={t("stats.scheduledQueue")} value={queued} sub={`in queue`} accent="amber" delay={0.1} loading={dataLoading && posts.length === 0} />
        <StatCard icon={TrendingUp} label={t("stats.engagementScore")} value={score} sub={`/ 100`} accent="violet" delay={0.15} loading={dataLoading && posts.length === 0} />
      </div>

      {/* onboarding + up next */}
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2">
          <OnboardingChecklist onConnectKey={() => onNavigate("settings")} />
        </div>
        <div className="lg:col-span-3">
          <UpNextQueue />
        </div>
      </div>

      {/* content templates */}
      <ContentTemplates />
    </div>
  );
}

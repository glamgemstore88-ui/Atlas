// Pure computation helpers over real Buffer data — no mock fallbacks.

import type { BufferPost, BufferChannel, AggregatedMetric } from "./types";
import { differenceInCalendarDays, isWithinInterval, subDays, startOfWeek, endOfWeek, parseISO } from "date-fns";

// Engagement score: normalized 0-100 from available metrics on sent posts.
export function computeEngagementScore(posts: BufferPost[]): number {
  const sent = posts.filter((p) => p.status === "sent" && p.metrics?.length);
  if (!sent.length) return 0;
  let total = 0;
  let count = 0;
  for (const p of sent) {
    const reactions = metricValue(p, "reactions") + metricValue(p, "likes");
    const comments = metricValue(p, "comments");
    const clicks = metricValue(p, "clicks") + metricValue(p, "linkClicks");
    const impressions = metricValue(p, "impressions") + metricValue(p, "reach");
    const engagement = reactions + comments + clicks;
    const rate = impressions > 0 ? (engagement / impressions) * 100 : engagement;
    total += Math.min(rate, 100);
    count++;
  }
  return count > 0 ? Math.round((total / count) * 10) / 10 : 0;
}

export function metricValue(post: BufferPost, name: string): number {
  const m = (post.metrics ?? []).find((x) => x.name.toLowerCase() === name.toLowerCase());
  return m ? Number(m.value) || 0 : 0;
}

// Week streak: consecutive weeks (ending this week) with at least 1 sent post.
export function computeWeekStreak(posts: BufferPost[], now = new Date()): number {
  const sentDates = posts
    .filter((p) => p.status === "sent" && p.sentAt)
    .map((p) => parseISO(p.sentAt as string))
    .filter((d) => !isNaN(d.getTime()));
  if (!sentDates.length) return 0;
  const weeksWithPosts = new Set<string>();
  for (const d of sentDates) {
    const ws = startOfWeek(d, { weekStartsOn: 1 }).toISOString();
    weeksWithPosts.add(ws);
  }
  let streak = 0;
  let cursor = startOfWeek(now, { weekStartsOn: 1 });
  // allow this week or last week to start the streak
  if (!weeksWithPosts.has(cursor.toISOString())) {
    cursor = subDays(cursor, 7);
  }
  while (weeksWithPosts.has(cursor.toISOString())) {
    streak++;
    cursor = subDays(cursor, 7);
  }
  return streak;
}

// Posting goals: how many posts sent this week vs the user's weekly goal.
export function computePostingGoals(posts: BufferPost[], goal: number, now = new Date()): { sent: number; goal: number } {
  const ws = startOfWeek(now, { weekStartsOn: 1 });
  const we = endOfWeek(now, { weekStartsOn: 1 });
  const sentThisWeek = posts.filter((p) => {
    if (p.status !== "sent" || !p.sentAt) return false;
    const d = parseISO(p.sentAt as string);
    return !isNaN(d.getTime()) && isWithinInterval(d, { start: ws, end: we });
  }).length;
  return { sent: sentThisWeek, goal };
}

// Scheduled queue count: posts with status buffer (queued, not yet sent).
export function computeScheduledQueue(posts: BufferPost[]): number {
  return posts.filter((p) => p.status === "buffer").length;
}

// Up-next queue: scheduled posts sorted ascending by dueAt.
export function upNextQueue(posts: BufferPost[]): BufferPost[] {
  return posts
    .filter((p) => p.status === "buffer" && p.dueAt)
    .sort((a, b) => new Date(a.dueAt as string).getTime() - new Date(b.dueAt as string).getTime());
}

// Sent posts in last N days, sorted by sentAt desc.
export function recentSentPosts(posts: BufferPost[], days: number): BufferPost[] {
  const since = subDays(new Date(), days);
  return posts
    .filter((p) => p.status === "sent" && p.sentAt && parseISO(p.sentAt).getTime() >= since.getTime())
    .sort((a, b) => new Date(b.sentAt as string).getTime() - new Date(a.sentAt as string).getTime());
}

// Per-channel aggregation of a metric for charting.
export function perChannelMetrics(posts: BufferPost[], channels: BufferChannel[]): { channel: BufferChannel; reactions: number; comments: number; clicks: number; impressions: number; posts: number }[] {
  return channels.map((ch) => {
    const chPosts = posts.filter((p) => p.channelId === ch.id && p.status === "sent");
    return {
      channel: ch,
      reactions: chPosts.reduce((s, p) => s + metricValue(p, "reactions") + metricValue(p, "likes"), 0),
      comments: chPosts.reduce((s, p) => s + metricValue(p, "comments"), 0),
      clicks: chPosts.reduce((s, p) => s + metricValue(p, "clicks") + metricValue(p, "linkClicks"), 0),
      impressions: chPosts.reduce((s, p) => s + metricValue(p, "impressions") + metricValue(p, "reach"), 0),
      posts: chPosts.length,
    };
  });
}

// Daily engagement series for the last N days.
export function dailyEngagementSeries(posts: BufferPost[], days: number): { date: string; label: string; engagement: number; posts: number }[] {
  const out: { date: string; label: string; engagement: number; posts: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = subDays(new Date(), i);
    const dayStr = day.toISOString().slice(0, 10);
    const dayPosts = posts.filter((p) => p.status === "sent" && p.sentAt && p.sentAt.slice(0, 10) === dayStr);
    const engagement = dayPosts.reduce((s, p) => s + metricValue(p, "reactions") + metricValue(p, "likes") + metricValue(p, "comments") + metricValue(p, "clicks"), 0);
    out.push({
      date: dayStr,
      label: day.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      engagement,
      posts: dayPosts.length,
    });
  }
  return out;
}

// Smart scheduling: compute top posting hours from historical sent-post performance.
export function computeBestTimes(posts: BufferPost[]): { hour: number; score: number; posts: number }[] {
  const buckets: Record<number, { score: number; posts: number }> = {};
  for (let h = 0; h < 24; h++) buckets[h] = { score: 0, posts: 0 };
  for (const p of posts) {
    if (p.status !== "sent" || !p.sentAt) continue;
    const d = parseISO(p.sentAt);
    if (isNaN(d.getTime())) continue;
    const h = d.getHours();
    const eng = metricValue(p, "reactions") + metricValue(p, "likes") + metricValue(p, "comments") + metricValue(p, "clicks");
    buckets[h].score += eng;
    buckets[h].posts += 1;
  }
  return Object.entries(buckets)
    .map(([h, v]) => ({ hour: Number(h), score: v.score, posts: v.posts }))
    .filter((b) => b.posts > 0)
    .sort((a, b) => b.score - a.score);
}

export function aggregatedTotal(metrics: AggregatedMetric[], name: string): number {
  const m = metrics.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return m ? Number(m.value) || 0 : 0;
}

export function daysSince(dateStr: string): number {
  return differenceInCalendarDays(new Date(), parseISO(dateStr));
}

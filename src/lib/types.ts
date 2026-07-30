// Shared types for Atlas — mirrors the authentic Buffer GraphQL API shapes.

export type Service =
  | "twitter" | "instagram" | "facebook" | "linkedin" | "tiktok"
  | "pinterest" | "youtube" | "threads" | "mastodon" | "bluesky"
  | "startPage" | "googleBusiness" | string;

export interface BufferOrganization {
  id: string;
  name: string;
}

export interface BufferAccount {
  id: string;
  email: string;
  name?: string | null;
  avatar?: string;
  timezone?: string | null;
  organizations: BufferOrganization[];
}

export interface BufferChannel {
  id: string;
  name: string;
  service: Service;
  avatar: string;
  displayName?: string | null;
  descriptor: string;
  isDisconnected: boolean;
  isQueuePaused: boolean;
  isLocked: boolean;
  externalLink?: string | null;
  organizationId: string;
}

export type PostStatus = "buffer" | "sent" | "draft" | "error" | "moved" | "deleted";
export type ShareMode = "addToQueue" | "shareNext" | "shareNow" | "customScheduled";
export type SchedulingType = "automatic" | "notification";

export interface PostMetric {
  name: string;
  value: number;
  description?: string;
}

export interface BufferPost {
  id: string;
  text: string;
  status: PostStatus;
  dueAt?: string | null;
  sentAt?: string | null;
  shareMode: ShareMode;
  isCustomScheduled: boolean;
  channelId: string;
  channel?: { id: string; service: Service; name: string; avatar: string } | null;
  metrics: PostMetric[];
  createdAt: string;
  updatedAt: string;
  externalLink?: string | null;
}

export interface AggregatedMetric {
  name: string;
  value: number;
  description?: string;
}

export interface EdgeFunctionError {
  error: string;
  detail?: unknown;
  status?: number;
}

export interface AIGenerateResponse {
  variants: string[];
  source: "openai" | "local_fallback";
  note?: string;
}

export interface AlertRow {
  id: string;
  owner: string | null;
  name: string;
  metric: string;
  operator: "gte" | "lte";
  threshold: number;
  channel_id: string | null;
  enabled: boolean;
  last_checked: string | null;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  owner: string | null;
  alert_id: string | null;
  title: string;
  body: string;
  severity: "info" | "warning" | "error" | "success";
  read: boolean;
  created_at: string;
}

export interface UserSettings {
  owner: string | null;
  language: "en" | "hi" | "hnglish";
  posts_per_week_goal: number;
  smart_schedule_enabled: boolean;
  timezone: string;
  onboarding_dismissed: boolean;
  created_at?: string;
}

export interface AITemplate {
  id: string;
  owner: string | null;
  title: string;
  body: string;
  category: string | null;
  channel_id: string | null;
  created_at: string;
}

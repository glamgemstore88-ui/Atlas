// Atlas Buffer API client.
// All Buffer calls go through the buffer-proxy edge function (server-side),
// which decrypts the user's BYOK key and performs real HTTP requests to
// api.buffer.com. This module builds the authentic GraphQL queries and returns
// typed results. No mock data anywhere.

import { supabase, EDGE_BASE } from "./supabase";
import type {
  BufferAccount, BufferChannel, BufferPost, AggregatedMetric,
} from "./types";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

interface ProxyResult<T> {
  data: T | null;
  error: string | null;
  status: number;
  raw: unknown;
}

async function graphql<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<ProxyResult<T>> {
  const headers = await getAuthHeaders();
  const resp = await fetch(`${EDGE_BASE}/buffer-proxy`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "graphql", query, variables }),
  });
  const text = await resp.text();
  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch { parsed = { error: text }; }
  if (!resp.ok) {
    return { data: null, error: parsed?.error ?? `Request failed (${resp.status})`, status: resp.status, raw: parsed };
  }
  if (parsed?.errors) {
    const msgs = parsed.errors.map((e: any) => e.message).join("; ");
    return { data: parsed.data ?? null, error: msgs, status: resp.status, raw: parsed };
  }
  return { data: parsed?.data ?? null, error: null, status: resp.status, raw: parsed };
}

// ---- Key management (calls buffer-proxy save/delete/status actions) ----

export async function saveBufferKey(apiKey: string): Promise<{ ok: boolean; account?: any; error?: string }> {
  const headers = await getAuthHeaders();
  const owner = (await supabase.auth.getUser()).data.user?.email ?? null;
  const resp = await fetch(`${EDGE_BASE}/buffer-proxy`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "save-key", apiKey, owner }),
  });
  const parsed = await resp.json().catch(() => ({ error: "Invalid response" }));
  if (!resp.ok) return { ok: false, error: parsed?.error ?? `Failed (${resp.status})` };
  return { ok: true, account: parsed?.account ?? null };
}

export async function deleteBufferKey(): Promise<{ ok: boolean; error?: string }> {
  const headers = await getAuthHeaders();
  const resp = await fetch(`${EDGE_BASE}/buffer-proxy`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "delete-key" }),
  });
  const parsed = await resp.json().catch(() => ({}));
  if (!resp.ok) return { ok: false, error: parsed?.error ?? `Failed (${resp.status})` };
  return { ok: true };
}

export async function getBufferKeyStatus(): Promise<{ linked: boolean; hint?: string | null; updated_at?: string | null }> {
  const headers = await getAuthHeaders();
  const resp = await fetch(`${EDGE_BASE}/buffer-proxy`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "key-status" }),
  });
  if (!resp.ok) return { linked: false };
  return await resp.json().catch(() => ({ linked: false }));
}

// ---- Account ----

const ACCOUNT_QUERY = `query {
  account {
    id
    email
    name
    avatar
    timezone
    organizations { id name }
  }
}`;

export async function getAccount(): Promise<{ account: BufferAccount | null; error: string | null }> {
  const r = await graphql<any>(ACCOUNT_QUERY);
  if (r.error && !r.data) return { account: null, error: r.error };
  return { account: r.data?.account ?? null, error: r.error };
}

// ---- Channels ----

const CHANNELS_QUERY = `query($org: OrganizationId!) {
  channels(input: { organizationId: $org }) {
    id
    name
    service
    avatar
    displayName
    descriptor
    isDisconnected
    isQueuePaused
    isLocked
    externalLink
    organizationId
  }
}`;

export async function getChannels(organizationId: string): Promise<{ channels: BufferChannel[]; error: string | null }> {
  const r = await graphql<any>(CHANNELS_QUERY, { org: organizationId });
  if (r.error && !r.data) return { channels: [], error: r.error };
  return { channels: r.data?.channels ?? [], error: r.error };
}

export async function getAllChannels(organizations: { id: string }[]): Promise<{ channels: BufferChannel[]; error: string | null }> {
  const all: BufferChannel[] = [];
  let lastError: string | null = null;
  for (const org of organizations) {
    const { channels, error } = await getChannels(org.id);
    if (error && channels.length === 0) lastError = error;
    all.push(...channels);
  }
  return { channels: all, error: lastError };
}

// ---- Posts ----

const POSTS_QUERY = `query($org: OrganizationId!, $first: Int, $filter: PostsFiltersInput) {
  posts(first: $first, input: { organizationId: $org, filter: $filter }) {
    edges {
      node {
        id
        text
        status
        dueAt
        sentAt
        shareMode
        isCustomScheduled
        channelId
        channel { id service name avatar }
        metrics { name value description }
        createdAt
        updatedAt
        externalLink
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

interface PostsFilters {
  status?: string[];
  channelIds?: string[];
  startDate?: string;
  endDate?: string;
}

export async function getPosts(
  organizationId: string,
  opts: { first?: number; filter?: PostsFilters } = {},
): Promise<{ posts: BufferPost[]; hasNextPage?: boolean; endCursor?: string | null; error: string | null }> {
  const r = await graphql<any>(POSTS_QUERY, {
    org: organizationId,
    first: opts.first ?? 50,
    filter: opts.filter ?? {},
  });
  if (r.error && !r.data) return { posts: [], error: r.error };
  const edges = r.data?.posts?.edges ?? [];
  return {
    posts: edges.map((e: any) => e.node) as BufferPost[],
    hasNextPage: r.data?.posts?.pageInfo?.hasNextPage ?? false,
    endCursor: r.data?.posts?.pageInfo?.endCursor ?? null,
    error: r.error,
  };
}

export async function getAllPosts(
  organizations: { id: string }[],
  opts: { first?: number; filter?: PostsFilters } = {},
): Promise<{ posts: BufferPost[]; error: string | null }> {
  const all: BufferPost[] = [];
  let lastError: string | null = null;
  for (const org of organizations) {
    const { posts, error } = await getPosts(org.id, opts);
    if (error && posts.length === 0) lastError = error;
    all.push(...posts);
  }
  return { posts: all, error: lastError };
}

// ---- Aggregated metrics ----

const AGG_QUERY = `query($input: AggregatedPostMetricsInput!) {
  aggregatedPostMetrics(input: $input) {
    metrics { name value description }
  }
}`;

export async function getAggregatedMetrics(
  input: { organizationId: string; startDate?: string; endDate?: string; channelIds?: string[] },
): Promise<{ metrics: AggregatedMetric[]; error: string | null }> {
  const r = await graphql<any>(AGG_QUERY, { input });
  if (r.error && !r.data) return { metrics: [], error: r.error };
  return { metrics: r.data?.aggregatedPostMetrics?.metrics ?? [], error: r.error };
}

// ---- Mutations ----

const CREATE_POST_MUTATION = `mutation($input: CreatePostInput!) {
  createPost(input: $input) {
    ... on PostActionPayload {
      post { id text status dueAt }
    }
  }
}`;

export async function createPost(input: {
  channelId: string;
  text: string;
  dueAt?: string | null;
  mode?: string;
  schedulingType?: string;
}): Promise<{ ok: boolean; post?: any; error?: string }> {
  const payload: any = {
    channelId: input.channelId,
    text: input.text,
    assets: [],
    mode: input.mode ?? (input.dueAt ? "customScheduled" : "addToQueue"),
    schedulingType: input.schedulingType ?? "automatic",
  };
  if (input.dueAt) payload.dueAt = input.dueAt;
  const r = await graphql<any>(CREATE_POST_MUTATION, { input: payload });
  if (r.error) return { ok: false, error: r.error };
  return { ok: true, post: r.data?.createPost?.post ?? null };
}

const EDIT_POST_MUTATION = `mutation($input: EditPostInput!) {
  editPost(input: $input) {
    ... on PostActionPayload {
      post { id text status dueAt }
    }
  }
}`;

export async function editPost(input: {
  id: string;
  text?: string;
  dueAt?: string | null;
}): Promise<{ ok: boolean; post?: any; error?: string }> {
  const payload: any = { id: input.id, assets: [] };
  if (input.text !== undefined) payload.text = input.text;
  if (input.dueAt !== undefined) payload.dueAt = input.dueAt;
  const r = await graphql<any>(EDIT_POST_MUTATION, { input: payload });
  if (r.error) return { ok: false, error: r.error };
  return { ok: true, post: r.data?.editPost?.post ?? null };
}

const DELETE_POST_MUTATION = `mutation($input: DeletePostInput!) {
  deletePost(input: $input) {
    ... on DeletePostPayload {
      success
    }
  }
}`;

export async function deletePost(id: string): Promise<{ ok: boolean; error?: string }> {
  const r = await graphql<any>(DELETE_POST_MUTATION, { input: { id } });
  if (r.error) return { ok: false, error: r.error };
  return { ok: true };
}

const MOVE_POST_MUTATION = `mutation($input: MovePostInQueueInput!) {
  movePostInQueue(input: $input) {
    ... on MovePostInQueuePayload {
      post { id }
    }
  }
}`;

export async function movePostInQueue(id: string, position: "top" | "bottom"): Promise<{ ok: boolean; error?: string }> {
  const r = await graphql<any>(MOVE_POST_MUTATION, { input: { id, position } });
  if (r.error) return { ok: false, error: r.error };
  return { ok: true };
}

// Share now = createPost with mode shareNow (no dueAt)
export async function shareNow(channelId: string, text: string): Promise<{ ok: boolean; post?: any; error?: string }> {
  return createPost({ channelId, text, mode: "shareNow" });
}

import { Platform } from 'react-native';

import { filterComments, filterPosts, isSubredditAllowed } from './filter';

export type Post = {
  id: string;
  title: string;
  subreddit: string;
  author: string;
  selftext: string;
  url: string;
  domain: string;
  permalink: string;
  score: number;
  numComments: number;
  createdUtc: number;
  isSelf: boolean;
  isVideo: boolean;
  over18: boolean;
  spoiler: boolean;
  quarantine: boolean;
  flair: string | null;
  image: { url: string; width: number; height: number } | null;
};

export type Comment = {
  id: string;
  author: string;
  body: string;
  score: number;
  depth: number;
  replies: Comment[];
};

export type Listing = { posts: Post[]; after: string | null; hiddenCount: number };

export type SortMode = 'hot' | 'top' | 'new' | 'rising';

export type RedditAuth = {
  /** Client ID of a Reddit "installed app" (reddit.com/prefs/apps). Optional. */
  clientId?: string;
  /** Web only: URL of the relay in proxy/reddit-proxy.js. */
  proxyUrl?: string;
};

/** Relay baked into the web build (GitHub repo variable REDDIT_PROXY_URL). */
export const BUILT_IN_PROXY = process.env.EXPO_PUBLIC_REDDIT_PROXY ?? '';

const WEB_NEEDS_PROXY =
  'Reddit doesn’t let websites load its posts directly. The phone app works without this; for the website, set up the free relay described in the README (or paste its URL in Settings → Reddit connection).';

const USER_AGENT = `${Platform.OS}:clean-reddit:v1.0.0 (open source reader)`;
const PUBLIC_BASE = 'https://www.reddit.com';
const OAUTH_BASE = 'https://oauth.reddit.com';

export class RedditError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

// ---------- OAuth (application-only, no Reddit login needed) ----------

let token: { value: string; clientId: string; expiresAt: number } | null = null;

function randomDeviceId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 30; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function base64(input: string) {
  if (typeof btoa === 'function') return btoa(input);
  // Hermes ships btoa, but keep a fallback for older runtimes.
  const table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < input.length; i += 3) {
    const [a, b, c] = [input.charCodeAt(i), input.charCodeAt(i + 1), input.charCodeAt(i + 2)];
    const n = (a << 16) | ((b || 0) << 8) | (c || 0);
    out += table[(n >> 18) & 63] + table[(n >> 12) & 63];
    out += i + 1 < input.length ? table[(n >> 6) & 63] : '=';
    out += i + 2 < input.length ? table[n & 63] : '=';
  }
  return out;
}

async function getToken(clientId: string): Promise<string> {
  if (token && token.clientId === clientId && token.expiresAt > Date.now() + 60_000) {
    return token.value;
  }
  const res = await fetch(`${PUBLIC_BASE}/api/v1/access_token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${base64(`${clientId}:`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(Platform.OS === 'web' ? {} : { 'User-Agent': USER_AGENT }),
    },
    body: `grant_type=${encodeURIComponent('https://oauth.reddit.com/grants/installed_client')}&device_id=${randomDeviceId()}`,
  });
  if (!res.ok) throw new RedditError('Reddit rejected the client ID. Check it in Settings.', res.status);
  const json = await res.json();
  token = {
    value: json.access_token,
    clientId,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return token.value;
}

async function request(path: string, params: Record<string, string>, auth?: RedditAuth) {
  const query = new URLSearchParams({ raw_json: '1', ...params }).toString();
  const headers: Record<string, string> = {};
  if (Platform.OS !== 'web') headers['User-Agent'] = USER_AGENT;

  let url: string;
  if (Platform.OS === 'web') {
    // Browsers can't call Reddit directly (no CORS), so the website always goes through the relay.
    const proxy = (auth?.proxyUrl || BUILT_IN_PROXY).trim().replace(/\/+$/, '');
    if (!proxy) throw new RedditError(WEB_NEEDS_PROXY);
    url = `${proxy}${path}.json?${query}`;
  } else if (auth?.clientId) {
    headers.Authorization = `Bearer ${await getToken(auth.clientId)}`;
    url = `${OAUTH_BASE}${path}?${query}`;
  } else {
    url = `${PUBLIC_BASE}${path}.json?${query}`;
  }

  let res: Response;
  try {
    res = await fetch(url, { headers });
  } catch {
    throw new RedditError(
      Platform.OS === 'web'
        ? 'Could not reach the Reddit relay. Check its URL in Settings → Reddit connection.'
        : 'Could not reach Reddit. Check your internet connection.',
    );
  }
  if (res.status === 429) throw new RedditError('Reddit is rate limiting requests. Try again in a minute.', 429);
  if (res.status === 403) {
    throw new RedditError(
      'Reddit blocked this request. Adding your own Reddit client ID in Settings usually fixes this.',
      403,
    );
  }
  if (!res.ok) throw new RedditError(`Reddit returned an error (${res.status}).`, res.status);
  return res.json();
}

// ---------- Normalisation ----------

function decodeEntities(s: string) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

export function normalizePost(d: any): Post {
  const preview = d.preview?.images?.[0]?.resolutions;
  // Pick a preview around 640px wide: sharp enough on phones, still light.
  const res = Array.isArray(preview) && preview.length ? (preview.find((r: any) => r.width >= 640) ?? preview[preview.length - 1]) : null;
  return {
    id: String(d.id),
    title: decodeEntities(String(d.title ?? '')),
    subreddit: String(d.subreddit ?? ''),
    author: String(d.author ?? '[deleted]'),
    selftext: String(d.selftext ?? ''),
    url: String(d.url ?? ''),
    domain: String(d.domain ?? ''),
    permalink: String(d.permalink ?? ''),
    score: Number(d.score ?? 0),
    numComments: Number(d.num_comments ?? 0),
    createdUtc: Number(d.created_utc ?? 0),
    isSelf: Boolean(d.is_self),
    isVideo: Boolean(d.is_video),
    over18: Boolean(d.over_18),
    spoiler: Boolean(d.spoiler),
    quarantine: Boolean(d.quarantine),
    flair: d.link_flair_text ? String(d.link_flair_text) : null,
    image: res ? { url: decodeEntities(res.url), width: res.width, height: res.height } : null,
  };
}

function normalizeComments(children: any[], depth = 0): Comment[] {
  const out: Comment[] = [];
  for (const child of children ?? []) {
    if (child?.kind !== 't1') continue;
    const d = child.data;
    out.push({
      id: String(d.id),
      author: String(d.author ?? '[deleted]'),
      body: String(d.body ?? ''),
      score: Number(d.score ?? 0),
      depth,
      replies: d.replies?.data?.children ? normalizeComments(d.replies.data.children, depth + 1) : [],
    });
  }
  return out;
}

// ---------- Public API ----------

export type FeedOptions = {
  subreddits: string[];
  sort: SortMode;
  after?: string | null;
  extraBlockedWords?: string[];
  strict?: boolean;
  auth?: RedditAuth;
};

export async function fetchFeed(opts: FeedOptions): Promise<Listing> {
  const subs = opts.subreddits.filter((s) => isSubredditAllowed(s));
  if (subs.length === 0) return { posts: [], after: null, hiddenCount: 0 };
  const params: Record<string, string> = { limit: '25' };
  if (opts.after) params.after = opts.after;
  if (opts.sort === 'top') params.t = 'week';
  const json = await request(`/r/${subs.join('+')}/${opts.sort}`, params, opts.auth);
  const raw: Post[] = (json?.data?.children ?? []).filter((c: any) => c.kind === 't3').map((c: any) => normalizePost(c.data));
  const posts = filterPosts(raw, { strict: opts.strict ?? true, extraWords: opts.extraBlockedWords ?? [] });
  return { posts, after: json?.data?.after ?? null, hiddenCount: raw.length - posts.length };
}

export async function fetchPost(
  id: string,
  opts: { auth?: RedditAuth; strict?: boolean; extraBlockedWords?: string[] } = {},
): Promise<{ post: Post | null; comments: Comment[] }> {
  const json = await request(`/comments/${id}`, { limit: '60', depth: '3', sort: 'top' }, opts.auth);
  const postData = json?.[0]?.data?.children?.[0]?.data;
  if (!postData) return { post: null, comments: [] };
  const post = normalizePost(postData);
  const filterOpts = { strict: opts.strict ?? true, extraWords: opts.extraBlockedWords ?? [] };
  if (filterPosts([post], filterOpts).length === 0) return { post: null, comments: [] };
  const comments = filterComments(normalizeComments(json?.[1]?.data?.children ?? []), filterOpts);
  return { post, comments };
}

/** Checks Reddit's own adult-content flag before letting the user add a subreddit. */
export async function checkSubreddit(name: string, auth?: RedditAuth): Promise<{ ok: boolean; reason?: string }> {
  const clean = name.replace(/^\/?r\//i, '').trim();
  if (!/^[A-Za-z0-9_]{2,21}$/.test(clean)) return { ok: false, reason: 'That is not a valid subreddit name.' };
  if (!isSubredditAllowed(clean)) return { ok: false, reason: 'This subreddit is blocked by the content filter.' };
  try {
    const json = await request(`/r/${clean}/about`, {}, auth);
    const d = json?.data;
    if (!d || json?.kind !== 't5') return { ok: false, reason: 'Subreddit not found.' };
    if (d.over18 || d.quarantine) return { ok: false, reason: 'This subreddit is marked as adult content.' };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'Could not reach Reddit.' };
  }
}

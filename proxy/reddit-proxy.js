/**
 * Tiny Cloudflare Worker that lets the Clean Reddit website read Reddit.
 *
 * Browsers block websites from calling reddit.com directly (Reddit sends no
 * CORS headers), so the web build asks this worker instead. It only forwards
 * the read-only endpoints the app uses and adds the CORS headers.
 *
 * Settings (Worker → Settings → Variables and Secrets):
 *   REDDIT_CLIENT_ID  (recommended) client ID of a Reddit "installed app" from
 *                     reddit.com/prefs/apps. Reddit often blocks anonymous
 *                     requests from cloud servers; with this set the worker uses
 *                     Reddit's official API instead.
 *   ALLOWED_ORIGIN    (optional) e.g. https://your-name.github.io — only that
 *                     site may use the worker. Defaults to any site.
 *
 * Content filtering happens in the app, not here.
 */

const USER_AGENT = 'web:clean-reddit-proxy:v1.0.0 (open source reader)';

// /r/<subs>/<sort>.json, /r/<sub>/about.json and /comments/<id>.json only.
const ALLOWED_PATH = /^\/(r\/[A-Za-z0-9_+]{2,400}\/(hot|new|top|rising|about)|comments\/[a-z0-9]{1,12})\.json$/;

let token = null;

async function getToken(clientId) {
  if (token && token.clientId === clientId && token.expiresAt > Date.now() + 60_000) return token.value;
  const deviceId = crypto.randomUUID().replace(/-/g, '').slice(0, 30);
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: `grant_type=${encodeURIComponent('https://oauth.reddit.com/grants/installed_client')}&device_id=${deviceId}`,
  });
  if (!res.ok) throw new Error(`token request failed (${res.status})`);
  const json = await res.json();
  token = { value: json.access_token, clientId, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return token.value;
}

function cors(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env) });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: cors(env) });

    const url = new URL(request.url);
    if (!ALLOWED_PATH.test(url.pathname)) return new Response('Not found', { status: 404, headers: cors(env) });

    let upstream;
    try {
      if (env.REDDIT_CLIENT_ID) {
        const accessToken = await getToken(env.REDDIT_CLIENT_ID);
        upstream = await fetch(`https://oauth.reddit.com${url.pathname.replace(/\.json$/, '')}${url.search}`, {
          headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': USER_AGENT },
        });
        if (upstream.status === 401) token = null; // expired early; next request gets a new one
      } else {
        upstream = await fetch(`https://www.reddit.com${url.pathname}${url.search}`, {
          headers: { 'User-Agent': USER_AGENT },
        });
      }
    } catch (e) {
      return new Response(`Could not reach Reddit: ${e.message}`, { status: 502, headers: cors(env) });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...cors(env),
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    });
  },
};

/**
 * AMS Class analytics Worker, routed on ams-class.tokenzhang.com/api/*; every other path is served by Cloudflare Pages.
 * Same first-party analytics as tokenzhang.com (beacon, cookies, source attribution, AnalyticsDO) in a Worker and
 * Durable Object of its own, so nothing is shared with the main site.
 *   POST /api/track             page-view beacon from the site's pages
 *   GET  /api/analytics/public  { uniqueVisitors, pageViews } for the footer
 *   GET  /api/analytics         full summary, gated by the optional ANALYTICS_KEY secret
 */
import { AnalyticsDO, type TrackEvent } from './analytics';

export { AnalyticsDO };

interface Env {
  ANALYTICS: DurableObjectNamespace<AnalyticsDO>;
  ANALYTICS_KEY?: string;
}

const VISITOR_COOKIE = 'tz_vid';
const SESSION_COOKIE = 'tz_sid';
const SESSION_MAX_AGE = 30 * 60;
const BOT_UA = /bot|crawler|spider|slurp|headless|phantom|pingdom|uptime|lighthouse|pagespeed|curl|wget|python|axios|fetch\//i;

const CAMPAIGN_SOURCES: Record<string, string> = {
  google: 'search:google',
  bing: 'search:bing',
  baidu: 'search:baidu',
  duckduckgo: 'search:duckduckgo',
  yahoo: 'search:yahoo',
  yandex: 'search:yandex',
  wechat: 'social:wechat',
  weixin: 'social:wechat',
  wechat_moments: 'social:wechat',
  'wechat-moments': 'social:wechat',
  weixin_moments: 'social:wechat',
  moments: 'social:wechat',
  linkedin: 'social:linkedin',
  twitter: 'social:x',
  x: 'social:x',
  facebook: 'social:facebook',
  instagram: 'social:instagram',
  reddit: 'social:reddit',
  github: 'social:github',
  zhihu: 'social:zhihu',
  bilibili: 'social:bilibili',
  xiaohongshu: 'social:xiaohongshu',
  rednote: 'social:xiaohongshu',
  email: 'campaign:email',
  newsletter: 'campaign:email',
  qr: 'campaign:qr',
  qrcode: 'campaign:qr',
  rss: 'campaign:rss',
};

const REFERRER_CATEGORIES: [string, string[]][] = [
  ['search:bing', ['bing.com']],
  ['search:baidu', ['baidu.com']],
  ['search:duckduckgo', ['duckduckgo.com']],
  ['search:yahoo', ['yahoo.com']],
  ['search:yandex', ['yandex.com', 'yandex.ru']],
  ['search:ecosia', ['ecosia.org']],
  ['search:naver', ['naver.com']],
  ['search:sogou', ['sogou.com']],
  ['search:360', ['so.com']],
  ['social:wechat', ['weixin.qq.com', 'weixin110.qq.com', 'servicewechat.com', 'wechat.com']],
  ['social:linkedin', ['linkedin.com', 'lnkd.in']],
  ['social:x', ['x.com', 'twitter.com', 't.co']],
  ['social:facebook', ['facebook.com', 'fb.com']],
  ['social:instagram', ['instagram.com']],
  ['social:reddit', ['reddit.com', 'redd.it']],
  ['social:github', ['github.com']],
  ['social:zhihu', ['zhihu.com']],
  ['social:bilibili', ['bilibili.com']],
  ['social:xiaohongshu', ['xiaohongshu.com', 'xhslink.com']],
];

const KNOWN_SOURCES = new Set([
  'direct-or-unknown',
  'campaign:other',
  'ref:other',
  ...Object.values(CAMPAIGN_SOURCES),
  ...REFERRER_CATEGORIES.map(([source]) => source),
]);

const analytics = (env: Env) => env.ANALYTICS.get(env.ANALYTICS.idFromName('ams-class'));

function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get('Cookie') ?? '').split(';')) {
    const [key, value] = part.split('=').map((s) => s.trim());
    if (key === name && value && /^[A-Za-z0-9._:-]{1,120}$/.test(value)) return value;
  }
  return null;
}

const readVisitorId = (request: Request): string | null => {
  const value = readCookie(request, VISITOR_COOKIE);
  return value && /^[A-Za-z0-9-]{8,64}$/.test(value) ? value : null;
};

const readSessionSource = (request: Request): string | null => {
  const value = readCookie(request, SESSION_COOKIE);
  return value && (KNOWN_SOURCES.has(value) || /^ref:[a-z0-9.-]{1,100}$/.test(value)) ? value : null;
};

/** Page path only (no query), or null for anything that is not a page. */
function trackedPath(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('/api/')) return null;
  return raw.split(/[?#]/)[0].slice(0, 120);
}

const canonicalHost = (hostname: string) => hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');

/** Reduce an entry referrer or an allow-listed utm_source to a bounded category; URLs and queries are never kept. */
function acquisitionSource(referrer: unknown, campaign: unknown, site: URL): string {
  if (typeof campaign === 'string' && campaign.trim()) {
    const key = campaign.trim().toLowerCase();
    return /^[a-z0-9._-]{1,40}$/.test(key) ? (CAMPAIGN_SOURCES[key] ?? 'campaign:other') : 'campaign:other';
  }
  if (typeof referrer !== 'string' || !URL.canParse(referrer)) return 'direct-or-unknown';
  const url = new URL(referrer);
  const host = canonicalHost(url.hostname);
  if (!url.protocol.startsWith('http') || !host || host === canonicalHost(site.hostname)) return 'direct-or-unknown';
  if (/^google\.[a-z.]+$/.test(host)) return 'search:google';
  const known = REFERRER_CATEGORIES.find(([, domains]) => domains.some((d) => host === d || host.endsWith(`.${d}`)));
  if (known) return known[0];
  return /^[a-z0-9.-]{1,100}$/.test(host) ? `ref:${host}` : 'ref:other';
}

/** Reject cross-site submissions: Origin first, then Fetch Metadata, then Referer for browsers that omit both. */
function isSameOrigin(request: Request): boolean {
  const expected = new URL(request.url).origin;
  const origin = request.headers.get('Origin');
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  if (origin && origin !== expected) return false;
  if (fetchSite && fetchSite !== 'same-origin') return false;
  if (origin || fetchSite === 'same-origin') return true;
  const referer = request.headers.get('Referer');
  return referer !== null && URL.canParse(referer) && new URL(referer).origin === expected;
}

async function handleTrack(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  // Do Not Track, bots, probes and foreign pages are acknowledged but not counted.
  const skip = new Response(null, { status: 204 });
  const ua = request.headers.get('User-Agent') ?? '';
  if (!isSameOrigin(request) || request.headers.get('DNT') === '1' || !ua || BOT_UA.test(ua)) return skip;

  const payload = await request.json<{ p?: unknown; r?: unknown; s?: unknown }>().catch(() => null);
  const path = trackedPath(payload?.p);
  if (!path) return skip;

  const url = new URL(request.url);
  const vid = readVisitorId(request);
  const sessionSource = readSessionSource(request);
  const cf = request.cf as { country?: string; latitude?: string; longitude?: string } | undefined;
  const country = cf?.country?.toUpperCase() ?? '';
  const coordinate = (value?: string) => (value && Number.isFinite(Number.parseFloat(value)) ? Number.parseFloat(value) : null);
  const event: TrackEvent = {
    path,
    day: new Date().toISOString().slice(0, 10),
    vid: vid ?? crypto.randomUUID(),
    country: /^[A-Z0-9]{2}$/.test(country) ? country : 'XX',
    lat: coordinate(cf?.latitude),
    lng: coordinate(cf?.longitude),
    source: sessionSource ?? acquisitionSource(payload?.r, payload?.s, url),
    isNewSession: sessionSource === null,
  };
  await analytics(env).track(event);

  const headers = new Headers({ 'Cache-Control': 'no-store' });
  const attributes = `Path=/; HttpOnly; SameSite=Lax${url.protocol === 'https:' ? '; Secure' : ''}`;
  if (!vid) headers.append('Set-Cookie', `${VISITOR_COOKIE}=${event.vid}; Max-Age=63072000; ${attributes}`);
  headers.append('Set-Cookie', `${SESSION_COOKIE}=${event.source}; Max-Age=${SESSION_MAX_AGE}; ${attributes}`);
  return new Response(null, { status: 204, headers });
}

async function handlePublicSummary(env: Env): Promise<Response> {
  const summary = await analytics(env).summary();
  return Response.json(
    { uniqueVisitors: summary.totals.uv, pageViews: summary.totals.pv },
    { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60' } },
  );
}

async function handleSummary(request: Request, env: Env): Promise<Response> {
  if (env.ANALYTICS_KEY && new URL(request.url).searchParams.get('key') !== env.ANALYTICS_KEY) {
    return new Response('Forbidden', { status: 403 });
  }
  return Response.json(await analytics(env).summary(), { headers: { 'Cache-Control': 'no-store' } });
}

export default {
  fetch(request, env) {
    const { pathname } = new URL(request.url);
    const read = request.method === 'GET' || request.method === 'HEAD';
    if (pathname === '/api/track') return handleTrack(request, env);
    if (pathname === '/api/analytics/public' && read) return handlePublicSummary(env);
    if (pathname === '/api/analytics' && read) return handleSummary(request, env);
    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;

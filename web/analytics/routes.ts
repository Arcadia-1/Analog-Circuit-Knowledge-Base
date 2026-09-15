import type { Hono } from "hono";
import {
  cacheStatsResponse,
  queryAnalyticsSummary,
  queryVisitStats,
  readSessionSource,
  readVisitorId,
  recordPageView,
  sessionCookie,
  statsCacheKey,
  visitorCookie,
} from "./worker";

const BOT_UA =
  /bot|crawler|spider|slurp|headless|phantom|pingdom|uptime|lighthouse|pagespeed|curl|wget|python|axios|fetch\//i;

const CAMPAIGN_SOURCES: Record<string, string> = {
  google: "search:google",
  bing: "search:bing",
  baidu: "search:baidu",
  duckduckgo: "search:duckduckgo",
  yahoo: "search:yahoo",
  yandex: "search:yandex",
  wechat: "social:wechat",
  weixin: "social:wechat",
  wechat_moments: "social:wechat",
  "wechat-moments": "social:wechat",
  weixin_moments: "social:wechat",
  moments: "social:wechat",
  linkedin: "social:linkedin",
  twitter: "social:x",
  x: "social:x",
  facebook: "social:facebook",
  instagram: "social:instagram",
  reddit: "social:reddit",
  github: "social:github",
  zhihu: "social:zhihu",
  bilibili: "social:bilibili",
  xiaohongshu: "social:xiaohongshu",
  rednote: "social:xiaohongshu",
  email: "campaign:email",
  newsletter: "campaign:email",
  qr: "campaign:qr",
  qrcode: "campaign:qr",
  rss: "campaign:rss",
};

const REFERRER_CATEGORIES: readonly (readonly [string, readonly string[]])[] = [
  ["search:bing", ["bing.com"]],
  ["search:baidu", ["baidu.com"]],
  ["search:duckduckgo", ["duckduckgo.com"]],
  ["search:yahoo", ["yahoo.com"]],
  ["search:yandex", ["yandex.com", "yandex.ru"]],
  ["search:ecosia", ["ecosia.org"]],
  ["search:naver", ["naver.com"]],
  ["search:sogou", ["sogou.com"]],
  ["search:360", ["so.com"]],
  ["social:wechat", ["weixin.qq.com", "weixin110.qq.com", "servicewechat.com", "wechat.com"]],
  ["social:linkedin", ["linkedin.com", "lnkd.in"]],
  ["social:x", ["x.com", "twitter.com", "t.co"]],
  ["social:facebook", ["facebook.com", "fb.com"]],
  ["social:instagram", ["instagram.com"]],
  ["social:reddit", ["reddit.com", "redd.it"]],
  ["social:github", ["github.com"]],
  ["social:zhihu", ["zhihu.com"]],
  ["social:bilibili", ["bilibili.com"]],
  ["social:xiaohongshu", ["xiaohongshu.com", "xhslink.com"]],
];

function normalizeTrackedPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let path = raw.split("?")[0]?.split("#")[0] ?? "";
  if (!path.startsWith("/")) return null;
  if (path.length > 120) path = path.slice(0, 120);
  if (path.startsWith("/api/") || path.startsWith("/analytics")) return null;
  return path;
}

function canonicalHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
}

function hostnameMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function normalizeAcquisitionSource(
  rawReferrer: unknown,
  rawCampaignSource: unknown,
  siteUrl: URL,
): string {
  if (typeof rawCampaignSource === "string" && rawCampaignSource.trim()) {
    const key = rawCampaignSource.trim().toLowerCase();
    if (!/^[a-z0-9._-]{1,40}$/.test(key)) return "campaign:other";
    return CAMPAIGN_SOURCES[key] ?? "campaign:other";
  }
  if (typeof rawReferrer !== "string" || !rawReferrer.trim()) {
    return "direct-or-unknown";
  }

  try {
    const referrer = new URL(rawReferrer);
    if (referrer.protocol !== "http:" && referrer.protocol !== "https:") {
      return "direct-or-unknown";
    }
    const hostname = canonicalHostname(referrer.hostname);
    const siteHostname = canonicalHostname(siteUrl.hostname);
    if (!hostname || hostname === siteHostname) return "direct-or-unknown";
    if (/^google\.[a-z.]+$/.test(hostname)) return "search:google";
    for (const [source, domains] of REFERRER_CATEGORIES) {
      if (domains.some((domain) => hostnameMatches(hostname, domain))) return source;
    }
    return /^[a-z0-9.-]{1,100}$/.test(hostname) ? `ref:${hostname}` : "ref:other";
  } catch {
    return "direct-or-unknown";
  }
}

function normalizedSessionSource(value: string | null): string | null {
  if (!value) return null;
  if (
    value === "direct-or-unknown"
    || value === "campaign:other"
    || value === "ref:other"
    || Object.values(CAMPAIGN_SOURCES).includes(value)
    || REFERRER_CATEGORIES.some(([source]) => source === value)
    || /^ref:[a-z0-9.-]{1,100}$/.test(value)
  ) return value;
  return null;
}

function isSameOriginTrackRequest(request: Request): boolean {
  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get("Origin");
  const fetchSite = request.headers.get("Sec-Fetch-Site");
  if (origin && origin !== expectedOrigin) return false;
  if (fetchSite && fetchSite !== "same-origin") return false;
  if (origin || fetchSite === "same-origin") return true;

  const referer = request.headers.get("Referer");
  if (!referer) return false;
  try {
    return new URL(referer).origin === expectedOrigin;
  } catch {
    return false;
  }
}

interface RequestCf {
  country?: string;
  latitude?: string;
  longitude?: string;
}

function cfNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Mount the complete analytics HTTP API on the host Hono application. */
export function registerAnalyticsRoutes(app: Hono<{ Bindings: Env }>): void {
  app.post("/api/hit", async (c) => {
    const noContent = () => new Response(null, { status: 204 });
    const request = c.req.raw;
    if (!isSameOriginTrackRequest(request)) return noContent();
    if (c.req.header("DNT") === "1") return noContent();
    const userAgent = c.req.header("User-Agent") ?? "";
    if (!userAgent || BOT_UA.test(userAgent)) return noContent();

    const payload = (await c.req.json().catch(() => null)) as {
      p?: unknown;
      r?: unknown;
      s?: unknown;
    } | null;
    const path = normalizeTrackedPath(payload?.p);
    if (!path) return noContent();

    const cookieHeader = c.req.header("Cookie");
    const existing = readVisitorId(cookieHeader);
    const visitorId = existing ?? crypto.randomUUID();
    const previousSource = normalizedSessionSource(readSessionSource(cookieHeader));
    const source = previousSource
      ?? normalizeAcquisitionSource(payload?.r, payload?.s, new URL(c.req.url));
    const cf = (request as Request & { cf?: RequestCf }).cf ?? {};
    const rawCountry = typeof cf.country === "string" ? cf.country.toUpperCase() : "";
    const country = /^[A-Z0-9]{2}$/.test(rawCountry) ? rawCountry : "XX";
    const secure = c.req.url.startsWith("https://");
    const headers = new Headers({ "cache-control": "no-store" });
    if (!existing) headers.append("Set-Cookie", visitorCookie(visitorId, secure));
    headers.append("Set-Cookie", sessionCookie(source, secure));

    try {
      const stats = await recordPageView(c.env.VISIT_STATS, visitorId, {
        path,
        country,
        lat: cfNumber(cf.latitude),
        lng: cfNumber(cf.longitude),
        source,
      });
      c.executionCtx.waitUntil(
        caches.default.put(statsCacheKey(c.req.url), cacheStatsResponse(stats)),
      );
      return Response.json(stats, { headers });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to record page view";
      return Response.json({ error: message }, { status: 502, headers });
    }
  });

  app.get("/api/analytics", async (c) => {
    const analyticsKey = (c.env as Env & { ANALYTICS_KEY?: string }).ANALYTICS_KEY;
    if (analyticsKey && c.req.query("key") !== analyticsKey) {
      return c.json({ error: "Forbidden" }, 403, { "cache-control": "no-store" });
    }
    try {
      const summary = await queryAnalyticsSummary(c.env.VISIT_STATS);
      return c.json(summary, 200, { "cache-control": "no-store" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to query analytics";
      return c.json({ error: message }, 502, { "cache-control": "no-store" });
    }
  });

  app.get("/api/stats", async (c) => {
    const cache = caches.default;
    const cacheKey = statsCacheKey(c.req.url);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    try {
      const stats = await queryVisitStats(c.env.VISIT_STATS);
      const response = cacheStatsResponse(stats);
      c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to query visit stats";
      return c.json(
        {
          error: message,
          hint: "Durable Object visit tracking is temporarily unavailable.",
        },
        502,
      );
    }
  });
}

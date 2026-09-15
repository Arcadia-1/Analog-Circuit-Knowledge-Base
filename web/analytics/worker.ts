import { DurableObject } from "cloudflare:workers";

const VISITOR_COOKIE = "adb_vid";
const SESSION_COOKIE = "adb_sid";
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const SESSION_COOKIE_MAX_AGE = 30 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;
const RETAINED_DAYS = 400;
const STATS_CACHE_TTL_SECONDS = 5 * 60;
const STATS_CACHE_TTL_MS = STATS_CACHE_TTL_SECONDS * 1000;
const VISITOR_HASH_PATTERN = /^[0-9a-f]{64}$/;
const DURABLE_OBJECT_NAME = "global";
const OTHER_KEY = "__other__";
const ANALYTICS_SCHEMA_VERSION = "2";

const BREAKDOWN_TABLES = {
  countries: "analytics_countries",
  sources: "analytics_sources",
  pages: "analytics_pages",
} as const;

export type VisitStats = {
  pv: number;
  uv: number;
};

export type VisitStatsResponse = VisitStats & {
  scope: "all";
};

export type PageViewEvent = {
  visitorHash: string;
  path: string;
  country: string;
  lat: number | null;
  lng: number | null;
  source: string;
};

export type AnalyticsSummary = {
  generatedAt: string;
  totals: VisitStats;
  today: { date: string; pv: number; uv: number };
  days: { date: string; pv: number; uv: number }[];
  countries: { code: string; pv: number; uv: number }[];
  points: { lat: number; lng: number; count: number }[];
  paths: { path: string; pv: number; uv: number }[];
  sources: { source: string; pv: number; uv: number }[];
  breakdownStartedAt: string;
  breakdownTotals: {
    countries: VisitStats;
    sources: VisitStats;
    pages: VisitStats;
  };
};

type StatsRow = {
  pv: number;
  uv: number;
};

type StatsCacheRow = StatsRow & {
  computed_at: number;
};

type BreakdownRow = {
  dimension_key: string;
  pv: number;
  uv: number;
};

type DailyViewsRow = {
  day: number;
  views: number;
};

type DailyVisitorsRow = {
  day: number;
  visitors: number;
};

type PointRow = {
  lat: number;
  lng: number;
  count: number;
};

export class VisitStatsDurableObject extends DurableObject<Env> {
  private readonly sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.initializeSchema(ctx);
  }

  private initializeSchema(ctx: DurableObjectState): void {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS visitors (
        visitor_hash TEXT PRIMARY KEY,
        last_seen_day INTEGER NOT NULL
      ) WITHOUT ROWID
    `);
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_visitors_last_seen_day
      ON visitors(last_seen_day)
    `);
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS daily_views (
        day INTEGER PRIMARY KEY,
        views INTEGER NOT NULL
      )
    `);
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS stats_cache (
        days INTEGER PRIMARY KEY,
        computed_at INTEGER NOT NULL,
        pv INTEGER NOT NULL,
        uv INTEGER NOT NULL
      )
    `);
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS daily_visitors (
        day INTEGER NOT NULL,
        visitor_hash TEXT NOT NULL,
        PRIMARY KEY (day, visitor_hash)
      ) WITHOUT ROWID
    `);
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS analytics_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      ) WITHOUT ROWID
    `);
    for (const table of Object.values(BREAKDOWN_TABLES)) {
      this.sql.exec(`
        CREATE TABLE IF NOT EXISTS ${table} (
          dimension_key TEXT PRIMARY KEY,
          pv INTEGER NOT NULL,
          uv INTEGER NOT NULL
        ) WITHOUT ROWID
      `);
    }
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS analytics_points (
        lat INTEGER NOT NULL,
        lng INTEGER NOT NULL,
        count INTEGER NOT NULL,
        PRIMARY KEY (lat, lng)
      ) WITHOUT ROWID
    `);

    const schemaVersion = this.sql
      .exec<{ value: string }>("SELECT value FROM analytics_meta WHERE key = 'schema_version'")
      .toArray()[0]?.value;
    if (schemaVersion === ANALYTICS_SCHEMA_VERSION) return;

    // The previous lifetime-only schema cannot reconstruct daily UV or any
    // dimension. Reset once so totals, days, and breakdowns share one epoch.
    ctx.storage.transactionSync(() => {
      this.sql.exec("DELETE FROM visitors");
      this.sql.exec("DELETE FROM daily_views");
      this.sql.exec("DELETE FROM daily_visitors");
      this.sql.exec("DELETE FROM stats_cache");
      this.sql.exec("DELETE FROM analytics_countries");
      this.sql.exec("DELETE FROM analytics_sources");
      this.sql.exec("DELETE FROM analytics_pages");
      this.sql.exec("DELETE FROM analytics_points");
      this.sql.exec("DELETE FROM analytics_meta");
      this.sql.exec(
        "INSERT INTO analytics_meta(key, value) VALUES ('schema_version', ?)",
        ANALYTICS_SCHEMA_VERSION,
      );
      this.sql.exec(
        "INSERT INTO analytics_meta(key, value) VALUES ('breakdown_started_at', ?)",
        new Date().toISOString(),
      );
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/hit") {
      const event = (await request.json().catch(() => null)) as PageViewEvent | null;
      if (!isValidEvent(event)) {
        return Response.json({ error: "Invalid analytics event" }, { status: 400 });
      }

      const now = Date.now();
      this.recordHit(event, now);
      return Response.json({ ...this.readStats(now), scope: "all" });
    }

    if (request.method === "GET" && url.pathname === "/stats") {
      return Response.json({ ...this.readStats(Date.now()), scope: "all" });
    }

    if (request.method === "GET" && url.pathname === "/analytics") {
      return Response.json(this.readAnalyticsSummary());
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  }

  private recordHit(event: PageViewEvent, now: number): void {
    const today = utcDay(now);

    this.ctx.storage.transactionSync(() => {
      const knownVisitor = this.sql
        .exec<{ visitor_hash: string }>(
          "SELECT visitor_hash FROM visitors WHERE visitor_hash = ?",
          event.visitorHash,
        )
        .toArray()[0];
      const uvDelta = knownVisitor ? 0 : 1;

      this.sql.exec(
        `
          INSERT INTO daily_views(day, views)
          VALUES (?, 1)
          ON CONFLICT(day) DO UPDATE SET views = views + 1
        `,
        today,
      );
      this.sql.exec(
        "INSERT OR IGNORE INTO daily_visitors(day, visitor_hash) VALUES (?, ?)",
        today,
        event.visitorHash,
      );
      this.sql.exec("DELETE FROM daily_visitors WHERE day < ?", today - (RETAINED_DAYS - 1));
      this.sql.exec(
        `
          INSERT INTO visitors(visitor_hash, last_seen_day)
          VALUES (?, ?)
          ON CONFLICT(visitor_hash) DO UPDATE SET last_seen_day = excluded.last_seen_day
          WHERE visitors.last_seen_day < excluded.last_seen_day
        `,
        event.visitorHash,
        today,
      );

      this.upsertBreakdown(BREAKDOWN_TABLES.countries, event.country, uvDelta);
      this.upsertBreakdown(BREAKDOWN_TABLES.sources, event.source, uvDelta);
      this.upsertBreakdown(BREAKDOWN_TABLES.pages, event.path, uvDelta);

      if (event.lat != null && event.lng != null) {
        const lat = Math.round(event.lat);
        const lng = Math.round(event.lng);
        this.sql.exec(
          `
            INSERT INTO analytics_points(lat, lng, count)
            VALUES (?, ?, 1)
            ON CONFLICT(lat, lng) DO UPDATE SET count = count + 1
          `,
          lat,
          lng,
        );
        this.trimPoints(2000);
      }

      this.sql.exec("DELETE FROM stats_cache");
    });
  }

  private upsertBreakdown(table: string, key: string, uvDelta: number): void {
    this.sql.exec(
      `
        INSERT INTO ${table}(dimension_key, pv, uv)
        VALUES (?, 1, ?)
        ON CONFLICT(dimension_key) DO UPDATE SET
          pv = pv + 1,
          uv = uv + excluded.uv
      `,
      key,
      uvDelta,
    );
  }

  private trimPoints(maxRows: number): void {
    const count = this.sql.exec<{ count: number }>("SELECT COUNT(*) AS count FROM analytics_points").one();
    const excess = Number(count.count) - maxRows;
    if (excess <= 0) return;
    const rows = this.sql
      .exec<PointRow>(
        "SELECT lat, lng, count FROM analytics_points ORDER BY count ASC LIMIT ?",
        excess,
      )
      .toArray();
    for (const row of rows) {
      this.sql.exec("DELETE FROM analytics_points WHERE lat = ? AND lng = ?", row.lat, row.lng);
    }
  }

  private readStats(now: number): VisitStats {
    const cached = this.sql
      .exec<StatsCacheRow>("SELECT computed_at, pv, uv FROM stats_cache WHERE days = 0")
      .toArray()[0];
    if (cached && now - Number(cached.computed_at) < STATS_CACHE_TTL_MS) {
      return { pv: Number(cached.pv), uv: Number(cached.uv) };
    }

    const stats = this.computeStats();
    this.sql.exec(
      `
        INSERT INTO stats_cache(days, computed_at, pv, uv)
        VALUES (0, ?, ?, ?)
        ON CONFLICT(days) DO UPDATE SET
          computed_at = excluded.computed_at,
          pv = excluded.pv,
          uv = excluded.uv
      `,
      now,
      stats.pv,
      stats.uv,
    );
    return stats;
  }

  private computeStats(): VisitStats {
    const pv = this.sql
      .exec<{ pv: number }>("SELECT COALESCE(SUM(views), 0) AS pv FROM daily_views")
      .one();
    const uv = this.sql.exec<{ uv: number }>("SELECT COUNT(*) AS uv FROM visitors").one();
    return { pv: Number(pv.pv), uv: Number(uv.uv) };
  }

  private readAnalyticsSummary(): AnalyticsSummary {
    const today = utcDay(Date.now());
    const firstDay = today - (RETAINED_DAYS - 1);
    const viewRows = this.sql
      .exec<DailyViewsRow>(
        "SELECT day, views FROM daily_views WHERE day >= ? ORDER BY day",
        firstDay,
      )
      .toArray();
    const visitorRows = this.sql
      .exec<DailyVisitorsRow>(
        `
          SELECT day, COUNT(*) AS visitors
          FROM daily_visitors
          WHERE day >= ?
          GROUP BY day
          ORDER BY day
        `,
        firstDay,
      )
      .toArray();
    const viewsByDay = new Map(viewRows.map((row) => [Number(row.day), Number(row.views)]));
    const visitorsByDay = new Map(
      visitorRows.map((row) => [Number(row.day), Number(row.visitors)]),
    );
    const days = Array.from({ length: RETAINED_DAYS }, (_, index) => {
      const day = firstDay + index;
      return {
        date: utcDate(day),
        pv: viewsByDay.get(day) ?? 0,
        uv: visitorsByDay.get(day) ?? 0,
      };
    });

    const countries = this.readBreakdown(BREAKDOWN_TABLES.countries).map((row) => ({
      code: row.dimension_key,
      pv: Number(row.pv),
      uv: Number(row.uv),
    }));
    const sources = this.readBreakdown(BREAKDOWN_TABLES.sources).map((row) => ({
      source: row.dimension_key,
      pv: Number(row.pv),
      uv: Number(row.uv),
    }));
    const paths = this.readBreakdown(BREAKDOWN_TABLES.pages).map((row) => ({
      path: row.dimension_key,
      pv: Number(row.pv),
      uv: Number(row.uv),
    }));
    const points = this.sql
      .exec<PointRow>(
        "SELECT lat, lng, count FROM analytics_points ORDER BY count DESC LIMIT 2000",
      )
      .toArray()
      .map((row) => ({ lat: Number(row.lat), lng: Number(row.lng), count: Number(row.count) }));
    const totals = this.computeStats();

    return {
      generatedAt: new Date().toISOString(),
      totals,
      today: days[days.length - 1] ?? { date: utcDate(today), pv: 0, uv: 0 },
      days,
      countries,
      points,
      paths,
      sources,
      breakdownStartedAt: this.sql
        .exec<{ value: string }>(
          "SELECT value FROM analytics_meta WHERE key = 'breakdown_started_at'",
        )
        .one().value,
      breakdownTotals: {
        countries: this.breakdownTotal(BREAKDOWN_TABLES.countries),
        sources: this.breakdownTotal(BREAKDOWN_TABLES.sources),
        pages: this.breakdownTotal(BREAKDOWN_TABLES.pages),
      },
    };
  }

  private readBreakdown(table: string): BreakdownRow[] {
    const rows = this.sql
      .exec<BreakdownRow>(
        `SELECT dimension_key, pv, uv FROM ${table} ORDER BY pv DESC, uv DESC`,
      )
      .toArray();
    const other = rows.find((row) => row.dimension_key === OTHER_KEY);
    const regular = rows.filter((row) => row.dimension_key !== OTHER_KEY);
    return other ? [...regular, other] : regular;
  }

  private breakdownTotal(table: string): VisitStats {
    const row = this.sql
      .exec<StatsRow>(`SELECT COALESCE(SUM(pv), 0) AS pv, COALESCE(SUM(uv), 0) AS uv FROM ${table}`)
      .one();
    return { pv: Number(row.pv), uv: Number(row.uv) };
  }
}

function isValidEvent(event: PageViewEvent | null): event is PageViewEvent {
  return Boolean(
    event
      && VISITOR_HASH_PATTERN.test(event.visitorHash)
      && typeof event.path === "string"
      && event.path.startsWith("/")
      && event.path.length <= 120
      && typeof event.country === "string"
      && /^[A-Z0-9]{2}$/.test(event.country)
      && typeof event.source === "string"
      && event.source.length > 0
      && event.source.length <= 120
      && (event.lat == null || (Number.isFinite(event.lat) && event.lat >= -90 && event.lat <= 90))
      && (event.lng == null || (Number.isFinite(event.lng) && event.lng >= -180 && event.lng <= 180)),
  );
}

export function readCookieValue(cookieHeader: string | undefined, cookieName: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey !== cookieName) continue;
    const value = rest.join("=").trim();
    return /^[A-Za-z0-9._:-]{1,120}$/.test(value) ? value : null;
  }
  return null;
}

export function readVisitorId(cookieHeader: string | undefined): string | null {
  const value = readCookieValue(cookieHeader, VISITOR_COOKIE);
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

export function readSessionSource(cookieHeader: string | undefined): string | null {
  return readCookieValue(cookieHeader, SESSION_COOKIE);
}

function cookie(
  name: string,
  value: string,
  maxAge: number,
  secure: boolean,
): string {
  const parts = [
    `${name}=${value}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "SameSite=Lax",
    "HttpOnly",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function visitorCookie(visitorId: string, secure: boolean): string {
  return cookie(VISITOR_COOKIE, visitorId, VISITOR_COOKIE_MAX_AGE, secure);
}

export function sessionCookie(source: string, secure: boolean): string {
  return cookie(SESSION_COOKIE, source, SESSION_COOKIE_MAX_AGE, secure);
}

export async function recordPageView(
  namespace: DurableObjectNamespace,
  visitorId: string,
  event: Omit<PageViewEvent, "visitorHash">,
): Promise<VisitStatsResponse> {
  const visitorHash = await hashVisitorId(visitorId);
  const stub = namespace.getByName(DURABLE_OBJECT_NAME);
  const response = await stub.fetch("https://visit-stats.internal/hit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...event, visitorHash }),
  });
  if (!response.ok) throw new Error(`Visit tracking failed (${response.status})`);
  return response.json<VisitStatsResponse>();
}

export async function queryVisitStats(
  namespace: DurableObjectNamespace,
): Promise<VisitStats> {
  const stub = namespace.getByName(DURABLE_OBJECT_NAME);
  const response = await stub.fetch("https://visit-stats.internal/stats");
  if (!response.ok) throw new Error(`Visit stats failed (${response.status})`);
  return response.json<VisitStats>();
}

export async function queryAnalyticsSummary(
  namespace: DurableObjectNamespace,
): Promise<AnalyticsSummary> {
  const stub = namespace.getByName(DURABLE_OBJECT_NAME);
  const response = await stub.fetch("https://visit-stats.internal/analytics");
  if (!response.ok) throw new Error(`Analytics summary failed (${response.status})`);
  return response.json<AnalyticsSummary>();
}

export function statsCacheKey(requestUrl: string): Request {
  const url = new URL(requestUrl);
  url.pathname = "/api/stats";
  url.search = "";
  return new Request(url.toString());
}

export function cacheStatsResponse(stats: VisitStats): Response {
  return Response.json(
    { ...stats, scope: "all" },
    { headers: { "cache-control": `public, max-age=${STATS_CACHE_TTL_SECONDS}` } },
  );
}

function utcDay(timestamp: number): number {
  return Math.floor(timestamp / DAY_MS);
}

function utcDate(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

async function hashVisitorId(visitorId: string): Promise<string> {
  const bytes = new TextEncoder().encode(visitorId);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Analytics Durable Object, the same counters as tokenzhang.com (src/analytics.ts there) without its legacy data
 * migrations. One instance keeps page views, unique visitors and request origins in a single JSON document ("v1"):
 * - pv / uv        all-time totals
 * - days           UTC date -> { pv, uv } (uv = distinct visitor ids per day)
 * - seen           today's visitor ids for the daily dedupe
 * - countries      ISO 3166-1 alpha-2 -> views
 * - points         "lat,lng" (1° buckets from request.cf) -> views
 * - paths          page path -> views
 * - sourceVisits   attributed 30-minute entry sessions
 * - sources        normalised acquisition source -> visits
 * - breakdowns     a 65,536-bit visitor sketch plus additive UV / PV per country, source and page
 * Calls to one instance are serialised and share one loaded document, so mutate-then-write stays consistent.
 */
import { DurableObject } from 'cloudflare:workers';

export interface TrackEvent {
  path: string;
  /** UTC date, YYYY-MM-DD */
  day: string;
  vid: string;
  /** ISO country code, or 'XX' when unknown */
  country: string;
  lat: number | null;
  lng: number | null;
  /** Normalised acquisition source kept for the current 30-minute session */
  source: string;
  isNewSession: boolean;
}

interface Stat {
  pv: number;
  uv: number;
}

interface Breakdowns {
  startedAt: string;
  /** Base64 bitmap of hashed visitor ids; the ids themselves are not kept */
  visitorSketch: string;
  countries: Record<string, Stat>;
  sources: Record<string, Stat>;
  paths: Record<string, Stat>;
}

interface AnalyticsData {
  pv: number;
  uv: number;
  days: Record<string, Stat>;
  seen: { day: string; vids: string[] };
  countries: Record<string, number>;
  points: Record<string, number>;
  paths: Record<string, number>;
  sourceVisits: number;
  sources: Record<string, number>;
  breakdowns: Breakdowns;
}

const STORAGE_KEY = 'v1';
const MAX_DAYS = 400;
const MAX_POINTS = 2000;
const MAX_COUNTRIES = 250;
const MAX_PATHS = 100;
const MAX_SOURCES = 100;
const TOP_COUNTRIES = 15;
const TOP_PATHS = 25;
const TOP_SOURCES = 25;
const MAX_SEEN_PER_DAY = 10000;
const VISITOR_BITMAP_BITS = 65536;
const OTHER = '__other__';

const emptyData = (): AnalyticsData => ({
  pv: 0,
  uv: 0,
  days: {},
  seen: { day: '', vids: [] },
  countries: {},
  points: {},
  paths: {},
  sourceVisits: 0,
  sources: {},
  breakdowns: { startedAt: new Date().toISOString(), visitorSketch: '', countries: {}, sources: {}, paths: {} },
});

/** Keep only the highest-count entries so maps stay bounded. */
function trimCounts(map: Record<string, number>, max: number): void {
  const keys = Object.keys(map);
  if (keys.length <= max) return;
  const keep = new Set(keys.sort((a, b) => map[b] - map[a]).slice(0, Math.floor(max * 0.9)));
  for (const key of keys) if (!keep.has(key)) delete map[key];
}

/** Bound a breakdown map, folding the dropped rows into the "Other" row so totals stay additive. */
function trimBreakdowns(map: Record<string, Stat>, max: number): void {
  const keys = Object.keys(map);
  if (keys.length <= max) return;
  const keep = new Set(
    keys
      .filter((key) => key !== OTHER)
      .sort((a, b) => map[b].pv - map[a].pv)
      .slice(0, Math.max(0, Math.floor(max * 0.9) - 1)),
  );
  const other = map[OTHER] ?? { pv: 0, uv: 0 };
  for (const key of keys) {
    if (key === OTHER || keep.has(key)) continue;
    other.pv += map[key].pv;
    other.uv += map[key].uv;
    delete map[key];
  }
  map[OTHER] = other;
}

function prune(data: AnalyticsData): void {
  const dayKeys = Object.keys(data.days).sort();
  for (const key of dayKeys.slice(0, Math.max(0, dayKeys.length - MAX_DAYS))) delete data.days[key];
  trimCounts(data.points, MAX_POINTS);
  trimCounts(data.paths, MAX_PATHS);
  trimCounts(data.sources, MAX_SOURCES);
  trimBreakdowns(data.breakdowns.countries, MAX_COUNTRIES);
  trimBreakdowns(data.breakdowns.paths, MAX_PATHS);
  trimBreakdowns(data.breakdowns.sources, MAX_SOURCES);
}

/** FNV-1a hash of a visitor id. */
function visitorHash(vid: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < vid.length; i++) {
    hash ^= vid.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Set the visitor's bit in the sketch; 1 when it was not set yet (a new visitor), else 0. */
function recordVisitor(breakdowns: Breakdowns, vid: string): number {
  const bitmap = Uint8Array.from(atob(breakdowns.visitorSketch), (c) => c.charCodeAt(0));
  const bytes = bitmap.length ? bitmap : new Uint8Array(VISITOR_BITMAP_BITS / 8);
  const bit = visitorHash(vid) % VISITOR_BITMAP_BITS;
  const mask = 1 << (bit % 8);
  if (bytes[bit >> 3] & mask) return 0;
  bytes[bit >> 3] |= mask;
  breakdowns.visitorSketch = btoa(String.fromCharCode(...bytes));
  return 1;
}

function recordBreakdown(map: Record<string, Stat>, key: string, uvDelta: number): void {
  const stat = (map[key] ??= { pv: 0, uv: 0 });
  stat.pv += 1;
  stat.uv += uvDelta;
}

/** Rows sorted by views, at most `limit`, with everything beyond folded into "Other". */
function topRows(map: Record<string, Stat>, limit: number) {
  const rows = Object.entries(map)
    .filter(([key]) => key !== OTHER)
    .map(([key, stat]) => ({ key, pv: stat.pv, uv: stat.uv }))
    .sort((a, b) => b.pv - a.pv || b.uv - a.uv);
  const other = { key: OTHER, pv: map[OTHER]?.pv ?? 0, uv: map[OTHER]?.uv ?? 0 };
  const hasOther = other.pv > 0 || other.uv > 0;
  if (rows.length + (hasOther ? 1 : 0) <= limit) return hasOther ? [...rows, other] : rows;
  const shown = rows.slice(0, limit - 1);
  for (const row of rows.slice(limit - 1)) {
    other.pv += row.pv;
    other.uv += row.uv;
  }
  return [...shown, other];
}

const utcDay = (offsetDays = 0): string => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);

function summarize(data: AnalyticsData) {
  // zero-filled UTC day series over the retained window, so a dashboard can filter without another request
  const days = Array.from({ length: MAX_DAYS }, (_, i) => {
    const date = utcDay(i - MAX_DAYS + 1);
    return { date, pv: data.days[date]?.pv ?? 0, uv: data.days[date]?.uv ?? 0 };
  });
  const totals = { pv: data.pv, uv: data.uv };
  return {
    generatedAt: new Date().toISOString(),
    totals,
    today: days[days.length - 1],
    days,
    countries: topRows(data.breakdowns.countries, TOP_COUNTRIES).map(({ key, pv, uv }) => ({ code: key, pv, uv })),
    points: Object.entries(data.points)
      .map(([key, count]) => {
        const [lat, lng] = key.split(',').map(Number);
        return { lat, lng, count };
      })
      .sort((a, b) => b.count - a.count),
    paths: topRows(data.breakdowns.paths, TOP_PATHS).map(({ key, pv, uv }) => ({ path: key, pv, uv })),
    sources: topRows(data.breakdowns.sources, TOP_SOURCES).map(({ key, pv, uv }) => ({ source: key, pv, uv })),
    breakdownStartedAt: data.breakdowns.startedAt,
    breakdownTotals: { countries: totals, sources: totals, pages: totals },
  };
}

export class AnalyticsDO extends DurableObject {
  private data: Promise<AnalyticsData> | null = null;

  private load(): Promise<AnalyticsData> {
    this.data ??= this.ctx.storage.get<AnalyticsData>(STORAGE_KEY).then((stored) => stored ?? emptyData());
    return this.data;
  }

  async track(event: TrackEvent): Promise<void> {
    const data = await this.load();
    apply(data, event);
    await this.ctx.storage.put(STORAGE_KEY, data);
  }

  async summary() {
    return summarize(await this.load());
  }
}

function apply(data: AnalyticsData, event: TrackEvent): void {
  data.pv += 1;
  const uvDelta = recordVisitor(data.breakdowns, event.vid);
  data.uv += uvDelta;

  const day = (data.days[event.day] ??= { pv: 0, uv: 0 });
  day.pv += 1;
  if (data.seen.day !== event.day) data.seen = { day: event.day, vids: [] };
  if (!data.seen.vids.includes(event.vid) && data.seen.vids.length < MAX_SEEN_PER_DAY) {
    data.seen.vids.push(event.vid);
    day.uv += 1;
  }

  data.countries[event.country] = (data.countries[event.country] ?? 0) + 1;
  recordBreakdown(data.breakdowns.countries, event.country, uvDelta);

  if (event.lat !== null && event.lng !== null) {
    const key = `${Math.round(event.lat)},${Math.round(event.lng)}`;
    data.points[key] = (data.points[key] ?? 0) + 1;
  }

  data.paths[event.path] = (data.paths[event.path] ?? 0) + 1;
  recordBreakdown(data.breakdowns.paths, event.path, uvDelta);

  recordBreakdown(data.breakdowns.sources, event.source, uvDelta);
  if (event.isNewSession) {
    data.sourceVisits += 1;
    data.sources[event.source] = (data.sources[event.source] ?? 0) + 1;
  }

  prune(data);
}

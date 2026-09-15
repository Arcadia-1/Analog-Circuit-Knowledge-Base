import { useVisitStats } from '../../analytics/client';

const format = new Intl.NumberFormat('en');

/** Records this page view with the analytics module; with `counter`, shows the site totals linked to the dashboard. */
export default function Visits({ path, counter = false }: { path: string; counter?: boolean }) {
  const stats = useVisitStats(path);
  if (!counter || !stats || (stats.pv === 0 && stats.uv === 0)) return null;
  return (
    <a className="visitors" href="/analytics/" title="View site analytics">
      {format.format(stats.uv)} visitors · {format.format(stats.pv)} views
    </a>
  );
}

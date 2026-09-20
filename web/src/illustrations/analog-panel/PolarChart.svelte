<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import type { PolarData } from './model';

  let { data, label }: { data: PolarData; label: string } = $props();

  function geo(W: number, H: number) {
    const cx = W / 2, cy = H / 2 + 3, outer = Math.max(28, Math.min(W, H) / 2 - 10);
    const floor = Math.min(data.floor, -30);
    const radius = (db: number) => outer * Math.max(0, Math.min(1, (db - floor) / -floor));
    const point = (angle: number, db: number) => {
      const r = radius(db);
      return { x: cx + r * Math.sin(angle), y: cy - r * Math.cos(angle) };
    };
    let cloud = '';
    for (const p of data.points) {
      const q = point(p.angle, p.db);
      cloud += `M${q.x.toFixed(1)},${q.y.toFixed(1)}h0.01`;
    }
    return { cx, cy, outer, floor, radius, point, cloud };
  }
</script>

<Plot {label}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each [0.25, 0.5, 0.75, 1] as f (f)}
      <circle class="gr" cx={g.cx} cy={g.cy} r={g.outer * f} />
    {/each}
    {#each [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2] as a (a)}
      {@const p = g.point(a, 0)}
      <line class="gr" x1={g.cx} y1={g.cy} x2={p.x} y2={p.y} />
    {/each}
    <text class="tx" x={g.cx} y={g.cy - g.outer + 9} text-anchor="middle">0°</text>
    <text class="tx" x={g.cx + g.outer - 2} y={g.cy - 3} text-anchor="end">90°</text>
    <text class="tx" x={g.cx} y={g.cy + g.outer - 3} text-anchor="middle">180°</text>
    <text class="tx" x={g.cx - g.outer + 2} y={g.cy - 3}>270°</text>
    {#if data.points.length}<path class="cloud" d={g.cloud} />{/if}
    {#each data.rays as ray (ray.text)}
      {@const p = g.point(ray.angle, ray.db)}
      <line class="c{ray.series}" stroke-width={ray.series === 1 ? 2 : 1.4} x1={g.cx} y1={g.cy} x2={p.x} y2={p.y} />
      <circle class="f{ray.series} ring" cx={p.x} cy={p.y} r={ray.series === 1 ? 3.8 : 3} />
      <text class="tx2 halo" x={p.x + (p.x < g.cx ? -5 : 5)} y={p.y - 5} text-anchor={p.x < g.cx ? 'end' : 'start'}>{ray.text}</text>
    {/each}
  {/snippet}
</Plot>

<style>
  .cloud { fill: none; stroke: var(--ink-3); stroke-width: 2.2; stroke-linecap: round; opacity: 0.42; }
</style>

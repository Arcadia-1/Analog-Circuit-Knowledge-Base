<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import type { Decomposition } from './model';

  /**
   * analyze_decomposition_polar: each harmonic as a vector, as far out as it is loud and turned to the phase the fit
   * found for it — relative to the fundamental, so a harmonic that keeps its shape keeps its angle.
   */
  let { decomposition, hover, onhover, label }: {
    decomposition: Decomposition;
    hover: number | null;
    onhover: (h: number | null) => void;
    label: string;
  } = $props();

  const FLOOR = -120, RINGS = [-30, -60, -90];
  const dbc = $derived(decomposition.db.map((v) => v - decomposition.db[0]));

  function geo(W: number, H: number) {
    const R = Math.max(36, Math.min(W / 2 - 40, H / 2 - 14)), cx = W / 2, cy = H / 2;
    const at = (phase: number, level: number) => {
      const r = (Math.max(0, level - FLOOR) / -FLOOR) * R;
      return [cx + r * Math.sin(phase), cy - r * Math.cos(phase)] as const;
    };
    // the label sits beside its spoke rather than beyond it, alternating sides, since harmonics often line up
    const spokes = dbc.slice(1).map((level, i) => {
      const h = i + 2, phase = decomposition.phases[h - 1], end = at(phase, level), side = h % 2 ? 1 : -1;
      return { h, level, end, tag: [end[0] + side * 13 * Math.cos(phase), end[1] + side * 13 * Math.sin(phase)] };
    });
    return { R, cx, cy, at, spokes };
  }
</script>

<Plot
  {label}
  onpointermove={(px, W, H, py) => {
    const g = geo(W, H);
    let best: number | null = null, near = 18;
    g.spokes.forEach((s) => {
      const d = Math.hypot(px - s.end[0], py - s.end[1]);
      if (d < near) {
        near = d;
        best = s.h;
      }
    });
    onhover(best);
  }}
  onpointerleave={() => onhover(null)}
>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each RINGS as level (level)}
      <circle class="orbit" cx={g.cx} cy={g.cy} r={((level - FLOOR) / -FLOOR) * g.R} />
      <text class="tx halo" x={g.cx - ((level - FLOOR) / -FLOOR) * g.R} y={g.cy + 9} text-anchor="middle">{level}</text>
    {/each}
    <circle class="orbit edge" cx={g.cx} cy={g.cy} r={g.R} />
    {#each [0, 90, 180, 270] as deg (deg)}
      <line class="gr" x1={g.cx} y1={g.cy} x2={g.cx + g.R * Math.sin((deg * Math.PI) / 180)} y2={g.cy - g.R * Math.cos((deg * Math.PI) / 180)} />
    {/each}
    {#each g.spokes as s (s.h)}
      <line class="c2" stroke-width={hover === s.h ? 3 : 1.8} x1={g.cx} y1={g.cy} x2={s.end[0]} y2={s.end[1]} />
      <circle class="f2" cx={s.end[0]} cy={s.end[1]} r={hover === s.h ? 4.5 : 3} />
      <text class="tx halo" x={s.tag[0]} y={s.tag[1]} text-anchor="middle" dominant-baseline="central">H{s.h}</text>
    {/each}
    <circle class="f1" cx={g.cx} cy={g.cy} r="3.5" />
    <text class="tx2 halo" x={8} y={16}>dBc, phase from the fundamental</text>
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      {@const s = g.spokes.find((v) => v.h === hover)!}
      <Tip x={s.end[0]} y={s.end[1]} {width} text="H{s.h} · {nf(s.level, 2)} dBc · {nf((decomposition.phases[s.h - 1] * 180) / Math.PI, 1)}°" />
    {/if}
  {/snippet}
</Plot>

<style>
  .orbit { fill: none; stroke: var(--grid); }
  .edge { stroke: var(--rule); }
</style>

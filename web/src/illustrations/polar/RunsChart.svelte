<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import type { Curve } from './model';

  /**
   * exp_s07's comparison: SNR (solid) and SNDR (dashed) as runs are added, averaged as powers (orange) and coherently
   * (blue), on a log axis of runs.
   */
  let { curve, stale, at, coherent, hover, onhover, label }: {
    curve: Curve;
    stale: boolean;
    /** the run count the page shows */
    at: number;
    coherent: boolean;
    hover: number | null;
    onhover: (i: number | null) => void;
    label: string;
  } = $props();

  const X0 = 40;

  function geo(W: number, H: number) {
    const X1 = W - 12, Y0 = 8, Y1 = H - 20, last = curve.runs[curve.runs.length - 1];
    const all = [...curve.powerSndr, ...curve.powerSnr, ...curve.coherentSndr, ...curve.coherentSnr];
    const lo = 10 * Math.floor(Math.min(...all) / 10), hi = 10 * Math.ceil(Math.max(...all) / 10);
    const sx = (runs: number) => X0 + (Math.log10(runs) / Math.log10(last)) * (X1 - X0);
    const sy = (v: number) => Y0 + ((hi - clamp(v, lo, hi)) / Math.max(hi - lo, 10)) * (Y1 - Y0);
    const line = (a: number[]) => a.map((v, i) => `${i ? 'L' : 'M'}${sx(curve.runs[i]).toFixed(1)},${sy(v).toFixed(1)}`).join('');
    const grid: number[] = [];
    for (let v = lo; v <= hi; v += hi - lo > 40 ? 10 : 5) grid.push(v);
    return {
      X1, Y0, Y1, sx, sy, grid,
      paths: [
        { d: line(curve.powerSnr), cls: 'c2', dash: false, on: !coherent },
        { d: line(curve.powerSndr), cls: 'c2', dash: true, on: !coherent },
        { d: line(curve.coherentSnr), cls: 'c1', dash: false, on: coherent },
        { d: line(curve.coherentSndr), cls: 'c1', dash: true, on: coherent },
      ],
    };
  }

  function move(px: number, W: number) {
    const g = geo(W, 100);
    if (px < X0 - 6 || px > g.X1 + 6) return onhover(null);
    let best = 0;
    curve.runs.forEach((r, i) => {
      if (Math.abs(g.sx(r) - px) < Math.abs(g.sx(curve.runs[best]) - px)) best = i;
    });
    onhover(best);
  }
</script>

<Plot {label} onpointermove={move} onpointerleave={() => onhover(null)}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each g.grid as v (v)}
      <line class="gr" x1={X0} y1={g.sy(v)} x2={g.X1} y2={g.sy(v)} />
      <text class="tx" x={X0 - 6} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{v}</text>
    {/each}
    {#each [1, 10, 100] as r, i (r)}
      <text class="tx" x={g.sx(r)} y={height - 5} text-anchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}>{i === 2 ? `${r} runs` : r}</text>
    {/each}
    <text class="tx2 halo" x={X0 + 6} y={g.Y0 + 10}>dB</text>
    <line class="guide" x1={g.sx(at)} y1={g.Y0} x2={g.sx(at)} y2={g.Y1} />
    <g class:stale>
      {#each g.paths as p, i (i)}
        <path class={p.cls} class:dash={p.dash} stroke-width={p.on ? 2.4 : 1.3} d={p.d} />
      {/each}
    </g>
    {#if hover !== null}<line class="cross" x1={g.sx(curve.runs[hover])} y1={g.Y0} x2={g.sx(curve.runs[hover])} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      <Tip
        x={g.sx(curve.runs[hover])}
        y={g.sy(curve.coherentSnr[hover])}
        {width}
        text="{curve.runs[hover]} run{curve.runs[hover] > 1 ? 's' : ''} · power: SNR {nf(curve.powerSnr[hover], 1)}, SNDR {nf(curve.powerSndr[hover], 1)} · coherent: SNR {nf(curve.coherentSnr[hover], 1)}, SNDR {nf(curve.coherentSndr[hover], 1)} dB"
      />
    {/if}
  {/snippet}
</Plot>

<style>
  .dash { stroke-dasharray: 6 4; }
  .stale { opacity: 0.35; }
</style>

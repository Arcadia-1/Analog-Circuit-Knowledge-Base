<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { AMP, DC } from './model';

  const phaseTicks: Array<{ phase: number; text: string }> = [
    { phase: 0, text: '0°' },
    { phase: 0.25, text: '90°' },
    { phase: 0.5, text: '180°' },
    { phase: 0.75, text: '270°' },
    { phase: 1, text: '360°' },
  ];

  let { data, bin, hd3, bits, hover, onhover, label }: {
    data: Float64Array;
    bin: number;
    hd3: number;
    bits: number;
    hover: number | null;
    onhover: (i: number | null) => void;
    label: string;
  } = $props();

  const points = $derived.by(() => {
    const count = Math.min(data.length, 192);
    return Array.from({ length: count }, (_, j) => {
      const i = Math.min(data.length - 1, Math.floor((j * data.length) / count));
      const phase = ((bin * i) % data.length) / data.length;
      const ideal = DC + AMP * Math.sin(2 * Math.PI * phase) + hd3 * Math.sin(6 * Math.PI * phase);
      return { i, phase, value: data[i], errorMv: (data[i] - ideal) * 1e3 };
    }).sort((a, b) => a.phase - b.phase);
  });

  function geo(W: number, H: number) {
    const X0 = 42, X1 = W - 8, Y0 = 8, YMID = Math.max(72, H * 0.6), Y1 = H - 20;
    const sx = (phase: number) => X0 + phase * (X1 - X0);
    const sy = (v: number) => Y0 + (1 - v) * (YMID - Y0);
    const maxError = Math.max(0.5 * 1e3 / 2 ** bits, ...points.map((p) => Math.abs(p.errorMv)));
    const R = Math.max(0.1, maxError * 1.15);
    const se = (v: number) => YMID + 10 + ((R - v) / (2 * R)) * (Y1 - YMID - 10);
    const ideal = Array.from({ length: 181 }, (_, i) => {
      const phase = i / 180;
      const v = DC + AMP * Math.sin(2 * Math.PI * phase) + hd3 * Math.sin(6 * Math.PI * phase);
      return `${i ? 'L' : 'M'}${sx(phase).toFixed(1)},${sy(v).toFixed(1)}`;
    }).join('');
    return { X0, X1, Y0, YMID, Y1, sx, sy, se, R, ideal };
  }

  function move(x: number, W: number) {
    const x0 = 42, x1 = W - 8;
    if (x < x0 || x > x1 || !points.length) return onhover(null);
    const phase = (x - x0) / (x1 - x0);
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(points[i].phase - phase) < Math.abs(points[best].phase - phase)) best = i;
    }
    onhover(best);
  }
</script>

<Plot {label} onpointermove={move} onpointerleave={() => onhover(null)}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each [0, 0.5, 1] as v (v)}
      <line class="gr" x1={g.X0} y1={g.sy(v)} x2={g.X1} y2={g.sy(v)} />
      <text class="tx" x={g.X0 - 6} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{nf(v, 1)}</text>
    {/each}
    <line class="zero" x1={g.X0} y1={g.se(0)} x2={g.X1} y2={g.se(0)} />
    <text class="tx" x={g.X0 - 6} y={g.se(g.R)} text-anchor="end" dominant-baseline="central">+{nf(g.R, 1)}</text>
    <text class="tx" x={g.X0 - 6} y={g.se(0)} text-anchor="end" dominant-baseline="central">0</text>
    <text class="tx" x={g.X0 - 6} y={g.se(-g.R)} text-anchor="end" dominant-baseline="central">−{nf(g.R, 1)}</text>
    <text class="tx2 halo" x={g.X0 + 5} y={g.Y0 + 12}>output, V</text>
    <text class="tx2 halo" x={g.X0 + 5} y={g.YMID + 22}>error, mV</text>
    <path class="ideal" d={g.ideal} />
    {#each points as p, i (p.i)}
      <circle class="f1" cx={g.sx(p.phase)} cy={g.sy(p.value)} r={i === hover ? 4 : points.length < 40 ? 2.8 : 1.7} />
      <line class="c2" x1={g.sx(p.phase)} y1={g.se(0)} x2={g.sx(p.phase)} y2={g.se(p.errorMv)} />
    {/each}
    {#each phaseTicks as tick (tick.phase)}
      <text class="tx" x={g.sx(tick.phase)} y={height - 5} text-anchor={tick.phase === 0 ? 'start' : tick.phase === 1 ? 'end' : 'middle'}>{tick.text}</text>
    {/each}
    {#if hover !== null && points[hover]}
      <line class="cross" x1={g.sx(points[hover].phase)} y1={g.Y0} x2={g.sx(points[hover].phase)} y2={g.Y1} />
    {/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null && points[hover]}
      {@const g = geo(width, height)}
      {@const p = points[hover]}
      <Tip x={g.sx(p.phase)} y={g.sy(p.value)} {width} text="sample {p.i} · {nf(p.phase * 360, 1)}° · {nf(p.value, 5)} V · error {nf(p.errorMv, 2)} mV" />
    {/if}
  {/snippet}
</Plot>

<style>
  .ideal { fill: none; stroke: var(--ink-3); stroke-width: 1.2; stroke-dasharray: 5 4; }
</style>

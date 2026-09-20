<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';

  let { phases, values, hover, onhover, label }: {
    phases: Float64Array;
    values: Float64Array;
    hover: number | null;
    onhover: (index: number | null) => void;
    label: string;
  } = $props();

  const X0 = 40;
  const ordered = $derived(Array.from(phases, (phase, i) => ({ phase, value: values[i], i })).sort((a, b) => a.phase - b.phase));

  function geo(W: number, H: number) {
    const X1 = W - 8, Y0 = 8, Y1 = H - 20;
    const sx = (phase: number) => X0 + phase * (X1 - X0);
    const sy = (v: number) => Y0 + (1.05 - clamp(v, -0.05, 1.05)) / 1.1 * (Y1 - Y0);
    const sine = Array.from({ length: 301 }, (_, i) => {
      const phase = i / 300, v = 0.5 + 0.49 * Math.sin(2 * Math.PI * phase);
      return `${i ? 'L' : 'M'}${sx(phase).toFixed(1)},${sy(v).toFixed(1)}`;
    }).join('');
    return { X1, Y0, Y1, sx, sy, sine };
  }

  function move(px: number, W: number) {
    if (!ordered.length || px < X0 - 6 || px > W - 2) return onhover(null);
    const phase = clamp((px - X0) / (W - 8 - X0), 0, 1);
    let best = 0;
    ordered.forEach((sample, i) => { if (Math.abs(sample.phase - phase) < Math.abs(ordered[best].phase - phase)) best = i; });
    onhover(best);
  }
</script>

<Plot {label} onpointermove={move} onpointerleave={() => onhover(null)}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each [0, 0.5, 1] as v}
      <line class="gr" x1={X0} x2={g.X1} y1={g.sy(v)} y2={g.sy(v)} />
      <text class="tx" x={X0 - 6} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{nf(v, 1)}</text>
    {/each}
    {#each [0, 0.25, 0.5, 0.75, 1] as phase, i}
      <text class="tx" x={g.sx(phase)} y={height - 5} text-anchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}>{phase === 1 ? '2π' : phase === 0.5 ? 'π' : phase === 0 ? '0' : phase === 0.25 ? 'π/2' : '3π/2'}</text>
    {/each}
    <path class="ideal" d={g.sine} />
    {#each ordered as sample, i}
      <line class="stem" x1={g.sx(sample.phase)} x2={g.sx(sample.phase)} y1={g.sy(0.5)} y2={g.sy(sample.value)} />
      <circle class="sample" class:active={hover === i} cx={g.sx(sample.phase)} cy={g.sy(sample.value)} r={hover === i ? 4.5 : 3} />
    {/each}
    <text class="tx2 halo" x={X0 + 5} y={g.Y0 + 11}>volts</text>
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null && ordered[hover]}
      {@const g = geo(width, height)}
      {@const sample = ordered[hover]}
      <Tip x={g.sx(sample.phase)} y={g.sy(sample.value)} {width} text="sample {sample.i} · phase {nf(sample.phase * 360, 1)}° · code value {nf(sample.value, 4)} V" />
    {/if}
  {/snippet}
</Plot>

<style>
  .ideal { fill: none; stroke: var(--ink-3); stroke-width: 1.2; }
  .stem { stroke: var(--s1); opacity: .28; }
  .sample { fill: var(--s1); stroke: var(--plot); stroke-width: 1.5; }
  .sample.active { stroke: var(--ink); }
</style>

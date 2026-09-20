<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import { inputValue, type HarmonicLevels, type Mismatch } from './model';

  let { samples, truth, fin, fs, harmonics, hover, onhover, label }: {
    samples: Float64Array;
    truth: Mismatch;
    fin: number;
    fs: number;
    harmonics: Partial<HarmonicLevels>;
    hover: number | null;
    onhover: (index: number | null) => void;
    label: string;
  } = $props();

  const X0 = 45, COUNT = 48;
  const m = $derived(truth.gain.length);
  const ideal = (i: number) => inputValue(i / fs, fin, harmonics);

  function geo(W: number, H: number) {
    // Keep a dedicated strip above the plot for the legend and channel indices.
    // Otherwise the legend sits on the +0.5 V grid line and on high input samples.
    const X1 = W - 8, Y0 = 26, Y1 = H - 20;
    const sx = (i: number) => X0 + ((i + .5) / COUNT) * (X1 - X0);
    const sy = (v: number) => Y0 + ((.5 - clamp(v, -.5, .5)) / 1) * (Y1 - Y0);
    let wave = '';
    for (let i = 0; i <= 400; i++) {
      const at = ((COUNT - 1) * i) / 400;
      wave += `${i ? 'L' : 'M'}${sx(at).toFixed(1)},${sy(ideal(at)).toFixed(1)}`;
    }
    return { X1, Y0, Y1, sx, sy, wave };
  }
</script>

<Plot
  {label}
  onpointermove={(px, W) => onhover(px >= X0 && px <= W - 8 ? clamp(Math.floor(((px - X0) / (W - 8 - X0)) * COUNT), 0, COUNT - 1) : null)}
  onpointerleave={() => onhover(null)}
>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each [-.5, 0, .5] as v}
      <line class={v ? 'gr' : 'zero'} x1={X0} x2={g.X1} y1={g.sy(v)} y2={g.sy(v)} />
      <text class="tx" x={X0 - 6} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{nf(v, 1)}</text>
    {/each}
    <path class="ideal" d={g.wave} />
    {#each samples.subarray(0, COUNT) as value, i}
      {@const c = i % m}
      <line class="sample-stem ch{c % 4}" x1={g.sx(i)} x2={g.sx(i + truth.skew[c] * fs)} y1={g.sy(value)} y2={g.sy(value)} />
      <circle class="sample ch{c % 4}" cx={g.sx(i + truth.skew[c] * fs)} cy={g.sy(value)} r={hover === i ? 4.5 : 2.8} />
      {#if i < m}<text class="tx channel ch{c % 4}" x={g.sx(i + truth.skew[c] * fs)} y="15" text-anchor="middle">{c}</text>{/if}
    {/each}
    <text class="tx2 halo" x={g.X1} y="15" text-anchor="end">input and channel samples · V</text>
    {#each [0, 12, 24, 36, 47] as i, k}
      <text class="tx" x={g.sx(i)} y={height - 5} text-anchor={k === 0 ? 'start' : k === 4 ? 'end' : 'middle'}>{k === 4 ? `${i} samples` : i}</text>
    {/each}
    {#if hover !== null}<line class="cross" x1={g.sx(hover)} x2={g.sx(hover)} y1={g.Y0} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      {@const c = hover % m}
      <Tip x={g.sx(hover)} y={g.sy(samples[hover])} {width} text="sample {hover}, channel {c} · {nf(samples[hover], 4)} V · skew {nf(truth.skew[c] * 1e12, 2)} ps" />
    {/if}
  {/snippet}
</Plot>

<style>
  .ideal { fill: none; stroke: var(--ink-3); stroke-width: 1.2; }
  .sample-stem { stroke: var(--ink-3); opacity: .45; }
  .sample { stroke: var(--plot); stroke-width: 1.2; }
  .ch0 { fill: var(--s1); }
  .ch1 { fill: var(--s2); }
  .ch2 { fill: var(--bad); }
  .ch3 { fill: var(--brand); }
  .sample-stem.ch0 { stroke: var(--s1); }
  .sample-stem.ch1 { stroke: var(--s2); }
  .sample-stem.ch2 { stroke: var(--bad); }
  .sample-stem.ch3 { stroke: var(--brand); }
  .channel { font-weight: 600; }
</style>

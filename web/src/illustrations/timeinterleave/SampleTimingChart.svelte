<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import { inputValue, type HarmonicLevels, type Mismatch } from './model';

  let { samples, truth, fin, fs, harmonics, decimation, hover, onhover, label }: {
    samples: Float64Array;
    truth: Mismatch;
    fin: number;
    fs: number;
    harmonics: Partial<HarmonicLevels>;
    decimation: number;
    hover: number | null;
    onhover: (index: number | null) => void;
    label: string;
  } = $props();

  const X0 = 45, COUNT = 48;
  const m = $derived(truth.gain.length);
  const ideal = (i: number) => inputValue(i / fs, fin, harmonics);
  const markerShape = (channel: number) => channel % 5;
  const channelColor = (channel: number, count: number) => {
    const hue = (210 + channel * 360 / Math.max(1, count)) % 360;
    return `color-mix(in srgb, hsl(${hue} 70% 50%), var(--ink) 10%)`;
  };
  const polygon = (points: [number, number][]) => points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

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
    return { X1, Y0, Y1, sx, sy, wave, bandWidth: clamp((X1 - X0) / COUNT * .42, 3, 8) };
  }
</script>

<Plot
  {label}
  onpointermove={(px, W) => onhover(px >= X0 && px <= W - 8 ? clamp(Math.floor(((px - X0) / (W - 8 - X0)) * COUNT), 0, COUNT - 1) : null)}
  onpointerleave={() => onhover(null)}
>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#if decimation > 1}
      {#each Array.from({ length: Math.ceil(COUNT / decimation) }, (_, k) => k * decimation) as i (i)}
        <rect class="kept-band" x={g.sx(i) - g.bandWidth / 2} y={g.Y0} width={g.bandWidth} height={g.Y1 - g.Y0} />
      {/each}
    {/if}
    {#each [-.5, 0, .5] as v}
      <line class={v ? 'gr' : 'zero'} x1={X0} x2={g.X1} y1={g.sy(v)} y2={g.sy(v)} />
      <text class="tx" x={X0 - 6} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{nf(v, 1)}</text>
    {/each}
    <path class="ideal" d={g.wave} />
    {#each samples.subarray(0, COUNT) as value, i}
      {@const c = i % m}
      {@const x = g.sx(i + truth.skew[c] * fs)}
      {@const y = g.sy(value)}
      {@const radius = hover === i ? 4.7 : 3.1}
      <g style:--channel-color={channelColor(c, m)}>
        <line class="sample-stem" x1={g.sx(i)} x2={x} y1={y} y2={y} />
        {#if markerShape(c) === 0}
          <circle class="sample" cx={x} cy={y} r={radius} />
        {:else if markerShape(c) === 1}
          <rect class="sample" x={x - radius} y={y - radius} width={2 * radius} height={2 * radius} />
        {:else if markerShape(c) === 2}
          <polygon class="sample" points={polygon([[x, y - 1.3 * radius], [x + 1.3 * radius, y], [x, y + 1.3 * radius], [x - 1.3 * radius, y]])} />
        {:else if markerShape(c) === 3}
          <polygon class="sample" points={polygon([[x, y - 1.35 * radius], [x + 1.2 * radius, y + radius], [x - 1.2 * radius, y + radius]])} />
        {:else}
          <polygon class="sample" points={polygon([[x - 1.2 * radius, y - radius], [x + 1.2 * radius, y - radius], [x, y + 1.35 * radius]])} />
        {/if}
        {#if i < m}<text class="tx channel" x={x} y="15" text-anchor="middle">{c}</text>{/if}
      </g>
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
      <Tip x={g.sx(hover)} y={g.sy(samples[hover])} {width} text="sample {hover}, channel {c} · {nf(samples[hover], 4)} V · skew {nf(truth.skew[c] * 1e12, 2)} ps{decimation > 1 ? hover % decimation === 0 ? ` · kept by ÷${decimation}` : ` · dropped by ÷${decimation}` : ''}" />
    {/if}
  {/snippet}
</Plot>

<style>
  .kept-band { fill: var(--ink-3); opacity: .1; }
  .ideal { fill: none; stroke: var(--ink-3); stroke-width: 1.2; }
  .sample-stem { stroke: var(--channel-color); opacity: .55; }
  .sample { fill: var(--channel-color); stroke: var(--plot); stroke-width: 1.2; }
  .channel { fill: var(--channel-color); font-weight: 650; }
</style>

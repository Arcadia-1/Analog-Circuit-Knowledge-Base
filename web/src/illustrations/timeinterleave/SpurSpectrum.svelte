<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { freqText, nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import type { Spectrum } from '../../lib/spectrum';
  import { N, type Spur } from './model';

  /**
   * The spectrum of the interleaved output, with a mark wherever predict_spurs expects a spur and as high as it
   * expects it: circles for the images of gain, bandwidth and skew, squares for the offset tones.
   */
  let { spectrum, spurs, bits, fs, hover, onhover, label }: {
    spectrum: Spectrum;
    spurs: Spur[];
    bits: number;
    fs: number;
    hover: number | null;
    onhover: (bin: number | null) => void;
    label: string;
  } = $props();

  const X0 = 46, HALF = N / 2;
  const ybot = $derived(-20 * Math.ceil((6.02 * bits + 1.76 + 10 * Math.log10(HALF) + 12) / 20));
  const binOf = (f: number) => Math.round((f / fs) * N);
  const spurText = (bin: number) =>
    spurs
      .filter((s) => binOf(s.freq) === bin)
      .map((s) => `${s.kind === 'offset' ? 'offset' : 'image'} k=${s.k}, predicted ${nf(s.dbfs, 1)} dBFS`)
      .join(' · ');

  function trace(s: Spectrum, cols: number, sy: (v: number) => number) {
    const lo = new Float64Array(cols).fill(Infinity), hi = new Float64Array(cols).fill(-Infinity);
    for (let k = 1; k <= HALF; k++) {
      const c = Math.min(cols - 1, Math.floor(((k - 0.5) / HALF) * cols));
      if (s.dbfs[k] < lo[c]) lo[c] = s.dbfs[k];
      if (s.dbfs[k] > hi[c]) hi[c] = s.dbfs[k];
    }
    let d = '';
    for (let c = 0; c < cols; c++) if (hi[c] > -Infinity) d += `M${X0 + c + 0.5},${sy(hi[c])}V${Math.max(sy(lo[c]), sy(hi[c]) + 1)}`;
    return d;
  }

  function geo(W: number, H: number) {
    const X1 = W - 6, Y0 = 6, Y1 = H - 20;
    const sx = (bin: number) => X0 + (bin / HALF) * (X1 - X0);
    const sy = (v: number) => Y0 + (clamp(v, ybot, 0) / ybot) * (Y1 - Y0);
    const cols = Math.max(1, Math.round(X1 - X0));
    const grid: number[] = [];
    for (let v = ybot; v <= 0; v += 20) grid.push(v);
    const every = Y1 - Y0 < 170 ? 40 : 20;
    const marks = spurs.filter((s) => s.dbfs > ybot).map((s) => ({ x: sx(binOf(s.freq)), y: sy(s.dbfs), offset: s.kind === 'offset' }));
    const steps = X1 - X0 < 360 ? 2 : 5;
    const ticks = Array.from({ length: steps + 1 }, (_, i) => (i / steps) * fs / 2);
    return { ticks, X1, Y0, Y1, sx, sy, grid, every, marks, d: trace(spectrum, cols, sy) };
  }

  function move(px: number, W: number) {
    const X1 = W - 6;
    onhover(px >= X0 && px <= X1 ? clamp(Math.round(((px - X0) / (X1 - X0)) * HALF), 1, HALF) : null);
  }
</script>

<Plot {label} onpointermove={move} onpointerleave={() => onhover(null)}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each g.grid as v (v)}
      <line class="gr" x1={X0} y1={g.sy(v)} x2={g.X1} y2={g.sy(v)} />
      {#if (v - ybot) % g.every === 0}<text class="tx" x="40" y={g.sy(v)} text-anchor="end" dominant-baseline="central">{nf(v, 0)}</text>{/if}
    {/each}
    {#each g.ticks as f, i (f)}
      <line class="gr" x1={g.sx((f * N) / fs)} y1={g.Y0} x2={g.sx((f * N) / fs)} y2={g.Y1} />
      <text class="tx" x={g.sx((f * N) / fs)} y={height - 5} text-anchor={i === 0 ? 'start' : i === g.ticks.length - 1 ? 'end' : 'middle'}>{freqText(f)}</text>
    {/each}
    <text class="tx2 halo" x={X0 + 6} y={g.Y0 + 12}>dBFS</text>
    <path class="c1" stroke-width="1" d={g.d} />
    <circle class="f1 ring" cx={g.sx(spectrum.signal)} cy={g.sy(spectrum.dbfs[spectrum.signal])} r="4.5" />
    {#each g.marks as m, i (i)}
      {#if m.offset}
        <rect class="mark" x={m.x - 4} y={m.y - 4} width="8" height="8" />
      {:else}
        <circle class="mark" cx={m.x} cy={m.y} r="4.5" />
      {/if}
    {/each}
    {#if hover !== null}<line class="cross" x1={g.sx(hover)} y1={g.Y0} x2={g.sx(hover)} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      {@const named = spurText(hover)}
      <Tip
        x={g.sx(hover)}
        y={g.sy(spectrum.dbfs[hover])}
        {width}
        text="{freqText((hover * fs) / N)} · {nf(spectrum.dbfs[hover], 1)} dBFS{hover === spectrum.signal ? ' · the input' : named ? ` · ${named}` : ''}"
      />
    {/if}
  {/snippet}
</Plot>

<style>
  .mark { fill: none; stroke: var(--s2); stroke-width: 1.6; }
</style>

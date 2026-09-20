<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { freqText, nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import type { Spectrum } from '../../lib/spectrum';
  import { frequencyAxis } from './frequencyAxis';
  import type { HarmonicTone, Spur } from './model';

  /**
   * The spectrum of the interleaved output, with a mark wherever predict_spurs expects a spur and as high as it
   * expects it: circles for the images of gain, bandwidth and skew, squares for the offset tones.
   */
  let { spectrum, spurs, harmonics, bits, fs, points, hover, onhover, label }: {
    spectrum: Spectrum;
    spurs: Spur[];
    harmonics: HarmonicTone[];
    bits: number;
    fs: number;
    points: number;
    hover: number | null;
    onhover: (bin: number | null) => void;
    label: string;
  } = $props();

  const half = $derived(Math.floor(points / 2));
  const ybot = $derived(-20 * Math.ceil((6.02 * bits + 1.76 + 10 * Math.log10(half) + 12) / 20));
  const binOf = (f: number) => Math.min(half, Math.round((f / fs) * points));
  const spurText = (bin: number) =>
    spurs
      .filter((s) => binOf(s.freq) === bin)
      .map((s) => `${s.kind === 'offset' ? 'offset' : 'image'} k=${s.k}, predicted ${nf(s.dbfs, 1)} dBFS`)
      .join(' · ');
  const harmonicText = (bin: number) => harmonics.filter((tone) => binOf(tone.freq) === bin).map((tone) => `H${tone.order}`).join('/');

  function trace(s: Spectrum, cols: number, x0: number, sy: (v: number) => number) {
    const lo = new Float64Array(cols).fill(Infinity), hi = new Float64Array(cols).fill(-Infinity);
    for (let k = 1; k <= half; k++) {
      const c = Math.min(cols - 1, Math.floor(((k - 0.5) / half) * cols));
      if (s.dbfs[k] < lo[c]) lo[c] = s.dbfs[k];
      if (s.dbfs[k] > hi[c]) hi[c] = s.dbfs[k];
    }
    let d = '';
    for (let c = 0; c < cols; c++) if (hi[c] > -Infinity) d += `M${x0 + c + 0.5},${sy(hi[c])}V${Math.max(sy(lo[c]), sy(hi[c]) + 1)}`;
    return d;
  }

  function geo(W: number, H: number) {
    const axis = frequencyAxis(W, fs, points), Y0 = 6, Y1 = H - 20;
    const sy = (v: number) => Y0 + (clamp(v, ybot, 0) / ybot) * (Y1 - Y0);
    const cols = Math.max(1, Math.round(axis.x1 - axis.x0));
    const grid: number[] = [];
    for (let v = ybot; v <= 0; v += 20) grid.push(v);
    const every = Y1 - Y0 < 170 ? 40 : 20;
    const marks = spurs.filter((s) => s.dbfs > ybot).map((s) => ({ x: axis.sx(axis.binOf(s.freq)), y: sy(s.dbfs), offset: s.kind === 'offset' }));
    const grouped = new Map<number, HarmonicTone[]>();
    for (const tone of harmonics) {
      const bin = axis.binOf(tone.freq), list = grouped.get(bin) ?? [];
      list.push(tone);
      grouped.set(bin, list);
    }
    const harmonicMarks = [...grouped].map(([bin, tones]) => ({
      bin,
      x: axis.sx(bin),
      y: sy(spectrum.dbfs[bin]),
      label: tones.map((tone) => `H${tone.order}`).join('/'),
    }));
    return { ...axis, Y0, Y1, sy, grid, every, marks, harmonicMarks, d: trace(spectrum, cols, axis.x0, sy) };
  }

  function move(px: number, W: number) {
    const axis = frequencyAxis(W, fs, points);
    onhover(px >= axis.x0 && px <= axis.x1 ? clamp(Math.round(((px - axis.x0) / (axis.x1 - axis.x0)) * half), 1, half) : null);
  }
</script>

<Plot {label} onpointermove={move} onpointerleave={() => onhover(null)}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each g.grid as v (v)}
      <line class="gr" x1={g.x0} y1={g.sy(v)} x2={g.x1} y2={g.sy(v)} />
      {#if (v - ybot) % g.every === 0}<text class="tx" x={g.x0 - 6} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{nf(v, 0)}</text>{/if}
    {/each}
    {#each g.ticks as tick, i (tick.bin)}
      <line class="gr" x1={g.sx(tick.bin)} y1={g.Y0} x2={g.sx(tick.bin)} y2={g.Y1} />
      <text class="tx" x={g.sx(tick.bin)} y={height - 5} text-anchor={i === 0 ? 'start' : i === g.ticks.length - 1 ? 'end' : 'middle'}>{freqText(tick.frequency)}</text>
    {/each}
    <text class="tx2 halo" x={g.x0 + 6} y={g.Y0 + 12}>dBFS</text>
    <path class="c1" stroke-width="1" d={g.d} />
    <circle class="f1 ring" cx={g.sx(spectrum.signal)} cy={g.sy(spectrum.dbfs[spectrum.signal])} r="4.5" />
    {#each g.marks as m, i (i)}
      {#if m.offset}
        <rect class="mark" x={m.x - 4} y={m.y - 4} width="8" height="8" />
      {:else}
        <circle class="mark" cx={m.x} cy={m.y} r="4.5" />
      {/if}
    {/each}
    {#each g.harmonicMarks as mark (mark.bin)}
      <circle class="harmonic" cx={mark.x} cy={mark.y} r="4.5" />
      <text class="harmonic-label halo" x={mark.x} y={Math.max(g.Y0 + 12, mark.y - 9)} text-anchor="middle">{mark.label}</text>
    {/each}
    {#if hover !== null}<line class="cross" x1={g.sx(hover)} y1={g.Y0} x2={g.sx(hover)} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      {@const named = spurText(hover)}
      {@const namedHarmonic = harmonicText(hover)}
      <Tip
        x={g.sx(hover)}
        y={g.sy(spectrum.dbfs[hover])}
        {width}
        text="{freqText((hover * fs) / points)} · {nf(spectrum.dbfs[hover], 1)} dBFS{hover === spectrum.signal ? ' · the input' : namedHarmonic ? ` · ${namedHarmonic}` : named ? ` · ${named}` : ''}"
      />
    {/if}
  {/snippet}
</Plot>

<style>
  .mark { fill: none; stroke: var(--s2); stroke-width: 1.6; }
  .harmonic { fill: var(--plot); stroke: var(--bad); stroke-width: 2; }
  .harmonic-label { fill: var(--bad); font: 600 11px var(--mono); }
</style>

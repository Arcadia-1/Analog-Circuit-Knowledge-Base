<script lang="ts">
  import { freqText, nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import type { Spectrum } from '../../lib/spectrum';
  import Plot from './Plot.svelte';
  import Tip from './Tip.svelte';

  /** Output spectrum in dBFS; each pixel column spans the min … max of the bins it covers. */
  let { spectrum, n, series, hover, onhover, label, fs, marks = [], behind, signalLabel = 'input' }: {
    spectrum: Spectrum;
    n: number;
    series: 1 | 2;
    hover: number | null;
    onhover: (bin: number | null) => void;
    label: string;
    /** sampling rate in hertz, to mark the axis in frequency rather than in fractions of fs */
    fs?: number;
    /** bins to name, such as where harmonics landed; a mark on the spur replaces the spur's own label */
    marks?: { bin: number; text: string }[];
    /** a second spectrum of the same record to draw faded underneath, such as the same capture before a correction */
    behind?: Spectrum;
    signalLabel?: string;
  } = $props();

  const X0 = 46;
  // the record this spectrum came from, which is not always the site's usual one
  const BINS = $derived(spectrum.dbfs.length - 1);
  const points = $derived(2 * BINS);
  const ybot = $derived(-20 * Math.ceil((6.02 * n + 1.76 + 10 * Math.log10(BINS) + 12) / 20));
  const order = (bin: number) => spectrum.harmonics.indexOf(bin) + 2;
  const mhz = (bin: number) => `${Math.round(((bin / points) * (fs ?? 0)) / 1e5) / 10}`;
  const at = (bin: number) => (fs ? freqText((bin / points) * fs) : `${(bin / points).toFixed(3)} fs`);

  function geo(W: number, H: number) {
    const X1 = W - 6, Y0 = 6, Y1 = H - 20;
    const sx = (bin: number) => X0 + (bin / BINS) * (X1 - X0);
    const sy = (v: number) => Y0 + (clamp(v, ybot, 0) / ybot) * (Y1 - Y0);
    const cols = Math.max(1, Math.round(X1 - X0));
    // one column of pixels spans the min … max of the bins it covers
    const columns = (of: Spectrum) => {
      const lo = new Float64Array(cols).fill(Infinity), hi = new Float64Array(cols).fill(-Infinity);
      for (let k = 1; k <= BINS; k++) {
        const c = Math.min(cols - 1, Math.floor(((k - 0.5) / BINS) * cols));
        const v = of.dbfs[k];
        if (v < lo[c]) lo[c] = v;
        if (v > hi[c]) hi[c] = v;
      }
      let path = '';
      for (let c = 0; c < cols; c++) if (hi[c] > -Infinity) path += `M${X0 + c + 0.5},${sy(hi[c])}V${Math.max(sy(lo[c]), sy(hi[c]) + 1)}`;
      return path;
    };
    const d = columns(spectrum), was = behind ? columns(behind) : '';
    const grid: number[] = [];
    const every = Y1 - Y0 < 170 ? 40 : 20;
    for (let v = ybot; v <= 0; v += 20) grid.push(v);
    const ticks = X1 - X0 < 300 ? [0, 0.25, 0.5] : [0, 0.1, 0.2, 0.3, 0.4, 0.5];
    const spurX = sx(spectrum.spur), right = spurX < X1 - 100;
    const h = order(spectrum.spur);
    const spurText = `${h > 1 ? `H${h} ` : ''}${nf(spectrum.dbfs[spectrum.spur], 1)} dBFS`;
    // named bins, left to right; a label that would sit on its neighbour's moves up a line
    const named = [...marks].sort((a, b) => a.bin - b.bin).map((m) => ({ ...m, x: sx(m.bin), y: sy(spectrum.dbfs[m.bin]) }));
    named.forEach((m, i) => {
      if (i && m.x - named[i - 1].x < 28 && Math.abs(m.y - named[i - 1].y) < 14) m.y = named[i - 1].y - 14;
    });
    const tick = (f: number) => (fs ? (f === 0.5 ? `${mhz(f * points)} MHz` : mhz(f * points)) : f === 0.5 ? '0.5 fs' : `${f}`);
    return { X1, Y0, Y1, sx, sy, d, was, grid, every, ticks, tick, spurX, right, spurText, named };
  }

  function move(px: number, W: number) {
    const X1 = W - 6;
    onhover(px >= X0 && px <= X1 ? clamp(Math.round(((px - X0) / (X1 - X0)) * BINS), 1, BINS) : null);
  }
</script>

<Plot {label} onpointermove={move} onpointerleave={() => onhover(null)}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each g.grid as v (v)}
      <line class="gr" x1={X0} y1={g.sy(v)} x2={g.X1} y2={g.sy(v)} />
      {#if (v - ybot) % g.every === 0}<text class="tx" x="40" y={g.sy(v)} text-anchor="end" dominant-baseline="central">{nf(v, 0)}</text>{/if}
    {/each}
    {#each g.ticks as f (f)}
      <line class="gr" x1={g.sx(f * points)} y1={g.Y0} x2={g.sx(f * points)} y2={g.Y1} />
      <text class="tx" x={g.sx(f * points)} y={height - 5} text-anchor={f === 0 ? 'start' : f === 0.5 ? 'end' : 'middle'}>{g.tick(f)}</text>
    {/each}
    <text class="tx2 halo" x={X0 + 6} y={g.Y0 + 12}>dBFS</text>
    {#if g.was}<path class="was" stroke-width="1" d={g.was} />{/if}
    <path class="c{series}" stroke-width="1" d={g.d} />
    <circle class="f{series} ring" cx={g.sx(spectrum.signal)} cy={g.sy(spectrum.dbfs[spectrum.signal])} r="4.5" />
    {#if !marks.some((m) => m.bin === spectrum.spur)}
      <circle class="f{series} ring" cx={g.spurX} cy={g.sy(spectrum.dbfs[spectrum.spur])} r="4" />
      <text class="tx2 tx-ink halo" x={g.spurX + (g.right ? 8 : -8)} y={g.sy(spectrum.dbfs[spectrum.spur]) + 4} text-anchor={g.right ? 'start' : 'end'}>{g.spurText}</text>
    {/if}
    {#each g.named as m (m.bin)}
      <circle class="f2 ring" cx={m.x} cy={g.sy(spectrum.dbfs[m.bin])} r="4" />
      <text class="tx2 tx-ink halo" x={m.x} y={m.y - 9} text-anchor={m.x > g.X1 - 20 ? 'end' : m.x < X0 + 20 ? 'start' : 'middle'}>{m.text}</text>
    {/each}
    {#if hover !== null}<line class="cross" x1={g.sx(hover)} y1={g.Y0} x2={g.sx(hover)} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      {@const h = order(hover)}
      <Tip x={g.sx(hover)} y={g.sy(spectrum.dbfs[hover])} {width} text="{at(hover)} · {nf(spectrum.dbfs[hover], 1)} dBFS{hover === spectrum.signal ? ` · ${signalLabel}` : h > 1 ? ` · H${h}` : ''}" />
    {/if}
  {/snippet}
</Plot>

<style>
  /* the same capture before whatever the page is showing the effect of */
  .was { stroke: var(--ink-3); fill: none; opacity: 0.4; }
</style>

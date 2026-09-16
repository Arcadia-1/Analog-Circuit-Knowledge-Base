<script lang="ts">
  import { nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import { N_FFT, type Spectrum } from '../../lib/spectrum';
  import Plot from './Plot.svelte';
  import Tip from './Tip.svelte';

  /** Output spectrum in dBFS; each pixel column spans the min … max of the bins it covers. */
  let { spectrum, n, series, hover, onhover, label }: {
    spectrum: Spectrum;
    n: number;
    series: 1 | 2;
    hover: number | null;
    onhover: (bin: number | null) => void;
    label: string;
  } = $props();

  const X0 = 46, BINS = N_FFT / 2;
  const ybot = $derived(-20 * Math.ceil((6.02 * n + 1.76 + 10 * Math.log10(BINS) + 12) / 20));
  const order = (bin: number) => spectrum.harmonics.indexOf(bin) + 2;

  function geo(W: number, H: number) {
    const X1 = W - 6, Y0 = 6, Y1 = H - 20;
    const sx = (bin: number) => X0 + (bin / BINS) * (X1 - X0);
    const sy = (v: number) => Y0 + (clamp(v, ybot, 0) / ybot) * (Y1 - Y0);
    const cols = Math.max(1, Math.round(X1 - X0));
    const lo = new Float64Array(cols).fill(Infinity), hi = new Float64Array(cols).fill(-Infinity);
    for (let k = 1; k <= BINS; k++) {
      const c = Math.min(cols - 1, Math.floor(((k - 0.5) / BINS) * cols));
      const v = spectrum.dbfs[k];
      if (v < lo[c]) lo[c] = v;
      if (v > hi[c]) hi[c] = v;
    }
    let d = '';
    for (let c = 0; c < cols; c++) if (hi[c] > -Infinity) d += `M${X0 + c + 0.5},${sy(hi[c])}V${Math.max(sy(lo[c]), sy(hi[c]) + 1)}`;
    const grid: number[] = [];
    const every = Y1 - Y0 < 170 ? 40 : 20;
    for (let v = ybot; v <= 0; v += 20) grid.push(v);
    const ticks = X1 - X0 < 300 ? [0, 0.25, 0.5] : [0, 0.1, 0.2, 0.3, 0.4, 0.5];
    const spurX = sx(spectrum.spur), right = spurX < X1 - 100;
    const h = order(spectrum.spur);
    const spurText = `${h > 1 ? `H${h} ` : ''}${nf(spectrum.dbfs[spectrum.spur], 1)} dBFS`;
    return { X1, Y0, Y1, sx, sy, d, grid, every, ticks, spurX, right, spurText };
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
      <line class="gr" x1={g.sx(f * N_FFT)} y1={g.Y0} x2={g.sx(f * N_FFT)} y2={g.Y1} />
      <text class="tx" x={g.sx(f * N_FFT)} y={height - 5} text-anchor={f === 0 ? 'start' : f === 0.5 ? 'end' : 'middle'}>{f === 0.5 ? '0.5 fs' : f}</text>
    {/each}
    <text class="tx2 halo" x={X0 + 6} y={g.Y0 + 12}>dBFS</text>
    <path class="c{series}" stroke-width="1" d={g.d} />
    <circle class="f{series} ring" cx={g.sx(spectrum.signal)} cy={g.sy(spectrum.dbfs[spectrum.signal])} r="4.5" />
    <circle class="f{series} ring" cx={g.spurX} cy={g.sy(spectrum.dbfs[spectrum.spur])} r="4" />
    <text class="tx2 tx-ink halo" x={g.spurX + (g.right ? 8 : -8)} y={g.sy(spectrum.dbfs[spectrum.spur]) + 4} text-anchor={g.right ? 'start' : 'end'}>{g.spurText}</text>
    {#if hover !== null}<line class="cross" x1={g.sx(hover)} y1={g.Y0} x2={g.sx(hover)} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      {@const h = order(hover)}
      <Tip x={g.sx(hover)} y={g.sy(spectrum.dbfs[hover])} {width} text="{(hover / N_FFT).toFixed(3)} fs · {nf(spectrum.dbfs[hover], 1)} dBFS{hover === spectrum.signal ? ' · input' : h > 1 ? ` · H${h}` : ''}" />
    {/if}
  {/snippet}
</Plot>

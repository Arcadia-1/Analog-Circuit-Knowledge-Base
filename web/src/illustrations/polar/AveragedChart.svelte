<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import type { AveragedSpectrum } from '../../lib/averaged-spectrum';
  import { freqText, nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import { FS, N } from './model';

  /** The averaged spectrum in dBFS, bin to bin, with the harmonics compute_spectrum located named. */
  let { spectrum, hover, onhover, label }: {
    spectrum: AveragedSpectrum;
    hover: number | null;
    onhover: (bin: number | null) => void;
    label: string;
  } = $props();

  const X0 = 46, HALF = N / 2, BOTTOM = -160;

  function geo(W: number, H: number) {
    const X1 = W - 8, Y0 = 16, Y1 = H - 20;
    const sx = (bin: number) => X0 + (bin / HALF) * (X1 - X0);
    const sy = (v: number) => Y0 + (clamp(v, BOTTOM, 0) / BOTTOM) * (Y1 - Y0);
    let d = '';
    for (let k = 1; k <= HALF; k++) d += `${k > 1 ? 'L' : 'M'}${sx(k).toFixed(1)},${sy(spectrum.dbfs[k]).toFixed(1)}`;
    const grid: number[] = [];
    for (let v = BOTTOM; v <= 0; v += 40) grid.push(v);
    const ticks = X1 - X0 < 360 ? [0, 25, 50] : [0, 10, 20, 30, 40, 50];
    // a label that would sit on its neighbour moves up a line
    const marks = spectrum.harmonicBins
      .map((bin, i) => ({ bin, h: i + 2, x: sx(bin), y: sy(spectrum.dbfs[bin]) - 9 }))
      .filter((m) => m.bin > 0 && m.bin !== spectrum.signal)
      .sort((a, b) => a.x - b.x);
    marks.forEach((m, i) => {
      if (i && m.x - marks[i - 1].x < 22 && Math.abs(m.y - marks[i - 1].y) < 12) m.y = marks[i - 1].y - 12;
    });
    return { X1, Y0, Y1, sx, sy, d, grid, ticks, marks };
  }

  function move(px: number, W: number) {
    const X1 = W - 8;
    onhover(px >= X0 && px <= X1 ? clamp(Math.round(((px - X0) / (X1 - X0)) * HALF), 1, HALF) : null);
  }

  const which = (bin: number) => {
    if (bin === spectrum.signal) return ' · the tone';
    const h = spectrum.harmonicBins.indexOf(bin);
    return h >= 0 ? ` · H${h + 2}` : '';
  };
</script>

<Plot {label} onpointermove={move} onpointerleave={() => onhover(null)}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each g.grid as v (v)}
      <line class="gr" x1={X0} y1={g.sy(v)} x2={g.X1} y2={g.sy(v)} />
      <text class="tx" x={X0 - 6} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{nf(v, 0)}</text>
    {/each}
    {#each g.ticks as f, i (f)}
      <text class="tx" x={g.sx((f * 1e6 * N) / FS)} y={height - 5} text-anchor={i === 0 ? 'start' : i === g.ticks.length - 1 ? 'end' : 'middle'}>{i === g.ticks.length - 1 ? `${f} MHz` : f}</text>
    {/each}
    <text class="tx2 halo" x={X0 + 6} y={g.Y0 + 12}>dBFS</text>
    <path class="c1" stroke-width="1" d={g.d} />
    <circle class="f1 ring" cx={g.sx(spectrum.signal)} cy={g.sy(spectrum.dbfs[spectrum.signal])} r="4.5" />
    {#each g.marks as m (m.h)}
      <circle class="f2 ring" cx={m.x} cy={g.sy(spectrum.dbfs[m.bin])} r="3.8" />
      <text class="tx2 tx-ink halo" x={m.x} y={m.y} text-anchor="middle">H{m.h}</text>
    {/each}
    {#if hover !== null}<line class="cross" x1={g.sx(hover)} y1={g.Y0} x2={g.sx(hover)} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      <Tip x={g.sx(hover)} y={g.sy(spectrum.dbfs[hover])} {width} text="{freqText((hover * FS) / N)} · {nf(spectrum.dbfs[hover], 1)} dBFS{which(hover)}" />
    {/if}
  {/snippet}
</Plot>

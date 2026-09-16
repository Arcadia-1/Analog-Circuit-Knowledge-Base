<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import type { AveragedSpectrum } from '../../lib/averaged-spectrum';
  import { freqText, nf } from '../../lib/format';
  import { FS, N, phaseDeg, polarOf, RADIAL } from './model';

  /**
   * plot_spectrum_polar: every bin of the coherently averaged spectrum as a point, its phase clockwise from the top and
   * its level outward from −120 dB; the fundamental and harmonics 2 … 5 drawn as spokes.
   */
  let { spectrum, hover, onhover, label }: {
    spectrum: AveragedSpectrum;
    hover: number | null;
    onhover: (bin: number | null) => void;
    label: string;
  } = $props();

  const RINGS = [30, 60, 90, 120];
  const SPOKES = Array.from({ length: 12 }, (_, i) => i * 30);
  const polar = $derived(polarOf(spectrum));

  function geo(W: number, H: number) {
    const R = Math.max(40, Math.min(W / 2 - 34, H / 2 - 16)), cx = W / 2, cy = H / 2;
    // phase 0 at the top, turning clockwise
    const at = (phase: number, radius: number) => [cx + (radius / RADIAL) * R * Math.sin(phase), cy - (radius / RADIAL) * R * Math.cos(phase)] as const;
    let dots = '';
    for (let k = 1; k < polar.radius.length; k++) {
      const [x, y] = at(polar.phase[k], polar.radius[k]);
      dots += `M${x.toFixed(1)},${y.toFixed(1)}h0.01`;
    }
    // each harmonic's number sits beside its spoke's end, even ones to the right of it and odd ones to the left
    const spokes = [spectrum.signal, ...spectrum.harmonicBins]
      .map((bin, i) => {
        const h = i + 1, end = at(polar.phase[bin], polar.radius[bin]), side = h % 2 ? -1 : 1;
        const tag = [end[0] + side * 9 * Math.cos(polar.phase[bin]), end[1] + side * 9 * Math.sin(polar.phase[bin])];
        return { bin, h, end, tag };
      })
      .filter((s) => s.bin > 0 && (s.h === 1 || s.bin !== spectrum.signal));
    return { R, cx, cy, at, dots, spokes };
  }

  function move(x: number, W: number, H: number, y: number) {
    const g = geo(W, H);
    let best: number | null = null, dist = 14;
    for (let k = 1; k < polar.radius.length; k++) {
      const [px, py] = g.at(polar.phase[k], polar.radius[k]);
      const d = Math.hypot(px - x, py - y);
      if (d < dist) [best, dist] = [k, d];
    }
    onhover(best);
  }
</script>

<Plot {label} onpointermove={move} onpointerleave={() => onhover(null)}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each RINGS as r (r)}
      <circle class="gr" cx={g.cx} cy={g.cy} r={(r / RADIAL) * g.R} />
      <text class="tx" x={g.cx + 3} y={g.cy - (r / RADIAL) * g.R + 11}>{r - RADIAL}</text>
    {/each}
    {#each SPOKES as a (a)}
      {@const [x, y] = g.at((a * Math.PI) / 180, RADIAL)}
      {@const [lx, ly] = g.at((a * Math.PI) / 180, RADIAL + 13)}
      <line class="gr" x1={g.cx} y1={g.cy} x2={x} y2={y} />
      <text class="tx" x={lx} y={ly} text-anchor="middle" dominant-baseline="central">{a}°</text>
    {/each}
    <path class="dots" d={g.dots} />
    {#each g.spokes as s (s.h)}
      <line class={s.h === 1 ? 'c1' : 'c2'} stroke-width="2" x1={g.cx} y1={g.cy} x2={s.end[0]} y2={s.end[1]} />
      {#if s.h === 1}
        <circle class="f1 ring" cx={s.end[0]} cy={s.end[1]} r="4.5" />
      {:else}
        <rect class="f2" x={s.end[0] - 3.5} y={s.end[1] - 3.5} width="7" height="7" />
        <text class="tx2 tx-ink halo" x={s.tag[0]} y={s.tag[1]} text-anchor="middle" dominant-baseline="central">{s.h}</text>
      {/if}
    {/each}
    {#if hover !== null}
      {@const [x, y] = g.at(polar.phase[hover], polar.radius[hover])}
      <circle class="pick" cx={x} cy={y} r="6" />
    {/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      {@const [x, y] = g.at(polar.phase[hover], polar.radius[hover])}
      {@const h = spectrum.harmonicBins.indexOf(hover)}
      <Tip {x} {y} {width} text="{freqText((hover * FS) / N)}{hover === spectrum.signal ? ' · the tone' : h >= 0 ? ` · H${h + 2}` : ''} · {nf(polar.radius[hover] - RADIAL, 1)} dB ∠{nf(phaseDeg(spectrum, hover), 1)}°" />
    {/if}
  {/snippet}
</Plot>

<style>
  .dots { stroke: var(--ink-3); stroke-width: 2.4; stroke-linecap: round; fill: none; opacity: 0.6; }
  .pick { fill: none; stroke: var(--ink); stroke-width: 1.5; }
</style>

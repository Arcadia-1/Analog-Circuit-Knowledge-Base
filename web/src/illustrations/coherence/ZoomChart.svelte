<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import type { Spectrum } from '../../lib/spectrum';

  /** The bins right around the tone, where a window either holds the energy in or lets it out. */
  let { spectrum, bin, sideBin, span, hover, onhover, label }: {
    spectrum: Spectrum;
    bin: number;
    sideBin: number;
    span: number;
    hover: number | null;
    onhover: (bin: number | null) => void;
    label: string;
  } = $props();

  const X0 = 44, FLOOR = -140;
  const lo = $derived(Math.max(0, bin - span));
  const hi = $derived(Math.min(spectrum.dbfs.length - 1, bin + span));

  function geo(W: number, H: number) {
    const X1 = W - 6, Y0 = 8, Y1 = H - 18;
    const sx = (k: number) => X0 + ((k - lo + 0.5) / (hi - lo + 1)) * (X1 - X0);
    const sy = (v: number) => Y0 + ((0 - clamp(v, FLOOR, 0)) / (0 - FLOOR)) * (Y1 - Y0);
    const bw = Math.max(1.5, (X1 - X0) / (hi - lo + 1) - 1.5);
    const bars = Array.from({ length: hi - lo + 1 }, (_, i) => {
      const k = lo + i;
      return { k, x: sx(k) - bw / 2, y: sy(spectrum.dbfs[k]), h: Y1 - sy(spectrum.dbfs[k]), signal: Math.abs(k - bin) <= sideBin };
    });
    const grid: number[] = [];
    for (let v = 0; v >= FLOOR; v -= 40) grid.push(v);
    return { X1, Y0, Y1, sx, sy, bw, bars, grid };
  }
</script>

<Plot
  {label}
  onpointermove={(px, W) => onhover(px >= X0 && px <= W - 6 ? lo + clamp(Math.floor(((px - X0) / (W - 6 - X0)) * (hi - lo + 1)), 0, hi - lo) : null)}
  onpointerleave={() => onhover(null)}
>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each g.grid as v (v)}
      <line class="gr" x1={X0} y1={g.sy(v)} x2={g.X1} y2={g.sy(v)} />
      <text class="tx" x={X0 - 7} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{v}</text>
    {/each}
    <line class="gr" x1={X0} y1={g.Y1} x2={g.X1} y2={g.Y1} />
    <text class="tx2 halo" x={X0 + 6} y={g.Y0 + 10}>dBFS, bin by bin</text>
    {#each g.bars as b (b.k)}
      <rect class={b.signal ? 'f2' : 'f1'} x={b.x} y={b.y} width={g.bw} height={Math.max(0, b.h)} opacity={b.signal ? 1 : 0.55} />
    {/each}
    {#each [lo, bin, hi] as k, i (i)}
      <text class="tx" x={g.sx(k)} y={height - 4} text-anchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}>{k}</text>
    {/each}
    {#if hover !== null}<line class="cross" x1={g.sx(hover)} y1={g.Y0} x2={g.sx(hover)} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      <Tip
        x={g.sx(hover)}
        y={g.sy(spectrum.dbfs[hover])}
        {width}
        text="bin {hover} · {nf(spectrum.dbfs[hover], 1)} dBFS{Math.abs(hover - bin) <= sideBin ? ' · counted as signal' : ''}"
      />
    {/if}
  {/snippet}
</Plot>

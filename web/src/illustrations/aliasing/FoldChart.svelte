<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { freqText, nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import { F_MAX, foldFrequency, FS, zoneOf, type Landing } from './model';

  /**
   * Where every input from 0 to F_MAX lands at the output rate: one tooth per pair of Nyquist zones, the mirrored zones
   * shaded. The tone sits on it with the inputs of the other zones that land in the same place, and its harmonics beside.
   */
  let { fsOut, landings, twins, hover, onhover, label }: {
    fsOut: number;
    landings: Landing[];
    twins: number[];
    /** hovered input frequency, Hz */
    hover: number | null;
    onhover: (f: number | null) => void;
    label: string;
  } = $props();

  const X0 = 56;
  const short = (hz: number) => `${Math.round(hz / 1e5) / 10}`;

  function geo(W: number, H: number) {
    const X1 = W - 8, Y0 = 8, Y1 = H - 20, half = fsOut / 2;
    const sx = (f: number) => X0 + (f / F_MAX) * (X1 - X0);
    const sy = (f: number) => Y1 - (f / half) * (Y1 - Y0);
    const teeth = Math.round(F_MAX / half), bw = sx(half) - sx(0);
    const tri = Array.from({ length: teeth + 1 }, (_, k) => `${k ? 'L' : 'M'}${sx(k * half)},${sy(k % 2 ? half : 0)}`).join('');
    const zones = Array.from({ length: teeth }, (_, k) => ({ k, x: sx(k * half) }));
    // the harmonics that fall off the right end are still drawn where they land, at the edge; a label that would run
    // into the zone names goes under its dot
    const harmonics = landings.slice(1).map((l) => {
      const y = sy(l.lands);
      return { ...l, x: sx(Math.min(l.at, F_MAX)), y, ty: y - 9 < Y0 + 22 ? y + 17 : y - 9, off: l.at > F_MAX };
    });
    // two labels on top of each other, as both harmonics are when they run off the same end: lift the upper one clear
    const [a, b] = [...harmonics].sort((p, q) => q.ty - p.ty);
    if (b && Math.abs(a.x - b.x) < 120 && a.ty - b.ty < 13) b.ty = a.ty - 13;
    const ticks = X1 - X0 < 420 ? [0, 1, 2, 3] : [0, 0.5, 1, 1.5, 2, 2.5, 3];
    return { X1, Y0, Y1, sx, sy, tri, zones, bw, harmonics, ticks, named: bw >= 22 };
  }
</script>

<Plot
  {label}
  onpointermove={(px, W) => onhover(px >= X0 && px <= W - 8 ? clamp(((px - X0) / (W - 8 - X0)) * F_MAX, 0, F_MAX) : null)}
  onpointerleave={() => onhover(null)}
>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each g.zones as z (z.k)}
      {#if z.k % 2}<rect class="mirror" x={z.x} y={g.Y0} width={g.bw} height={g.Y1 - g.Y0} />{/if}
      {#if g.named}<text class="tx" x={z.x + g.bw / 2} y={g.Y0 + 12} text-anchor="middle">{g.bw >= 70 ? `zone ${z.k + 1}` : z.k + 1}</text>{/if}
    {/each}
    {#each [0, 0.25, 0.5] as r (r)}
      <line class="gr" x1={X0} y1={g.sy(r * fsOut)} x2={g.X1} y2={g.sy(r * fsOut)} />
      <text class="tx" x={X0 - 7} y={g.sy(r * fsOut)} text-anchor="end" dominant-baseline="central">{r === 0.5 ? `${short(r * fsOut)} MHz` : short(r * fsOut)}</text>
    {/each}
    {#each [0.5, 1, 1.5, 2, 2.5] as v (v)}
      <line class="guide" x1={g.sx(v * FS)} y1={g.Y0} x2={g.sx(v * FS)} y2={g.Y1} />
    {/each}
    {#each g.ticks as v (v)}
      <text class="tx" x={g.sx(v * FS)} y={height - 5} text-anchor={v === 0 ? 'start' : v === 3 ? 'end' : 'middle'}>{v === 3 ? '3 GHz in' : v}</text>
    {/each}
    <path class="fold" d={g.tri} />
    <line class="guide" x1={X0} y1={g.sy(landings[0].lands)} x2={g.X1} y2={g.sy(landings[0].lands)} stroke-dasharray="4 3" />
    {#each twins as t (t)}
      <circle class="twin" cx={g.sx(t)} cy={g.sy(landings[0].lands)} r="3.5" />
    {/each}
    {#each g.harmonics as h (h.order)}
      <circle class="f2 ring" cx={h.x} cy={h.y} r="4.5" />
      <text class="tx2 tx-ink halo" x={h.off ? h.x - 8 : h.x} y={h.ty} text-anchor={h.off ? 'end' : 'middle'}>H{h.order}{h.off ? ` from ${nf(h.at / 1e9, 2)} GHz` : ''}</text>
    {/each}
    <circle class="f1 ring" cx={g.sx(landings[0].at)} cy={g.sy(landings[0].lands)} r="5.5" />
    {#if hover !== null}<line class="cross" x1={g.sx(hover)} y1={g.Y0} x2={g.sx(hover)} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      {@const z = zoneOf(hover, fsOut)}
      <Tip
        x={g.sx(hover)}
        y={g.sy(foldFrequency(hover, fsOut))}
        {width}
        text="{freqText(hover)} in → {freqText(foldFrequency(hover, fsOut))} out · zone {z}{z % 2 ? '' : ', mirrored'}"
      />
    {/if}
  {/snippet}
</Plot>

<style>
  .mirror { fill: var(--chip); opacity: 0.7; }
  .fold { fill: none; stroke: var(--ink-2); stroke-width: 1.4; stroke-linejoin: round; }
  .twin { fill: var(--plot); stroke: var(--s1); stroke-width: 1.8; }
</style>

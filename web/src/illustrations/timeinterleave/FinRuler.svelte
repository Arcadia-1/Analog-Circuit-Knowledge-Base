<script lang="ts">
  import SliderRuler from '../../components/chart/SliderRuler.svelte';
  import { FS } from './model';

  /**
   * The input frequency from 0 to fs/2, over the Nyquist zones of one channel, which samples at fs/M. The first zone is
   * where the calibration's delays hold; in the shaded ones the channel sees the tone mirrored.
   */
  let { f, m, onchange }: { f: number; m: number; onchange: (hz: number) => void } = $props();

  const TOP = FS / 2;
  const zones = $derived(Array.from({ length: m }, (_, z) => z));
</script>

<SliderRuler value={f / 1e6} min={0} max={TOP / 1e6} step={0.25} label="Input frequency in MHz" onchange={(v) => onchange(v * 1e6)}>
  {#snippet children({ W, X })}
    {@const x = (hz: number) => X(hz / 1e6)}
    {@const width = x(FS / (2 * m)) - x(0)}
    {@const marks = W < 360 ? [0, 250, 500] : [0, 100, 200, 300, 400, 500]}
    <rect class="a1" x={x(0)} y="19" {width} height="18" />
    {#each zones as z (z)}
      {#if z % 2}<rect class="mirror" x={x((z * FS) / (2 * m))} y="19" {width} height="18" />{/if}
      {#if z}<line class="tick" x1={x((z * FS) / (2 * m))} y1="19" x2={x((z * FS) / (2 * m))} y2="37" />{/if}
    {/each}
    <line class="base" x1="0" y1="28" x2={W} y2="28" />
    {#each marks as v, i (v)}
      <line class="major" x1={X(v)} y1="24" x2={X(v)} y2="32" />
      <text class="tx" x={X(v)} y="10" text-anchor={i === 0 ? 'start' : i === marks.length - 1 ? 'end' : 'middle'}>{i === marks.length - 1 ? `${v} MHz` : v}</text>
    {/each}
    <text class="tx zone" x={x(FS / (2 * m))} y="56" text-anchor={m === 2 ? 'middle' : 'start'} dx={m === 2 ? 0 : -4}>fs/2M</text>
  {/snippet}
</SliderRuler>

<style>
  .mirror { fill: var(--chip); }
  .zone { fill: var(--ink-2); }
</style>

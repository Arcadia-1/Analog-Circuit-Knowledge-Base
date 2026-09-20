<script lang="ts">
  import SliderRuler from '../../components/chart/SliderRuler.svelte';
  import { freqText } from '../../lib/format';

  /**
   * The input frequency from 0 to fs/2, over the Nyquist zones of one channel, which samples at fs/M. The first zone is
   * repeated shaded zones show where an individual channel sees the tone mirrored.
   */
  let { f, fs, m, onchange }: { f: number; fs: number; m: number; onchange: (hz: number) => void } = $props();

  const top = $derived(fs / 2);
  const zones = $derived(Array.from({ length: m }, (_, z) => z));
</script>

<SliderRuler value={f / 1e6} min={0} max={top / 1e6} step={0.25} label="Input frequency" onchange={(v) => onchange(v * 1e6)}>
  {#snippet children({ W, X })}
    {@const x = (hz: number) => X(hz / 1e6)}
    {@const width = x(fs / (2 * m)) - x(0)}
    {@const steps = W < 360 ? 2 : 5}
    {@const marks = Array.from({ length: steps + 1 }, (_, i) => (i / steps) * top)}
    <rect class="a1" x={x(0)} y="19" {width} height="18" />
    {#each zones as z (z)}
      {#if z % 2}<rect class="mirror" x={x((z * fs) / (2 * m))} y="19" {width} height="18" />{/if}
      {#if z}<line class="tick" x1={x((z * fs) / (2 * m))} y1="19" x2={x((z * fs) / (2 * m))} y2="37" />{/if}
    {/each}
    <line class="base" x1="0" y1="28" x2={W} y2="28" />
    {#each marks as v, i (v)}
      <line class="major" x1={x(v)} y1="24" x2={x(v)} y2="32" />
      <text class="tx" x={x(v)} y="10" text-anchor={i === 0 ? 'start' : i === marks.length - 1 ? 'end' : 'middle'}>{freqText(v)}</text>
    {/each}
    <text class="tx zone" x={x(fs / (2 * m))} y="56" text-anchor={m === 2 ? 'middle' : 'start'} dx={m === 2 ? 0 : -4}>fs/2M</text>
  {/snippet}
</SliderRuler>

<style>
  .mirror { fill: var(--chip); }
  .zone { fill: var(--ink-2); }
</style>

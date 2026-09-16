<script lang="ts">
  import SliderRuler from '../../components/chart/SliderRuler.svelte';
  import { F_MAX, FS } from './model';

  /**
   * The input frequency on a ruler of the converter's six Nyquist zones, the mirrored ones shaded. When only every
   * N-th sample is kept, the narrower zones of the lower rate are ticked along the base.
   */
  let { f, fsOut, onchange }: { f: number; fsOut: number; onchange: (hz: number) => void } = $props();

  const zones = [0, 1, 2, 3, 4, 5];
  const marks = [0, 0.5, 1, 1.5, 2, 2.5, 3];
  const inner = $derived(fsOut < FS ? Array.from({ length: Math.round(F_MAX / (fsOut / 2)) - 1 }, (_, i) => ((i + 1) * fsOut) / 2) : []);
</script>

<SliderRuler value={f / 1e9} min={0} max={F_MAX / 1e9} step={0.0005} label="Input frequency in GHz" onchange={(g) => onchange(g * 1e9)}>
  {#snippet children({ W, X })}
    {@const x = (hz: number) => X(hz / 1e9)}
    {#each zones as z (z)}
      {#if z % 2}<rect class="mirror" x={x((z * FS) / 2)} y="19" width={x(FS / 2) - x(0)} height="18" />{/if}
      <text class="tx zone" x={x(((z + 0.5) * FS) / 2)} y="56" text-anchor="middle">zone {z + 1}</text>
    {/each}
    <line class="base" x1="0" y1="28" x2={W} y2="28" />
    {#each inner as v (v)}
      <line class="tick" x1={x(v)} y1="25" x2={x(v)} y2="31" />
    {/each}
    {#each marks as g, i (g)}
      <line class="major" x1={X(g)} y1="19" x2={X(g)} y2="37" />
      <text class="tx" x={X(g)} y="10" text-anchor={i === 0 ? 'start' : i === marks.length - 1 ? 'end' : 'middle'}>{i === marks.length - 1 ? `${g} GHz` : g}</text>
    {/each}
  {/snippet}
</SliderRuler>

<style>
  .mirror { fill: var(--chip); }
  .zone { fill: var(--ink-2); }
</style>

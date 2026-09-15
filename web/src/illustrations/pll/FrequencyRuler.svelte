<script lang="ts">
  import SliderRuler from '../../components/chart/SliderRuler.svelte';
  import { clamp } from '../../lib/scale';

  /** Target frequency on a ruler: integer-N can only land on the channels (multiples of f_ref). */
  let { targetHz, fRef, onchange }: { targetHz: number; fRef: number; onchange: (hz: number) => void } = $props();

  const LO = 4.95e9, HI = 5.15e9;
  const ticks = Array.from({ length: 21 }, (_, i) => LO + i * 10e6);
  const channels = $derived(Array.from({ length: Math.floor(HI / fRef) - Math.ceil(LO / fRef) + 1 }, (_, i) => (Math.ceil(LO / fRef) + i) * fRef));
  const fInt = $derived(Math.round(targetHz / fRef) * fRef);
</script>

<SliderRuler value={targetHz / 1e9} min={LO / 1e9} max={HI / 1e9} step={0.0001} label="Target output frequency in GHz" onchange={(g) => onchange(g * 1e9)}>
  {#snippet children({ W, X })}
    {@const x = (hz: number) => X(hz / 1e9)}
    {@const xi = clamp(x(fInt), 0, W)}
    <line class="base" x1="0" y1="28" x2={W} y2="28" />
    {#each ticks as f, i (f)}
      <line class="tick" x1={x(f)} y1={i % 5 ? 24 : 21} x2={x(f)} y2="28" />
      {#if i % 5 === 0}<text class="tx" x={x(f)} y="10" text-anchor={i === 0 ? 'start' : i === 20 ? 'end' : 'middle'}>{(f / 1e9).toFixed(2)}</text>{/if}
    {/each}
    {#each channels as f (f)}
      <line class="major" x1={x(f)} y1="17" x2={x(f)} y2="38" />
      <circle class="slot" cx={x(f)} cy="48" r="3.5" />
    {/each}
    <line class="lane c2" x1="0" y1="59" x2={W} y2="59" />
    <line class="miss" x1={x(targetHz)} y1="48" x2={xi} y2="48" />
    <circle class="f1 ring" cx={xi} cy="48" r="5" />
    <circle class="f2 ring" cx={x(targetHz)} cy="59" r="5" />
  {/snippet}
</SliderRuler>

<style>
  .slot { fill: var(--plot); stroke: var(--s1); stroke-width: 1.5; }
  .miss { stroke: var(--s1); stroke-width: 1.5; opacity: 0.55; }
</style>

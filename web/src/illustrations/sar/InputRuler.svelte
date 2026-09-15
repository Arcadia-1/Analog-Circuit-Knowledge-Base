<script lang="ts">
  import SliderRuler from '../../components/chart/SliderRuler.svelte';

  /** Input voltage over a 6-bit grid of decision levels, with both output codes marked. */
  let { vin, n, codeA, codeB, onchange }: { vin: number; n: number; codeA: number; codeB: number; onchange: (v: number) => void } = $props();

  const LEVELS = Array.from({ length: 63 }, (_, i) => (i + 1) / 64);
  const mid = (code: number) => (code + 0.5) / 2 ** n;
</script>

<SliderRuler value={vin} min={0} max={1} step={0.0001} label="Input voltage in volts" {onchange}>
  {#snippet children({ W, X })}
    <line class="base" x1="0" y1="28" x2={W} y2="28" />
    {#each LEVELS as v (v)}<line class="tick" opacity="0.6" x1={X(v)} y1="24" x2={X(v)} y2="28" />{/each}
    {#each [0, 0.25, 0.5, 0.75, 1] as v (v)}
      <line class="major" x1={X(v)} y1="18" x2={X(v)} y2="28" />
      <text class="tx" x={X(v)} y="10" text-anchor={v === 0 ? 'start' : v === 1 ? 'end' : 'middle'}>{v.toFixed(2)} V</text>
    {/each}
    <line class="lane c1" x1="0" y1="48" x2={W} y2="48" />
    <line class="lane c2" x1="0" y1="59" x2={W} y2="59" />
    <circle class="f1 ring" cx={X(mid(codeA))} cy="48" r="5" />
    <circle class="f2 ring" cx={X(mid(codeB))} cy="59" r="5" />
  {/snippet}
</SliderRuler>

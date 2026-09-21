<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import { frequency, response, type Amplifier } from './model';

  let { model, id, low, high, probe = $bindable(0.5) }: { model: Amplifier; id: string; low: number; high: number; probe: number } = $props();
  // Both cases retain exactly the same scales as either A0 or beta is adjusted.
  const left = 39, right = 12;
  const gainTicks = [-40, -20, 0, 20, 40, 60, 80, 100];
  const phaseTicks = [0, -45, -90];
  const decades = $derived(Array.from({ length: Math.floor(high) - Math.ceil(low) + 1 }, (_, i) => Math.ceil(low) + i));
  const samples = $derived(Array.from({ length: 361 }, (_, i) => {
    const log = low + (high - low) * i / 360;
    return { log, ...response(model, 10 ** log) };
  }));
  const probeLog = $derived(low + probe * (high - low));
  const probeResponse = $derived(response(model, 10 ** probeLog));
  const x = (log: number, w: number) => left + (log - low) / (high - low) * Math.max(1, w - left - right);
  const gx = (hz: number, w: number) => x(Math.log10(hz), w);
  const bottom = (h: number) => h - 59 - Math.max(40, Math.round(h * 0.22));
  const phaseTop = (h: number) => bottom(h) + 32;
  const gy = (db: number, h: number) => 22 + (100 - db) / 140 * (bottom(h) - 22);
  const py = (deg: number, h: number) => phaseTop(h) - deg / 90 * (h - 27 - phaseTop(h));
  const path = (key: 'openDb' | 'loopDb' | 'closedDb' | 'openPhase' | 'closedPhase', w: number, h: number) =>
    samples.map((p, i) => `${i ? 'L' : 'M'}${x(p.log, w).toFixed(2)},${(key.endsWith('Phase') ? py(p[key], h) : gy(p[key], h)).toFixed(2)}`).join(' ');
</script>

<div class="bode">
  <Plot label="{id}: open-loop, loop-gain and closed-loop Bode magnitude and phase. Move over the plot to inspect numeric values below it."
    onpointermove={(px, w) => { probe = Math.max(0, Math.min(1, (px - left) / Math.max(1, w - left - right))); }}>
    {#snippet children({ width: w, height: h })}
      {#if w > 0 && h > 80}
      <defs><clipPath id="{id}-gain"><rect x={left} y="18" width={Math.max(1, w - left - right)} height={bottom(h) - 18} /></clipPath></defs>
      <text class="tx2" x="1" y="11">dB</text>
      <text class="tx2" x="1" y={phaseTop(h) - 10}>Phase</text>
      {#each gainTicks as db}
        <line class={db === 0 ? 'zero' : 'gr'} x1={left} x2={w - right} y1={gy(db, h)} y2={gy(db, h)} />
        {#if h > 230 || db % 40 === 0}<text class="tx" text-anchor="end" x={left - 8} y={gy(db, h) + 4}>{db}</text>{/if}
      {/each}
      {#each phaseTicks as deg}
        <line class="gr" x1={left} x2={w - right} y1={py(deg, h)} y2={py(deg, h)} />
        <text class="tx" text-anchor="end" x={left - 8} y={py(deg, h) + 4}>{deg}°</text>
      {/each}
      {#each decades as log, i}
        <line class="gr" x1={x(log, w)} x2={x(log, w)} y1="22" y2={bottom(h)} />
        <line class="gr" x1={x(log, w)} x2={x(log, w)} y1={phaseTop(h)} y2={h - 27} />
        {#if i % Math.max(1, Math.ceil(decades.length / Math.max(2, (w - left - right) / 64))) === 0}
          <text class="tx tick" text-anchor={i === 0 ? 'start' : i === decades.length - 1 ? 'end' : 'middle'} x={x(log, w)} y={h - 8}>{frequency(10 ** log, 2)}</text>
        {/if}
      {/each}
      <g clip-path="url(#{id}-gain)">
        <line class="guide" stroke-dasharray="3 5" x1={left} x2={w - right} y1={gy(20 * Math.log10(model.idealGain), h)} y2={gy(20 * Math.log10(model.idealGain), h)}><title>Ideal gain 1/β = {Number(model.idealGain.toPrecision(5))} V/V</title></line>
        <path class="c1" d={path('openDb', w, h)} stroke-width="2" />
        <path class="loop" d={path('loopDb', w, h)} stroke-width="1.7" stroke-dasharray="5 4" />
        <path class="c2" d={path('closedDb', w, h)} stroke-width="2.5" />
        <line class="c1 pole-line" x1={gx(model.pole, w)} x2={gx(model.pole, w)} y1={gy(response(model, model.pole).openDb, h)} y2={bottom(h)} />
        <line class="c2 pole-line" x1={gx(model.closedBw, w)} x2={gx(model.closedBw, w)} y1={gy(response(model, model.closedBw).closedDb, h)} y2={bottom(h)} />
        <circle class="f1 ring" cx={gx(model.pole, w)} cy={gy(response(model, model.pole).openDb, h)} r="4" />
        <circle class="f2 ring" cx={gx(model.closedBw, w)} cy={gy(response(model, model.closedBw).closedDb, h)} r="4" />
        {#if model.unity !== null}<circle class="c1 unity" cx={gx(model.unity, w)} cy={gy(0, h)} r="4"><title>A = 1 at {frequency(model.unity)}</title></circle>{/if}
        {#if model.crossover !== null}<circle class="loop unity" cx={gx(model.crossover, w)} cy={gy(0, h)} r="4"><title>L = 1 at {frequency(model.crossover)}</title></circle>{/if}
      </g>
      <text class="tx halo f1" x={gx(model.pole, w)} y={bottom(h) + 15} text-anchor="middle">fOL</text>
      <text class="tx halo f2" x={gx(model.closedBw, w)} y={bottom(h) + 27} text-anchor="middle">fCL</text>
      <path class="c1" d={path('openPhase', w, h)} stroke-width="2" />
      <path class="c2" d={path('closedPhase', w, h)} stroke-width="2.5" />
      <text class="tx2 halo" x={w - right} y={phaseTop(h) - 10} text-anchor="end">∠L = ∠A</text>
      <line class="cross" stroke-dasharray="2 4" x1={x(probeLog, w)} x2={x(probeLog, w)} y1="22" y2={h - 27} />
      {#each [{ value: probeResponse.openDb, cls: 'f1' }, { value: probeResponse.closedDb, cls: 'f2' }] as point}
        {#if point.value >= -40 && point.value <= 100}<circle class="{point.cls} ring" cx={x(probeLog, w)} cy={gy(point.value, h)} r="3.5" />{/if}
      {/each}
      <circle class="f2 ring" cx={x(probeLog, w)} cy={py(probeResponse.closedPhase, h)} r="3.5" />
      {/if}
    {/snippet}
  </Plot>
</div>

<style>
  .bode { display: flex; min-height: 0; min-width: 0; }
  .bode :global(.plot) { min-height: 0; }
  .loop { stroke: var(--brand); fill: none; }
  .pole-line { stroke-width: 1; stroke-dasharray: 3 4; opacity: .5; }
  .unity { fill: var(--plot); stroke-width: 2; }
  .tick { font-size: 10px; }
</style>

<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import { frequency, response, type Amplifier } from './model';

  let { model, id, probe = $bindable(-1) }: { model: Amplifier; id: string; probe: number } = $props();
  // Both cases retain exactly the same scales as either A0 or beta is adjusted.
  const low = -6, high = 1, left = 43, right = 14;
  const gainTicks = [-40, -20, 0, 20, 40, 60, 80, 100];
  const phaseTicks = [0, -45, -90];
  const decades = [-6, -5, -4, -3, -2, -1, 0, 1];
  const samples = $derived(Array.from({ length: 361 }, (_, i) => {
    const log = low + (high - low) * i / 360;
    return { log, ...response(model, model.gbw * 10 ** log) };
  }));
  const probeResponse = $derived(response(model, model.gbw * 10 ** probe));
  const x = (log: number, w: number) => left + (log - low) / (high - low) * Math.max(1, w - left - right);
  const gx = (hz: number, w: number) => x(Math.log10(hz / model.gbw), w);
  const bottom = (h: number) => Math.round(h * 0.64);
  const phaseTop = (h: number) => bottom(h) + 35;
  const gy = (db: number, h: number) => 22 + (100 - db) / 140 * (bottom(h) - 22);
  const py = (deg: number, h: number) => phaseTop(h) - deg / 90 * (h - 27 - phaseTop(h));
  const path = (key: 'openDb' | 'loopDb' | 'closedDb' | 'openPhase' | 'closedPhase', w: number, h: number) =>
    samples.map((p, i) => `${i ? 'L' : 'M'}${x(p.log, w).toFixed(2)},${(key.endsWith('Phase') ? py(p[key], h) : gy(p[key], h)).toFixed(2)}`).join(' ');
</script>

<div class="bode">
  <Plot label="{id}: open-loop, loop and closed-loop Bode magnitude and phase. Use the shared frequency probe below for numeric values."
    onpointermove={(px, w) => { probe = Math.max(low, Math.min(high, low + (px - left) / Math.max(1, w - left - right) * (high - low))); }}>
    {#snippet children({ width: w, height: h })}
      <defs><clipPath id="{id}-gain"><rect x={left} y="18" width={Math.max(1, w - left - right)} height={bottom(h) - 18} /></clipPath></defs>
      <text class="tx2" x="1" y="11">dB</text>
      <text class="tx2" x="1" y={phaseTop(h) - 10}>Phase</text>
      {#each gainTicks as db}
        <line class={db === 0 ? 'zero' : 'gr'} x1={left} x2={w - right} y1={gy(db, h)} y2={gy(db, h)} />
        <text class="tx" text-anchor="end" x={left - 8} y={gy(db, h) + 4}>{db}</text>
      {/each}
      {#each phaseTicks as deg}
        <line class="gr" x1={left} x2={w - right} y1={py(deg, h)} y2={py(deg, h)} />
        <text class="tx" text-anchor="end" x={left - 8} y={py(deg, h) + 4}>{deg}°</text>
      {/each}
      {#each decades as log, i}
        <line class="gr" x1={x(log, w)} x2={x(log, w)} y1="22" y2={bottom(h)} />
        <line class="gr" x1={x(log, w)} x2={x(log, w)} y1={phaseTop(h)} y2={h - 27} />
        {#if w > 460 || i % 2 === 0}
          <text class="tx tick" text-anchor={i === 0 ? 'start' : i === 7 ? 'end' : 'middle'} x={x(log, w)} y={h - 8}>{frequency(model.gbw * 10 ** log, 2)}</text>
        {/if}
      {/each}
      <g clip-path="url(#{id}-gain)">
        <line class="guide" stroke-dasharray="3 5" x1={left} x2={w - right} y1={gy(20 * Math.log10(model.idealGain), h)} y2={gy(20 * Math.log10(model.idealGain), h)} />
        <path class="c1" d={path('openDb', w, h)} stroke-width="2" />
        <path class="loop" d={path('loopDb', w, h)} stroke-width="1.7" stroke-dasharray="5 4" />
        <path class="c2" d={path('closedDb', w, h)} stroke-width="2.5" />
        <line class="c1 pole-line" x1={gx(model.pole, w)} x2={gx(model.pole, w)} y1={gy(response(model, model.pole).openDb, h)} y2={bottom(h)} />
        <line class="c2 pole-line" x1={gx(model.closedBw, w)} x2={gx(model.closedBw, w)} y1={gy(response(model, model.closedBw).closedDb, h)} y2={bottom(h)} />
        <circle class="f1 ring" cx={gx(model.pole, w)} cy={gy(response(model, model.pole).openDb, h)} r="4" />
        <circle class="f2 ring" cx={gx(model.closedBw, w)} cy={gy(response(model, model.closedBw).closedDb, h)} r="4" />
        {#if model.unity !== null}<circle class="c1 unity" cx={gx(model.unity, w)} cy={gy(0, h)} r="4" />{/if}
        {#if model.crossover !== null}<circle class="loop unity" cx={gx(model.crossover, w)} cy={gy(0, h)} r="4" />{/if}
      </g>
      <text class="tx halo f1" x={gx(model.pole, w)} y={bottom(h) + 15} text-anchor="middle">fOL</text>
      <text class="tx halo f2" x={gx(model.closedBw, w)} y={bottom(h) + 27} text-anchor="middle">fCL</text>
      <path class="c1" d={path('openPhase', w, h)} stroke-width="2" />
      <path class="c2" d={path('closedPhase', w, h)} stroke-width="2.5" />
      <text class="tx2 halo" x={w - right} y={phaseTop(h) - 10} text-anchor="end">∠L = ∠A</text>
      <line class="cross" stroke-dasharray="2 4" x1={x(probe, w)} x2={x(probe, w)} y1="22" y2={h - 27} />
      {#each [{ value: probeResponse.openDb, cls: 'f1' }, { value: probeResponse.closedDb, cls: 'f2' }] as point}
        {#if point.value >= -40 && point.value <= 100}<circle class="{point.cls} ring" cx={x(probe, w)} cy={gy(point.value, h)} r="3.5" />{/if}
      {/each}
      <circle class="f2 ring" cx={x(probe, w)} cy={py(probeResponse.closedPhase, h)} r="3.5" />
    {/snippet}
  </Plot>
</div>

<style>
  .bode { display: flex; height: clamp(345px, 44vh, 480px); min-width: 0; }
  .loop { stroke: var(--brand); fill: none; }
  .pole-line { stroke-width: 1; stroke-dasharray: 3 4; opacity: .5; }
  .unity { fill: var(--plot); stroke-width: 2; }
  .tick { font-size: 10px; }
  @media (max-width: 900px) { .bode { height: 355px; } }
</style>

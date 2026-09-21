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
  const hasPhase = (h: number) => h >= 135;
  const compact = (h: number) => h < 220;
  const axisBottom = (h: number) => compact(h) ? h - 17 : h - 27;
  const phaseGap = (h: number) => compact(h) ? 14 : 32;
  const phaseHeight = (h: number) => compact(h) ? Math.max(38, Math.round(h * 0.25)) : Math.max(48, Math.round(h * 0.28));
  const bottom = (h: number) => hasPhase(h) ? axisBottom(h) - phaseGap(h) - phaseHeight(h) : h - 27;
  const phaseTop = (h: number) => bottom(h) + phaseGap(h);
  const gy = (db: number, h: number) => 22 + (100 - db) / 140 * (bottom(h) - 22);
  const py = (deg: number, h: number) => phaseTop(h) - deg / 90 * (axisBottom(h) - phaseTop(h));
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
      {#if hasPhase(h)}<text class="tx2" x="1" y={compact(h) ? phaseTop(h) + 10 : phaseTop(h) - 10}>Phase</text>{/if}
      {#each gainTicks as db}
        <line class={db === 0 ? 'zero' : 'gr'} x1={left} x2={w - right} y1={gy(db, h)} y2={gy(db, h)} />
        {#if h > 230 || db % 40 === 0}<text class="tx" text-anchor="end" x={left - 8} y={gy(db, h) + 4}>{db}</text>{/if}
      {/each}
      {#if hasPhase(h)}{#each phaseTicks as deg}
        <line class="gr" x1={left} x2={w - right} y1={py(deg, h)} y2={py(deg, h)} />
        <text class="tx" text-anchor="end" x={left - 8} y={py(deg, h) + 4}>{deg}°</text>
      {/each}{/if}
      {#each decades as log, i}
        <line class="gr" x1={x(log, w)} x2={x(log, w)} y1="22" y2={bottom(h)} />
        {#if hasPhase(h)}<line class="gr" x1={x(log, w)} x2={x(log, w)} y1={phaseTop(h)} y2={axisBottom(h)} />{/if}
        {#if i % Math.max(1, Math.ceil(decades.length / Math.max(2, (w - left - right) / 64))) === 0}
          <text class="tx tick" text-anchor={i === 0 ? 'start' : i === decades.length - 1 ? 'end' : 'middle'} x={x(log, w)} y={h - 8}>{frequency(10 ** log, 2)}</text>
        {/if}
      {/each}
      <g clip-path="url(#{id}-gain)">
        {#if model.beta > 0}
        <line class="guide" stroke-dasharray="3 5" x1={left} x2={w - right} y1={gy(20 * Math.log10(model.idealGain), h)} y2={gy(20 * Math.log10(model.idealGain), h)}><title>Ideal gain 1/β = {Number(model.idealGain.toPrecision(5))} V/V</title></line>
        {/if}
        <path class="c1" d={path('openDb', w, h)} stroke-width="2" />
        {#if model.beta > 0}
        <path class="loop" d={path('loopDb', w, h)} stroke-width="1.7" stroke-dasharray="5 4" />
        {/if}
        <path class="c2" d={path('closedDb', w, h)} stroke-width="2.5" />
        <line class="c1 pole-line" x1={gx(model.pole, w)} x2={gx(model.pole, w)} y1={gy(response(model, model.pole).openDb, h)} y2={bottom(h)} />
        <line class="c2 pole-line" x1={gx(model.closedBw, w)} x2={gx(model.closedBw, w)} y1={gy(response(model, model.closedBw).closedDb, h)} y2={bottom(h)} />
        <circle class="f1 ring" cx={gx(model.pole, w)} cy={gy(response(model, model.pole).openDb, h)} r="4" />
        <circle class="f2 ring" cx={gx(model.closedBw, w)} cy={gy(response(model, model.closedBw).closedDb, h)} r="4" />
        {#if model.unity !== null}<circle class="c1 unity" cx={gx(model.unity, w)} cy={gy(0, h)} r="4"><title>A = 1 at {frequency(model.unity)}</title></circle>{/if}
        {#if model.crossover !== null}<circle class="loop unity" cx={gx(model.crossover, w)} cy={gy(0, h)} r="4"><title>L = 1 at {frequency(model.crossover)}</title></circle>{/if}
      </g>
      {#if hasPhase(h)}
        <text class="tx halo f1" x={gx(model.pole, w)} y={bottom(h) + (compact(h) ? 11 : 15)} text-anchor="middle">fOL</text>
        <text class="tx halo f2" x={gx(model.closedBw, w)} y={bottom(h) + (compact(h) ? 11 : 27)} text-anchor="middle">fCL</text>
      {/if}
      {#if hasPhase(h)}
      <path class="c1" d={path('openPhase', w, h)} stroke-width="2" />
      <path class="c2" d={path('closedPhase', w, h)} stroke-width="2.5" />
      {#if !compact(h)}<text class="tx2 halo" x={w - right} y={phaseTop(h) - 10} text-anchor="end">{model.beta === 0 ? 'L = 0 · T = A' : '∠L = ∠A'}</text>{/if}
      {/if}
      <line class="cross" stroke-dasharray="2 4" x1={x(probeLog, w)} x2={x(probeLog, w)} y1="22" y2={hasPhase(h) ? axisBottom(h) : bottom(h)} />
      {#each [{ value: probeResponse.openDb, cls: 'f1' }, { value: probeResponse.closedDb, cls: 'f2' }] as point}
        {#if point.value >= -40 && point.value <= 100}<circle class="{point.cls} ring" cx={x(probeLog, w)} cy={gy(point.value, h)} r="3.5" />{/if}
      {/each}
      {#if hasPhase(h)}<circle class="f2 ring" cx={x(probeLog, w)} cy={py(probeResponse.closedPhase, h)} r="3.5" />{/if}
      <g class="chart-legend" transform="translate({Math.max(left + 10, w - right - (w < 560 ? 102 : 160))} 48)">
        <rect class="legend-bg" x="0" y="-16" width={w < 560 ? 92 : 150} height="70" rx="4" />
        <line class="c1" x1="10" x2="28" y1="0" y2="0" stroke-width="2.5" /><text class="lg" x="35" y="4">{w < 560 ? 'A(s)' : 'Open-loop A'}</text>
        <line class="loop" x1="10" x2="28" y1="21" y2="21" stroke-width="2.2" stroke-dasharray="5 4" /><text class="lg" x="35" y="25">{w < 560 ? 'L(s)' : 'Loop gain L'}</text>
        <line class="c2" x1="10" x2="28" y1="42" y2="42" stroke-width="2.8" /><text class="lg" x="35" y="46">{w < 560 ? 'T(s)' : 'Closed-loop T'}</text>
      </g>
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
  .lg { fill: var(--ink-2); font: 13px var(--sans); }
  .legend-bg { fill: var(--plot); }
</style>

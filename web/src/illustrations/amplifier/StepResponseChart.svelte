<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import { formatTime, stepResponse, type StepMetrics, type TwoPoleModel } from './twoPoleModel';

  let { model, metrics }: { model: TwoPoleModel; metrics: StepMetrics } = $props();
  const left = 42, right = 14, top = 17, bottom = 28;
  const low = -7, high = 0;
  const timeTicks = [-7, -6, -5, -4, -3, -2, -1, 0];
  const levelTicks = [0, .25, .5, .75, 1];
  const samples = $derived(Array.from({ length: 421 }, (_, i) => {
    const logTime = low + (high - low) * i / 420;
    return { logTime, value: stepResponse(model, 10 ** logTime) };
  }));
  const x = (logTime: number, width: number) => left + (logTime - low) / (high - low) * Math.max(1, width - left - right);
  const y = (value: number, height: number) => top + (1.08 - value) / 1.08 * Math.max(1, height - top - bottom);
  const curve = (width: number, height: number) => samples.map((p, i) => `${i ? 'L' : 'M'}${x(p.logTime, width).toFixed(2)},${y(p.value, height).toFixed(2)}`).join(' ');
</script>

<div class="step-chart">
  <Plot label="Unit-step response of a stable unity-gain system with two adjustable real poles">
    {#snippet children({ width, height })}
      {#if width > 0 && height > 70}
        <defs><clipPath id="step-response-clip"><rect x={left} y={top} width={Math.max(1, width - left - right)} height={Math.max(1, height - top - bottom)} /></clipPath></defs>
        {#each levelTicks as level}
          <line class={level === 1 ? 'final' : 'gr'} x1={left} x2={width - right} y1={y(level, height)} y2={y(level, height)} />
          <text class="tx" x={left - 8} y={y(level, height) + 4} text-anchor="end">{level.toFixed(level % 1 ? 2 : 0)}</text>
        {/each}
        {#each timeTicks as tick}
          <line class="gr" x1={x(tick, width)} x2={x(tick, width)} y1={top} y2={height - bottom} />
          <text class="tx time-tick" x={x(tick, width)} y={height - 8} text-anchor={tick === low ? 'start' : tick === high ? 'end' : 'middle'}>{formatTime(10 ** tick, 1)}</text>
        {/each}
        <g clip-path="url(#step-response-clip)">
          <path class="response-line" d={curve(width, height)} />
          <line class="rise" x1={x(Math.log10(metrics.t10), width)} x2={x(Math.log10(metrics.t10), width)} y1={y(.1, height)} y2={y(.9, height)} />
          <line class="rise" x1={x(Math.log10(metrics.t90), width)} x2={x(Math.log10(metrics.t90), width)} y1={y(.1, height)} y2={y(.9, height)} />
          <line class="rise-arrow" x1={x(Math.log10(metrics.t10), width)} x2={x(Math.log10(metrics.t90), width)} y1={y(.5, height)} y2={y(.5, height)} />
          <circle class="marker" cx={x(Math.log10(metrics.t10), width)} cy={y(.1, height)} r="3.5" />
          <circle class="marker" cx={x(Math.log10(metrics.t90), width)} cy={y(.9, height)} r="3.5" />
          <line class="settle" x1={x(Math.log10(metrics.settlingTime), width)} x2={x(Math.log10(metrics.settlingTime), width)} y1={top} y2={height - bottom} />
        </g>
        <text class="tx2" x="2" y="11">y(t)</text>
        <text class="tx2 halo legend" x={width - right} y={top + 12} text-anchor="end">unit step · final value = 1</text>
        <text class="tx2 halo rise-label" x={(x(Math.log10(metrics.t10), width) + x(Math.log10(metrics.t90), width)) / 2} y={y(.5, height) - 6} text-anchor="middle">10–90%</text>
      {/if}
    {/snippet}
  </Plot>
</div>

<style>
  .step-chart { display: flex; min-width: 0; min-height: 0; }
  .step-chart :global(.plot) { min-height: 0; }
  .response-line { fill: none; stroke: var(--brand); stroke-width: 2.5; }
  .final { stroke: var(--ink-2); stroke-width: 1; stroke-dasharray: 5 5; }
  .rise { stroke: var(--s1); stroke-width: 1; stroke-dasharray: 3 4; opacity: .8; }
  .rise-arrow { stroke: var(--s1); stroke-width: 1.2; }
  .marker { fill: var(--s1); stroke: var(--plot); stroke-width: 2; }
  .settle { stroke: var(--s2); stroke-width: 1.2; stroke-dasharray: 4 4; }
  .time-tick { font-size: 10px; }
  .legend, .rise-label { font-size: 10px; }
  @media (max-width: 500px) { .time-tick { font-size: 8px; } .rise-label { display: none; } }
</style>

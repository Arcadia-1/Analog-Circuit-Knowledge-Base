<script lang="ts">
  import { frequency } from './model';

  let { pole1Log = $bindable(1), pole2Log = $bindable(3) }: { pole1Log: number; pole2Log: number } = $props();
  const ticks = [0, 1, 2, 3, 4, 5];
  const f1 = $derived(10 ** pole1Log), f2 = $derived(10 ** pole2Log);

  function wheel(event: WheelEvent, pole: 1 | 2) {
    if (!event.deltaY) return;
    event.preventDefault();
    const current = pole === 1 ? pole1Log : pole2Log;
    const next = Math.max(0, Math.min(5, Math.round((current + (event.deltaY < 0 ? .05 : -.05)) * 20) / 20));
    if (pole === 1) pole1Log = next;
    else pole2Log = next;
  }
</script>

<div class="pole-ruler" aria-label="Drag the two real pole frequencies">
  <div class="axis" aria-hidden="true">
    {#each ticks as tick}<span style="left: {tick / 5 * 100}%"><i></i><b>{frequency(10 ** tick, 1)}</b></span>{/each}
  </div>
  <label class="lane pole-one">
    <span class="pole-name"><i></i><var>p</var><sub>1</sub></span>
    <input id="pole-1" type="range" min="0" max="5" step="0.01" bind:value={pole1Log} aria-valuetext="Pole 1 at minus 2 pi times {frequency(f1)} radians per second" onwheel={(event) => wheel(event, 1)} />
    <output for="pole-1"><var>f</var><sub>p1</sub> = {frequency(f1, 4)}</output>
  </label>
  <label class="lane pole-two">
    <span class="pole-name"><i></i><var>p</var><sub>2</sub></span>
    <input id="pole-2" type="range" min="0" max="5" step="0.01" bind:value={pole2Log} aria-valuetext="Pole 2 at minus 2 pi times {frequency(f2)} radians per second" onwheel={(event) => wheel(event, 2)} />
    <output for="pole-2"><var>f</var><sub>p2</sub> = {frequency(f2, 4)}</output>
  </label>
</div>

<style>
  .pole-ruler { min-width: 0; display: grid; grid-template-rows: 25px 34px 34px; gap: 1px; padding: 1px 0 0; }
  .axis { position: relative; height: 25px; margin: 0 114px 0 48px; border-bottom: 1px solid var(--rule); }
  .axis span { position: absolute; bottom: -1px; transform: translateX(-50%); display: grid; justify-items: center; }
  .axis span:first-child { transform: none; }
  .axis span:last-child { transform: translateX(-100%); }
  .axis i { display: block; width: 1px; height: 6px; background: var(--ink-3); }
  .axis b { position: absolute; top: -14px; color: var(--ink-3); font: 9px var(--mono); font-weight: 400; white-space: nowrap; }
  .lane { min-width: 0; display: grid; grid-template-columns: 42px minmax(80px, 1fr) 108px; align-items: center; gap: 6px; cursor: ew-resize; }
  .pole-name { display: flex; align-items: center; justify-content: flex-end; gap: 4px; color: var(--ink-2); font-size: 15px; }
  .pole-name i { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
  .lane input { width: 100%; min-width: 0; margin: 0; accent-color: var(--accent); cursor: ew-resize; }
  .lane output { color: var(--ink); font: 11px var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap; text-align: right; }
  .lane output var { font-size: 13px; }
  .pole-one { --accent: var(--s1); }
  .pole-two { --accent: var(--s2); }
  @media (max-width: 600px) {
    .pole-ruler { grid-template-rows: 20px 30px 30px; }
    .axis { height: 20px; margin-right: 96px; }
    .axis b { font-size: 8px; }
    .lane { grid-template-columns: 40px minmax(60px, 1fr) 90px; gap: 4px; }
    .lane output { font-size: 10px; }
  }
</style>

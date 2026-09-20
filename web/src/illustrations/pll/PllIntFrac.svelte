<script lang="ts">
  import Notes from '../../components/ui/Notes.svelte';
  import Segmented from '../../components/ui/Segmented.svelte';
  import ValueField from '../../components/ui/ValueField.svelte';
  import { freqText } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import BlockDiagram from './BlockDiagram.svelte';
  import FrequencyRuler from './FrequencyRuler.svelte';

  const T_LO = 4.95e9, T_HI = 5.15e9;
  let target = $state(5.0005e9);
  let fRef = $state(40e6);

  const setTarget = (hz: number) => (target = Math.round(clamp(hz, T_LO, T_HI) / 1e5) * 1e5);
  const nInteger = $derived(Math.round(target / fRef));
  const integerOut = $derived(nInteger * fRef);
  const miss = $derived(integerOut - target);
  const nBase = $derived(Math.floor(target / fRef));
  const alpha = $derived(target / fRef - nBase);
</script>

<main class="page">
  <header class="top">
    <a class="crumb" href="/#related">← More to explore</a>
    <h1>Integer-<var>N</var> vs fractional-<var>N</var></h1>
    <p class="sub">The difference is the set of output frequencies the divider can realise.</p>
    <div class="pick">
      <span class="label">Reference</span>
      <Segmented
        size="sm"
        mono
        label="Reference frequency"
        options={[{ value: 25e6, label: '25' }, { value: 40e6, label: '40' }, { value: 100e6, label: '100' }]}
        bind:value={fRef}
      />
      <span class="unit">MHz</span>
    </div>
    <Notes>
      <p><b>Integer-<var>N</var>.</b> The feedback divider is one integer <var>N</var>, so <var>f</var><sub>out</sub> can only move in steps of <var>f</var><sub>ref</sub>. A requested frequency between two channels must be rounded.</p>
      <p><b>Fractional-<var>N</var>.</b> The divider changes among nearby integers. Its long-term average is <var>N</var> + <var>α</var>, so the average output can land between integer channels. The modulator is part of how that average is produced; it is not a different frequency formula.</p>
      <p><b>This page stops at frequency choice.</b> The sequence used to realise <var>α</var>, its accumulated phase error and noise shaping are separated into <a href="/pll/fractional-divider/">Inside a fractional divider</a>.</p>
    </Notes>
  </header>

  <section class="tuner" aria-label="Target output frequency">
    <div class="tuner-left">
      <label class="label" for="target-num">Target output</label>
      <ValueField id="target-num" value={target / 1e9} digits={4} unit="GHz" step={1e-4} onchange={(g) => setTarget(g * 1e9)} title="Type a frequency in GHz, or use the arrow keys to step 0.1 MHz" />
      <div class="legend">
        <span><span class="key k1"></span>integer-<var>N</var>: {freqText(fRef)} channel spacing</span>
        <span><span class="key k2"></span>fractional-<var>N</var>: lands between channels</span>
      </div>
    </div>
    <FrequencyRuler targetHz={target} {fRef} onchange={setTarget} />
  </section>

  <section class="compare">
    <div class="head col1">
      <div class="name-f">
        <div class="name"><span class="key k1"></span><span>Integer-<var>N</var></span></div>
        <div class="formula"><var>f</var><sub>out</sub> <span class="op">=</span> <var>N</var> <span class="op">·</span> <var>f</var><sub>ref</sub></div>
      </div>
      <div class="readout">
        <span><var>N</var> = <span class="mono">{nInteger}</span></span>
        <span class="mono">{(integerOut / 1e9).toFixed(4)} GHz</span>
        {#if Math.abs(miss) < 50}<span class="chip">on target</span>{:else}<span class="chip miss">misses by {freqText(miss)}</span>{/if}
      </div>
    </div>

    <div class="head col2">
      <div class="name-f">
        <div class="name"><span class="key k2"></span><span>Fractional-<var>N</var></span></div>
        <div class="formula"><var>f</var><sub>out</sub> <span class="op">=</span> (<var>N</var> <span class="op">+</span> <var>α</var>) <span class="op">·</span> <var>f</var><sub>ref</sub></div>
      </div>
      <div class="readout">
        <span><var>N</var> = <span class="mono">{nBase}</span></span>
        <span><var>α</var> = <span class="mono">{alpha.toFixed(5)}</span></span>
        <span class="mono">{(target / 1e9).toFixed(4)} GHz</span>
        <span class="chip">on target</span>
      </div>
    </div>

    <div class="diagram col1"><BlockDiagram kind="int" label="Integer-N PLL block diagram" /></div>
    <div class="diagram col2"><BlockDiagram kind="sd" label="Fractional-N PLL block diagram" /></div>

    <div class="answer col1">
      <span class="eyebrow">Channel grid</span>
      <b>One divider word, one channel.</b>
      <p>Changing <var>N</var> by one moves the output by exactly <var>f</var><sub>ref</sub>. A finer grid requires a lower reference frequency.</p>
    </div>
    <a class="answer next col2" href="/pll/fractional-divider/">
      <span class="eyebrow">Next lesson</span>
      <b>How does the average become <var>N</var> + <var>α</var>? <span aria-hidden="true">↗</span></b>
      <p>Compare the word sequence and accumulated error of a first-order accumulator and a MASH 1-1-1.</p>
    </a>
  </section>
</main>

<style>
  .page { grid-template-rows: auto auto minmax(0, 1fr); }
  .tuner { grid-template-columns: 430px minmax(0, 1fr); }
  .compare { --rows: auto auto minmax(0, 1fr); }
  .head { gap: 8px; }
  .diagram { align-self: center; padding-block: 14px; }
  .answer { align-self: stretch; padding: 24px; border: 1px solid var(--rule); background: var(--plot); display: flex; flex-direction: column; justify-content: center; gap: 7px; color: inherit; text-decoration: none; }
  .answer .eyebrow { color: var(--ink-3); font: 11px var(--mono); text-transform: uppercase; letter-spacing: 0.08em; }
  .answer b { font-size: 19px; line-height: 1.35; font-weight: 550; }
  .answer p { max-width: 58ch; margin: 0; color: var(--ink-2); font-size: 14px; line-height: 1.6; }
  .answer.next { border-color: color-mix(in srgb, var(--s2) 45%, var(--rule)); }
  .answer.next:hover b { color: var(--brand); }
  @media (max-width: 900px) { .tuner { grid-template-columns: 1fr; } .answer { min-height: 180px; } }
</style>

<script lang="ts">
  import Notes from '../../components/ui/Notes.svelte';
  import Segmented from '../../components/ui/Segmented.svelte';
  import ValueField from '../../components/ui/ValueField.svelte';
  import { freqText, jitterText, nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import BlockDiagram from './BlockDiagram.svelte';
  import FrequencyRuler from './FrequencyRuler.svelte';
  import {
    analyze,
    N_SHOW,
    simulate,
    type Analysis,
    type EdgeScale,
    type Mode,
    type Sim,
  } from './model';
  import PhaseDetectorChart from './PhaseDetectorChart.svelte';
  import PhaseNoiseChart from './PhaseNoiseChart.svelte';

  const T_LO = 4.95e9, T_HI = 5.15e9;
  const BW = 1e6;
  let target = $state(5.0005e9);
  let fRef = $state(40e6);
  let mode = $state<Exclude<Mode, 'int'>>('acc');
  let dtc = $state(false);
  let hoverCycle = $state<number | null>(null);
  let hoverF = $state<number | null>(null);

  const setTarget = (hz: number) => (target = Math.round(clamp(hz, T_LO, T_HI) / 1e5) * 1e5);
  const nInteger = $derived(Math.round(target / fRef));
  const integerOut = $derived(nInteger * fRef);
  const miss = $derived(integerOut - target);
  const nBase = $derived(Math.floor(target / fRef));
  const alpha = $derived(target / fRef - nBase);

  const intSim: Sim = $derived(simulate(integerOut, 'int', false, 0, fRef, BW, 0));
  const fracSim: Sim = $derived(simulate(target, mode, dtc, 0, fRef, BW, 0));
  const intAn: Analysis = $derived(analyze(intSim));
  const fracAn: Analysis = $derived(analyze(fracSim));
  const dividerName = $derived(mode === 'acc' ? '1st-order accumulator ΣΔ' : '3rd-order MASH 1-1-1 ΣΔ');
  const fracName = $derived(`${dividerName}${dtc ? ' + ideal DTC' : ''}`);

  const edgeScale: EdgeScale = $derived.by(() => {
    let nMin = Infinity, nMax = -Infinity, R = 0;
    for (const sim of [intSim, fracSim]) {
      for (let i = 0; i < N_SHOW; i++) {
        nMin = Math.min(nMin, sim.ndiv[i]);
        nMax = Math.max(nMax, sim.ndiv[i]);
        R = Math.max(R, Math.abs(sim.e[i]) * 1e12);
      }
    }
    if (dtc) {
      let mean = 0;
      for (let i = 0; i < N_SHOW; i++) mean += fracSim.qd[i];
      mean /= N_SHOW;
      for (let i = 0; i < N_SHOW; i++) R = Math.max(R, Math.abs(fracSim.qd[i] - mean) * 1e12);
    }
    return {
      nMin,
      nMax,
      R: Math.max(R * 1.12, 1.08 * intSim.tOut * 1e12),
    };
  });

  const spurText = (an: Analysis) => {
    const spur = an.spurs.find((p) => p.f >= 1e4);
    return spur
      ? { value: `${nf(spur.dBc, 1)} dBc`, offset: ` at ${freqText(spur.f)}` }
      : { value: 'none detected', offset: ' in 32k record' };
  };
  const intSpur = $derived(spurText(intAn));
  const fracSpur = $derived(spurText(fracAn));
</script>

<main class="page">
  <header class="top">
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
      <p><b>Choose the fractional path.</b> A single accumulator is itself a first-order ΣΔ modulator: its carry emits 0 or 1, and the divider-word error <var>y</var> − <var>α</var> has one zero at DC. MASH 1-1-1 is a third-order ΣΔ modulator and gives that error three zeros at DC, moving more of it to high offset frequencies. Both sequences here are deterministic and undithered. A short repeating pattern can produce visible fractional spurs; a long pattern can leave no individual line above this finite record's detector even though the sequence is not random. The ideal DTC compensates the accumulated divider timing error before the phase detector.</p>
      <p><b>The plots below show the system view.</b> The block diagram, phase-detector timing and output phase-noise view all follow the selected divider and DTC state. With DTC enabled, the grey points show the uncompensated divider timing and the orange points show what reaches the phase detector.</p>
      <p><b>Model assumptions.</b> A reference-rate behavioral loop with a linear phase detector, type-II PI filter and two extra poles at 6 MHz is tuned to a 1 MHz closed-loop −3 dB bandwidth. White reference/PD noise uses a −228 dBc/Hz normalized floor; free-running VCO noise follows 1/f² with −120 dBc/Hz at 1 MHz. The accumulator and MASH are undithered 24-bit models. The DTC has ideal gain and zero INL; charge-pump mismatch is zero. These are illustrative assumptions, not predictions for a particular PLL circuit.</p>
      <p><b>Frequency and noise readouts.</b> Fractional resolution is f<sub>ref</sub>/2²⁴ (up to 5.96 Hz here), with at most half a step of rounding error. RMS jitter is the detrended time-record rms, including deterministic tones, over 32768 reference samples; the listed band is the record's nominal FFT span, not a brick-wall integration filter. The lower plots are reference-rate baseband views of phase-noise density and discrete phase-modulation spurs around the carrier, not full RF spectra. Levels average the two sidebands and are normalized to the measured carrier. “None detected in 32k record” means no tone passed the 18 dB local-floor threshold above 10 kHz; it does not prove zero spurs.</p>
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
      <div class="line">
        <div class="name-f">
          <div class="name"><span class="key k2"></span><span>Fractional-<var>N</var></span></div>
          <div class="formula"><var>f</var><sub>out</sub> <span class="op">=</span> (<var>N</var> <span class="op">+</span> <var>α</var>) <span class="op">·</span> <var>f</var><sub>ref</sub></div>
        </div>
        <div class="picks accent2">
          <Segmented
            size="sm"
            label="Fractional divider architecture"
            options={[{ value: 'acc', label: '1st-order ΣΔ' }, { value: 'sd', label: 'MASH 1-1-1 ΣΔ' }]}
            bind:value={mode}
          />
          <Segmented
            size="sm"
            label="Digital-to-time converter"
            options={[{ value: false, label: 'DTC off' }, { value: true, label: 'Ideal DTC' }]}
            bind:value={dtc}
          />
        </div>
      </div>
      <div class="line">
        <div class="readout">
          <span class="architecture">{fracName}</span>
          <span><var>N</var> = <span class="mono">{nBase}</span></span>
          <span><var>α</var> = <span class="mono">{alpha.toFixed(5)}</span></span>
          <span class="chip" title="The divider modulator is deterministic; no random dither is applied">no dither</span>
          <span class="mono">{(fracSim.fOut / 1e9).toFixed(4)} GHz</span>
          <span class="chip" title={`24-bit rounding error: ${(fracSim.fOut - target).toFixed(3)} Hz`}>within {nf(fRef / 2 ** 25, 2)} Hz</span>
        </div>
      </div>
    </div>

    <div class="diagram col1"><BlockDiagram kind="int" label="Integer-N PLL block diagram" /></div>
    <div class="diagram col2"><BlockDiagram kind={mode} {dtc} label={`Fractional-N PLL block diagram: ${fracName}`} /></div>

    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label"><span class="tag">Integer-<var>N</var></span>Time domain</span><span>divider word and phase-detector timing</span></span>
      </div>
      <PhaseDetectorChart sim={intSim} series={1} scale={edgeScale} hover={hoverCycle} onhover={(i) => (hoverCycle = i)} label="Integer-N time-domain timing" />
    </div>
    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label"><span class="tag">Fractional-<var>N</var></span>Time domain</span><span>{fracName} · divider word and phase-detector timing</span></span>
        {#if dtc}<span><span class="gk"></span>before DTC<span class="gk g2"></span>at phase detector</span>{/if}
      </div>
      <PhaseDetectorChart sim={fracSim} series={2} scale={edgeScale} ghost={dtc} hover={hoverCycle} onhover={(i) => (hoverCycle = i)} label={`Fractional-N time-domain timing: ${fracName}`} />
    </div>

    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label"><span class="tag">Integer-<var>N</var></span>Output phase noise</span><span>density and spurs · offset from carrier</span></span>
        <span>RMS jitter <b>{jitterText(intAn.jitterFs)}</b> <span class="band">({freqText(intAn.bandLo)}–{freqText(intAn.bandHi)})</span> · largest spur <b>{intSpur.value}</b>{intSpur.offset}</span>
      </div>
      <PhaseNoiseChart an={intAn} series={1} bw={BW} hover={hoverF} onhover={(f) => (hoverF = f)} label="Integer-N output phase-noise density and spurs" />
    </div>
    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label"><span class="tag">Fractional-<var>N</var></span>Output phase noise</span><span>{fracName} · density and spurs</span></span>
        <span>RMS jitter <b>{jitterText(fracAn.jitterFs)}</b> <span class="band">({freqText(fracAn.bandLo)}–{freqText(fracAn.bandHi)})</span> · largest spur <b>{fracSpur.value}</b>{fracSpur.offset}</span>
      </div>
      <PhaseNoiseChart an={fracAn} series={2} bw={BW} hover={hoverF} onhover={(f) => (hoverF = f)} label={`Fractional-N output phase-noise density and spurs: ${fracName}`} />
    </div>
  </section>
</main>

<style>
  .tuner { grid-template-columns: 430px minmax(0, 1fr); }
  .compare { --rows: auto 78px minmax(0, 1fr) minmax(0, 1.15fr); }
  .head { gap: 8px; }
  .picks { display: flex; flex-wrap: wrap; gap: 6px; }
  .architecture { color: var(--ink); font-weight: 500; }
  .gk { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin: 0 5px 0 10px; background: var(--ghost); }
  .gk.g2 { background: var(--s2); }
  .diagram { align-self: center; padding-block: 14px; }
  @media (max-width: 1180px) {
    .picks { width: 100%; }
  }
  @media (max-width: 900px) {
    .tuner { grid-template-columns: 1fr; }
    .picks { display: grid; grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 520px) { .picks { grid-template-columns: 1fr; } }
</style>

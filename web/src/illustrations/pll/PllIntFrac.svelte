<script lang="ts">
  import Notes from '../../components/ui/Notes.svelte';
  import Range from '../../components/ui/Range.svelte';
  import Segmented from '../../components/ui/Segmented.svelte';
  import ValueField from '../../components/ui/ValueField.svelte';
  import { freqText, jitterText, nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import BlockDiagram from './BlockDiagram.svelte';
  import FrequencyRuler from './FrequencyRuler.svelte';
  import { analyze, bwMaxFor, N_SHOW, simulate, type Analysis, type EdgeScale, type Mode, type Sim } from './model';
  import PhaseDetectorChart from './PhaseDetectorChart.svelte';
  import PhaseNoiseChart from './PhaseNoiseChart.svelte';

  const T_LO = 4.95e9, T_HI = 5.15e9;
  const BW_STEPS = [100e3, 120e3, 150e3, 200e3, 250e3, 300e3, 400e3, 500e3, 600e3, 800e3, 1e6, 1.2e6, 1.5e6, 2e6, 2.5e6, 3e6, 4e6, 5e6];

  let target = $state(5.005e9);
  let fRef = $state(40e6);
  let bw = $state(1e6);
  let mode = $state<Mode>('acc');
  let inl = $state(0);
  let hoverCycle = $state<number | null>(null);
  let hoverF = $state<number | null>(null);

  const bwSteps = $derived(BW_STEPS.filter((v) => v <= bwMaxFor(fRef)));
  function setRef(v: number) {
    fRef = v;
    bw = Math.min(bw, bwSteps[bwSteps.length - 1]);
  }
  const setTarget = (hz: number) => (target = Math.round(clamp(hz, T_LO, T_HI) / 1e5) * 1e5);

  // integer-N depends on the channel only, so dragging the target does not re-run it
  const channel = $derived(Math.round(target / fRef));
  const intSim: Sim = $derived(simulate(channel * fRef, 'int', 0, fRef, bw));
  const intAn: Analysis = $derived(analyze(intSim));
  const fracSim: Sim = $derived(simulate(target, mode, inl, fRef, bw));
  const fracAn: Analysis = $derived(analyze(fracSim));

  const edgeScale: EdgeScale = $derived.by(() => {
    let nMin = Infinity, nMax = -Infinity, R = 0;
    for (const s of [intSim, fracSim]) {
      for (let i = 0; i < N_SHOW; i++) {
        nMin = Math.min(nMin, s.ndiv[i]);
        nMax = Math.max(nMax, s.ndiv[i]);
        R = Math.max(R, Math.abs(s.e[i]) * 1e12);
      }
    }
    if (mode === 'dtc') {
      let m = 0;
      for (let i = 0; i < N_SHOW; i++) m += fracSim.qd[i];
      m /= N_SHOW;
      for (let i = 0; i < N_SHOW; i++) R = Math.max(R, Math.abs(fracSim.qd[i] - m) * 1e12);
    }
    return { nMin, nMax, R: Math.max(R * 1.12, 1.08 * intSim.tOut * 1e12) };
  });

  const spurText = (an: Analysis) => {
    const sp = an.spurs.find((p) => p.f >= 1e4);
    return sp ? { v: `${nf(sp.dBc, 1)} dBc`, at: ` at ${freqText(sp.f)}` } : { v: 'none', at: '' };
  };
  const intSpur = $derived(spurText(intAn));
  const fracSpur = $derived(spurText(fracAn));
  const miss = $derived(intSim.fOut - target);
</script>

<main class="page">
  <header class="top">
    <a class="crumb" href="/">AMS Class</a>
    <h1>Integer-<var>N</var> vs fractional-<var>N</var></h1>
    <p class="sub">One reference, one loop, one VCO. Only the divider differs.</p>
    <div class="pick">
      <span class="label" id="ref-label"><span class="long">Reference</span><span class="short"><var>f</var><sub>ref</sub></span></span>
      <Segmented
        size="sm"
        mono
        label="Reference frequency"
        options={[{ value: 25e6, label: '25' }, { value: 40e6, label: '40' }, { value: 100e6, label: '100' }]}
        bind:value={() => fRef, setRef}
      />
      <span class="unit">MHz</span>
    </div>
    <Range id="bw" min={0} max={bwSteps.length - 1} output={freqText(bw)} bind:value={() => bwSteps.indexOf(bw), (i) => (bw = bwSteps[i])}>
      <span class="long">Loop bandwidth</span><span class="short">BW</span>
    </Range>
    <Notes>
      <p><b>Simulation.</b> Reference-rate time-domain model of both loops: 40 960 reference cycles, the first 8 192 discarded. Spectrum of e<sup>jφ</sup> with a Hann window.</p>
      <p><b>Jitter.</b> RMS of the output edge-time error against an ideal clock at <var>f</var><sub>out</sub>, one sample per reference cycle, so it integrates from <var>f</var><sub>ref</sub>/32 768 to <var>f</var><sub>ref</sub>/2. Integer-<var>N</var> jitter comes only from the assumed noise below; the extra jitter of fractional-<var>N</var> is produced by the divider.</p>
      <p><b>Assumed noise.</b> Reference and phase detector: white, normalised floor −228 dBc/Hz, so in-band noise is −228 + 10 log <var>f</var><sub>ref</sub> + 20 log <var>N</var> (634 fs rms per edge). VCO: −120 dBc/Hz at 1 MHz. The same noise realisation drives both PLLs.</p>
      <p><b>Loop.</b> Linear phase detector, type-II filter with ζ = 1 and two extra poles at six times the bandwidth. The closed-loop −3 dB bandwidth is set directly, from 100 kHz up to <var>f</var><sub>ref</sub>/12 (at most 5 MHz); the loop stays stable with about 1.5 dB of peaking over that range.</p>
      <p><b>Divider.</b> Accumulator and MASH 1-1-1 are 24-bit; the ΣΔ word has its LSB set. DTC: ideal gain, a range of four VCO periods, parabolic INL.</p>
    </Notes>
  </header>

  <section class="tuner" aria-label="Target output frequency">
    <div class="tuner-left">
      <label class="label" for="target-num">Target output</label>
      <ValueField id="target-num" value={target / 1e9} digits={4} unit="GHz" step={1e-4} onchange={(g) => setTarget(g * 1e9)} title="Type a frequency in GHz, or use ↑ ↓ to step 0.1 MHz (Shift: 1 MHz)" />
      <div class="legend">
        <span><span class="key k1"></span>integer-<var>N</var>: multiples of {fRef / 1e6} MHz</span>
        <span><span class="key k2"></span>fractional-<var>N</var>: any frequency</span>
      </div>
    </div>
    <FrequencyRuler targetHz={target} {fRef} onchange={setTarget} />
  </section>

  <section class="compare">
    <div class="head col1">
      <div class="line">
        <div class="name-f">
          <div class="name"><span class="key k1"></span><span>Integer-<var>N</var></span></div>
          <div class="formula"><var>f</var><sub>out</sub> <span class="op">=</span> <var>N</var> <span class="op">·</span> <var>f</var><sub>ref</sub></div>
        </div>
      </div>
      <div class="line">
        <div class="readout">
          <span><var>N</var> = <span class="mono">{intSim.nInt}</span></span>
          <span class="mono">{(intSim.fOut / 1e9).toFixed(4)} GHz</span>
          {#if Math.abs(miss) < 50}<span class="chip">on target</span>{:else}<span class="chip miss">misses target by {freqText(miss)}</span>{/if}
        </div>
      </div>
    </div>
    <div class="head col2">
      <div class="line">
        <div class="name-f">
          <div class="name"><span class="key k2"></span><span>Fractional-<var>N</var></span></div>
          <div class="formula"><var>f</var><sub>out</sub> <span class="op">=</span> (<var>N</var> <span class="op">+</span> <var>α</var>) <span class="op">·</span> <var>f</var><sub>ref</sub></div>
        </div>
        <div class="accent2">
          <Segmented
            label="Fractional divider control"
            options={[{ value: 'acc', label: 'Accumulator' }, { value: 'sd', label: 'ΣΔ' }, { value: 'dtc', label: 'ΣΔ + DTC' }]}
            bind:value={mode}
          />
        </div>
      </div>
      <div class="line">
        <div class="readout">
          <span><var>N</var> + <var>α</var> = <span class="mono">{fracSim.nAvg.toFixed(4)}</span></span>
          <span class="mono">{(fracSim.fOut / 1e9).toFixed(4)} GHz</span>
          <span class="chip">on target</span>
        </div>
        {#if mode === 'dtc'}
          <div class="accent2"><Range id="inl" min={0} max={5} step={0.1} output="{inl.toFixed(1)} ps" bind:value={inl}>DTC INL</Range></div>
        {/if}
      </div>
    </div>
    <div class="col1"><BlockDiagram kind="int" label="Integer-N PLL block diagram" /></div>
    <div class="col2"><BlockDiagram kind={mode} label="Fractional-N PLL block diagram" /></div>

    <div class="chart">
      <div class="cap"><span class="left"><span class="label"><span class="tag">Integer-<var>N</var></span>Phase detector</span><span>feedback edge vs reference edge, per cycle</span></span></div>
      <PhaseDetectorChart sim={intSim} series={1} scale={edgeScale} hover={hoverCycle} onhover={(i) => (hoverCycle = i)} label="Integer-N phase detector timing" />
    </div>
    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label"><span class="tag">Fractional-<var>N</var></span>Phase detector</span><span>feedback edge vs reference edge, per cycle</span></span>
        {#if mode === 'dtc'}<span><span class="gk"></span>divider edge<span class="gk g2"></span>after DTC</span>{/if}
      </div>
      <PhaseDetectorChart sim={fracSim} series={2} scale={edgeScale} ghost={mode === 'dtc'} hover={hoverCycle} onhover={(i) => (hoverCycle = i)} label="Fractional-N phase detector timing" />
    </div>
    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label"><span class="tag">Integer-<var>N</var></span>Output spectrum</span><span>offset from carrier</span></span>
        <span>RMS jitter <b>{jitterText(intAn.jitterFs)}</b> <span class="band">({freqText(intAn.bandLo)}–{freqText(intAn.bandHi)})</span> · largest spur <b>{intSpur.v}</b>{intSpur.at}</span>
      </div>
      <PhaseNoiseChart an={intAn} series={1} {bw} hover={hoverF} onhover={(f) => (hoverF = f)} label="Integer-N output spectrum" />
    </div>
    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label"><span class="tag">Fractional-<var>N</var></span>Output spectrum</span><span>offset from carrier</span></span>
        <span>RMS jitter <b>{jitterText(fracAn.jitterFs)}</b> <span class="band">({freqText(fracAn.bandLo)}–{freqText(fracAn.bandHi)})</span> · largest spur <b>{fracSpur.v}</b>{fracSpur.at}</span>
      </div>
      <PhaseNoiseChart an={fracAn} series={2} {bw} hover={hoverF} onhover={(f) => (hoverF = f)} label="Fractional-N output spectrum" />
    </div>
  </section>
</main>

<style>
  .compare { --rows: auto 78px minmax(0, 1fr) minmax(0, 1.15fr); }
  .accent2 { --range-width: 120px; }
  .gk { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin: 0 5px 0 10px; background: var(--ghost); }
  .gk.g2 { background: var(--s2); }
</style>

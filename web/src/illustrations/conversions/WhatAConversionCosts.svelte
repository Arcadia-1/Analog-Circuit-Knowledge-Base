<script lang="ts">
  import Notes from '../../components/ui/Notes.svelte';
  import Range from '../../components/ui/Range.svelte';
  import Segmented from '../../components/ui/Segmented.svelte';
  import { freqText, jitterText, nf } from '../../lib/format';
  import { snrToEnob } from '../../lib/units';
  import LandscapeChart from './LandscapeChart.svelte';
  import { PARTS, read, type Part } from './model';
  import SchreierChart from './SchreierChart.svelte';

  /** What each preset is, in a few words. */
  const NAMES: { value: string; label: string; what: string }[] = [
    { value: 'audio', label: 'Audio', what: 'An oversampled converter: 48 kHz of bandwidth out of 6 MS/s, and 100 dB to show for it.' },
    { value: 'sensor', label: 'Sensor', what: 'A 20 µW SAR reading a slow sensor — small, cheap, and nowhere near any physical wall.' },
    { value: 'radio', label: 'Radio', what: 'A pipeline for a receiver: bandwidth is everything, and the clock is what stops it.' },
    { value: 'scope', label: 'Scope', what: 'Ten gigasamples a second for eight bits: fast, hot, and expensive per conversion step.' },
  ];

  let name = $state('radio');
  let part = $state<Part>({ ...PARTS.radio });
  let jitter = $state(1e-13);
  let cap = $state(1);
  let hoverFs = $state<number | null>(null);
  let hoverBw = $state<number | null>(null);

  const r = $derived(read(part, part.fs / 2, jitter, cap));
  const what = $derived(NAMES.find((n) => n.value === name)?.what ?? '');

  function pick(v: string) {
    name = v;
    part = { ...PARTS[v] };
  }

  /** the sliders move in tenths of a decade, so one step is about 26 % */
  const decibel = (v: number): number => 10 ** (v / 10);
  const powerText = (w: number): string =>
    w < 1e-3 ? `${nf(w * 1e6, 1)} µW` : w < 1 ? `${nf(w * 1e3, w < 1e-2 ? 2 : 1)} mW` : `${nf(w, 2)} W`;
  const WALL = { jitter: 'the clock', thermal: 'kT/C', quantiser: 'its own codes' };
</script>

<main class="page">
  <header class="top">
    <a class="crumb" href="/#lessons">← All lessons</a>
    <h1>ADC energy and figures of merit</h1>
    <p class="sub">A converter written every way a datasheet writes it, against the figures of merit and the walls it has to live inside.</p>
    <div class="pick">
      <Segmented size="sm" label="Converter" options={NAMES.map((n) => ({ value: n.value, label: n.label }))} bind:value={() => name, pick} />
    </div>
    <Notes>
      <p><b>Ported from ADCToolbox 0.9.1.</b> <code>fundamentals/units.py</code>: <a href="/doc/api/fundamentals#adctoolbox.db_to_mag"><code>db_to_mag</code></a>, <a href="/doc/api/fundamentals#adctoolbox.mag_to_db"><code>mag_to_db</code></a>, <a href="/doc/api/fundamentals#adctoolbox.db_to_power"><code>db_to_power</code></a>, <a href="/doc/api/fundamentals#adctoolbox.power_to_db"><code>power_to_db</code></a>, <a href="/doc/api/fundamentals#adctoolbox.fundamentals.lsb_to_volts"><code>lsb_to_volts</code></a>, <a href="/doc/api/fundamentals#adctoolbox.fundamentals.volts_to_lsb"><code>volts_to_lsb</code></a>, <a href="/doc/api/fundamentals#adctoolbox.fundamentals.bin_to_freq"><code>bin_to_freq</code></a>, <a href="/doc/api/fundamentals#adctoolbox.fundamentals.freq_to_bin"><code>freq_to_bin</code></a>, <a href="/doc/api/fundamentals#adctoolbox.snr_to_enob"><code>snr_to_enob</code></a>, <a href="/doc/api/fundamentals#adctoolbox.enob_to_snr"><code>enob_to_snr</code></a>, <a href="/doc/api/fundamentals#adctoolbox.fundamentals.dbm_to_vrms"><code>dbm_to_vrms</code></a>, <a href="/doc/api/fundamentals#adctoolbox.fundamentals.vrms_to_dbm"><code>vrms_to_dbm</code></a>, <a href="/doc/api/fundamentals#adctoolbox.fundamentals.sine_amplitude_to_power"><code>sine_amplitude_to_power</code></a>; <code>fundamentals/snr_nsd.py</code>: <a href="/doc/api/fundamentals#adctoolbox.amplitudes_to_snr"><code>amplitudes_to_snr</code></a>, <a href="/doc/api/fundamentals#adctoolbox.snr_to_nsd"><code>snr_to_nsd</code></a>, <a href="/doc/api/fundamentals#adctoolbox.fundamentals.nsd_to_snr"><code>nsd_to_snr</code></a>; <code>fundamentals/metrics.py</code>: <a href="/doc/api/fundamentals#adctoolbox.fundamentals.calculate_walden_fom"><code>calculate_walden_fom</code></a>, <a href="/doc/api/fundamentals#adctoolbox.fundamentals.calculate_schreier_fom"><code>calculate_schreier_fom</code></a>, <a href="/doc/api/fundamentals#adctoolbox.fundamentals.calculate_thermal_noise_limit"><code>calculate_thermal_noise_limit</code></a>, <a href="/doc/api/fundamentals#adctoolbox.fundamentals.calculate_jitter_limit"><code>calculate_jitter_limit</code></a>. This page is the interactive companion to its examples <code>exp_c02</code>–<code>exp_c05</code>; <a href="https://github.com/Arcadia-1/Analog-Circuit-Knowledge-Base/blob/main/web/python/adc_conversions.py">python/adc_conversions.py</a> runs <a href="https://github.com/Arcadia-1/ADCToolbox">ADCToolbox</a> and every number here matches it.</p>
      <p><b>Nothing here is sampled.</b> Every other lesson on this site measures a capture; this one is the arithmetic around it — the closed forms a part is specified in, and the two ratios the field compares parts by. The four buttons are working points, not real products.</p>
      <p><b>Walden</b> divides the power by the conversions and by the steps each one resolves: <var>P</var> / (2<sup>ENOB</sup> · <var>f</var><sub>s</sub>), in joules per conversion step, and lower is better. It assumes a bit costs twice the last one, which is true while a converter is limited by its own comparators and switches. <b>Schreier</b> assumes the opposite — that noise sets the price, so a bit costs four times the last — and counts SNDR + 10 log (BW / <var>P</var>) in dB, where higher is better. A part usually looks good by one and ordinary by the other; which one flatters it tells you what limits it.</p>
      <p><b>The left plot</b> puts the converter on the map: each blue line is what a fixed Walden figure buys at the power you have set, so moving the power slider slides the whole family up and down. The dashed red line is the ENOB a clock of that jitter leaves at a Nyquist-rate input, which is why converters above a gigasample need femtoseconds, and the grey line is the ceiling <var>kT</var>/<var>C</var> puts on a sampling capacitor of that size over that range. All three walls are noise spread over <var>f</var><sub>s</sub>/2, so oversampling takes 10 log OSR off every one of them — which is why the audio part, impossible at OSR 1, becomes nearly possible at 64, and why its slider is worth pushing.</p>
      <p><b>The ladder</b> on the right is the same converter written eight ways. Watch the round trips: dB to a ratio and back is exact, but SNDR through ENOB and back is not quite, because 6.02 and 1.76 are the shorthand for 6.0206 and 1.7609 — the bits a datasheet quotes carry that rounding with them. NSD is the one number that lets two converters of different bandwidths be compared at all.</p>
    </Notes>
  </header>

  <section class="controls" aria-label="The converter">
    <Range id="fs" min={60} max={110} step={1} output={freqText(part.fs)} bind:value={() => Math.round(10 * Math.log10(part.fs)), (v) => (part = { ...part, fs: decibel(v) })}>Rate</Range>
    <Range id="sndr" min={20} max={130} step={1} output="{nf(part.sndr, 0)} dB" bind:value={() => part.sndr, (v) => (part = { ...part, sndr: v })}>SNDR</Range>
    <Range id="power" min={-40} max={35} step={1} output={powerText(part.power)} bind:value={() => Math.round(10 * Math.log10(part.power * 1e3)), (v) => (part = { ...part, power: decibel(v) / 1e3 })}>Power</Range>
    <Range id="osr" min={0} max={8} step={1} output="× {part.osr}" bind:value={() => Math.round(Math.log2(part.osr)), (v) => (part = { ...part, osr: 2 ** v })}>OSR</Range>
    <Range id="jitter" min={0} max={35} step={1} output={jitterText(jitter * 1e15)} bind:value={() => Math.round(10 * Math.log10(jitter * 1e15)), (v) => (jitter = decibel(v) * 1e-15)}>Clock</Range>
    <Range id="cap" min={-20} max={20} step={1} output="{nf(cap, cap < 1 ? 2 : 1)} pF" bind:value={() => Math.round(10 * Math.log10(cap)), (v) => (cap = decibel(v))}>Sampler</Range>
    <p class="sign">{what}</p>
  </section>

  <section class="compare">
    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">The landscape</span><span>ENOB against sampling rate, at {powerText(part.power)}</span></span>
        <span>Walden <b>{nf(r.ladder.walden * 1e15, 1)} fJ</b> per conversion step</span>
      </div>
      <LandscapeChart {part} enob={r.ladder.enob} {jitter} {cap} hover={hoverFs} onhover={(f) => (hoverFs = f)} label="ENOB against sampling rate, with lines of constant Walden figure of merit" />
    </div>

    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">The other figure</span><span>SNDR against bandwidth, at {powerText(part.power)}</span></span>
        <span>Schreier <b>{nf(r.ladder.schreier, 1)} dB</b></span>
      </div>
      <SchreierChart {part} bw={r.ladder.bw} hover={hoverBw} onhover={(b) => (hoverBw = b)} label="SNDR against bandwidth, with lines of constant Schreier figure of merit" />
    </div>

    <div class="sheet" aria-label="The same converter in every unit">
      <div class="cap">
        <span class="left"><span class="label">The ladder</span><span>the same part, written every way</span></span>
        <span>on a {nf(part.vfs, 1)} V range, sold as {part.bits} bits</span>
      </div>
      <dl>
        <div><dt>Bandwidth</dt><dd class="mono">{freqText(r.ladder.bw)}</dd><dd class="how">fs / 2·OSR</dd></div>
        <div><dt>ENOB</dt><dd class="mono">{nf(r.ladder.enob, 3)} bits</dd><dd class="how">snr_to_enob, back to {nf(r.ladder.back, 2)} dB</dd></div>
        <div><dt>Noise density</dt><dd class="mono">{nf(r.ladder.nsd, 2)} dBFS/Hz</dd><dd class="how">snr_to_nsd, back to {nf(r.ladder.fromNsd, 2)} dB</dd></div>
        <div><dt>Noise</dt><dd class="mono">{nf(r.ladder.noiseV * 1e6, 3)} µV rms</dd><dd class="how">= {nf(r.ladder.noiseLsb, 2)} LSB, volts_to_lsb</dd></div>
        <div><dt>One LSB</dt><dd class="mono">{nf(r.ladder.lsbV * 1e6, 3)} µV</dd><dd class="how">lsb_to_volts, at {part.bits} bits</dd></div>
        <div><dt>Full-scale sine</dt><dd class="mono">{nf(r.ladder.signalDbm, 2)} dBm</dd><dd class="how">= {nf(r.ladder.signalMw, 3)} mW into 50 Ω</dd></div>
        <div><dt>Walden</dt><dd class="mono">{nf(r.ladder.walden * 1e15, 2)} fJ/step</dd><dd class="how">calculate_walden_fom · lower is better</dd></div>
        <div><dt>Schreier</dt><dd class="mono">{nf(r.ladder.schreier, 2)} dB</dd><dd class="how">calculate_schreier_fom · higher is better</dd></div>
        <div class="wall">
          <dt>Nearest wall</dt>
          <dd class="mono">{WALL[r.walls.nearest]}, {nf(Math.min(r.walls.jitter, r.walls.thermal, r.walls.quantiser), 1)} dB</dd>
          <dd class="how">at {freqText(r.fin)} in: clock {nf(r.walls.jitter, 1)} · kT/C {nf(r.walls.thermal, 1)} · codes {nf(r.walls.quantiser, 1)}{r.walls.gain ? `, all after the ${nf(r.walls.gain, 1)} dB oversampling gives back` : ''}</dd>
        </div>
        <div class="room">
          <dt>Room left</dt>
          <dd class="mono" class:over={r.walls.headroom < 0}>{r.walls.headroom >= 0 ? '+' : ''}{nf(r.walls.headroom, 1)} dB</dd>
          <dd class="how">{r.walls.headroom < 0 ? 'this part is asking for more than physics allows' : `and ${nf(snrToEnob(r.walls.headroom + 1.76), 1)} bits of it`}</dd>
        </div>
      </dl>
    </div>
  </section>
</main>

<style>
  .page { grid-template-rows: auto auto minmax(0, 1fr); }
  .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 28px; border-top: 1px solid var(--rule); padding-top: 12px; }
  .sign { margin: 0; color: var(--ink-2); font-size: 13.5px; flex: 1 1 260px; }
  .compare { --rows: minmax(0, 1fr) auto; }
  .sheet { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 6px; min-height: 0; }
  dl { margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(430px, 1fr)); gap: 0 44px; align-content: start; }
  dl > div { display: grid; grid-template-columns: 112px minmax(130px, max-content) minmax(0, 1fr); align-items: baseline; gap: 12px; padding: 4px 0; border-bottom: 1px solid var(--rule-soft); }
  dt { color: var(--ink-2); font-size: 13px; }
  dd { margin: 0; }
  .mono { font: 500 15px var(--mono); font-variant-numeric: tabular-nums; color: var(--ink); white-space: nowrap; }
  .how { font-size: 11.5px; line-height: 1.35; color: var(--ink-3); font-family: var(--mono); }
  .over { color: var(--bad); }
  .wall .mono, .room .mono { color: var(--s2); }
  @media (max-width: 900px) {
    /* the shared shell sends .chart to the end of the column; the ladder belongs after it, as it does on a desktop */
    .sheet { grid-column: auto; order: 4; }
    dl > div { grid-template-columns: 104px minmax(0, 1fr); }
    .how { grid-column: 1 / -1; }
  }
</style>

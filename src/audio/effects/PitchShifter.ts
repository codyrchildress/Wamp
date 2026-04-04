import type { EffectType, ParamDescriptor } from '../../types/effects';
import { BaseEffect } from './BaseEffect';

export class PitchShifter extends BaseEffect {
  readonly type: EffectType = 'pitchshifter';

  // Pitch-shifting voices (two cross-faded delay lines)
  private delay1: DelayNode;
  private delay2: DelayNode;
  private delayLfo1: OscillatorNode;
  private delayLfo2: OscillatorNode;
  private delayModGain1: GainNode;
  private delayModGain2: GainNode;
  private voice1Gain: GainNode;
  private voice2Gain: GainNode;

  // Crossfade modulation (cosine windows aligned to mask discontinuities)
  private fadeLfo1: OscillatorNode;
  private fadeLfo2: OscillatorNode;
  private fadeModGain1: GainNode;
  private fadeModGain2: GainNode;

  // Formant filter bank (peaking EQs at vocal formant frequencies)
  private formantFilters: BiquadFilterNode[];

  // Internal mixing
  private pitchMixer: GainNode;
  private dryMix: GainNode;
  private wetMix: GainNode;
  private outMixer: GainNode;

  private pitch = 0;
  private fine = 0;
  private formant = 0;
  private mix = 100;

  private static readonly GRAIN_SIZE = 0.06; // 60ms grain window
  private static readonly NUM_HARMONICS = 64;
  private static readonly FORMANT_FREQS = [300, 850, 2200, 3500];

  constructor(ctx: AudioContext) {
    super(ctx);

    const G = PitchShifter.GRAIN_SIZE;
    const N = PitchShifter.NUM_HARMONICS;

    // --- Build PeriodicWaves ---

    // Standard sawtooth: (2/π) * Σ (-1)^{k+1}/k * sin(kωt)
    // Discontinuity at T/2 in the Web Audio phase convention
    const sawReal = new Float32Array(N);
    const sawImag = new Float32Array(N);
    for (let k = 1; k < N; k++) {
      sawImag[k] = (2 / (k * Math.PI)) * (k % 2 === 0 ? -1 : 1);
    }
    const sawWave = ctx.createPeriodicWave(sawReal, sawImag);

    // 180°-shifted sawtooth: -(2/π) * Σ 1/k * sin(kωt)
    // Discontinuity at t=0 (shifted by half period from standard)
    const shiftSawReal = new Float32Array(N);
    const shiftSawImag = new Float32Array(N);
    for (let k = 1; k < N; k++) {
      shiftSawImag[k] = -(2 / (k * Math.PI));
    }
    const shiftSawWave = ctx.createPeriodicWave(shiftSawReal, shiftSawImag);

    // +cos fade for voice 1: zero at T/2 (masks standard saw discontinuity)
    const posCosWave = ctx.createPeriodicWave(
      new Float32Array([0, 1]), new Float32Array(2),
    );
    // -cos fade for voice 2: zero at t=0 (masks shifted saw discontinuity)
    const negCosWave = ctx.createPeriodicWave(
      new Float32Array([0, -1]), new Float32Array(2),
    );

    // --- Voice 1 ---
    this.delay1 = ctx.createDelay(0.5);
    this.delay1.delayTime.value = G;

    this.delayLfo1 = ctx.createOscillator();
    this.delayLfo1.setPeriodicWave(sawWave);
    this.delayLfo1.frequency.value = 0;
    this.delayModGain1 = ctx.createGain();
    this.delayModGain1.gain.value = 0;
    this.delayLfo1.connect(this.delayModGain1);
    this.delayModGain1.connect(this.delay1.delayTime);

    this.voice1Gain = ctx.createGain();
    this.voice1Gain.gain.value = 0.5;
    this.fadeLfo1 = ctx.createOscillator();
    this.fadeLfo1.setPeriodicWave(posCosWave);
    this.fadeLfo1.frequency.value = 0;
    this.fadeModGain1 = ctx.createGain();
    this.fadeModGain1.gain.value = 0;
    this.fadeLfo1.connect(this.fadeModGain1);
    this.fadeModGain1.connect(this.voice1Gain.gain);

    // --- Voice 2 ---
    this.delay2 = ctx.createDelay(0.5);
    this.delay2.delayTime.value = G;

    this.delayLfo2 = ctx.createOscillator();
    this.delayLfo2.setPeriodicWave(shiftSawWave);
    this.delayLfo2.frequency.value = 0;
    this.delayModGain2 = ctx.createGain();
    this.delayModGain2.gain.value = 0;
    this.delayLfo2.connect(this.delayModGain2);
    this.delayModGain2.connect(this.delay2.delayTime);

    this.voice2Gain = ctx.createGain();
    this.voice2Gain.gain.value = 0.5;
    this.fadeLfo2 = ctx.createOscillator();
    this.fadeLfo2.setPeriodicWave(negCosWave);
    this.fadeLfo2.frequency.value = 0;
    this.fadeModGain2 = ctx.createGain();
    this.fadeModGain2.gain.value = 0;
    this.fadeLfo2.connect(this.fadeModGain2);
    this.fadeModGain2.connect(this.voice2Gain.gain);

    // --- Mixers ---
    this.pitchMixer = ctx.createGain();
    this.dryMix = ctx.createGain();
    this.wetMix = ctx.createGain();
    this.outMixer = ctx.createGain();

    // --- Signal routing ---
    // Pitch-shifted path: input -> delay -> voice gain -> pitch mixer
    this.inputNode.connect(this.delay1);
    this.delay1.connect(this.voice1Gain);
    this.voice1Gain.connect(this.pitchMixer);

    this.inputNode.connect(this.delay2);
    this.delay2.connect(this.voice2Gain);
    this.voice2Gain.connect(this.pitchMixer);

    // Formant filter bank in series after pitch mixer
    this.formantFilters = PitchShifter.FORMANT_FREQS.map(freq => {
      const f = ctx.createBiquadFilter();
      f.type = 'peaking';
      f.frequency.value = freq;
      f.Q.value = 3;
      f.gain.value = 0;
      return f;
    });

    let prev: AudioNode = this.pitchMixer;
    for (const f of this.formantFilters) {
      prev.connect(f);
      prev = f;
    }
    prev.connect(this.wetMix);

    // Dry path for internal mix control
    this.inputNode.connect(this.dryMix);

    // Combine wet + dry into BaseEffect's wetGain for bypass support
    this.wetMix.connect(this.outMixer);
    this.dryMix.connect(this.outMixer);
    this.outMixer.connect(this.wetGain);

    // Start all LFOs at the same time for phase alignment
    const now = ctx.currentTime;
    this.delayLfo1.start(now);
    this.delayLfo2.start(now);
    this.fadeLfo1.start(now);
    this.fadeLfo2.start(now);

    this.updatePitch();
    this.updateFormant();
    this.updateMix();
  }

  private updatePitch(): void {
    const semitones = this.pitch + this.fine / 100;
    const ratio = Math.pow(2, semitones / 12);
    const G = PitchShifter.GRAIN_SIZE;
    const now = this.ctx.currentTime;
    const ramp = 0.02;

    if (Math.abs(ratio - 1) < 0.0005) {
      // No pitch shift — disable modulation, equal voice gains
      this.delayLfo1.frequency.linearRampToValueAtTime(0.001, now + ramp);
      this.delayLfo2.frequency.linearRampToValueAtTime(0.001, now + ramp);
      this.fadeLfo1.frequency.linearRampToValueAtTime(0.001, now + ramp);
      this.fadeLfo2.frequency.linearRampToValueAtTime(0.001, now + ramp);
      this.delayModGain1.gain.linearRampToValueAtTime(0, now + ramp);
      this.delayModGain2.gain.linearRampToValueAtTime(0, now + ramp);
      this.fadeModGain1.gain.linearRampToValueAtTime(0, now + ramp);
      this.fadeModGain2.gain.linearRampToValueAtTime(0, now + ramp);
      this.delay1.delayTime.linearRampToValueAtTime(G, now + ramp);
      this.delay2.delayTime.linearRampToValueAtTime(G, now + ramp);
      return;
    }

    // LFO frequency = |1 - R| / grainSize
    const modFreq = Math.abs(1 - ratio) / G;
    // Modulation depth: negative for pitch up, positive for pitch down
    const modDepth = (1 - ratio) * G / 2;
    // Base delay must keep delay > 0 at all modulation extremes
    const baseDelay = Math.max(G, Math.abs(modDepth)) + 0.005;

    this.delayLfo1.frequency.linearRampToValueAtTime(modFreq, now + ramp);
    this.delayLfo2.frequency.linearRampToValueAtTime(modFreq, now + ramp);
    this.fadeLfo1.frequency.linearRampToValueAtTime(modFreq, now + ramp);
    this.fadeLfo2.frequency.linearRampToValueAtTime(modFreq, now + ramp);

    this.delayModGain1.gain.linearRampToValueAtTime(modDepth, now + ramp);
    this.delayModGain2.gain.linearRampToValueAtTime(modDepth, now + ramp);

    this.delay1.delayTime.linearRampToValueAtTime(baseDelay, now + ramp);
    this.delay2.delayTime.linearRampToValueAtTime(baseDelay, now + ramp);

    // Enable cosine crossfade (±0.5 around the 0.5 DC offset on voice gains)
    this.fadeModGain1.gain.linearRampToValueAtTime(0.5, now + ramp);
    this.fadeModGain2.gain.linearRampToValueAtTime(0.5, now + ramp);
  }

  private updateFormant(): void {
    const semitones = this.formant;
    const ratio = Math.pow(2, semitones / 12);
    const now = this.ctx.currentTime;
    const ramp = 0.02;
    const boost = Math.min(8, Math.abs(semitones) * 0.7);
    const nyquist = this.ctx.sampleRate / 2;

    for (let i = 0; i < this.formantFilters.length; i++) {
      const freq = Math.max(60, Math.min(
        PitchShifter.FORMANT_FREQS[i] * ratio, nyquist - 500,
      ));
      this.formantFilters[i].frequency.linearRampToValueAtTime(freq, now + ramp);
      this.formantFilters[i].gain.linearRampToValueAtTime(boost, now + ramp);
    }
  }

  private updateMix(): void {
    const wet = this.mix / 100;
    this.dryMix.gain.value = 1 - wet;
    this.wetMix.gain.value = wet;
  }

  setParam(name: string, value: number): void {
    switch (name) {
      case 'pitch':
        this.pitch = value;
        this.updatePitch();
        break;
      case 'fine':
        this.fine = value;
        this.updatePitch();
        break;
      case 'formant':
        this.formant = value;
        this.updateFormant();
        break;
      case 'mix':
        this.mix = value;
        this.updateMix();
        break;
    }
  }

  getParams(): Record<string, number> {
    return { pitch: this.pitch, fine: this.fine, formant: this.formant, mix: this.mix };
  }

  getParamDescriptors(): ParamDescriptor[] {
    return [
      { name: 'pitch', label: 'Pitch', min: -24, max: 24, default: 0, step: 1, unit: 'st' },
      { name: 'fine', label: 'Fine', min: -50, max: 50, default: 0, step: 1, unit: 'ct' },
      { name: 'formant', label: 'Formant', min: -12, max: 12, default: 0, step: 1, unit: 'st' },
      { name: 'mix', label: 'Mix', min: 0, max: 100, default: 100, step: 1, unit: '%' },
    ];
  }

  dispose(): void {
    this.delayLfo1.stop();
    this.delayLfo2.stop();
    this.fadeLfo1.stop();
    this.fadeLfo2.stop();
    this.delayLfo1.disconnect();
    this.delayLfo2.disconnect();
    this.delayModGain1.disconnect();
    this.delayModGain2.disconnect();
    this.fadeLfo1.disconnect();
    this.fadeLfo2.disconnect();
    this.fadeModGain1.disconnect();
    this.fadeModGain2.disconnect();
    this.delay1.disconnect();
    this.delay2.disconnect();
    this.voice1Gain.disconnect();
    this.voice2Gain.disconnect();
    this.pitchMixer.disconnect();
    this.dryMix.disconnect();
    this.wetMix.disconnect();
    this.outMixer.disconnect();
    for (const f of this.formantFilters) {
      f.disconnect();
    }
    super.dispose();
  }
}

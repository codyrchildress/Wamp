import type { EffectType, ParamDescriptor } from '../../types/effects';
import { BaseEffect } from './BaseEffect';

/**
 * Growl effect — creates monster-like growling sounds using:
 * - Resonant bandpass formant filters at low vocal formant frequencies
 * - Sub-octave generation via waveshaper for deep rumble
 * - Adjustable formant positions and resonance
 */
export class Growl extends BaseEffect {
  readonly type: EffectType = 'growl';

  // Formant filter bank (3 resonant bandpass filters)
  private formant1: BiquadFilterNode;
  private formant2: BiquadFilterNode;
  private formant3: BiquadFilterNode;
  private formantMerge: GainNode;

  // Sub-octave path
  private subWaveshaper: WaveShaperNode;
  private subFilter: BiquadFilterNode;
  private subGain: GainNode;

  // Output mixing
  private formantGain: GainNode;
  private masterGain: GainNode;

  // Parameter state
  private growlAmount = 70;
  private subDepth = 50;
  private tone = 50;
  private mix = 80;

  // Base formant frequencies for a monster growl
  private static BASE_FORMANTS = [180, 400, 800];

  constructor(ctx: AudioContext) {
    super(ctx);

    // Create formant filters
    this.formant1 = ctx.createBiquadFilter();
    this.formant2 = ctx.createBiquadFilter();
    this.formant3 = ctx.createBiquadFilter();
    this.formantMerge = ctx.createGain();
    this.formantGain = ctx.createGain();

    this.formant1.type = 'bandpass';
    this.formant2.type = 'bandpass';
    this.formant3.type = 'bandpass';

    // Connect formants in parallel to merge node
    this.formant1.connect(this.formantMerge);
    this.formant2.connect(this.formantMerge);
    this.formant3.connect(this.formantMerge);
    this.formantMerge.connect(this.formantGain);
    this.formantMerge.gain.value = 0.5;

    // Sub-octave path: waveshaper (square wave folding) -> low-pass -> gain
    this.subWaveshaper = ctx.createWaveShaper();
    this.subWaveshaper.curve = this.makeSubOctaveCurve();
    this.subWaveshaper.oversample = '2x';

    this.subFilter = ctx.createBiquadFilter();
    this.subFilter.type = 'lowpass';
    this.subFilter.frequency.value = 250;
    this.subFilter.Q.value = 1;

    this.subGain = ctx.createGain();

    this.subWaveshaper.connect(this.subFilter);
    this.subFilter.connect(this.subGain);

    // Master output
    this.masterGain = ctx.createGain();
    this.formantGain.connect(this.masterGain);
    this.subGain.connect(this.masterGain);

    // Connect wet chain: input splits to formants + sub-octave
    this.inputNode.connect(this.formant1);
    this.inputNode.connect(this.formant2);
    this.inputNode.connect(this.formant3);
    this.inputNode.connect(this.subWaveshaper);
    this.masterGain.connect(this.wetGain);

    this.updateFormants();
    this.updateSubDepth();
    this.updateMix();
  }

  private makeSubOctaveCurve(): Float32Array {
    // Creates a square-wave-like transfer function that produces sub-harmonics
    const samples = 8192;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      // Full-wave rectify + hard clip to generate octave-down content
      curve[i] = Math.sign(x) * Math.pow(Math.abs(x), 0.5);
    }
    return curve;
  }

  private updateFormants(): void {
    const toneShift = (this.tone - 50) / 50; // -1 to 1
    const qBase = 2 + (this.growlAmount / 100) * 18; // Q from 2 to 20

    const freqs = Growl.BASE_FORMANTS.map(
      (f) => f * Math.pow(2, toneShift * 0.5)
    );

    const now = this.ctx.currentTime;
    const ramp = 0.02;

    this.formant1.frequency.linearRampToValueAtTime(freqs[0], now + ramp);
    this.formant1.Q.linearRampToValueAtTime(qBase, now + ramp);

    this.formant2.frequency.linearRampToValueAtTime(freqs[1], now + ramp);
    this.formant2.Q.linearRampToValueAtTime(qBase * 0.8, now + ramp);

    this.formant3.frequency.linearRampToValueAtTime(freqs[2], now + ramp);
    this.formant3.Q.linearRampToValueAtTime(qBase * 0.6, now + ramp);
  }

  private updateSubDepth(): void {
    this.subGain.gain.linearRampToValueAtTime(
      this.subDepth / 100,
      this.ctx.currentTime + 0.01
    );
  }

  private updateMix(): void {
    this.formantGain.gain.linearRampToValueAtTime(
      this.mix / 100,
      this.ctx.currentTime + 0.01
    );
  }

  setParam(name: string, value: number): void {
    switch (name) {
      case 'growl':
        this.growlAmount = value;
        this.updateFormants();
        break;
      case 'sub':
        this.subDepth = value;
        this.updateSubDepth();
        break;
      case 'tone':
        this.tone = value;
        this.updateFormants();
        break;
      case 'mix':
        this.mix = value;
        this.updateMix();
        break;
    }
  }

  getParams(): Record<string, number> {
    return {
      growl: this.growlAmount,
      sub: this.subDepth,
      tone: this.tone,
      mix: this.mix,
    };
  }

  getParamDescriptors(): ParamDescriptor[] {
    return [
      { name: 'growl', label: 'Growl', min: 0, max: 100, default: 70, step: 1, unit: '%' },
      { name: 'sub', label: 'Sub', min: 0, max: 100, default: 50, step: 1, unit: '%' },
      { name: 'tone', label: 'Tone', min: 0, max: 100, default: 50, step: 1, unit: '%' },
      { name: 'mix', label: 'Mix', min: 0, max: 100, default: 80, step: 1, unit: '%' },
    ];
  }

  dispose(): void {
    this.formant1.disconnect();
    this.formant2.disconnect();
    this.formant3.disconnect();
    this.formantMerge.disconnect();
    this.formantGain.disconnect();
    this.subWaveshaper.disconnect();
    this.subFilter.disconnect();
    this.subGain.disconnect();
    this.masterGain.disconnect();
    super.dispose();
  }
}

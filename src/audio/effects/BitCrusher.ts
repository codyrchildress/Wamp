import type { EffectType, ParamDescriptor } from '../../types/effects';
import { BaseEffect } from './BaseEffect';

/**
 * BitCrusher — reduces bit depth and simulates sample rate reduction
 * for aggressive, lo-fi, digital destruction sounds.
 * Uses a WaveShaper for bit quantization and a low-pass filter
 * to simulate reduced sample rate.
 */
export class BitCrusher extends BaseEffect {
  readonly type: EffectType = 'bitcrusher';

  private waveshaper: WaveShaperNode;
  private preGain: GainNode;
  private rateFilter: BiquadFilterNode;
  private postGain: GainNode;

  private bits = 8;
  private rate = 50;
  private crush = 60;

  constructor(ctx: AudioContext) {
    super(ctx);

    this.preGain = ctx.createGain();
    this.preGain.gain.value = 1;

    this.waveshaper = ctx.createWaveShaper();
    this.waveshaper.oversample = 'none'; // No oversampling for maximum grit

    // Low-pass filter to simulate reduced sample rate
    this.rateFilter = ctx.createBiquadFilter();
    this.rateFilter.type = 'lowpass';
    this.rateFilter.Q.value = 0.5;

    this.postGain = ctx.createGain();
    this.postGain.gain.value = 1;

    // Chain: preGain -> waveshaper -> rateFilter -> postGain
    this.preGain.connect(this.waveshaper);
    this.waveshaper.connect(this.rateFilter);
    this.rateFilter.connect(this.postGain);

    this.connectWetChain(this.preGain, this.postGain);
    this.updateCurve();
    this.updateRate();
  }

  private updateCurve(): void {
    // Create a staircase transfer function for bit quantization
    // Fewer bits = fewer steps = more distortion
    const effectiveBits = Math.max(1, Math.round(this.bits));
    const levels = Math.pow(2, effectiveBits);
    const samples = 65536;
    const curve = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1; // -1 to 1
      // Quantize to discrete levels
      curve[i] = Math.round(x * levels) / levels;
    }

    this.waveshaper.curve = curve;

    // Boost signal to compensate for quantization loss at low bit depths
    const compensation = 1 + (16 - this.bits) * 0.03;
    this.postGain.gain.linearRampToValueAtTime(
      compensation,
      this.ctx.currentTime + 0.01
    );
  }

  private updateRate(): void {
    // Map rate parameter (0-100) to filter cutoff
    // 100 = full bandwidth (20kHz), 0 = very low (500Hz)
    const minFreq = 500;
    const maxFreq = 20000;
    const normalized = this.rate / 100;
    const freq = minFreq * Math.pow(maxFreq / minFreq, normalized);
    this.rateFilter.frequency.linearRampToValueAtTime(
      freq,
      this.ctx.currentTime + 0.01
    );
  }

  setParam(name: string, value: number): void {
    switch (name) {
      case 'bits':
        this.bits = value;
        this.updateCurve();
        break;
      case 'rate':
        this.rate = value;
        this.updateRate();
        break;
      case 'crush':
        this.crush = value;
        // Drive the input harder for more aggressive crushing
        const drive = 1 + (value / 100) * 2;
        this.preGain.gain.linearRampToValueAtTime(
          drive,
          this.ctx.currentTime + 0.01
        );
        break;
    }
  }

  getParams(): Record<string, number> {
    return { bits: this.bits, rate: this.rate, crush: this.crush };
  }

  getParamDescriptors(): ParamDescriptor[] {
    return [
      { name: 'bits', label: 'Bits', min: 1, max: 16, default: 8, step: 1, unit: 'bit' },
      { name: 'rate', label: 'Rate', min: 0, max: 100, default: 50, step: 1, unit: '%' },
      { name: 'crush', label: 'Crush', min: 0, max: 100, default: 60, step: 1, unit: '%' },
    ];
  }

  dispose(): void {
    this.preGain.disconnect();
    this.waveshaper.disconnect();
    this.rateFilter.disconnect();
    this.postGain.disconnect();
    super.dispose();
  }
}

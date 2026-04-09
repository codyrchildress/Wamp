import type { EffectType, ParamDescriptor } from '../../types/effects';
import { BaseEffect } from './BaseEffect';

/**
 * Ring Modulator — multiplies the input signal with an oscillator,
 * creating inharmonic, metallic, and alien-sounding tones.
 * Great for robot voices, alien creatures, and demonic effects.
 */
export class RingModulator extends BaseEffect {
  readonly type: EffectType = 'ringmod';

  private oscillator: OscillatorNode;
  private modGain: GainNode;
  private outputGain: GainNode;

  private freq = 30;
  private depth = 80;
  private wave: 0 | 1 = 0; // 0 = sine, 1 = square

  constructor(ctx: AudioContext) {
    super(ctx);

    // Create modulation oscillator
    this.oscillator = ctx.createOscillator();
    this.oscillator.type = 'sine';
    this.oscillator.frequency.value = this.freq;

    // The modGain node acts as the ring modulator:
    // Its gain is modulated by the oscillator, and the input signal passes through it.
    // This effectively multiplies input * oscillator.
    this.modGain = ctx.createGain();
    this.modGain.gain.value = 0; // Will be modulated by oscillator

    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 1;

    // Connect oscillator to modulate the gain
    this.oscillator.connect(this.modGain.gain);
    this.oscillator.start();

    // Signal path: input -> modGain -> outputGain
    this.modGain.connect(this.outputGain);

    this.connectWetChain(this.modGain, this.outputGain);
    this.updateDepth();
  }

  private updateDepth(): void {
    // Scale oscillator output to control ring mod intensity.
    // At 100% depth, oscillator swings gain fully; at lower depths, swing is reduced.
    // We reconnect through a scaling gain node by adjusting the oscillator's output level.
    this.oscillator.disconnect();
    const scaledGain = this.ctx.createGain();
    scaledGain.gain.value = this.depth / 100;
    this.oscillator.connect(scaledGain);
    scaledGain.connect(this.modGain.gain);
    this.modGain.gain.value = 0;
  }

  setParam(name: string, value: number): void {
    switch (name) {
      case 'freq':
        this.freq = value;
        this.oscillator.frequency.linearRampToValueAtTime(
          value,
          this.ctx.currentTime + 0.01
        );
        break;
      case 'depth':
        this.depth = value;
        this.updateDepth();
        break;
      case 'wave':
        this.wave = value as 0 | 1;
        this.oscillator.type = value === 1 ? 'square' : 'sine';
        break;
    }
  }

  getParams(): Record<string, number> {
    return { freq: this.freq, depth: this.depth, wave: this.wave };
  }

  getParamDescriptors(): ParamDescriptor[] {
    return [
      { name: 'freq', label: 'Freq', min: 1, max: 500, default: 30, step: 1, unit: 'Hz' },
      { name: 'depth', label: 'Depth', min: 0, max: 100, default: 80, step: 1, unit: '%' },
      { name: 'wave', label: 'Wave', min: 0, max: 1, default: 0, step: 1, unit: '' },
    ];
  }

  dispose(): void {
    this.oscillator.stop();
    this.oscillator.disconnect();
    this.modGain.disconnect();
    this.outputGain.disconnect();
    super.dispose();
  }
}

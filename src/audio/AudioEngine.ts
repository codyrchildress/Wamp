import type { EffectNode, EffectType, EffectSlotState } from '../types/effects';
import { createEffect } from './effects';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private inputGain: GainNode | null = null;
  private outputGain: GainNode | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private recordingDest: MediaStreamAudioDestinationNode | null = null;
  private effects: EffectNode[] = [];
  private masterVolume = 1;

  async start(deviceId?: string): Promise<void> {
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      },
    };

    this.stream = await navigator.mediaDevices.getUserMedia(constraints);

    this.ctx = new AudioContext({ latencyHint: 'interactive', sampleRate: 48000 });
    this.sourceNode = this.ctx.createMediaStreamSource(this.stream);

    this.inputGain = this.ctx.createGain();
    this.outputGain = this.ctx.createGain();
    this.outputGain.gain.value = this.masterVolume;

    this.inputAnalyser = this.ctx.createAnalyser();
    this.inputAnalyser.fftSize = 256;
    this.outputAnalyser = this.ctx.createAnalyser();
    this.outputAnalyser.fftSize = 256;

    this.sourceNode.connect(this.inputGain);
    this.inputGain.connect(this.inputAnalyser);

    this.rebuildChain();
  }

  stop(): void {
    this.effects.forEach((e) => e.dispose());
    this.effects = [];
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close();
    this.ctx = null;
    this.stream = null;
    this.sourceNode = null;
  }

  isRunning(): boolean {
    return this.ctx !== null && this.ctx.state !== 'closed';
  }

  getContext(): AudioContext | null {
    return this.ctx;
  }

  private rebuildChain(): void {
    if (!this.ctx || !this.inputGain || !this.outputGain || !this.outputAnalyser) return;

    // Disconnect everything from inputGain forward
    this.inputGain.disconnect(this.inputAnalyser!);
    this.inputGain.connect(this.inputAnalyser!); // keep analyser connected

    // Disconnect previous chain
    try { this.inputGain.disconnect(); } catch { /* ignore */ }
    this.inputGain.connect(this.inputAnalyser!);

    for (const effect of this.effects) {
      try { effect.getOutputNode().disconnect(); } catch { /* ignore */ }
    }
    try { this.outputGain.disconnect(); } catch { /* ignore */ }

    // Build new chain
    let prevOutput: AudioNode = this.inputGain;

    for (const effect of this.effects) {
      prevOutput.connect(effect.getInputNode());
      prevOutput = effect.getOutputNode();
    }

    prevOutput.connect(this.outputGain);
    this.outputGain.connect(this.outputAnalyser);
    this.outputAnalyser.connect(this.ctx.destination);

    // Recording tap: connect output to a MediaStreamDestination for recording
    if (!this.recordingDest && this.ctx) {
      this.recordingDest = this.ctx.createMediaStreamDestination();
    }
    this.outputAnalyser.connect(this.recordingDest!);
  }

  addEffect(type: EffectType, params?: Record<string, number>): EffectNode {
    if (!this.ctx) throw new Error('Engine not started');
    const effect = createEffect(this.ctx, type);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        effect.setParam(k, v);
      }
    }
    this.effects.push(effect);
    this.rebuildChain();
    return effect;
  }

  removeEffect(id: string): void {
    const idx = this.effects.findIndex((e) => e.id === id);
    if (idx === -1) return;
    const effect = this.effects[idx];
    this.effects.splice(idx, 1);
    effect.dispose();
    this.rebuildChain();
  }

  reorderEffects(fromIndex: number, toIndex: number): void {
    const [removed] = this.effects.splice(fromIndex, 1);
    this.effects.splice(toIndex, 0, removed);
    this.rebuildChain();
  }

  getEffects(): EffectNode[] {
    return [...this.effects];
  }

  getEffectById(id: string): EffectNode | undefined {
    return this.effects.find((e) => e.id === id);
  }

  setMasterVolume(value: number): void {
    this.masterVolume = value;
    if (this.outputGain) {
      this.outputGain.gain.linearRampToValueAtTime(value, (this.ctx?.currentTime ?? 0) + 0.01);
    }
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  getInputLevel(): number {
    return this.getLevel(this.inputAnalyser);
  }

  getOutputLevel(): number {
    return this.getLevel(this.outputAnalyser);
  }

  private getLevel(analyser: AnalyserNode | null): number {
    if (!analyser) return 0;
    const data = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }

  getChainState(): EffectSlotState[] {
    return this.effects.map((e) => ({
      id: e.id,
      type: e.type,
      bypassed: e.isBypassed(),
      params: e.getParams(),
    }));
  }

  async switchInput(deviceId: string): Promise<void> {
    if (!this.ctx || !this.sourceNode || !this.inputGain) return;

    // Stop old stream
    this.stream?.getTracks().forEach((t) => t.stop());
    this.sourceNode.disconnect();

    // Get new stream
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: deviceId },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    this.sourceNode = this.ctx.createMediaStreamSource(this.stream);
    this.sourceNode.connect(this.inputGain);
  }

  getInputNode(): GainNode | null {
    return this.inputGain;
  }

  getRecordingStream(): MediaStream | null {
    return this.recordingDest?.stream ?? null;
  }

  clearChain(): void {
    this.effects.forEach((e) => e.dispose());
    this.effects = [];
    this.rebuildChain();
  }
}

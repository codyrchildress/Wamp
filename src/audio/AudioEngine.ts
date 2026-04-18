import type { EffectNode, EffectType, EffectSlotState } from '../types/effects';
import { createEffect } from './effects';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private monoSplitter: ChannelSplitterNode | null = null;
  private monoSum: GainNode | null = null;
  private inputGain: GainNode | null = null;
  private outputGain: GainNode | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private recordingDest: MediaStreamAudioDestinationNode | null = null;
  private effects: EffectNode[] = [];
  private masterVolume = 1;
  private micMuted = false;
  private forceMono = false;

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

    this.monoSplitter = this.ctx.createChannelSplitter(2);
    this.monoSum = this.ctx.createGain();
    this.monoSum.channelCount = 1;
    this.monoSum.channelCountMode = 'explicit';
    this.monoSum.channelInterpretation = 'speakers';

    this.connectSourceToInput();

    this.rebuildChain();
  }

  private connectSourceToInput(): void {
    if (!this.sourceNode || !this.inputGain || !this.monoSplitter || !this.monoSum) return;
    try { this.sourceNode.disconnect(); } catch { /* ignore */ }
    try { this.monoSplitter.disconnect(); } catch { /* ignore */ }
    try { this.monoSum.disconnect(); } catch { /* ignore */ }

    if (this.micMuted) return;

    if (this.forceMono) {
      // Sum L + R into a single-channel node so a signal on only one channel
      // plays at full volume through both output channels.
      this.sourceNode.connect(this.monoSplitter);
      this.monoSplitter.connect(this.monoSum, 0);
      this.monoSplitter.connect(this.monoSum, 1);
      this.monoSum.connect(this.inputGain);
    } else {
      this.sourceNode.connect(this.inputGain);
    }
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

    // Disconnect previous chain from inputGain forward (analyser included),
    // then re-attach the analyser so the input meter keeps working.
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
    this.connectSourceToInput();
  }

  setForceMono(enabled: boolean): void {
    this.forceMono = enabled;
    this.connectSourceToInput();
  }

  getForceMono(): boolean {
    return this.forceMono;
  }

  setMicMuted(muted: boolean): void {
    this.micMuted = muted;
    this.connectSourceToInput();
  }

  isMicMuted(): boolean {
    return this.micMuted;
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

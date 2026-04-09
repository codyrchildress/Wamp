export type SynthWaveform = 'sine' | 'square' | 'sawtooth' | 'triangle';
export type ArpMode = 'up' | 'down' | 'updown' | 'random';

interface Voice {
  osc: OscillatorNode;
  gain: GainNode;
  note: number;
}

/**
 * Polyphonic synthesizer that connects to an AudioEngine's input node
 * so its output is processed by the effect chain.
 */
export class Synth {
  private ctx: AudioContext;
  private output: GainNode;
  private voices: Map<number, Voice> = new Map();

  private _waveform: SynthWaveform = 'sawtooth';
  private _octave = 4;
  private _attack = 0.01;
  private _release = 0.15;
  private _volume = 0.3;

  // Arpeggiator state
  private _arpEnabled = false;
  private _arpMode: ArpMode = 'up';
  private _arpBpm = 240;
  private _arpOctaves = 1;
  private arpHeldNotes: Set<number> = new Set();
  private arpTimer: ReturnType<typeof setInterval> | null = null;
  private arpIndex = 0;
  private arpDirection = 1; // 1 = up, -1 = down (for updown mode)
  private arpCurrentNote: number | null = null;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.output = ctx.createGain();
    this.output.gain.value = this._volume;
    this.output.connect(destination);
  }

  noteOn(midiNote: number): void {
    if (this._arpEnabled) {
      this.arpHeldNotes.add(midiNote);
      if (!this.arpTimer) this.startArp();
      return;
    }

    if (this.voices.has(midiNote)) return;
    this.playVoice(midiNote);
  }

  noteOff(midiNote: number): void {
    if (this._arpEnabled) {
      this.arpHeldNotes.delete(midiNote);
      if (this.arpHeldNotes.size === 0) this.stopArp();
      return;
    }

    this.releaseVoice(midiNote);
  }

  private playVoice(midiNote: number): void {
    if (this.voices.has(midiNote)) return;

    const freq = 440 * Math.pow(2, (midiNote - 69) / 12);

    const osc = this.ctx.createOscillator();
    osc.type = this._waveform;
    osc.frequency.value = freq;

    const gain = this.ctx.createGain();
    gain.gain.value = 0;

    osc.connect(gain);
    gain.connect(this.output);
    osc.start();

    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + this._attack);

    this.voices.set(midiNote, { osc, gain, note: midiNote });
  }

  private releaseVoice(midiNote: number): void {
    const voice = this.voices.get(midiNote);
    if (!voice) return;

    const now = this.ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + this._release);

    const releaseMs = this._release * 1000 + 50;
    setTimeout(() => {
      voice.osc.stop();
      voice.osc.disconnect();
      voice.gain.disconnect();
    }, releaseMs);

    this.voices.delete(midiNote);
  }

  allNotesOff(): void {
    for (const midiNote of [...this.voices.keys()]) {
      this.releaseVoice(midiNote);
    }
    this.arpHeldNotes.clear();
    this.stopArp();
  }

  // --- Arpeggiator ---

  private getArpSequence(): number[] {
    const baseNotes = [...this.arpHeldNotes].sort((a, b) => a - b);
    if (baseNotes.length === 0) return [];

    const notes: number[] = [];
    for (let oct = 0; oct < this._arpOctaves; oct++) {
      for (const n of baseNotes) {
        notes.push(n + oct * 12);
      }
    }

    switch (this._arpMode) {
      case 'up':
        return notes;
      case 'down':
        return notes.reverse();
      case 'updown': {
        if (notes.length <= 1) return notes;
        const down = notes.slice(1, -1).reverse();
        return [...notes, ...down];
      }
      case 'random':
        return notes; // randomized at step time
    }
  }

  private startArp(): void {
    this.stopArp();
    this.arpIndex = 0;
    this.arpDirection = 1;
    const intervalMs = (60 / this._arpBpm) * 1000;
    this.arpStep();
    this.arpTimer = setInterval(() => this.arpStep(), intervalMs);
  }

  private stopArp(): void {
    if (this.arpTimer) {
      clearInterval(this.arpTimer);
      this.arpTimer = null;
    }
    if (this.arpCurrentNote !== null) {
      this.releaseVoice(this.arpCurrentNote);
      this.arpCurrentNote = null;
    }
    this.arpIndex = 0;
  }

  private arpStep(): void {
    // Release previous note
    if (this.arpCurrentNote !== null) {
      this.releaseVoice(this.arpCurrentNote);
      this.arpCurrentNote = null;
    }

    const seq = this.getArpSequence();
    if (seq.length === 0) return;

    let note: number;
    if (this._arpMode === 'random') {
      note = seq[Math.floor(Math.random() * seq.length)];
    } else {
      this.arpIndex = this.arpIndex % seq.length;
      note = seq[this.arpIndex];
      this.arpIndex++;
    }

    this.playVoice(note);
    this.arpCurrentNote = note;
  }

  private restartArpTimer(): void {
    if (!this.arpTimer) return;
    clearInterval(this.arpTimer);
    const intervalMs = (60 / this._arpBpm) * 1000;
    this.arpTimer = setInterval(() => this.arpStep(), intervalMs);
  }

  // --- Getters/Setters ---

  get waveform(): SynthWaveform { return this._waveform; }
  set waveform(w: SynthWaveform) {
    this._waveform = w;
    for (const voice of this.voices.values()) {
      voice.osc.type = w;
    }
  }

  get octave(): number { return this._octave; }
  set octave(o: number) {
    this.allNotesOff();
    this._octave = Math.max(1, Math.min(7, o));
  }

  get attack(): number { return this._attack; }
  set attack(v: number) { this._attack = v; }

  get release(): number { return this._release; }
  set release(v: number) { this._release = v; }

  get volume(): number { return this._volume; }
  set volume(v: number) {
    this._volume = v;
    this.output.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 0.01);
  }

  get arpEnabled(): boolean { return this._arpEnabled; }
  set arpEnabled(v: boolean) {
    this._arpEnabled = v;
    if (!v) {
      this.stopArp();
      this.arpHeldNotes.clear();
    }
  }

  get arpMode(): ArpMode { return this._arpMode; }
  set arpMode(m: ArpMode) {
    this._arpMode = m;
    this.arpIndex = 0;
  }

  get arpBpm(): number { return this._arpBpm; }
  set arpBpm(v: number) {
    this._arpBpm = v;
    this.restartArpTimer();
  }

  get arpOctaves(): number { return this._arpOctaves; }
  set arpOctaves(v: number) {
    this._arpOctaves = Math.max(1, Math.min(4, v));
    this.arpIndex = 0;
  }

  getActiveNotes(): number[] {
    return [...this.voices.keys()];
  }

  dispose(): void {
    this.allNotesOff();
    this.output.disconnect();
  }
}

/**
 * QWERTY keyboard → semitone offset mapping.
 * Bottom row (ZXCVBNM) = C to B of current octave.
 * Top row (QWERTYU) = C to B of next octave.
 */
export const KEY_TO_SEMITONE: Record<string, number> = {
  // Bottom row: current octave
  'z': 0,   // C
  's': 1,   // C#
  'x': 2,   // D
  'd': 3,   // D#
  'c': 4,   // E
  'v': 5,   // F
  'g': 6,   // F#
  'b': 7,   // G
  'h': 8,   // G#
  'n': 9,   // A
  'j': 10,  // A#
  'm': 11,  // B

  // Top row: next octave up
  'q': 12,  // C
  '2': 13,  // C#
  'w': 14,  // D
  '3': 15,  // D#
  'e': 16,  // E
  'r': 17,  // F
  '5': 18,  // F#
  't': 19,  // G
  '6': 20,  // G#
  'y': 21,  // A
  '7': 22,  // A#
  'u': 23,  // B
  'i': 24,  // C (2 octaves up)
};

export function semitoneToMidi(semitone: number, octave: number): number {
  // MIDI note: C4 = 60. C of octave N = 12 * (N + 1)
  return 12 * (octave + 1) + semitone;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const note = NOTE_NAMES[midi % 12];
  return `${note}${octave}`;
}

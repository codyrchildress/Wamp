export type SynthWaveform = 'sine' | 'square' | 'sawtooth' | 'triangle';

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

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.output = ctx.createGain();
    this.output.gain.value = this._volume;
    this.output.connect(destination);
  }

  noteOn(midiNote: number): void {
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

    // Attack envelope
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + this._attack);

    this.voices.set(midiNote, { osc, gain, note: midiNote });
  }

  noteOff(midiNote: number): void {
    const voice = this.voices.get(midiNote);
    if (!voice) return;

    const now = this.ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + this._release);

    // Clean up after release
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
      this.noteOff(midiNote);
    }
  }

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

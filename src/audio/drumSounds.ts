export type DrumSoundFn = (
  ctx: AudioContext,
  dest: AudioNode,
  noise: AudioBuffer,
) => void;

export function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

const kick: DrumSoundFn = (ctx, dest) => {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(1, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + 0.4);
};

const snare: DrumSoundFn = (ctx, dest, noise) => {
  const t = ctx.currentTime;
  // Tone
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(200, t);
  osc.frequency.exponentialRampToValueAtTime(80, t + 0.07);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.7, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  osc.connect(og).connect(dest);
  osc.start(t);
  osc.stop(t + 0.1);
  // Noise
  const ns = ctx.createBufferSource();
  ns.buffer = noise;
  const filt = ctx.createBiquadFilter();
  filt.type = 'highpass';
  filt.frequency.value = 1000;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.5, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  ns.connect(filt).connect(ng).connect(dest);
  ns.start(t);
  ns.stop(t + 0.2);
};

const closedHH: DrumSoundFn = (ctx, dest, noise) => {
  const t = ctx.currentTime;
  const ns = ctx.createBufferSource();
  ns.buffer = noise;
  const filt = ctx.createBiquadFilter();
  filt.type = 'highpass';
  filt.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.4, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  ns.connect(filt).connect(g).connect(dest);
  ns.start(t);
  ns.stop(t + 0.06);
};

const openHH: DrumSoundFn = (ctx, dest, noise) => {
  const t = ctx.currentTime;
  const ns = ctx.createBufferSource();
  ns.buffer = noise;
  const filt = ctx.createBiquadFilter();
  filt.type = 'highpass';
  filt.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.4, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  ns.connect(filt).connect(g).connect(dest);
  ns.start(t);
  ns.stop(t + 0.3);
};

const clap: DrumSoundFn = (ctx, dest, noise) => {
  const t = ctx.currentTime;
  const ns = ctx.createBufferSource();
  ns.buffer = noise;
  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = 1500;
  filt.Q.value = 0.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.5, t + 0.005);
  g.gain.linearRampToValueAtTime(0.1, t + 0.01);
  g.gain.linearRampToValueAtTime(0.5, t + 0.015);
  g.gain.linearRampToValueAtTime(0.1, t + 0.02);
  g.gain.linearRampToValueAtTime(0.6, t + 0.025);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  ns.connect(filt).connect(g).connect(dest);
  ns.start(t);
  ns.stop(t + 0.2);
};

const rimshot: DrumSoundFn = (ctx, dest) => {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(800, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + 0.04);
};

function makeTom(startFreq: number, endFreq: number, dur: number): DrumSoundFn {
  return (ctx, dest) => {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur * 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur);
  };
}

const lowTom = makeTom(120, 60, 0.3);
const midTom = makeTom(200, 100, 0.25);
const highTom = makeTom(300, 150, 0.2);

const cowbell: DrumSoundFn = (ctx, dest) => {
  const t = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  osc1.type = 'square';
  osc1.frequency.value = 560;
  const osc2 = ctx.createOscillator();
  osc2.type = 'square';
  osc2.frequency.value = 845;
  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = 800;
  filt.Q.value = 3;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.4, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  osc1.connect(filt);
  osc2.connect(filt);
  filt.connect(g).connect(dest);
  osc1.start(t);
  osc2.start(t);
  osc1.stop(t + 0.2);
  osc2.stop(t + 0.2);
};

const crash: DrumSoundFn = (ctx, dest, noise) => {
  const t = ctx.currentTime;
  const ns = ctx.createBufferSource();
  ns.buffer = noise;
  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = 5000;
  filt.Q.value = 0.3;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
  ns.connect(filt).connect(g).connect(dest);
  ns.start(t);
  ns.stop(t + 1.0);
};

const ride: DrumSoundFn = (ctx, dest, noise) => {
  const t = ctx.currentTime;
  const ns = ctx.createBufferSource();
  ns.buffer = noise;
  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = 8000;
  filt.Q.value = 1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  ns.connect(filt).connect(g).connect(dest);
  ns.start(t);
  ns.stop(t + 0.5);
};

const shaker: DrumSoundFn = (ctx, dest, noise) => {
  const t = ctx.currentTime;
  const ns = ctx.createBufferSource();
  ns.buffer = noise;
  const filt = ctx.createBiquadFilter();
  filt.type = 'highpass';
  filt.frequency.value = 8000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  ns.connect(filt).connect(g).connect(dest);
  ns.start(t);
  ns.stop(t + 0.08);
};

const clave: DrumSoundFn = (ctx, dest) => {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = 2500;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + 0.03);
};

function makeConga(startFreq: number, endFreq: number, dur: number): DrumSoundFn {
  return (ctx, dest) => {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur * 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur);
  };
}

const congaLow = makeConga(200, 100, 0.18);
const congaHigh = makeConga(350, 200, 0.12);

export interface PadDef {
  key: string;
  name: string;
  play: DrumSoundFn;
}

export const DEFAULT_PADS: PadDef[] = [
  { key: '1', name: 'Kick', play: kick },
  { key: '2', name: 'Snare', play: snare },
  { key: '3', name: 'CH Hat', play: closedHH },
  { key: '4', name: 'OH Hat', play: openHH },
  { key: 'Q', name: 'Clap', play: clap },
  { key: 'W', name: 'Rim', play: rimshot },
  { key: 'E', name: 'Lo Tom', play: lowTom },
  { key: 'R', name: 'Md Tom', play: midTom },
  { key: 'A', name: 'Hi Tom', play: highTom },
  { key: 'S', name: 'Cowbell', play: cowbell },
  { key: 'D', name: 'Crash', play: crash },
  { key: 'F', name: 'Ride', play: ride },
  { key: 'Z', name: 'Shaker', play: shaker },
  { key: 'X', name: 'Clave', play: clave },
  { key: 'C', name: 'Cga Lo', play: congaLow },
  { key: 'V', name: 'Cga Hi', play: congaHigh },
];

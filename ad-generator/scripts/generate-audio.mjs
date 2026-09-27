import {mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '..', 'public', 'audio');
mkdirSync(outDir, {recursive: true});

const sampleRate = 48000;
const seconds = 30;
const samples = sampleRate * seconds;
const left = new Float32Array(samples);
const right = new Float32Array(samples);
let randomState = 0x1a2b3c4d;
const random = () => {
  randomState = (1664525 * randomState + 1013904223) >>> 0;
  return randomState / 0xffffffff;
};

const addTone = (start, duration, frequency, volume, kind = 'sine', pan = 0, glide = 0) => {
  const from = Math.max(0, Math.floor(start * sampleRate));
  const count = Math.floor(duration * sampleRate);
  let phase = 0;
  for (let j = 0; j < count && from + j < samples; j += 1) {
    const t = j / sampleRate;
    const env = Math.pow(Math.sin(Math.PI * Math.min(1, t / duration)), 0.55) * Math.exp(-t * 0.8);
    const freq = frequency + glide * (t / duration);
    phase += (Math.PI * 2 * freq) / sampleRate;
    let wave = Math.sin(phase);
    if (kind === 'triangle') wave = (2 / Math.PI) * Math.asin(Math.sin(phase));
    if (kind === 'square') wave = Math.sign(Math.sin(phase));
    const value = wave * env * volume;
    left[from + j] += value * (1 - Math.max(0, pan));
    right[from + j] += value * (1 + Math.min(0, pan));
  }
};

const addKick = (start, volume = 0.7) => {
  const from = Math.floor(start * sampleRate);
  const count = Math.floor(0.28 * sampleRate);
  let phase = 0;
  for (let j = 0; j < count && from + j < samples; j += 1) {
    const t = j / sampleRate;
    const freq = 145 * Math.exp(-t * 22) + 43;
    phase += (Math.PI * 2 * freq) / sampleRate;
    const value = Math.sin(phase) * Math.exp(-t * 15) * volume;
    left[from + j] += value;
    right[from + j] += value;
  }
};

const addNoise = (start, duration, volume, decay = 18, pan = 0) => {
  const from = Math.floor(start * sampleRate);
  const count = Math.floor(duration * sampleRate);
  let previous = 0;
  for (let j = 0; j < count && from + j < samples; j += 1) {
    const t = j / sampleRate;
    const white = random() * 2 - 1;
    const high = white - previous * 0.72;
    previous = white;
    const value = high * Math.exp(-t * decay) * volume;
    left[from + j] += value * (1 - Math.max(0, pan));
    right[from + j] += value * (1 + Math.min(0, pan));
  }
};

const bpm = 128;
const beat = 60 / bpm;
const bass = [65.41, 65.41, 77.78, 58.27, 87.31, 77.78, 65.41, 58.27];
const arp = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 293.66, 440.0];

for (let b = 0; b * beat < seconds; b += 1) {
  const t = b * beat;
  addKick(t, b % 4 === 0 ? 0.72 : 0.56);
  if (b % 4 === 1 || b % 4 === 3) addNoise(t, 0.18, 0.22, 14);
  addTone(t, beat * 0.82, bass[Math.floor(b / 2) % bass.length], 0.16, 'triangle', -0.08);
  for (let h = 0; h < 2; h += 1) {
    addNoise(t + h * beat / 2, 0.07, 0.07, 35, h ? 0.35 : -0.35);
    const note = arp[(b * 2 + h) % arp.length];
    addTone(t + h * beat / 2, beat * 0.36, note, 0.065, 'triangle', h ? 0.28 : -0.28);
  }
}

for (const transition of [2.4, 6.5, 10.4, 14.3, 18.2, 24.5, 27.5]) {
  addNoise(transition - 0.35, 0.5, 0.12, 2.8);
  addTone(transition - 0.3, 0.44, 320, 0.11, 'sine', 0, 620);
  addKick(transition, 0.9);
}

for (let t = 0; t < seconds; t += 4 * beat) {
  addTone(t, 3.8 * beat, 130.81, 0.035, 'sine', -0.5);
  addTone(t, 3.8 * beat, 196.0, 0.03, 'sine', 0.5);
}

let peak = 0;
for (let i = 0; i < samples; i += 1) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
const gain = 0.92 / Math.max(1, peak);
const dataSize = samples * 2 * 2;
const wav = Buffer.alloc(44 + dataSize);
wav.write('RIFF', 0);
wav.writeUInt32LE(36 + dataSize, 4);
wav.write('WAVE', 8);
wav.write('fmt ', 12);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * 4, 28);
wav.writeUInt16LE(4, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(dataSize, 40);
for (let i = 0; i < samples; i += 1) {
  wav.writeInt16LE(Math.max(-32768, Math.min(32767, left[i] * gain * 32767)), 44 + i * 4);
  wav.writeInt16LE(Math.max(-32768, Math.min(32767, right[i] * gain * 32767)), 46 + i * 4);
}
writeFileSync(path.join(outDir, 'bgm.wav'), wav);
process.stdout.write('generated original 30s BGM\n');

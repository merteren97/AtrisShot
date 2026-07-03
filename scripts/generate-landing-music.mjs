import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const sampleRate = 44100;
const seconds = 24;
const channels = 2;
const totalSamples = sampleRate * seconds;
const outPath = path.resolve("apps/landing/public/media/atrisshot-product-theme.wav");

const clamp = (value) => Math.max(-1, Math.min(1, value));
const note = (midi) => 440 * 2 ** ((midi - 69) / 12);
const envelope = (t, start, length, attack = 0.05, release = 0.38) => {
  const local = t - start;
  if (local < 0 || local > length) return 0;
  if (local < attack) return local / attack;
  if (local > length - release) return Math.max(0, (length - local) / release);
  return 1;
};
const sine = (frequency, t) => Math.sin(2 * Math.PI * frequency * t);
const triangle = (frequency, t) => (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * frequency * t));

const chords = [
  [52, 59, 64, 68],
  [48, 55, 60, 67],
  [50, 57, 62, 66],
  [45, 52, 59, 64],
];
const melody = [76, 78, 80, 83, 81, 80, 78, 76, 74, 76, 78, 81, 80, 78, 76, 73];
const pcm = Buffer.alloc(totalSamples * channels * 2);

for (let i = 0; i < totalSamples; i += 1) {
  const t = i / sampleRate;
  const beat = t * 1.72;
  const bar = Math.floor(beat / 4);
  const barTime = (beat % 4) / 1.72;
  const chord = chords[bar % chords.length];

  let sample = 0;

  for (const midi of chord) {
    const freq = note(midi);
    const env = envelope(t, bar * (4 / 1.72), 4 / 1.72, 0.1, 0.55);
    sample += sine(freq, t) * env * 0.055;
    sample += triangle(freq * 2, t) * env * 0.018;
  }

  const step = Math.floor(beat * 2) % melody.length;
  const stepStart = Math.floor(beat * 2) / 2 / 1.72;
  const pluckEnv = envelope(t, stepStart, 0.42, 0.012, 0.32);
  sample += sine(note(melody[step]), t) * pluckEnv * 0.085;
  sample += sine(note(melody[step] + 12), t) * pluckEnv * 0.025;

  const bassMidi = chord[0] - 12;
  sample += sine(note(bassMidi), t) * envelope(t, Math.floor(beat) / 1.72, 0.48, 0.01, 0.28) * 0.12;

  const kickPhase = beat % 1;
  if (kickPhase < 0.18) {
    sample += sine(54 - kickPhase * 140, t) * (1 - kickPhase / 0.18) * 0.12;
  }

  const hatPhase = (beat * 2) % 1;
  if (hatPhase < 0.08) {
    const noise = Math.sin(i * 92.31) * Math.sin(i * 12.73);
    sample += noise * (1 - hatPhase / 0.08) * 0.028;
  }

  const intro = Math.min(1, t / 1.4);
  const outro = Math.min(1, (seconds - t) / 1.8);
  const value = clamp(sample * intro * outro * 0.88);
  const left = Math.round(clamp(value * 0.96) * 32767);
  const right = Math.round(clamp(value * (0.92 + Math.sin(t * 0.7) * 0.05)) * 32767);
  const offset = i * channels * 2;
  pcm.writeInt16LE(left, offset);
  pcm.writeInt16LE(right, offset + 2);
}

const dataSize = pcm.length;
const wav = Buffer.alloc(44 + dataSize);
wav.write("RIFF", 0);
wav.writeUInt32LE(36 + dataSize, 4);
wav.write("WAVE", 8);
wav.write("fmt ", 12);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(channels, 22);
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * channels * 2, 28);
wav.writeUInt16LE(channels * 2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(dataSize, 40);
pcm.copy(wav, 44);

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, wav);
console.log(`Generated ${outPath}`);

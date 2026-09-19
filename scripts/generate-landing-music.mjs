import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const sampleRate = 44100;
const seconds = 24;
const channels = 2;
const totalSamples = sampleRate * seconds;
const outPath = path.resolve("apps/landing/public/media/atrisshot-product-theme.wav");

const clamp = (value) => Math.max(-1, Math.min(1, value));
const note = (midi) => 440 * 2 ** ((midi - 69) / 12);

// Smooth envelope with configurable attack, decay, sustain level, and release
const envelope = (t, start, duration, attack = 0.4, release = 1.2) => {
  const local = t - start;
  if (local < 0 || local > duration) return 0;
  if (local < attack) return Math.sin((local / attack) * (Math.PI / 2));
  if (local > duration - release) {
    const relProgress = (duration - local) / release;
    return Math.max(0, Math.sin(relProgress * (Math.PI / 2)));
  }
  return 1;
};

// Slow, lush ambient chords (MIDI notes)
// Progression: Dmaj9 -> Bm9 -> Gmaj9 -> A(add9) (6 seconds per chord = 24s total)
const chords = [
  // Dmaj9: D3, A3, C#4, E4, F#4
  { bass: 38, pad: [50, 57, 61, 64, 66], chime: [66, 69, 73, 76] },
  // Bm9: B2, F#3, A3, C#4, D4
  { bass: 35, pad: [47, 54, 57, 61, 62], chime: [62, 66, 71, 73] },
  // Gmaj9: G2, D3, F#3, A3, B3
  { bass: 31, pad: [43, 50, 54, 57, 59], chime: [59, 62, 66, 71] },
  // A(add9): A2, E3, G#3, B3, C#4
  { bass: 33, pad: [45, 52, 56, 59, 61], chime: [61, 64, 68, 73] },
];

const pcm = Buffer.alloc(totalSamples * channels * 2);

for (let i = 0; i < totalSamples; i += 1) {
  const t = i / sampleRate;
  const chordIndex = Math.min(chords.length - 1, Math.floor(t / 6));
  const chordStart = chordIndex * 6;
  const chord = chords[chordIndex];

  let sampleL = 0;
  let sampleR = 0;

  // 1. Warm Analog Pad (Detuned sine + triangle with slow stereo chorus)
  const padEnv = envelope(t, chordStart, 6.2, 0.8, 1.4);
  for (let idx = 0; idx < chord.pad.length; idx++) {
    const midi = chord.pad[idx];
    const freq = note(midi);
    const detune1 = freq * (1 + 0.0018 * Math.sin(t * 0.4 + idx));
    const detune2 = freq * (1 - 0.0018 * Math.cos(t * 0.35 + idx));

    const s1 = Math.sin(2 * Math.PI * detune1 * t);
    const s2 = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * detune2 * t));
    const amp = (0.045 / (idx * 0.35 + 1)) * padEnv;

    sampleL += (s1 * 0.7 + s2 * 0.3) * amp;
    sampleR += (s2 * 0.7 + s1 * 0.3) * amp;
  }

  // 2. Soft Deep Sub-Bass (Pure low warmth, 40-70Hz)
  const bassFreq = note(chord.bass);
  const bassEnv = envelope(t, chordStart, 5.8, 0.4, 0.8);
  const subBass = Math.sin(2 * Math.PI * bassFreq * t) * 0.14 * bassEnv;
  const subHarmonic = Math.sin(2 * Math.PI * bassFreq * 2 * t) * 0.03 * bassEnv;
  sampleL += subBass + subHarmonic;
  sampleR += subBass + subHarmonic;

  // 3. Gentle Rhodes / Chime Sparkles (Slow, peaceful arpeggio notes)
  // Plays a gentle chime note every 1.5 seconds
  const chimeInterval = 1.5;
  const chimeIndex = Math.floor((t % 6) / chimeInterval);
  const chimeStart = chordStart + chimeIndex * chimeInterval;
  const chimeMidi = chord.chime[chimeIndex % chord.chime.length];
  const chimeFreq = note(chimeMidi);
  const chimeAge = t - chimeStart;

  if (chimeAge >= 0 && chimeAge < 2.0) {
    // Quick soft attack, exponential long decay
    const chimeAmp = Math.exp(-chimeAge * 3.2) * 0.07;
    const chimeTone =
      Math.sin(2 * Math.PI * chimeFreq * t) * 0.8 +
      Math.sin(2 * Math.PI * chimeFreq * 2 * t) * 0.2;

    const pan = 0.5 + 0.35 * Math.sin(chimeIndex * 1.8);
    sampleL += chimeTone * chimeAmp * (1 - pan);
    sampleR += chimeTone * chimeAmp * pan;
  }

  // 4. Subtle Ambient Tape Warmth (Organic texture)
  const noise = (Math.sin(i * 12.314) * Math.sin(i * 7.189)) * 0.003;
  sampleL += noise;
  sampleR += noise;

  // Master Envelope: 1.5s gentle fade-in, 2.5s graceful fade-out
  const masterFadeIn = Math.min(1, t / 1.5);
  const masterFadeOut = Math.min(1, Math.max(0, (seconds - t) / 2.5));
  const masterGain = masterFadeIn * masterFadeOut * 0.92;

  const outL = Math.round(clamp(sampleL * masterGain) * 32767);
  const outR = Math.round(clamp(sampleR * masterGain) * 32767);

  const offset = i * channels * 2;
  pcm.writeInt16LE(outL, offset);
  pcm.writeInt16LE(outR, offset + 2);
}

// Write Standard 44.1kHz 16-bit Stereo WAV
const dataSize = pcm.length;
const wav = Buffer.alloc(44 + dataSize);
wav.write("RIFF", 0);
wav.writeUInt32LE(36 + dataSize, 4);
wav.write("WAVE", 8);
wav.write("fmt ", 12);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); // PCM
wav.writeUInt16LE(channels, 22); // 2 channels
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * channels * 2, 28);
wav.writeUInt16LE(channels * 2, 32);
wav.writeUInt16LE(16, 34); // 16-bit
wav.write("data", 36);
wav.writeUInt32LE(dataSize, 40);
pcm.copy(wav, 44);

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, wav);
console.log(`Generated high-end slow ambient theme: ${outPath} (${(wav.length / 1024 / 1024).toFixed(2)} MB)`);

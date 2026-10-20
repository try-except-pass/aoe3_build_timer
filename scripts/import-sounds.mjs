/**
 * Imports the step-alert sounds from the AoE3 sound-effects pack (16-bit PCM .wav files) into
 * assets/sounds: mixed to mono, trimmed, faded out and normalized to the same level.
 *
 *   node scripts/import-sounds.mjs "<path to the pack's SFX folder>"
 */
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Output id -> source file and max length in seconds. Ids must match src/data/sounds.ts. */
const SOUNDS = {
  sword: { file: 'SwordClank2.wav', max: 0.7 },
  treasure: { file: 'PickUpNugget.wav', max: 0.4 },
  coin: { file: 'GatherCoin3.wav', max: 0.7 },
  arrow: { file: 'arrow1.wav', max: 0.45 },
  musket: { file: 'musketshot1.wav', max: 0.7 },
};

const src = process.argv[2];
if (!src || !fs.existsSync(src)) {
  console.error('Usage: node scripts/import-sounds.mjs "<SFX folder>"');
  process.exit(1);
}
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');
fs.mkdirSync(out, { recursive: true });

function readWav(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${file}: not a WAV`);
  let fmt;
  let data;
  for (let p = 12; p + 8 <= b.length; ) {
    const id = b.toString('ascii', p, p + 4);
    const len = b.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { code: b.readUInt16LE(p + 8), channels: b.readUInt16LE(p + 10), rate: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === 'data') data = b.subarray(p + 8, p + 8 + len);
    p += 8 + len + (len & 1);
  }
  if (!fmt || !data || fmt.code !== 1 || fmt.bits !== 16) throw new Error(`${file}: only 16-bit PCM is supported`);
  // Mix to mono floats.
  const frames = data.length / 2 / fmt.channels;
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < fmt.channels; c++) sum += data.readInt16LE((i * fmt.channels + c) * 2);
    mono[i] = sum / fmt.channels / 32768;
  }
  return { rate: fmt.rate, samples: mono };
}

function writeWav(file, rate, samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
}

for (const [id, { file, max }] of Object.entries(SOUNDS)) {
  const { rate, samples } = readWav(path.join(src, file));
  // Skip leading silence, then cut to `max` seconds with a 150 ms fade-out.
  let start = 0;
  while (start < samples.length && Math.abs(samples[start]) < 0.003) start++;
  const clip = samples.slice(start, Math.min(samples.length, start + Math.round(max * rate)));
  const fade = Math.min(clip.length, Math.round(0.15 * rate));
  for (let i = 0; i < fade; i++) clip[clip.length - 1 - i] *= i / fade;
  let peak = 0;
  for (const v of clip) peak = Math.max(peak, Math.abs(v));
  const gain = peak > 0 ? 0.89 / peak : 1; // normalize to -1 dBFS
  for (let i = 0; i < clip.length; i++) clip[i] *= gain;
  writeWav(path.join(out, `${id}.wav`), rate, clip);
  console.log(`${id}.wav  <- ${file}  ${(clip.length / rate).toFixed(2)}s  ${Math.round(fs.statSync(path.join(out, `${id}.wav`)).size / 1024)} KB`);
}

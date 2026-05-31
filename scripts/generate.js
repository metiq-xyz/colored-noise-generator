import wf from "wavefile";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "..", "output", "colored");
mkdirSync(OUT_DIR, { recursive: true });

const SAMPLE_RATE = 48000;
const DURATION_SEC = 30;
const CROSSFADE_SEC = 0.5;
const N = SAMPLE_RATE * DURATION_SEC;
const XF = Math.floor(SAMPLE_RATE * CROSSFADE_SEC);
const VARIANTS = [
    { name: "White", gen: genWhite },
    { name: "Pink", gen: genPink },
    { name: "Brown", gen: genBrown },
    { name: "Grey", gen: genGrey },
];

function whiteSample() {
    const u1 = Math.max(Math.random(), 1e-12);
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function genWhite(n) {
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = whiteSample();
    return out;
}

function genPink(n) {
    const OCTAVES = 16;
    const gens = new Float64Array(OCTAVES);
    for (let i = 0; i < OCTAVES; i++) gens[i] = whiteSample();
    const out = new Float32Array(n);
    let runningSum = gens.reduce((a, b) => a + b, 0);
    for (let i = 0; i < n; i++) {
        let idx = 0;
        let v = i;
        while ((v & 1) === 0 && idx < OCTAVES - 1) {
            v >>= 1;
            idx++;
        }
        const newVal = whiteSample();
        runningSum += newVal - gens[idx];
        gens[idx] = newVal;
        out[i] = runningSum / OCTAVES;
    }
    return out;
}

function genBrown(n) {
    const out = new Float32Array(n);
    let acc = 0;
    const leak = 0.998;
    for (let i = 0; i < n; i++) {
        acc = leak * acc + whiteSample() * 0.1;
        out[i] = acc;
    }
    return out;
}

function genGrey(n) {
    const pink = genPink(n);
    const out = new Float32Array(n);
    const alpha = 0.6;
    let prev = 0;
    for (let i = 0; i < n; i++) {
        out[i] = pink[i] + alpha * (pink[i] - prev);
        prev = pink[i];
    }
    return out;
}

function normalize(buf, peak = 0.9) {
    let max = 0;
    for (let i = 0; i < buf.length; i++) {
        const a = Math.abs(buf[i]);
        if (a > max) max = a;
    }
    if (max === 0) return buf;
    const g = peak / max;
    for (let i = 0; i < buf.length; i++) buf[i] *= g;
    return buf;
}

function makeSeamless(buf, n, xf) {
    const out = new Float32Array(n);
    for (let i = xf; i < n; i++) out[i] = buf[i];
    for (let i = 0; i < xf; i++) {
        const t = i / xf;
        const a = Math.cos((1 - t) * 0.5 * Math.PI);
        const b = Math.cos(t * 0.5 * Math.PI);
        out[i] = buf[i] * a + buf[n + i] * b;
    }
    return out;
}

function toInt16(buf) {
    const i16 = new Int16Array(buf.length);
    for (let i = 0; i < buf.length; i++) {
        const v = Math.max(-1, Math.min(1, buf[i]));
        i16[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    return i16;
}

function writeWav(name, samples) {
    const wav = new wf.WaveFile();
    wav.fromScratch(1, SAMPLE_RATE, "16", samples);
    const outPath = resolve(OUT_DIR, `${name.toLowerCase()}.wav`);
    writeFileSync(outPath, wav.toBuffer());
    return outPath;
}

console.log(
    `Generating ${VARIANTS.length} colored noise loops @ ${SAMPLE_RATE}Hz, ${DURATION_SEC}s each, ${CROSSFADE_SEC}s seamless crossfade.`,
);

for (const { name, gen } of VARIANTS) {
    const raw = gen(N + XF);
    const seamless = makeSeamless(raw, N, XF);
    normalize(seamless, 0.5);
    const samples = toInt16(seamless);
    const outPath = writeWav(name, samples);
    console.log(
        `- ${name}: wrote ${outPath}  (${(samples.length / SAMPLE_RATE).toFixed(1)}s)`,
    );
}

console.log("Done. Encode to OGG with: npm run encode");

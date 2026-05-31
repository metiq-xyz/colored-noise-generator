import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync, renameSync, unlinkSync, existsSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(__dirname, "..", "output", "colored");

const TARGET_LUFS = -22;
const TARGET_PEAK_DBFS = -1.5;

function measure(inputPath) {
    const r = spawnSync(
        "ffmpeg",
        [
            "-nostats",
            "-hide_banner",
            "-i",
            inputPath,
            "-af",
            "ebur128=peak=true",
            "-f",
            "null",
            "-",
        ],
        { encoding: "utf-8" },
    );
    if (r.status !== 0) {
        throw new Error(
            `ffmpeg exited ${r.status} for ${inputPath}:\n${r.stderr ?? ""}`,
        );
    }
    const stderr = r.stderr ?? "";
    const integratedMatches = [
        ...stderr.matchAll(/I:\s+(-?\d+(?:\.\d+)?)\s+LUFS/g),
    ];
    const peakMatches = [
        ...stderr.matchAll(/Peak:\s+(-?\d+(?:\.\d+)?)\s+dBFS/g),
    ];
    if (integratedMatches.length === 0 || peakMatches.length === 0) {
        throw new Error(
            `Could not parse ebur128 output for ${inputPath}:\n${stderr}`,
        );
    }
    const lufs = parseFloat(integratedMatches[integratedMatches.length - 1][1]);
    const peak = parseFloat(peakMatches[peakMatches.length - 1][1]);
    return { lufs, peak };
}

function applyGain(inputPath, gainDb) {
    const tmpPath = `${inputPath}.tmp.wav`;
    execFileSync(
        "ffmpeg",
        [
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            inputPath,
            "-af",
            `volume=${gainDb.toFixed(3)}dB`,
            tmpPath,
        ],
        { stdio: "inherit" },
    );
    unlinkSync(inputPath);
    renameSync(tmpPath, inputPath);
}

function normalize(inputPath) {
    const name = basename(inputPath);
    const { lufs, peak } = measure(inputPath);
    const lufsGap = TARGET_LUFS - lufs;
    const peakHeadroom = TARGET_PEAK_DBFS - peak;
    const gainDb = Math.min(lufsGap, peakHeadroom);
    const limitedByPeak = peakHeadroom < lufsGap;

    if (Math.abs(gainDb) < 0.05) {
        console.log(
            `  ${name}: already at target (${lufs.toFixed(2)} LUFS, peak ${peak.toFixed(2)} dBFS)`,
        );
        return;
    }
    applyGain(inputPath, gainDb);
    const post = measure(inputPath);
    const limitedNote = limitedByPeak
        ? ` [peak-capped, fell ${(TARGET_LUFS - post.lufs).toFixed(2)} LU short of target]`
        : "";
    console.log(
        `  ${name}: ${lufs.toFixed(2)} LUFS / ${peak.toFixed(2)} dBFS → ${post.lufs.toFixed(2)} LUFS / ${post.peak.toFixed(2)} dBFS (applied ${gainDb >= 0 ? "+" : ""}${gainDb.toFixed(2)} dB)${limitedNote}`,
    );
}

if (!existsSync(DIR)) {
    console.error(`No input dir ${DIR}. Run 'pnpm run generate' first.`);
    process.exit(1);
}

console.log(
    `Loudness-normalizing to ${TARGET_LUFS} LUFS (true-peak cap ${TARGET_PEAK_DBFS} dBFS).`,
);

const inputs = readdirSync(DIR).filter((f) => f.endsWith(".wav"));
if (inputs.length === 0) {
    console.error("No WAV files found. Run 'pnpm run generate' first.");
    process.exit(1);
}

for (const f of inputs) {
    normalize(resolve(DIR, f));
}

console.log("Normalization done. Encode with: pnpm run encode");

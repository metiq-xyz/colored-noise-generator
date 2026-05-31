import { execFileSync } from "node:child_process";
import { readdirSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const IN_DIR = resolve(__dirname, "..", "output", "colored");
const OUT_BASE = resolve(__dirname, "..", "output");

if (!existsSync(IN_DIR)) {
    console.error(`No input dir ${IN_DIR}. Run 'npm run generate' first.`);
    process.exit(1);
}

const targets = [
    {
        platform: "android",
        ext: "ogg",
        args: ["-c:a", "libvorbis", "-qscale:a", "5"],
    },
    { platform: "ios", ext: "m4a", args: ["-c:a", "aac", "-b:a", "128k"] },
    { platform: "web", ext: "ogg", args: ["-c:a", "libopus", "-b:a", "96k"] },
];

const inputs = readdirSync(IN_DIR).filter((f) => f.endsWith(".wav"));
if (inputs.length === 0) {
    console.error("No WAV files found. Run 'npm run generate' first.");
    process.exit(1);
}

for (const t of targets) {
    const outDir = resolve(OUT_BASE, t.platform);
    mkdirSync(outDir, { recursive: true });
    for (const f of inputs) {
        const name = basename(f, ".wav");
        const inPath = resolve(IN_DIR, f);
        const outPath = resolve(outDir, `${name}.${t.ext}`);
        console.log(`[${t.platform}] ${name} -> ${outPath}`);
        execFileSync("ffmpeg", ["-y", "-i", inPath, ...t.args, outPath], {
            stdio: "inherit",
        });
    }
}

console.log("Encoding done.");

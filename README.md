# Metiq colored noise generator

Pre-rendered colored noise loops for [Metiq](https://github.com/metiq), plus the
LUFS-normalize and per-platform encode pipeline that produces them.

This repo synthesizes seamless 30s mono loops of white, pink, brown and grey
noise, normalizes each one to a common perceived loudness, and re-encodes the
masters into the codec each Metiq client app prefers. The encoded artifacts are
published as GitHub Release assets (see [Releases](#releases)) — downstream apps
(currently the Metiq Android app) pull them at build time, so the heavy DSP and
ffmpeg toolchain stays out of every client repo.

## Audio spec

| Property           | Value                                                    |
| ------------------ | -------------------------------------------------------- |
| Sample rate        | 48 kHz                                                   |
| Channels           | Mono                                                     |
| Bit depth (master) | 16-bit PCM                                               |
| Duration           | 30 s with 0.5 s seamless crossfade between tail and head |
| Loudness target    | -22 LUFS integrated (EBU R128, K-weighted)               |
| True-peak cap      | -1.5 dBFS                                                |
| Colors (v1)        | white, pink, brown, grey                                 |

### Why -22 LUFS

Each color has a very different ratio of true-peak to integrated loudness —
brown is mostly low-frequency energy that K-weighting attenuates, so a
low-amplitude brown sample is perceptually much quieter than the same-amplitude
white sample. Peak normalization makes white sound piercingly loud relative to
brown; loudness normalization to a common LUFS target makes them feel equal
under playback.

-22 LUFS is the loudest level brown can reach without exceeding the true-peak
cap at the current generator peak (0.5). Push higher and brown gets peak-capped
short of the others, breaking equal-loudness.

The equalization is baked into the asset, so client apps can play every color at
unity gain.

## Run locally

Requirements: Node.js 22+, [pnpm](https://pnpm.io/), `ffmpeg` on `PATH` (with
libvorbis, libopus and AAC support).

```bash
pnpm install
pnpm run build      # generate -> normalize -> encode
```

Encoded files land in:

```
output/
├── colored/   # WAV masters (peak-normalized to 0.5 then LUFS-normalized in place)
├── android/   # OGG/Vorbis  (q5, gapless-friendly)
├── ios/       # AAC/M4A     (AAC-LC, gapless via mp4 priming)
└── web/       # OGG/Opus    (lower bitrate)
```

## Scripts

| Command                             | What it does                                                                                                                                                                                                                                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run generate`                 | Synthesizes each color into `output/colored/<name>.wav`. White is flat-spectrum, pink is Voss-McCartney (-3 dB/oct), brown is leaky-integrated white (-6 dB/oct), grey is pink shaped by the inverse equal-loudness contour. Peak-normalized to 0.5. Seamless loop via a 0.5 s tail/head crossfade. |
| `pnpm run normalize`                | In-place EBU R128 loudness pass over `output/colored/<name>.wav`. Targets -22 LUFS integrated, -1.5 dBFS true-peak. Uses ffmpeg's `loudnorm` (two-pass: measure, then apply).                                                                                                                       |
| `pnpm run encode`                   | Re-encodes each WAV master into `output/{android,ios,web}/<name>.<ext>` using ffmpeg.                                                                                                                                                                                                               |
| `pnpm run build`                    | `generate` → `normalize` → `encode`.                                                                                                                                                                                                                                                                |
| `pnpm run lint` / `pnpm run format` | ESLint check / autofix.                                                                                                                                                                                                                                                                             |

## Releases

Tagged releases on this repo (any `v*` tag, e.g. `v0.1.0`) trigger the
[release workflow](.github/workflows/release.yml), which runs the full
`pnpm run build` pipeline on a clean Ubuntu runner and attaches every file under
`output/android/`, `output/ios/` and `output/web/` to a draft GitHub Release
named after the tag.

Releases are published as drafts so they can be reviewed before going public.
Downstream apps (currently the Metiq Android app) fetch the encoded files from a
chosen release tag at build time — they never re-run the generator pipeline
themselves.

To cut a release:

```bash
git tag v0.1.0
git push origin v0.1.0
# wait for the workflow, then publish the draft release from the GitHub UI
```

The workflow can also be triggered manually via `workflow_dispatch`.

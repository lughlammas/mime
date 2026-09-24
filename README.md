# MIME

FFT Mime-style chess line trainer. **Show → Mime.** Wrong move: red flash + hard reset to ply 0 (no hint). Offline, no backend, no engine.

## Run

```bash
npm install
npm run build:maps   # validate seed maps + stamp validated_at
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`).

## Build

```bash
npm run build
npm run preview
```

## Maps

Static JSON under `public/maps/`:

- `public/maps/index.json` — library listing
- `public/maps/canon/*.json` — Line files (`side_to_learn`, `start_fen`, `moves_uci`, …)

`npm run build:maps` walks canon maps, checks each UCI is legal from `start_fen` via chess.js, stamps `validated_at`, refreshes `index.json`.

## Loop (locked)

1. **SHOW** — opponent plies auto-play with a short pause; learner plies are demonstrated then undone.
2. **MIME** — board accepts only the expected UCI (compared via chess.js).
3. **FAIL** — red flash, reset to ply 0, rebuild from `start_fen`. Correct move is never revealed.
4. **COMPLETE** — line finished; retry or back to library.

Black learner: White’s first UCI auto-plays on Show from the standard start FEN. Orientation follows `side_to_learn`.

## Test / CI (v0.2)

```bash
npm ci
npm run build:maps
npm test
npm run build
```

Golden fixtures: `fixtures/golden/`. Canon source: `maps/canon-src/`. Export Android: `MIME_ANDROID_ROOT=../mime-android npm run export:android`.

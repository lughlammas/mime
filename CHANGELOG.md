# Changelog

## [0.2.0] — 2026-09-24

### Added
- Injectable clock / VirtualClock for MimeLoop; exported timing constants
- Golden fixture suite G01–G13 + vitest harness (parity contract)
- Canon maps source `maps/canon-src/` + `build:maps` validation (empty/illegal UCI fail)
- `scripts/export-maps-android.mjs` bridge to Android assets
- M01–M04 map tests; CI workflow (npm ci, build:maps, test, build)
- MIT LICENSE

### Changed
- SemVer → 0.2.0
- Auto-queen on back-rank pawn tries without explicit promo char (Android parity G10)

## [0.1.0] — 2026-09-21

### Added
- Initial MIME web PWA (Vite + TS + Chessground + chess.js)

#!/usr/bin/env node
/**
 * Validate Line maps from maps/canon-src (human-edited source).
 * Writes stamped JSON to public/maps/canon/ and rewrites index.json.
 * Empty moves_uci or illegal UCI → exit ≠ 0 (G12 / M04).
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const srcDir = join(root, 'maps', 'canon-src');
const mapsRoot = join(root, 'public', 'maps');
const canonDir = join(mapsRoot, 'canon');
const indexPath = join(mapsRoot, 'index.json');

const START =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function parseUci(uci) {
  if (typeof uci !== 'string' || uci.length < 4) {
    throw new Error(`bad UCI: ${uci}`);
  }
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length >= 5 ? uci.slice(4, 5) : undefined,
  };
}

function validateLine(raw, label) {
  const fen = raw.start_fen || START;
  const chess = new Chess(fen);
  const moves = raw.moves_uci;
  if (!Array.isArray(moves) || moves.length === 0) {
    throw new Error(`${raw.id || label}: moves_uci empty`);
  }
  if (raw.side_to_learn !== 'white' && raw.side_to_learn !== 'black') {
    throw new Error(`${raw.id || label}: side_to_learn must be white|black`);
  }
  for (let i = 0; i < moves.length; i++) {
    const uci = moves[i];
    const parts = parseUci(uci);
    let result;
    try {
      result = chess.move(parts);
    } catch {
      result = null;
    }
    if (!result) {
      throw new Error(
        `${raw.id || label}: illegal UCI at ply ${i}: ${uci} (fen: ${chess.fen()})`,
      );
    }
  }
  return {
    ...raw,
    length: moves.length,
    validated_at: new Date().toISOString(),
  };
}

function main() {
  if (!existsSync(srcDir)) {
    console.error('missing canon source', srcDir);
    process.exit(1);
  }
  const files = readdirSync(srcDir).filter((f) => f.endsWith('.json'));
  if (files.length === 0) {
    console.error('no canon-src maps');
    process.exit(1);
  }

  mkdirSync(canonDir, { recursive: true });
  // Remove stale outputs not present in source
  for (const f of readdirSync(canonDir).filter((x) => x.endsWith('.json'))) {
    if (!files.includes(f)) {
      rmSync(join(canonDir, f));
    }
  }

  const entries = [];
  for (const file of files) {
    const srcPath = join(srcDir, file);
    const raw = JSON.parse(readFileSync(srcPath, 'utf8'));
    const line = validateLine(raw, file);
    const outPath = join(canonDir, file);
    writeFileSync(outPath, JSON.stringify(line, null, 2) + '\n');
    console.log(`ok  ${line.id}  (${line.length} plies, ${line.side_to_learn})`);
    entries.push({
      id: line.id,
      name: line.name,
      path: `/maps/canon/${file}`,
      side_to_learn: line.side_to_learn,
      length: line.length,
    });
  }
  entries.sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(indexPath, JSON.stringify({ maps: entries }, null, 2) + '\n');
  console.log(`index → ${entries.length} maps`);
}

main();

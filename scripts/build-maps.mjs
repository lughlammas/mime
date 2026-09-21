#!/usr/bin/env node
/**
 * Validate Line maps: each UCI must be legal from start_fen via chess.js.
 * Stamps validated_at on success. Rewrites index.json lengths.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
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

function validateLine(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const fen = raw.start_fen || START;
  const chess = new Chess(fen);
  const moves = raw.moves_uci;
  if (!Array.isArray(moves) || moves.length === 0) {
    throw new Error(`${raw.id}: moves_uci empty`);
  }
  if (raw.side_to_learn !== 'white' && raw.side_to_learn !== 'black') {
    throw new Error(`${raw.id}: side_to_learn must be white|black`);
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
        `${raw.id}: illegal UCI at ply ${i}: ${uci} (fen: ${chess.fen()})`,
      );
    }
  }
  const stamped = {
    ...raw,
    length: moves.length,
    validated_at: new Date().toISOString(),
  };
  writeFileSync(path, JSON.stringify(stamped, null, 2) + '\n');
  return stamped;
}

function main() {
  if (!existsSync(canonDir)) {
    console.error('missing', canonDir);
    process.exit(1);
  }
  const files = readdirSync(canonDir).filter((f) => f.endsWith('.json'));
  if (files.length === 0) {
    console.error('no canon maps');
    process.exit(1);
  }
  const entries = [];
  for (const file of files) {
    const path = join(canonDir, file);
    const line = validateLine(path);
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
  writeFileSync(
    indexPath,
    JSON.stringify({ maps: entries }, null, 2) + '\n',
  );
  console.log(`index → ${entries.length} maps`);
}

main();

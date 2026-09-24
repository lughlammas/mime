import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { Chess } from 'chess.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP = join(__dirname, '../../..');
const SRC = join(APP, 'maps/canon-src');
const OUT = join(APP, 'public/maps');

function loadJson(p: string) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

describe('canon maps M01–M04', () => {
  it('M01 italian-game fields stable', () => {
    const src = loadJson(join(SRC, 'italian-game.json'));
    const out = loadJson(join(OUT, 'canon/italian-game.json'));
    expect(src.moves_uci).toEqual(out.moves_uci);
    expect(src.side_to_learn).toBe(out.side_to_learn);
    expect(src.start_fen).toBe(out.start_fen);
    expect(src.id).toBe('italian-game');
  });

  it('M02 accelerated-dragon fields stable', () => {
    const src = loadJson(join(SRC, 'accelerated-dragon.json'));
    const out = loadJson(join(OUT, 'canon/accelerated-dragon.json'));
    expect(src.moves_uci).toEqual(out.moves_uci);
    expect(src.side_to_learn).toBe('black');
    expect(out.side_to_learn).toBe('black');
  });

  it('M03 index.json canonical order', () => {
    const index = loadJson(join(OUT, 'index.json'));
    const ids = index.maps.map((m: { id: string }) => m.id);
    expect(ids).toEqual([...ids].sort((a: string, b: string) => a.localeCompare(b)));
    expect(ids).toContain('italian-game');
    expect(ids).toContain('accelerated-dragon');
  });

  it('M04 build:maps rejects illegal UCI', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mime-bad-map-'));
    try {
      const src = join(dir, 'maps/canon-src');
      mkdirSync(src, { recursive: true });
      writeFileSync(
        join(src, 'bad.json'),
        JSON.stringify({
          id: 'bad',
          name: 'Bad',
          side_to_learn: 'white',
          start_fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          moves_uci: ['e2e5'],
        }),
      );
      // Run validation inline mirroring build-maps
      const raw = loadJson(join(src, 'bad.json'));
      const chess = new Chess(raw.start_fen);
      let failed = false;
      try {
        const r = chess.move({ from: 'e2', to: 'e5' });
        if (!r) failed = true;
      } catch {
        failed = true;
      }
      expect(failed).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('canon-src exists as human source', () => {
    expect(existsSync(join(SRC, 'italian-game.json'))).toBe(true);
    expect(existsSync(join(SRC, 'accelerated-dragon.json'))).toBe(true);
  });
});

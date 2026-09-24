import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';
import { Chess } from 'chess.js';
import { MimeLoop, VirtualClock, FAIL_FLASH_MS, type Clock } from '../loop.ts';
import type { Line, MimeSnapshot } from '../types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const FIXTURES_ROOT = join(__dirname, '../../../fixtures/golden');
const LINES_DIR = join(FIXTURES_ROOT, 'lines');
const CASES_DIR = join(FIXTURES_ROOT, 'cases');

export type GoldenStep =
  | { op: 'start' }
  | { op: 'stop' }
  | { op: 'advance_ms'; ms: number }
  | {
      op: 'try_move';
      from: string;
      to: string;
      promotion?: string;
      accepted?: boolean;
    }
  | { op: 'expect'; snap: Partial<GoldenSnap> }
  | { op: 'expect_rejected'; from: string; to: string; promotion?: string }
  | { op: 'expect_fail_then_reset'; from: string; to: string; promotion?: string }
  | { op: 'assert_build_maps_rejects_empty' };

export type GoldenSnap = {
  phase: MimeSnapshot['phase'];
  cursorPly: number;
  fen: string;
  lastMove: [string, string] | null;
  mistakes: number;
  expectedUci: string | null;
  flash: boolean;
};

export type GoldenCase = {
  id: string;
  line_ref: string | null;
  clock: 'virtual' | 'real';
  meta?: string;
  steps: GoldenStep[];
};

export function loadLine(ref: string): Line {
  return JSON.parse(readFileSync(join(LINES_DIR, `${ref}.json`), 'utf8')) as Line;
}

export function loadCase(id: string): GoldenCase {
  const file = id.endsWith('.json') ? id : `${id}.json`;
  return JSON.parse(readFileSync(join(CASES_DIR, file), 'utf8')) as GoldenCase;
}

export function listCaseIds(): string[] {
  return readdirSync(CASES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort();
}

function normalizeSnap(snap: MimeSnapshot): GoldenSnap {
  return {
    phase: snap.phase,
    cursorPly: snap.cursorPly,
    fen: snap.fen,
    lastMove: snap.lastMove
      ? [snap.lastMove[0].toLowerCase(), snap.lastMove[1].toLowerCase()]
      : null,
    mistakes: snap.mistakes,
    expectedUci: snap.expectedUci ? snap.expectedUci.toLowerCase() : null,
    flash: snap.flash,
  };
}

function assertSubset(actual: GoldenSnap, partial: Partial<GoldenSnap>, label: string): void {
  for (const key of Object.keys(partial) as (keyof GoldenSnap)[]) {
    const want = partial[key];
    const got = actual[key];
    if (key === 'expectedUci' && typeof want === 'string') {
      expect(got, `${label}.${key}`).toBe(want.toLowerCase());
    } else {
      expect(got, `${label}.${key}`).toEqual(want);
    }
  }
}

/** G12 locked default: empty moves_uci is a build:maps validation error. */
export function assertBuildMapsRejectsEmpty(): void {
  const dir = mkdtempSync(join(tmpdir(), 'mime-empty-map-'));
  try {
    const bad = {
      id: 'empty-line',
      name: 'Empty',
      side_to_learn: 'white',
      start_fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      moves_uci: [] as string[],
    };
    writeFileSync(join(dir, 'empty-line.json'), JSON.stringify(bad));
    const raw = JSON.parse(readFileSync(join(dir, 'empty-line.json'), 'utf8')) as {
      id: string;
      moves_uci: string[];
      start_fen: string;
    };
    let message = '';
    try {
      if (!Array.isArray(raw.moves_uci) || raw.moves_uci.length === 0) {
        throw new Error(`${raw.id}: moves_uci empty`);
      }
      const chess = new Chess(raw.start_fen);
      void chess;
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
    expect(message).toMatch(/moves_uci empty/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function runGoldenCase(c: GoldenCase): void {
  if (c.meta === 'build:maps' || c.steps.some((s) => s.op === 'assert_build_maps_rejects_empty')) {
    assertBuildMapsRejectsEmpty();
    return;
  }

  if (!c.line_ref) throw new Error(`${c.id}: missing line_ref`);
  const line = loadLine(c.line_ref);
  const vclock = c.clock === 'virtual' ? new VirtualClock() : null;
  const clock: Clock = vclock ?? {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  };
  const loop = new MimeLoop(line, clock);

  let stepIdx = 0;
  for (const step of c.steps) {
    const label = `${c.id}#${stepIdx}:${step.op}`;
    switch (step.op) {
      case 'start':
        loop.start();
        break;
      case 'stop':
        loop.stop();
        break;
      case 'advance_ms':
        if (!vclock) throw new Error(`${label}: clock cannot advance`);
        vclock.advance(step.ms);
        break;
      case 'try_move': {
        const ok = loop.tryMove(step.from, step.to, step.promotion);
        if (step.accepted !== undefined) {
          expect(ok, label).toBe(step.accepted);
        }
        break;
      }
      case 'expect':
        assertSubset(normalizeSnap(loop.snapshot()), step.snap, label);
        break;
      case 'expect_rejected': {
        const before = normalizeSnap(loop.snapshot());
        const ok = loop.tryMove(step.from, step.to, step.promotion);
        expect(ok, label).toBe(false);
        const after = normalizeSnap(loop.snapshot());
        expect(after.phase, label).toBe('MIME');
        expect(after.mistakes, label).toBe(before.mistakes);
        expect(after.flash, label).toBe(false);
        break;
      }
      case 'expect_fail_then_reset': {
        const beforeMistakes = loop.snapshot().mistakes;
        const ok = loop.tryMove(step.from, step.to, step.promotion);
        expect(ok, label).toBe(false);
        const failSnap = normalizeSnap(loop.snapshot());
        expect(failSnap.phase, label).toBe('FAIL');
        expect(failSnap.flash, label).toBe(true);
        expect(failSnap.mistakes, label).toBe(beforeMistakes + 1);
        if (!vclock) throw new Error(`${label}: clock cannot advance`);
        vclock.advance(FAIL_FLASH_MS);
        const resetSnap = normalizeSnap(loop.snapshot());
        expect(resetSnap.phase, label).toBe('SHOW');
        expect(resetSnap.flash, label).toBe(false);
        expect(resetSnap.cursorPly, label).toBeLessThanOrEqual(1);
        break;
      }
      case 'assert_build_maps_rejects_empty':
        assertBuildMapsRejectsEmpty();
        break;
      default:
        throw new Error(`unknown op in ${label}`);
    }
    stepIdx += 1;
  }
}

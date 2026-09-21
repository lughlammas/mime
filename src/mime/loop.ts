import { Chess } from 'chess.js';
import type { Line, MimeSnapshot, Phase, Side } from './types.ts';
import { parseUci, toUci } from './uci.ts';

export type LoopListener = (snap: MimeSnapshot) => void;

const SHOW_PAUSE_MS = 700;
const DEMO_HOLD_MS = 900;
const FAIL_FLASH_MS = 550;

/**
 * MIME session state machine.
 * SHOW → (opponent auto | learner demo+undo) → MIME → correct advances / wrong FAIL→ply0
 */
export class MimeLoop {
  readonly line: Line;
  private chess: Chess;
  private phase: Phase = 'SHOW';
  private cursorPly = 0;
  private mistakes = 0;
  private lastMove: [string, string] | null = null;
  private flash = false;
  private listeners = new Set<LoopListener>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(line: Line) {
    this.line = line;
    this.chess = new Chess(line.start_fen);
  }

  get side(): Side {
    return this.line.side_to_learn;
  }

  subscribe(fn: LoopListener): () => void {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => {
      this.listeners.delete(fn);
    };
  }

  start(): void {
    this.resetBoard(0);
    this.phase = 'SHOW';
    this.emit();
    this.runShow();
  }

  stop(): void {
    this.stopped = true;
    this.clearTimer();
  }

  /** User attempt during MIME. Returns true if accepted. */
  tryMove(from: string, to: string, promotion?: string): boolean {
    if (this.phase !== 'MIME' || this.stopped) return false;

    const expected = this.line.moves_uci[this.cursorPly];
    if (!expected) return false;

    const probe = new Chess(this.chess.fen());
    let played;
    try {
      played = probe.move({
        from,
        to,
        promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined,
      });
    } catch {
      played = null;
    }
    if (!played) return false;

    const got = toUci(played.from, played.to, played.promotion);
    if (got !== expected) {
      this.onFail();
      return false;
    }

    this.chess.move({
      from,
      to,
      promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined,
    });
    this.lastMove = [from, to];
    this.cursorPly += 1;

    if (this.cursorPly >= this.line.moves_uci.length) {
      this.phase = 'COMPLETE';
      this.emit();
      return true;
    }

    this.phase = 'SHOW';
    this.emit();
    this.runShow();
    return true;
  }

  snapshot(): MimeSnapshot {
    const expected =
      this.phase === 'MIME' || this.phase === 'SHOW'
        ? (this.line.moves_uci[this.cursorPly] ?? null)
        : null;
    return {
      phase: this.phase,
      cursorPly: this.cursorPly,
      fen: this.chess.fen(),
      lastMove: this.lastMove,
      mistakes: this.mistakes,
      expectedUci: expected,
      flash: this.flash,
    };
  }

  private isLearnerPly(ply: number): boolean {
    const c = new Chess(this.line.start_fen);
    for (let i = 0; i < ply; i++) {
      const u = this.line.moves_uci[i];
      if (!u) break;
      c.move(parseUci(u));
    }
    const turn: Side = c.turn() === 'w' ? 'white' : 'black';
    return turn === this.line.side_to_learn;
  }

  private runShow(): void {
    if (this.stopped || this.phase !== 'SHOW') return;
    const ply = this.cursorPly;
    const uci = this.line.moves_uci[ply];
    if (!uci) {
      this.phase = 'COMPLETE';
      this.emit();
      return;
    }

    if (this.isLearnerPly(ply)) {
      this.applyUci(uci);
      this.emit();
      this.schedule(DEMO_HOLD_MS, () => {
        if (this.stopped) return;
        this.undoLast();
        this.phase = 'MIME';
        this.emit();
      });
    } else {
      this.applyUci(uci);
      this.cursorPly += 1;
      this.emit();
      this.schedule(SHOW_PAUSE_MS, () => {
        if (this.stopped) return;
        if (this.cursorPly >= this.line.moves_uci.length) {
          this.phase = 'COMPLETE';
          this.emit();
          return;
        }
        this.phase = 'SHOW';
        this.emit();
        this.runShow();
      });
    }
  }

  private onFail(): void {
    this.mistakes += 1;
    this.phase = 'FAIL';
    this.flash = true;
    this.emit();
    this.schedule(FAIL_FLASH_MS, () => {
      if (this.stopped) return;
      this.flash = false;
      this.resetBoard(0);
      this.phase = 'SHOW';
      this.emit();
      this.runShow();
    });
  }

  private applyUci(uci: string): void {
    const parts = parseUci(uci);
    this.chess.move(parts);
    this.lastMove = [parts.from, parts.to];
  }

  private undoLast(): void {
    const m = this.chess.undo();
    if (m) {
      const hist = this.chess.history({ verbose: true });
      const prev = hist[hist.length - 1];
      this.lastMove = prev ? [prev.from, prev.to] : null;
    }
  }

  private resetBoard(ply: number): void {
    this.chess = new Chess(this.line.start_fen);
    this.cursorPly = 0;
    this.lastMove = null;
    for (let i = 0; i < ply; i++) {
      const u = this.line.moves_uci[i];
      if (!u) break;
      this.applyUci(u);
      this.cursorPly = i + 1;
    }
  }

  private schedule(ms: number, fn: () => void): void {
    this.clearTimer();
    this.timer = setTimeout(fn, ms);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const fn of this.listeners) fn(snap);
  }
}

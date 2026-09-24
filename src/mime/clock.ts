/** Injectable timer surface for MimeLoop (real or virtual). */
export interface Clock {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

export const realClock: Clock = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

/**
 * Deterministic clock for golden tests. `advance(ms)` fires due timers in order.
 */
export class VirtualClock implements Clock {
  private now = 0;
  private nextId = 1;
  private readonly timers = new Map<number, { due: number; fn: () => void }>();

  get time(): number {
    return this.now;
  }

  setTimeout(fn: () => void, ms: number): number {
    const id = this.nextId++;
    this.timers.set(id, { due: this.now + Math.max(0, ms), fn });
    return id;
  }

  clearTimeout(id: unknown): void {
    if (typeof id === 'number') this.timers.delete(id);
  }

  /** Advance virtual time by `ms`, running callbacks whose due ≤ now. */
  advance(ms: number): void {
    const target = this.now + Math.max(0, ms);
    // Fire in chronological order; newly scheduled timers during a callback
    // are eligible if their due ≤ target.
    for (;;) {
      let earliest: { id: number; due: number; fn: () => void } | null = null;
      for (const [id, t] of this.timers) {
        if (t.due <= target && (!earliest || t.due < earliest.due || (t.due === earliest.due && id < earliest.id))) {
          earliest = { id, due: t.due, fn: t.fn };
        }
      }
      if (!earliest) {
        this.now = target;
        return;
      }
      this.now = earliest.due;
      this.timers.delete(earliest.id);
      earliest.fn();
    }
  }
}

import type { UciParts } from './types.ts';

export function parseUci(uci: string): UciParts {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length >= 5 ? uci[4] : undefined,
  };
}

export function toUci(from: string, to: string, promotion?: string): string {
  return from + to + (promotion ?? '');
}

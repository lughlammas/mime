import { describe, it, expect } from 'vitest';
import { parseUci, toUci } from '../uci.ts';

describe('uci', () => {
  it('parses lowercase promo', () => {
    expect(parseUci('e7e8q')).toEqual({ from: 'e7', to: 'e8', promotion: 'q' });
  });
  it('parses quiet move', () => {
    expect(parseUci('e2e4')).toEqual({ from: 'e2', to: 'e4', promotion: undefined });
  });
  it('toUci joins', () => {
    expect(toUci('e7', 'e8', 'q')).toBe('e7e8q');
    expect(toUci('e2', 'e4')).toBe('e2e4');
  });
});

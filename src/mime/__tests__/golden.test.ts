import { describe, it } from 'vitest';
import { listCaseIds, loadCase, runGoldenCase } from './golden-harness.ts';

describe('MIME golden parity', () => {
  const ids = listCaseIds();
  for (const id of ids) {
    it(id, () => {
      runGoldenCase(loadCase(id));
    });
  }
});

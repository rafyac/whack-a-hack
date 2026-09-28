import { describe, expect, it } from 'vitest';
import { rankResults } from './ranking';

describe('competition ranks', () => {
  it('keeps equal totals tied, skips positions, and does not mutate input', () => {
    const rows = [{ id: 3, name: 'C', total: 1 }, { id: 1, name: 'A', total: 5 }, { id: 2, name: 'B', total: 5 }];
    expect(rankResults(rows).map(({ id, rank, tied }) => ({ id, rank, tied }))).toEqual([
      { id: 1, rank: 1, tied: true }, { id: 2, rank: 1, tied: true }, { id: 3, rank: 3, tied: false },
    ]);
    expect(rows[0].id).toBe(3);
  });
  it('does not invent a unique winner among zero-point teams', () => {
    expect(rankResults([{ id: 1, name: 'A', total: 0 }, { id: 2, name: 'B', total: 0 }])
      .every(row => row.rank === 1 && row.tied)).toBe(true);
    expect(rankResults([])).toEqual([]);
  });
});

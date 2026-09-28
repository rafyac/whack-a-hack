import type { ResultRow } from './api';

export function rankResults(rows: readonly ResultRow[]) {
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  let rank = 0;
  return sorted.map((row, index) => {
    if (index === 0 || sorted[index - 1].total !== row.total) rank = index + 1;
    const tied = sorted.some((other) => other.id !== row.id && other.total === row.total);
    return { ...row, rank, tied };
  });
}

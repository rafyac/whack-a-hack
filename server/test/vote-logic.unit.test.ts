import assert from 'node:assert/strict';
import test from 'node:test';
import { budgetForTeam, validateAllocations } from '../src/vote-logic.js';

test('budgetForTeam picks the correct budget by team kind', () => {
  const budgets = { pointsPerTeam: 5, judgePoints: 15 };

  assert.equal(budgetForTeam('team', budgets), 5);
  assert.equal(budgetForTeam('judge', budgets), 15);
});

test('validateAllocations accepts valid same-session team allocations', () => {
  const error = validateAllocations({
    allocations: [
      { teamId: 2, points: 3 },
      { teamId: 3, points: 2 },
    ],
    voterTeamId: 1,
    validTargets: new Map([
      [1, 'team'],
      [2, 'team'],
      [3, 'team'],
      [4, 'judge'],
    ]),
    budget: 5,
  });

  assert.equal(error, null);
});

test('validateAllocations rejects duplicate, self, invalid-target, and budget errors', async (t) => {
  const validTargets = new Map([
    [1, 'team'],
    [2, 'team'],
    [3, 'judge'],
  ] as const);

  await t.test('duplicate target ids', () => {
    assert.equal(
      validateAllocations({
        allocations: [
          { teamId: 2, points: 2 },
          { teamId: 2, points: 3 },
        ],
        voterTeamId: 1,
        validTargets,
        budget: 5,
      }),
      'duplicate teamId in allocations'
    );
  });

  await t.test('self allocation', () => {
    assert.equal(
      validateAllocations({
        allocations: [{ teamId: 1, points: 5 }],
        voterTeamId: 1,
        validTargets,
        budget: 5,
      }),
      'cannot allocate points to your own team'
    );
  });

  await t.test('unknown team ids', () => {
    assert.equal(
      validateAllocations({
        allocations: [{ teamId: 99, points: 5 }],
        voterTeamId: 1,
        validTargets,
        budget: 5,
      }),
      'unknown teamId 99 for this session'
    );
  });

  await t.test('commissioner targets', () => {
    assert.equal(
      validateAllocations({
        allocations: [{ teamId: 3, points: 5 }],
        voterTeamId: 1,
        validTargets,
        budget: 5,
      }),
      'cannot allocate points to a commissioner'
    );
  });

  await t.test('budget mismatches', () => {
    assert.equal(
      validateAllocations({
        allocations: [{ teamId: 2, points: 4 }],
        voterTeamId: 1,
        validTargets,
        budget: 5,
      }),
      'points must sum to 5 (got 4)'
    );
  });
});

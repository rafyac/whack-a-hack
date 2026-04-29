import type { TeamKind } from './db.js';

export interface Allocation {
  teamId: number;
  points: number;
}

function participantLabel(kind: TeamKind): string {
  return kind === 'judge' ? 'commissioner' : kind;
}

export function budgetForTeam(
  kind: TeamKind,
  budgets: { pointsPerTeam: number; judgePoints: number }
): number {
  return kind === 'judge' ? budgets.judgePoints : budgets.pointsPerTeam;
}

export function validateAllocations({
  allocations,
  voterTeamId,
  validTargets,
  budget,
}: {
  allocations: Allocation[];
  voterTeamId: number;
  validTargets: ReadonlyMap<number, TeamKind>;
  budget: number;
}): string | null {
  const seen = new Set<number>();
  for (const allocation of allocations) {
    if (seen.has(allocation.teamId)) {
      return 'duplicate teamId in allocations';
    }
    seen.add(allocation.teamId);

    if (allocation.teamId === voterTeamId) {
      return 'cannot allocate points to your own team';
    }

    const targetKind = validTargets.get(allocation.teamId);
    if (!targetKind) {
      return `unknown teamId ${allocation.teamId} for this session`;
    }
    if (targetKind !== 'team') {
      return `cannot allocate points to a ${participantLabel(targetKind)}`;
    }
  }

  const total = allocations.reduce((sum, allocation) => sum + allocation.points, 0);
  if (total !== budget) {
    return `points must sum to ${budget} (got ${total})`;
  }

  return null;
}

import { describe, expect, it } from 'vitest';
import type { Session } from './api';
import {
  getDefaultLoginSessionId,
  getLoginSessions,
  parseSessionId,
  resolveResultsSessionId,
} from './sessionSelection';

function makeSession(
  id: number,
  status: Session['status'],
  name = `Session ${id}`
): Session {
  return {
    id,
    name,
    status,
    pointsPerTeam: 5,
    judgePoints: 15,
  };
}

describe('getLoginSessions', () => {
  it('keeps only open sessions available for team login', () => {
    const sessions = [
      makeSession(1, 'setup'),
      makeSession(2, 'open'),
      makeSession(3, 'closed'),
      makeSession(4, 'open'),
    ];

    expect(getLoginSessions(sessions).map((session) => session.id)).toEqual([2, 4]);
  });
});

describe('getDefaultLoginSessionId', () => {
  it('auto-selects the only open session', () => {
    expect(getDefaultLoginSessionId([makeSession(7, 'open')])).toBe(7);
  });

  it('requires an explicit choice when multiple sessions are available', () => {
    expect(
      getDefaultLoginSessionId([makeSession(7, 'open'), makeSession(8, 'open')])
    ).toBeNull();
  });
});

describe('parseSessionId', () => {
  it('accepts positive integer query params', () => {
    expect(parseSessionId('42')).toBe(42);
  });

  it('rejects empty and invalid query params', () => {
    expect(parseSessionId(null)).toBeNull();
    expect(parseSessionId('')).toBeNull();
    expect(parseSessionId('NaN')).toBeNull();
    expect(parseSessionId('3.14')).toBeNull();
    expect(parseSessionId('-1')).toBeNull();
  });
});

describe('resolveResultsSessionId', () => {
  it('keeps a requested session when it still exists in the results list', () => {
    const sessions = [makeSession(3, 'closed'), makeSession(5, 'closed')];

    expect(resolveResultsSessionId(sessions, 5)).toBe(5);
  });

  it('falls back to the first available results session when the requested one is stale', () => {
    const sessions = [makeSession(3, 'closed'), makeSession(5, 'closed')];

    expect(resolveResultsSessionId(sessions, 999)).toBe(3);
  });

  it('returns null when there are no results sessions yet', () => {
    expect(resolveResultsSessionId([], 1)).toBeNull();
  });
});

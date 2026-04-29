import type { Session } from './api';

type SessionSummary = Pick<Session, 'id' | 'status'>;

export function getLoginSessions<T extends SessionSummary>(sessions: readonly T[]) {
  return sessions.filter((session) => session.status === 'open');
}

export function getDefaultLoginSessionId(
  sessions: readonly Pick<Session, 'id'>[]
): number | null {
  return sessions.length === 1 ? sessions[0].id : null;
}

export function parseSessionId(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function resolveResultsSessionId(
  sessions: readonly Pick<Session, 'id'>[],
  requestedId: number | null
): number | null {
  if (requestedId != null && sessions.some((session) => session.id === requestedId)) {
    return requestedId;
  }

  return sessions[0]?.id ?? null;
}

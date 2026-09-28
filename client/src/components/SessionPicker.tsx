import { Check } from 'lucide-react';
import type { Session, SessionStatus } from '../api';

type SessionOption = Pick<Session, 'id' | 'name' | 'status'>;
const statuses = {
  setup: { label: 'Setup', hint: 'Not live yet', tone: 'border-amber-800 text-amber-900 bg-amber-50' },
  open: { label: 'Open', hint: 'Voting live', tone: 'border-green-800 text-green-900 bg-green-50' },
  closed: { label: 'Closed', hint: 'Results ready', tone: 'border-blue-800 text-blue-900 bg-blue-50' },
};
export function SessionStatusPill({ status }: { status: SessionStatus }) {
  return <span className={`pill shrink-0 ${statuses[status].tone}`}>{statuses[status].label}</span>;
}
export function SessionPicker({ label, sessions, value, onChange, testId }: {
  label: string;
  sessions: readonly SessionOption[];
  value: number | null;
  onChange: (id: number) => void;
  testId?: string;
}) {
  return (
    <fieldset className="min-w-0 space-y-3" data-testid={testId}>
      <legend className="section-kicker mb-3">{label}</legend>
      <div className="border border-ink/40">
        {sessions.map((session, index) => (
          <button key={session.id} type="button" className="session-option"
            aria-pressed={session.id === value}
            data-testid={testId ? `${testId}-option-${session.id}` : undefined}
            onClick={() => onChange(session.id)}>
            <span className="grid h-9 w-9 shrink-0 place-items-center border border-ink/40 font-mono text-sm text-cobalt" aria-hidden="true">
              {session.id === value ? <Check className="h-5 w-5" /> : String(index + 1).padStart(2, '0')}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block break-words font-semibold">{session.name}</span>
              <span className="text-xs text-muted">{statuses[session.status].hint}</span>
            </span>
            <SessionStatusPill status={session.status} />
          </button>
        ))}
      </div>
    </fieldset>
  );
}

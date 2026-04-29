import { Check, Sparkles } from 'lucide-react';
import type { Session, SessionStatus } from '../api';

type SessionOption = Pick<Session, 'id' | 'name' | 'status'>;

function statusLabel(status: SessionStatus) {
  switch (status) {
    case 'setup':
      return 'Setup';
    case 'open':
      return 'Open';
    case 'closed':
      return 'Closed';
  }
}

function statusHint(status: SessionStatus) {
  switch (status) {
    case 'setup':
      return 'Not live yet';
    case 'open':
      return 'Voting live';
    case 'closed':
      return 'Results ready';
  }
}

export function SessionStatusPill({
  status,
  selected = false,
}: {
  status: SessionStatus;
  selected?: boolean;
}) {
  const tone = selected
    ? 'border-slate-300 bg-slate-100 text-slate-700'
    : status === 'open'
    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
    : status === 'closed'
    ? 'border-sky-400/30 bg-sky-400/10 text-sky-200'
    : 'border-amber-300/30 bg-amber-300/10 text-amber-200';

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${tone}`}
    >
      {statusLabel(status)}
    </span>
  );
}

export function SessionPicker({
  label,
  sessions,
  value,
  onChange,
  testId,
}: {
  label: string;
  sessions: readonly SessionOption[];
  value: number | null;
  onChange: (id: number) => void;
  testId?: string;
}) {
  return (
    <div className="space-y-3" data-testid={testId}>
      <div className="section-kicker">
        <Sparkles className="h-4 w-4 text-carnival-cyan" />
        {label}
      </div>
      <div className="overflow-hidden rounded-[1.75rem] border border-white/12 bg-white/[0.05] shadow-[0_20px_60px_-40px_rgba(15,23,42,0.95)]">
        {sessions.map((session, index) => {
          const selected = session.id === value;
          return (
            <button
              key={session.id}
              type="button"
              data-testid={testId ? `${testId}-option-${session.id}` : undefined}
              onClick={() => onChange(session.id)}
              className={`flex w-full items-center gap-4 px-4 py-4 text-left transition ${
                  selected
                    ? 'bg-white text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]'
                    : 'border-t border-white/8 text-white/90 hover:bg-white/[0.08]'
               } ${index === 0 ? 'border-t-0' : ''}`}
             >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-sm font-display ${
                  selected
                    ? 'border-slate-200 bg-slate-900 text-white'
                    : 'border-white/10 bg-white/[0.06] text-white/70'
                }`}
              >
                {selected ? <Check className="h-5 w-5" /> : String(index + 1).padStart(2, '0')}
              </div>
              <div className="min-w-0 flex-1">
                <div className={`truncate text-base font-semibold ${selected ? 'text-slate-900' : 'text-white'}`}>
                  {session.name}
                </div>
                <div className={`text-sm ${selected ? 'text-slate-500' : 'text-white/45'}`}>
                  {statusHint(session.status)}
                </div>
              </div>
              <SessionStatusPill status={session.status} selected={selected} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const dbPath = path.join(DATA_DIR, 'voting.db');
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const SCHEMA_VERSION = 2;

db.exec(`
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY
  );
`);

const verRow = db
  .prepare('SELECT version FROM schema_version LIMIT 1')
  .get() as { version: number } | undefined;

const oldEventTable = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='event'"
  )
  .get() as { name: string } | undefined;

if (!verRow || verRow.version < SCHEMA_VERSION) {
  // One-shot bootstrap to v2: drop legacy single-event schema if present.
  // (No data migration — explicit project decision.)
  db.exec(`
    DROP TABLE IF EXISTS votes;
    DROP TABLE IF EXISTS teams;
    DROP TABLE IF EXISTS event;
  `);
  if (oldEventTable) {
    console.warn(
      '[db] Detected legacy v1 schema (event/teams/votes); dropped for fresh v2 start.'
    );
  }
  db.prepare('DELETE FROM schema_version').run();
  db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(
    SCHEMA_VERSION
  );
}

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('setup','open','closed')) DEFAULT 'setup',
    points_per_team INTEGER NOT NULL DEFAULT 10,
    judge_points INTEGER NOT NULL DEFAULT 30,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('team','judge')) DEFAULT 'team',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    UNIQUE (session_id, name)
  );

  CREATE UNIQUE INDEX IF NOT EXISTS ux_one_judge_per_session
    ON teams(session_id) WHERE kind = 'judge';

  CREATE TABLE IF NOT EXISTS votes (
    voter_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    target_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    points INTEGER NOT NULL CHECK (points >= 0),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    PRIMARY KEY (voter_team_id, target_team_id),
    CHECK (voter_team_id <> target_team_id)
  );
`);

export type SessionStatus = 'setup' | 'open' | 'closed';
export type TeamKind = 'team' | 'judge';

export interface SessionRow {
  id: number;
  name: string;
  status: SessionStatus;
  points_per_team: number;
  judge_points: number;
  created_at: number;
  updated_at: number;
}

export interface TeamRow {
  id: number;
  session_id: number;
  name: string;
  password: string;
  kind: TeamKind;
  created_at: number;
}

export interface VoteRow {
  voter_team_id: number;
  target_team_id: number;
  points: number;
  updated_at: number;
}

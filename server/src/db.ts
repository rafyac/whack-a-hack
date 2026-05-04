import './env.js';
import pg from 'pg';

const { Pool, types } = pg;
type QueryResultRow = pg.QueryResultRow;

types.setTypeParser(20, (value) => Number(value));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL env var is required. Set it in local .env files and deployment secrets before starting the server.'
  );
}

const DATABASE_SSL_MODE = (process.env.DATABASE_SSL_MODE || 'disable').toLowerCase();

function createSslConfig() {
  if (DATABASE_SSL_MODE === 'disable') return false;
  return { rejectUnauthorized: false };
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: createSslConfig(),
  max: 10,
});

function normalizeSql(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

type Queryable = pg.Pool | pg.PoolClient;

function createFacade(client: Queryable) {
  return {
    async query<T extends QueryResultRow>(sql: string, params: unknown[] = []) {
      return client.query<T>(normalizeSql(sql), params);
    },
    async maybeOne<T extends QueryResultRow>(sql: string, params: unknown[] = []) {
      const result = await client.query<T>(normalizeSql(sql), params);
      return (result.rows[0] as T | undefined) ?? null;
    },
    async one<T extends QueryResultRow>(sql: string, params: unknown[] = []) {
      const result = await client.query<T>(normalizeSql(sql), params);
      if (!result.rows[0]) {
        throw new Error('expected one row but found none');
      }
      return result.rows[0] as T;
    },
    async many<T extends QueryResultRow>(sql: string, params: unknown[] = []) {
      const result = await client.query<T>(normalizeSql(sql), params);
      return result.rows as T[];
    },
  };
}

async function exec(sql: string) {
  await pool.query(sql);
}

const SCHEMA_VERSION = 1;

async function initDb() {
  await exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `);

  const versionRow = await pool.query<{ version: number }>(
    'SELECT version FROM schema_version LIMIT 1'
  );

  if (!versionRow.rows[0]) {
    await pool.query('INSERT INTO schema_version (version) VALUES ($1)', [SCHEMA_VERSION]);
  } else if (versionRow.rows[0].version < SCHEMA_VERSION) {
    await exec(`
      DROP TABLE IF EXISTS votes;
      DROP TABLE IF EXISTS teams;
      DROP TABLE IF EXISTS sessions;
      DELETE FROM schema_version;
      INSERT INTO schema_version (version) VALUES (${SCHEMA_VERSION});
    `);
  }

  await exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK (status IN ('setup','open','closed')) DEFAULT 'setup',
      points_per_team INTEGER NOT NULL DEFAULT 10,
      judge_points INTEGER NOT NULL DEFAULT 30,
      created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT),
      updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT)
    );

    CREATE TABLE IF NOT EXISTS teams (
      id BIGSERIAL PRIMARY KEY,
      session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      password TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('team','judge')) DEFAULT 'team',
      created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT),
      UNIQUE (session_id, name)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS ux_one_judge_per_session
      ON teams(session_id) WHERE kind = 'judge';

    CREATE TABLE IF NOT EXISTS votes (
      voter_team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      target_team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      points INTEGER NOT NULL CHECK (points >= 0),
      updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT),
      PRIMARY KEY (voter_team_id, target_team_id),
      CHECK (voter_team_id <> target_team_id)
    );
  `);
}

await initDb();

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

export const db = {
  ...createFacade(pool),
  exec,
  async withTransaction<T>(
    work: (tx: ReturnType<typeof createFacade>) => Promise<T>
  ): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tx = createFacade(client);
      const result = await work(tx);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
  async resetForTests() {
    await exec(`
      TRUNCATE TABLE votes, teams, sessions RESTART IDENTITY CASCADE;
    `);
  },
  async close() {
    await pool.end();
  },
};

import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env'));
loadEnvFile(path.resolve(process.cwd(), 'server/.env'));

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to reset the database.');
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl:
    (process.env.DATABASE_SSL_MODE || 'disable').toLowerCase() === 'disable'
      ? false
      : { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  console.log('Reset PostgreSQL schema in DATABASE_URL target.');
} finally {
  await client.end();
}

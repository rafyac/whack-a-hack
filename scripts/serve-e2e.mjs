import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const build = spawnSync(npmCmd, ['run', 'build'], {
  cwd: repoRoot,
  stdio: 'inherit',
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const server = spawn(process.execPath, ['server/dist/index.js'], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: process.env.PORT ?? '4173',
    DATABASE_URL:
      process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/whack_a_hack_test',
    DATABASE_SSL_MODE: process.env.DATABASE_SSL_MODE ?? 'disable',
    ADMIN_CODE: process.env.ADMIN_CODE ?? 'admin-dev-code',
    COOKIE_SECRET: process.env.COOKIE_SECRET ?? 'playwright-cookie-secret',
  },
});

const stop = (signal) => {
  if (!server.killed) {
    server.kill(signal);
  }
};

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

server.on('exit', (code) => {
  process.exit(code ?? 0);
});

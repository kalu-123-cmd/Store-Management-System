/**
 * Production bootstrap for Render.
 * Forces SQLite on /data, migrates schema, then starts the API.
 * Seed + empty-DB handling also runs inside dist/index.js.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

if (process.env.RENDER === 'true' || fs.existsSync('/data')) {
  try { fs.mkdirSync('/data', { recursive: true }); } catch { /* ignore */ }
  process.env.DATABASE_URL = 'file:/data/prod.db';
  console.log('[boot] SQLite disk database:', process.env.DATABASE_URL);
} else if (process.env.DATABASE_URL && /postgres/i.test(process.env.DATABASE_URL)) {
  console.warn('[boot] Ignoring PostgreSQL URL — this app ships with SQLite.');
  process.env.DATABASE_URL = 'file:./prod.db';
}

run('npx', ['prisma', 'generate']);
run('npx', ['prisma', 'db', 'push', '--accept-data-loss', '--skip-generate']);
run('node', [path.join(__dirname, '..', 'dist', 'index.js')]);

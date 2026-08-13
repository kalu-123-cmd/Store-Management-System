/**
 * Production bootstrap — always SQLite (ignores dead Postgres URLs).
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

const onRender = process.env.RENDER === 'true' || fs.existsSync('/data');
if (onRender) {
  try { fs.mkdirSync('/data', { recursive: true }); } catch { /* ignore */ }
  process.env.DATABASE_URL = 'file:/data/prod.db';
} else if (!process.env.DATABASE_URL || /postgres|dpg-/i.test(process.env.DATABASE_URL || '')) {
  const diskDir = path.join(__dirname, '../prisma/data');
  try { fs.mkdirSync(diskDir, { recursive: true }); } catch { /* ignore */ }
  process.env.DATABASE_URL = 'file:' + path.join(diskDir, 'prod.db').replace(/\\/g, '/');
}
console.log('[boot] DATABASE_URL=', process.env.DATABASE_URL);

run('npx', ['prisma', 'generate']);
run('npx', ['prisma', 'db', 'push', '--accept-data-loss', '--skip-generate']);
run('node', [path.join(__dirname, '..', 'dist', 'index.js')]);

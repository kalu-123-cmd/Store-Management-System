/**
 * Production bootstrap for Render (and similar hosts).
 * Best option for this repo: SQLite on a persistent disk — matches schema.prisma,
 * avoids paid/expired Postgres, and auto-migrates + seeds on boot.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
    ...opts,
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

// Render sets RENDER=true. Prefer disk-backed SQLite whenever /data exists.
const onRender = process.env.RENDER === 'true' || fs.existsSync('/data');
const sqlitePath = process.env.SQLITE_PATH || (onRender ? 'file:/data/prod.db' : process.env.DATABASE_URL);

if (onRender) {
  if (!fs.existsSync('/data')) {
    fs.mkdirSync('/data', { recursive: true });
  }
  process.env.DATABASE_URL = 'file:/data/prod.db';
  console.log('[boot] Forcing SQLite on persistent disk:', process.env.DATABASE_URL);
} else if (sqlitePath && String(sqlitePath).startsWith('file:')) {
  process.env.DATABASE_URL = sqlitePath;
} else if (process.env.DATABASE_URL && /postgres/i.test(process.env.DATABASE_URL)) {
  // Repo schema is SQLite — refuse broken Postgres URLs for this deployment mode.
  console.warn('[boot] Ignoring PostgreSQL DATABASE_URL; using local SQLite file.');
  process.env.DATABASE_URL = 'file:./prod.db';
}

console.log('[boot] DATABASE_URL =', process.env.DATABASE_URL);

run('npx', ['prisma', 'generate']);
run('npx', ['prisma', 'db', 'push', '--accept-data-loss', '--skip-generate']);

// Seed demo users/products if the DB has no admin yet
try {
  const check = spawnSync(
    'npx',
    ['tsx', '-e', `
      const { PrismaClient } = require('@prisma/client');
      const p = new PrismaClient();
      p.user.count().then(c => { console.log(c); return p.$disconnect(); }).catch(e => { console.error(e); process.exit(1); });
    `],
    { encoding: 'utf8', env: process.env, shell: process.platform === 'win32' }
  );
  const count = parseInt(String(check.stdout || '').trim().split('\n').pop() || '0', 10);
  if (!Number.isFinite(count) || count === 0) {
    console.log('[boot] Empty database — running seed…');
    run('npx', ['tsx', 'prisma/seed.ts']);
  } else {
    console.log(`[boot] Database already has ${count} user(s) — skip seed`);
  }
} catch (e) {
  console.warn('[boot] Seed check failed, attempting seed anyway:', e.message);
  run('npx', ['tsx', 'prisma/seed.ts']);
}

const entry = path.join(__dirname, '..', 'dist', 'index.js');
run('node', [entry]);

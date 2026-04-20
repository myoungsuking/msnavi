import fs from 'fs';
import path from 'path';
import { pool } from './pool';

async function main() {
  const file = path.resolve(__dirname, 'migrations', '002_seed.sql');
  const sql = fs.readFileSync(file, 'utf8');
  console.log('[seed] running 002_seed.sql');
  await pool.query(sql);
  console.log('[seed] done');
  await pool.end();
}

main().catch((e) => {
  console.error('[seed] failed', e);
  process.exit(1);
});

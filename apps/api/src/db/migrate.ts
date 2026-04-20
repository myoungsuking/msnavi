import fs from 'fs';
import path from 'path';
import { pool } from './pool';

/**
 * 단순 파일 기반 마이그레이션 러너.
 * docker-compose에서는 /docker-entrypoint-initdb.d 로도 초기 실행됨.
 * 이 스크립트는 외부 Postgres(이미 기동된 상태)에 재실행하고 싶을 때 사용.
 */
async function main() {
  const dir = path.resolve(__dirname, 'migrations');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    console.log(`[migrate] running ${f}`);
    await pool.query(sql);
  }
  console.log('[migrate] done');
  await pool.end();
}

main().catch((e) => {
  console.error('[migrate] failed', e);
  process.exit(1);
});

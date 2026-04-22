import crypto from 'crypto';

/**
 * 로그/감사용 IP 익명화.
 *
 * 개인정보 최소화 전략에 따라 원본 IP 를 평문으로 저장하지 않는다.
 * - 기본: IPv4 마지막 옥텟 마스킹 (A.B.C.xxx), IPv6 마지막 64bit 마스킹
 * - 해시 모드: 솔트 기반 SHA-256 (앞 16 hex 만 표출) — 세션내 동일 IP 추적 목적
 *
 * 세션 식별이 필요 없는 로그에는 maskIp(), 이상 패턴 분석이 필요한 경우에는
 * hashIp() 를 사용한다.
 */

const IP_HASH_SALT = process.env.IP_HASH_SALT ?? 'msnavi-default-salt-change-me';

export function maskIp(raw?: string | null): string {
  if (!raw) return '-';
  // x-forwarded-for 가 콤마 분리로 들어오면 첫번째만 사용
  const ip = raw.split(',')[0].trim();
  if (ip.includes('.')) {
    const p = ip.split('.');
    if (p.length === 4) return `${p[0]}.${p[1]}.${p[2]}.xxx`;
  }
  if (ip.includes(':')) {
    const parts = ip.split(':');
    // 앞 4블록만 유지 (상위 64bit)
    const head = parts.slice(0, 4).join(':');
    return `${head}::xxxx`;
  }
  return 'unknown';
}

export function hashIp(raw?: string | null): string {
  if (!raw) return '-';
  const ip = raw.split(',')[0].trim();
  return crypto
    .createHmac('sha256', IP_HASH_SALT)
    .update(ip)
    .digest('hex')
    .slice(0, 16);
}

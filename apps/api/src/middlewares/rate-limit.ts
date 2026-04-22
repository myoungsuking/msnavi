import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { hashIp } from '../utils/ip-mask';

/**
 * Rate limit 정책.
 *
 * 비회원 서비스 — 인증이 없으므로 **IP 기준 제한** 이 유일한 남용 방지 수단.
 * Cloudflare 엣지에서 이미 기본 DDoS/봇 완화가 적용되지만, 서버단에서도
 * 이중으로 방어한다.
 *
 * 키 생성 시 원본 IP 를 그대로 저장하지 않고 HMAC-SHA256 해시값을 키로 쓴다.
 * (개인정보 최소화 원칙)
 */

const keyByHashedIp = (req: import('express').Request) => {
  const raw =
    (req.headers['x-forwarded-for'] as string | undefined) ??
    req.ip ??
    req.socket.remoteAddress ??
    '';
  // express-rate-limit v7 권장: IPv6 정규화를 위해 ipKeyGenerator 호출
  return hashIp(ipKeyGenerator(raw));
};

/** 전역 기본 레이트리밋: 1분에 120회 (평범한 앱 사용자 수준보다 넉넉) */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: keyByHashedIp,
  message: { error: { code: 'RATE_LIMITED', message: '요청이 너무 많습니다.' } },
});

/** 외부 API 비용이 큰 엔드포인트(주변 검색 등): 1분 30회 */
export const externalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: keyByHashedIp,
  message: { error: { code: 'RATE_LIMITED', message: '주변 검색 요청이 너무 많습니다.' } },
});

/** 쓰기 계열 엔드포인트(주행 시작/트랙/종료): 1분 60회 */
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: keyByHashedIp,
  message: { error: { code: 'RATE_LIMITED', message: '쓰기 요청이 너무 많습니다.' } },
});

/** 관리자 엔드포인트: 1분 20회 + 실패 시 강하게 카운트 */
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: keyByHashedIp,
  message: { error: { code: 'RATE_LIMITED', message: '관리자 요청 한도 초과' } },
});

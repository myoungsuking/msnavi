import type { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';
import { maskIp, hashIp } from '../utils/ip-mask';

/**
 * 관리자 전용 라우트 가드.
 *
 * 비회원 구조지만 일부 운영 API(데이터 재적재·통계 조회·지도 HTML 키 갱신 등)는
 * 외부 공개되면 곤란하다. 별도의 **관리자 API 키**를 요구하며:
 *  - 키는 서버 .env 의 ADMIN_API_KEY 에 저장 (최소 32자 랜덤)
 *  - 클라이언트 코드에는 절대 포함하지 않음
 *  - timing-safe 비교로 타이밍 공격 방어
 *  - 실패 요청은 구조화 로그로 남겨 이상 징후 추적
 *  - 선택적으로 ADMIN_ALLOW_IPS(콤마 구분) 화이트리스트 동시 적용
 */

function timingSafeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? '';
}

export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const adminKey = env.admin.apiKey;
  if (!adminKey) {
    console.warn('[admin-auth] ADMIN_API_KEY 가 설정되지 않음 - 모든 관리자 요청 거부');
    return res.status(503).json({
      error: { code: 'ADMIN_DISABLED', message: '관리자 기능 비활성화' },
    });
  }

  const header =
    req.headers['x-admin-key'] ?? req.headers['x-api-admin-key'];
  const provided = Array.isArray(header) ? header[0] : header;
  if (!provided || !timingSafeEquals(String(provided), adminKey)) {
    const ip = getClientIp(req);
    console.warn(
      JSON.stringify({
        event: 'admin_auth_failed',
        path: req.path,
        method: req.method,
        ipMasked: maskIp(ip),
        ipHash: hashIp(ip),
        ts: new Date().toISOString(),
      }),
    );
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: '관리자 인증 실패' },
    });
  }

  const allow = env.admin.allowIps;
  if (allow.length > 0) {
    const ip = getClientIp(req);
    if (!allow.includes(ip)) {
      console.warn(
        JSON.stringify({
          event: 'admin_ip_blocked',
          path: req.path,
          method: req.method,
          ipMasked: maskIp(ip),
          ts: new Date().toISOString(),
        }),
      );
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: '허용되지 않은 IP' },
      });
    }
  }

  console.info(
    JSON.stringify({
      event: 'admin_access',
      path: req.path,
      method: req.method,
      ipMasked: maskIp(getClientIp(req)),
      ts: new Date().toISOString(),
    }),
  );
  return next();
}

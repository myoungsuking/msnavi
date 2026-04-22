import cors, { CorsOptions } from 'cors';
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler } from './middlewares/error-handler';
import { globalLimiter } from './middlewares/rate-limit';
import { maskIp, hashIp } from './utils/ip-mask';
import routes from './routes';

export function createApp() {
  const app = express();

  // Express 내부 표식/X-Powered-By 헤더 제거 — 기술 스택 노출 방지
  app.disable('x-powered-by');

  // Cloudflare Tunnel + 내부 리버스프록시 체인을 1단계로 신뢰. req.ip 가 원 IP 가 되도록.
  app.set('trust proxy', 1);

  // ─── 보안 헤더 ───────────────────────────────────────────────────────────
  // helmet 의 기본값 + HSTS/ReferrerPolicy/NoSniff 를 명시적으로 강화.
  // HSTS: Cloudflare 엣지에서도 설정되지만 서버단 이중 적용.
  // CSP 는 /api/map/naver.html 이 네이버 스크립트를 불러오므로 완화한 기본값만 적용하고,
  // 해당 라우트에서 필요 시 더 엄격히 재정의한다.
  app.use(
    helmet({
      hsts:
        env.security.hstsMaxAgeSec > 0
          ? {
              maxAge: env.security.hstsMaxAgeSec,
              includeSubDomains: true,
              preload: false,
            }
          : false,
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // 지도 HTML 을 WebView 에서 띄우므로 전역 CSP 는 일단 비활성.
      // (WebView 로드 대상인 /api/map/*.html 에서는 라우트 단 CSP 를 적용해야 함)
      contentSecurityPolicy: false,
    }),
  );

  app.use(compression());

  // 업로드가 없는 서비스 — body 크기 상한을 낮게 유지 (DoS 완화)
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: false, limit: '32kb' }));

  // ─── 접근 로그 (개인정보 최소화) ────────────────────────────────────────
  // morgan 기본 'combined' 포맷은 원본 IP 를 그대로 기록하므로, 토큰을 재정의해
  // IP 는 마스킹된 형태(A.B.C.xxx)와 HMAC 해시(세션 추적용) 만 남긴다.
  morgan.token('ipmask', (req) => {
    const xff = (req.headers as Record<string, string | string[] | undefined>)[
      'x-forwarded-for'
    ];
    const raw =
      (typeof xff === 'string' ? xff : Array.isArray(xff) ? xff[0] : undefined) ??
      (req as unknown as { ip?: string }).ip ??
      '';
    return maskIp(raw);
  });
  morgan.token('iphash', (req) => {
    const xff = (req.headers as Record<string, string | string[] | undefined>)[
      'x-forwarded-for'
    ];
    const raw =
      (typeof xff === 'string' ? xff : Array.isArray(xff) ? xff[0] : undefined) ??
      (req as unknown as { ip?: string }).ip ??
      '';
    return hashIp(raw);
  });
  const accessFormat =
    env.nodeEnv === 'production'
      ? ':ipmask (:iphash) :method :url :status :res[content-length] - :response-time ms'
      : 'dev';
  app.use(morgan(accessFormat));

  // ─── CORS ───────────────────────────────────────────────────────────────
  const allowedOrigins = env.corsOrigins;
  const corsOptions: CorsOptions = {
    origin: (origin, cb) => {
      // 동일 출처/서버 헬스체크 등 origin 없는 요청은 허용
      if (!origin) return cb(null, true);
      if (allowedOrigins.length === 0) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS denied for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key'],
    maxAge: 86400,
  };
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  // ─── 전역 Rate Limit ────────────────────────────────────────────────────
  // 개별 라우트(주변/쓰기/관리자)는 각 라우터에서 별도 제한을 추가로 건다.
  app.use('/api', globalLimiter);

  app.use('/api', routes);

  app.get('/', (_req, res) => {
    res.json({ service: 'msnavi-api', status: 'ok', docs: '/api/health' });
  });

  app.use(errorHandler);
  return app;
}

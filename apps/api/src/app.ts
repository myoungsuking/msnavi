import cors, { CorsOptions } from 'cors';
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler } from './middlewares/error-handler';
import routes from './routes';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

  // CORS: 환경변수 CORS_ORIGINS 리스트 허용.
  // 172.22.0.148 등 IP 기반 테스트를 위해 credentials 없이도 작동.
  const allowedOrigins = env.corsOrigins;
  const corsOptions: CorsOptions = {
    origin: (origin, cb) => {
      // 동일 출처/서버 헬스체크 등 origin 없는 요청은 허용
      if (!origin) return cb(null, true);
      if (allowedOrigins.length === 0) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      // IP 기반 허용: allowlist에 기재된 host만 허용
      return cb(new Error(`CORS denied for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  };
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  app.use('/api', routes);

  app.get('/', (_req, res) => {
    res.json({ service: 'msnavi-api', status: 'ok', docs: '/api/health' });
  });

  app.use(errorHandler);
  return app;
}

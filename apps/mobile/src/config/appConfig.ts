import Constants from 'expo-constants';

interface ExtraConfig {
  apiBaseUrl?: string;
  kakaoJsKey?: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;

function resolve(v: string | undefined, fallback: string): string {
  if (!v || v.startsWith('${')) return fallback;
  return v;
}

export const appConfig = {
  apiBaseUrl: resolve(
    process.env.EXPO_PUBLIC_API_BASE_URL ?? extra.apiBaseUrl,
    'http://172.22.0.148:4000',
  ),
  kakaoJsKey: resolve(process.env.EXPO_PUBLIC_KAKAO_JS_KEY ?? extra.kakaoJsKey, ''),
};

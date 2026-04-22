import Constants from 'expo-constants';

interface ExtraConfig {
  apiBaseUrl?: string;
  kakaoJsKey?: string;
  naverMapClientId?: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;

function resolve(v: string | undefined, fallback: string): string {
  if (!v || v.startsWith('${')) return fallback;
  return v;
}

export const appConfig = {
  apiBaseUrl: resolve(
    process.env.EXPO_PUBLIC_API_BASE_URL ?? extra.apiBaseUrl,
    'https://msnavi.msking.co.kr',
  ),
  kakaoJsKey: resolve(
    process.env.EXPO_PUBLIC_KAKAO_JS_KEY ?? extra.kakaoJsKey,
    '',
  ),
  naverMapClientId: resolve(
    process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID ?? extra.naverMapClientId,
    '',
  ),
};

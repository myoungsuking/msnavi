import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const KEY = 'msnavi:deviceId';

let cached: string | null = null;

/**
 * 익명 디바이스 식별자를 돌려준다.
 * - 최초 호출 시 UUID v4 생성 후 AsyncStorage 에 저장
 * - 이후엔 메모리 캐시 우선
 * - 앱 삭제/초기화 시 리셋되며, 그 경우 기존 서버 기록과는 분리됨 (의도된 동작)
 */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  try {
    const stored = await AsyncStorage.getItem(KEY);
    if (stored && /^[A-Za-z0-9_-]{8,64}$/.test(stored)) {
      cached = stored;
      return stored;
    }
  } catch {
    // ignore storage errors — fall back to new id
  }

  const id = Crypto.randomUUID();
  try {
    await AsyncStorage.setItem(KEY, id);
  } catch {
    // storage failure: still return in-memory id for this session
  }
  cached = id;
  return id;
}

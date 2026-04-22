import * as Speech from 'expo-speech';

/**
 * 주행 중 음성 안내 (턴바이턴용).
 * 동일 문구를 짧은 간격으로 여러 번 발화하지 않도록 내부 de-dupe.
 */
let lastSpoken = '';
let lastSpokenAt = 0;

export async function speakKo(text: string, opts?: { force?: boolean }): Promise<void> {
  const now = Date.now();
  if (!opts?.force && text === lastSpoken && now - lastSpokenAt < 5000) {
    return;
  }
  lastSpoken = text;
  lastSpokenAt = now;

  try {
    const speaking = await Speech.isSpeakingAsync();
    if (speaking) Speech.stop();
  } catch {
    // ignore
  }

  Speech.speak(text, {
    language: 'ko-KR',
    pitch: 1.0,
    rate: 1.0,
  });
}

export function stopSpeaking(): void {
  try {
    Speech.stop();
  } catch {
    // ignore
  }
  lastSpoken = '';
  lastSpokenAt = 0;
}

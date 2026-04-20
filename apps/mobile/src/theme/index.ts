/**
 * 흑백 중심 테마 - 사양서 22번 "공통 원칙" 준수
 * - 배경: 흰색/검정 단색
 * - 텍스트: 검정/흰색 대비만 사용
 * - 강조: 회색 톤 1~2단계
 * - 테두리: 얇은 선
 * - 아이콘/장식 최소화
 */

export const colors = {
  bg: '#FFFFFF',
  bgInverse: '#000000',
  text: '#000000',
  textInverse: '#FFFFFF',
  textMuted: '#666666',
  textSubtle: '#999999',
  border: '#E5E5E5',
  borderStrong: '#000000',
  divider: '#EEEEEE',
  accent: '#000000',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const },
  h2: { fontSize: 22, fontWeight: '700' as const },
  h3: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyBold: { fontSize: 15, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  mono: { fontSize: 48, fontWeight: '700' as const },
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
} as const;

export const theme = { colors, spacing, typography, radius } as const;
export type Theme = typeof theme;

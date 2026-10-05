// Visual language: warm off-white canvas, white rounded cards, near-black
// "active" chips and a single orange accent (see the design reference in README).
export const colors = {
  canvas: '#EFEEEB',
  surface: '#FFFFFF',
  tile: '#F4F3F0',
  border: '#E7E5E1',
  ink: '#1F1F1F',
  inkSoft: '#3A3A3A',
  muted: '#9A9893',
  faint: '#C9C6C0',
  dark: '#2B2B2B',
  accent: '#F07A2B',
  accentSoft: '#FDEBDD',
  success: '#3C9A5F',
  successSoft: '#E3F2E8',
  danger: '#D2483C',
  dangerSoft: '#F9E3E0',
} as const;

export const radius = {
  sm: 12,
  md: 20,
  lg: 28,
  xl: 36,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const type = {
  display: { fontSize: 56, fontWeight: '500' as const, letterSpacing: -2, color: colors.ink },
  hero: { fontSize: 36, fontWeight: '700' as const, letterSpacing: -1, lineHeight: 40 },
  title: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.5, color: colors.ink },
  heading: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.3, color: colors.ink },
  body: { fontSize: 16, lineHeight: 23, color: colors.inkSoft },
  label: { fontSize: 15, fontWeight: '600' as const, color: colors.ink },
  caption: { fontSize: 13, color: colors.muted },
  stat: { fontSize: 34, fontWeight: '500' as const, letterSpacing: -1, color: colors.ink },
} as const;

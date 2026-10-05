import Feather from '@expo/vector-icons/Feather';
import { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors, radius, spacing, type } from '@/lib/theme';

export type IconName = ComponentProps<typeof Feather>['name'];

export function IconButton({
  icon,
  onPress,
  variant = 'light',
  size = 52,
  accessibilityLabel,
}: {
  icon: IconName;
  onPress?: () => void;
  variant?: 'light' | 'dark' | 'tile';
  size?: number;
  accessibilityLabel: string;
}) {
  const bg = variant === 'dark' ? colors.dark : variant === 'tile' ? colors.tile : colors.surface;
  const fg = variant === 'dark' ? colors.surface : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, opacity: pressed ? 0.7 : 1 },
      ]}>
      <Feather name={icon} size={Math.round(size * 0.42)} color={fg} />
    </Pressable>
  );
}

export function Pill({
  label,
  active,
  onPress,
  tone = 'accent',
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  /** accent = orange selected state, dark = near-black selected state */
  tone?: 'accent' | 'dark';
}) {
  const activeBg = tone === 'accent' ? colors.accent : colors.dark;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        tone === 'dark' && !active && styles.pillGhost,
        active && { backgroundColor: activeBg },
        pressed && { opacity: 0.75 },
      ]}>
      <Text style={[styles.pillText, tone === 'dark' && !active && { color: colors.muted }, active && { color: '#fff' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'accent' }: { label: string; tone?: 'accent' | 'dark' | 'success' | 'muted' }) {
  const bg = { accent: colors.accent, dark: colors.dark, success: colors.success, muted: colors.tile }[tone];
  const fg = tone === 'muted' ? colors.inkSoft : '#fff';
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={type.title}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ProgressRing({ progress, size = 56, stroke = 7 }: { progress: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surface} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={colors.dark}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${c * p} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

export function StatTile({
  label,
  value,
  progress,
  onPress,
}: {
  label: string;
  value: string;
  progress: number;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.statTile, pressed && onPress && { opacity: 0.8 }]}>
      <View style={styles.statTop}>
        <Text style={styles.statLabel}>{label}</Text>
        <View style={{ flexShrink: 0 }}>
          <ProgressRing progress={progress} />
        </View>
      </View>
      <Text style={type.stat} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </Pressable>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  trailing,
  onPress,
  bordered = true,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  bordered?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, bordered && styles.rowBordered, pressed && { opacity: 0.75 }]}>
      <View style={styles.rowIcon}>
        <Feather name={icon} size={22} color={colors.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
}

/** The white panel with large rounded top corners that slides over the canvas. */
export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  variant = 'dark',
  icon,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'dark' | 'accent' | 'ghost';
  icon?: IconName;
  disabled?: boolean;
}) {
  const bg = variant === 'dark' ? colors.dark : variant === 'accent' ? colors.accent : colors.tile;
  const fg = variant === 'ghost' ? colors.ink : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }]}>
      {icon ? <Feather name={icon} size={18} color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** Area sparkline with an orange marker, echoing the temperature chart in the design. */
export function Sparkline({
  values,
  width,
  height = 150,
  highlight,
}: {
  values: number[];
  width: number;
  height?: number;
  highlight?: number;
}) {
  if (values.length < 2 || width <= 0) return <View style={{ height }} />;
  const max = Math.max(1, ...values);
  const pad = 12;
  const inset = 16; // keeps the end marker on screen
  const step = (width - inset * 2) / (values.length - 1);
  const pts = values.map((v, i) => [inset + i * step, pad + (height - pad * 2) * (1 - v / max)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0]},${height} L${pts[0][0]},${height} Z`;
  const h = highlight ?? values.length - 1;
  const [hx, hy] = pts[h];
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.ink} stopOpacity={0.08} />
          <Stop offset="1" stopColor={colors.ink} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <Line key={f} x1={0} x2={width} y1={height * f} y2={height * f} stroke={colors.border} strokeWidth={1} />
      ))}
      <Path d={area} fill="url(#fade)" />
      <Path d={line} stroke={colors.inkSoft} strokeWidth={2} fill="none" strokeLinejoin="round" />
      <Circle cx={hx} cy={hy} r={10} fill={colors.accent} opacity={0.18} />
      <Line x1={hx} x2={hx} y1={hy - 9} y2={hy + 9} stroke={colors.accent} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

export function EmptyState({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.rowIcon}>
        <Feather name={icon} size={22} color={colors.ink} />
      </View>
      <Text style={[type.heading, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[type.caption, { textAlign: 'center', fontSize: 15, lineHeight: 21 }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconButton: { alignItems: 'center', justifyContent: 'center' },
  pill: {
    paddingHorizontal: 18,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillGhost: { backgroundColor: 'transparent', paddingHorizontal: 14 },
  pillText: { fontSize: 16, color: colors.muted, fontWeight: '500' },
  badge: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { fontSize: 13, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  sectionAction: { fontSize: 17, color: colors.muted },
  statTile: {
    flex: 1,
    backgroundColor: colors.tile,
    borderRadius: radius.lg,
    padding: spacing.lg + 4,
    minHeight: 168,
    justifyContent: 'space-between',
  },
  statTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  statLabel: { fontSize: 17, fontWeight: '600', color: colors.ink, flex: 1, lineHeight: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.lg, backgroundColor: colors.surface },
  rowBordered: { padding: spacing.lg + 4, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, marginBottom: spacing.md + 4 },
  rowIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.tile, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 17, fontWeight: '600', color: colors.ink, letterSpacing: -0.2 },
  rowSubtitle: { fontSize: 16, color: colors.muted, marginTop: 4 },
  panel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl + 4,
    flexGrow: 1,
  },
  button: {
    height: 54,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
});

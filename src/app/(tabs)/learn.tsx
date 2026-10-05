import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListRow, Panel, Pill, Sparkline } from '@/components/ui';
import { accuracy, series, streak, totals } from '@/lib/learning';
import { dueCards } from '@/lib/quiz';
import { useStore } from '@/lib/store';
import { colors, radius, spacing, type } from '@/lib/theme';

const RANGES = [
  { key: 'W', days: 7, label: 'This week' },
  { key: 'M', days: 30, label: 'Last 30 days' },
  { key: '3M', days: 90, label: 'Last 3 months' },
  { key: 'Y', days: 365, label: 'This year' },
] as const;

const GOALS = [5, 10, 15, 20, 30];

function ValuePill({ text }: { text: string }) {
  return (
    <View style={styles.valuePill}>
      <Text style={styles.valuePillText}>{text}</Text>
    </View>
  );
}

export default function LearnScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { stats, cards, settings, updateSettings, readSinceQuiz, history } = useStore();
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[0]);

  const values = series(stats, range.days, 'read');
  const t = totals(stats, range.days);
  const acc = accuracy(t);
  const due = dueCards(cards).length;
  const days = streak(stats);
  const best = Math.max(0, ...values);

  return (
    <ScrollView style={{ backgroundColor: colors.canvas }} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={{ paddingTop: insets.top + spacing.lg }}>
        <Text style={styles.screenTitle}>Learning</Text>

        <View style={styles.ranges}>
          {RANGES.map((r) => (
            <Pill key={r.key} label={r.key} tone="dark" active={range.key === r.key} onPress={() => setRange(r)} />
          ))}
        </View>

        <View style={styles.summary}>
          <Text style={styles.rangeLabel}>{range.label}</Text>
          <View style={styles.bigRow}>
            <Text style={type.display}>{t.read}</Text>
            <Text style={styles.unit}>posts read</Text>
          </View>
          {best > 0 ? <Text style={styles.peak}>best day {best}</Text> : null}
        </View>

        <Sparkline values={values} width={width} height={170} />
      </View>

      <Panel style={{ paddingBottom: insets.bottom + 120 }}>
        <Text style={[type.heading, { marginBottom: spacing.md }]}>Daily goal</Text>
        <View style={styles.goals}>
          {GOALS.map((g) => (
            <Pill key={g} label={String(g)} active={settings.dailyGoal === g} onPress={() => updateSettings({ dailyGoal: g })} />
          ))}
        </View>

        <Text style={[type.title, { marginTop: spacing.xxl, marginBottom: spacing.sm }]}>Practice</Text>

        <ListRow
          bordered={false}
          icon="layers"
          title="Spaced review"
          subtitle={due ? 'Questions due today' : 'All caught up'}
          trailing={<ValuePill text={`${due} due`} />}
          onPress={() => router.push({ pathname: '/quiz', params: { mode: 'review' } })}
        />
        <View style={styles.divider} />
        <ListRow
          bordered={false}
          icon="zap"
          title="Knowledge check"
          subtitle={history.length ? 'Quiz on your recent reads' : 'Read a few posts first'}
          trailing={<ValuePill text={`${readSinceQuiz} new`} />}
          onPress={() => router.push({ pathname: '/quiz', params: { mode: 'check' } })}
        />
        <View style={styles.divider} />
        <ListRow
          bordered={false}
          icon="target"
          title="Accuracy"
          subtitle={`${t.answered} answered · ${range.label.toLowerCase()}`}
          trailing={<ValuePill text={acc == null ? '—' : `${Math.round(acc * 100)}%`} />}
        />
        <View style={styles.divider} />
        <ListRow
          bordered={false}
          icon="sun"
          title="Reading streak"
          subtitle="Days in a row with at least one post"
          trailing={<ValuePill text={`${days} day${days === 1 ? '' : 's'}`} />}
        />
      </Panel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screenTitle: { ...type.title, textAlign: 'center', marginBottom: spacing.xl },
  ranges: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: spacing.lg },
  summary: { paddingHorizontal: spacing.xl, marginTop: spacing.xl },
  rangeLabel: { fontSize: 20, fontWeight: '500', color: colors.ink },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
  unit: { fontSize: 18, color: colors.muted },
  peak: { color: colors.accent, fontSize: 14, fontWeight: '600', alignSelf: 'center', marginTop: spacing.sm },
  goals: { flexDirection: 'row', justifyContent: 'space-between' },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 72 },
  valuePill: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  valuePillText: { fontSize: 15, fontWeight: '500', color: colors.ink },
});

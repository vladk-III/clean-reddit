import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, Pill } from '@/components/ui';
import { checkSubreddit } from '@/lib/reddit';
import { DEFAULT_SUBREDDITS, feedFilterOptions, useStore } from '@/lib/store';
import { colors, radius, spacing, type } from '@/lib/theme';

const SUGGESTIONS = [
  'todayilearned', 'explainlikeimfive', 'askscience', 'AskHistorians', 'space', 'science', 'Physics', 'biology',
  'history', 'dataisbeautiful', 'YouShouldKnow', 'LifeProTips', 'personalfinance', 'Economics', 'programming',
  'learnprogramming', 'linguistics', 'philosophy', 'geography',
  'Futurology', 'engineering', 'chemistry', 'nasa', 'Astronomy', 'books', 'Documentaries', 'coolguides',
];

export default function SubredditsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useStore();
  const [input, setInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const has = (s: string) => settings.subreddits.some((x) => x.toLowerCase() === s.toLowerCase());

  const add = async (raw: string) => {
    const name = raw.replace(/^\/?r\//i, '').trim();
    if (!name || has(name)) return;
    setChecking(true);
    setMessage(null);
    const res = await checkSubreddit(name, feedFilterOptions(settings).auth);
    setChecking(false);
    if (!res.ok) {
      setMessage(res.reason ?? 'Could not add that subreddit.');
      return;
    }
    updateSettings({ subreddits: [...settings.subreddits, name] });
    setInput('');
  };

  const remove = (s: string) => updateSettings({ subreddits: settings.subreddits.filter((x) => x !== s) });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.nav, { paddingTop: (Platform.OS === 'ios' ? spacing.lg : insets.top) + spacing.sm }]}>
        <IconButton icon="x" variant="tile" size={44} accessibilityLabel="Close" onPress={() => router.back()} />
        <Text style={styles.navTitle}>Subreddits</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }} keyboardShouldPersistTaps="handled">
        <View style={styles.inputRow}>
          <Text style={styles.prefix}>r/</Text>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Add a subreddit"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={() => add(input)}
            returnKeyType="done"
          />
          {checking ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Pressable onPress={() => add(input)} hitSlop={8} style={styles.addButton} accessibilityLabel="Add">
              <Feather name="plus" size={18} color="#fff" />
            </Pressable>
          )}
        </View>
        {message ? <Text style={styles.message}>{message}</Text> : null}

        <Text style={type.heading}>In your feed</Text>
        <View style={styles.wrap}>
          {settings.subreddits.map((s) => (
            <Pressable key={s} style={styles.chip} onPress={() => remove(s)} accessibilityLabel={`Remove ${s}`}>
              <Text style={styles.chipText}>r/{s}</Text>
              <Feather name="x" size={14} color={colors.muted} />
            </Pressable>
          ))}
          {settings.subreddits.length === 0 ? <Text style={type.caption}>Your feed is empty — add a few below.</Text> : null}
        </View>

        <Text style={[type.heading, { marginTop: spacing.md }]}>Good for learning</Text>
        <View style={styles.wrap}>
          {SUGGESTIONS.filter((s) => !has(s)).map((s) => (
            <Pill key={s} label={`+ ${s}`} onPress={() => updateSettings({ subreddits: [...settings.subreddits, s] })} />
          ))}
        </View>

        <Pressable onPress={() => updateSettings({ subreddits: DEFAULT_SUBREDDITS })}>
          <Text style={styles.reset}>Reset to defaults</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  navTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.tile,
    borderRadius: radius.pill,
    paddingLeft: spacing.lg,
    paddingRight: 6,
    height: 54,
    gap: 4,
  },
  prefix: { fontSize: 16, color: colors.muted, fontWeight: '600' },
  input: { flex: 1, fontSize: 16, color: colors.ink, height: '100%' },
  addButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' },
  message: { color: colors.danger, fontSize: 14 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    height: 40,
  },
  chipText: { fontSize: 15, color: colors.ink, fontWeight: '500' },
  reset: { color: colors.muted, textAlign: 'center', marginTop: spacing.lg, fontSize: 14 },
});

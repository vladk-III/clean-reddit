import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton, Pill } from '@/components/ui';
import { postCache, useStore } from '@/lib/store';
import { colors, radius, spacing, type } from '@/lib/theme';

const STARTERS = ['Key takeaway: ', 'To do: ', 'Look up: ', 'Question: ', 'In my own words: '];

export default function NoteScreen() {
  const { postId, noteId, afterReading } = useLocalSearchParams<{ postId?: string; noteId?: string; afterReading?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { notes, history, saveNote, deleteNote } = useStore();

  const existing = notes.find((n) => (noteId ? n.id === noteId : n.postId === postId));
  const cached = postId ? postCache.get(postId) : undefined;
  const fromHistory = history.find((h) => h.id === (existing?.postId ?? postId));
  const title = existing?.postTitle ?? cached?.title ?? fromHistory?.title ?? 'Untitled post';
  const subreddit = existing?.subreddit ?? cached?.subreddit ?? fromHistory?.subreddit ?? '';
  const permalink = existing?.permalink ?? cached?.permalink ?? fromHistory?.permalink ?? '';

  const [text, setText] = useState(existing?.text ?? '');
  const [actionable, setActionable] = useState(existing?.actionable ?? false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const save = () => {
    if (!text.trim()) return close();
    saveNote({
      id: existing?.id,
      postId: existing?.postId ?? postId ?? '',
      postTitle: title,
      subreddit,
      permalink,
      text: text.trim(),
      actionable,
      done: existing?.done ?? false,
    });
    close();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.nav, { paddingTop: (Platform.OS === 'ios' ? spacing.lg : insets.top) + spacing.sm }]}>
        <IconButton icon="x" variant="tile" size={44} accessibilityLabel="Close" onPress={close} />
        <Text style={styles.navTitle}>{existing ? 'Edit note' : 'New note'}</Text>
        {existing ? (
          <IconButton
            icon="trash-2"
            variant="tile"
            size={44}
            accessibilityLabel="Delete note"
            onPress={() => {
              deleteNote(existing.id);
              close();
            }}
          />
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
        {afterReading ? (
          <View style={styles.prompt}>
            <Feather name="feather" size={18} color={colors.accent} />
            <Text style={styles.promptText}>Before you move on: what's worth remembering or doing from this post?</Text>
          </View>
        ) : null}

        <View style={styles.source}>
          {subreddit ? <Text style={type.caption}>r/{subreddit}</Text> : null}
          <Text style={styles.sourceTitle} numberOfLines={3}>
            {title}
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }} style={{ marginHorizontal: -spacing.xl }}>
          <View style={{ width: spacing.xl - spacing.sm }} />
          {STARTERS.map((s) => (
            <Pill key={s} label={s.replace(/: $/, '')} onPress={() => setText((t) => (t ? `${t.trimEnd()}\n${s}` : s))} />
          ))}
          <View style={{ width: spacing.xl - spacing.sm }} />
        </ScrollView>

        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Write a note, a summary in your own words, or something to follow up on…"
          placeholderTextColor={colors.muted}
          multiline
          autoFocus={!existing}
          textAlignVertical="top"
        />

        <Pressable style={styles.toggle} onPress={() => setActionable((a) => !a)}>
          <View style={styles.toggleIcon}>
            <Feather name="check-square" size={20} color={colors.ink} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Action item</Text>
            <Text style={type.caption}>Show this in your to-do list until you mark it done</Text>
          </View>
          <Switch
            value={actionable}
            onValueChange={setActionable}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor="#fff"
            {...(Platform.OS === 'web' ? { activeThumbColor: '#fff' } : {})}
          />
        </Pressable>

        <Button label="Save note" onPress={save} disabled={!text.trim() && !existing} />
        {afterReading ? <Button label="Skip" variant="ghost" onPress={close} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  navTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  content: { padding: spacing.xl, gap: spacing.lg },
  prompt: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  promptText: { flex: 1, fontSize: 15, color: colors.ink, lineHeight: 21 },
  source: { backgroundColor: colors.tile, borderRadius: radius.md, padding: spacing.lg, gap: 4 },
  sourceTitle: { fontSize: 16, fontWeight: '600', color: colors.ink, lineHeight: 22 },
  input: {
    minHeight: 180,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    fontSize: 17,
    lineHeight: 24,
    color: colors.ink,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md + 2,
  },
  toggleIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.tile, alignItems: 'center', justifyContent: 'center' },
  toggleTitle: { fontSize: 16, fontWeight: '600', color: colors.ink },
});

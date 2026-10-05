import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, IconButton, Pill } from '@/components/ui';
import { timeAgo } from '@/lib/format';
import { Note, useStore } from '@/lib/store';
import { colors, radius, spacing, type } from '@/lib/theme';

type Filter = 'all' | 'todo' | 'done';

function notesAsText(notes: Note[]) {
  return notes
    .map(
      (n) =>
        `${n.actionable ? (n.done ? '[x] ' : '[ ] ') : ''}${n.text}\n— ${n.postTitle} (r/${n.subreddit})\nhttps://www.reddit.com${n.permalink}`,
    )
    .join('\n\n');
}

export default function NotesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { notes, updateNote } = useStore();
  const [filter, setFilter] = useState<Filter>('all');

  const todo = notes.filter((n) => n.actionable && !n.done);
  const shown = useMemo(() => {
    if (filter === 'todo') return todo;
    if (filter === 'done') return notes.filter((n) => n.actionable && n.done);
    return notes;
  }, [filter, notes, todo]);

  return (
    <FlatList
      style={{ backgroundColor: colors.canvas }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + 120 }}
      data={shown}
      keyExtractor={(n) => n.id}
      ListHeaderComponent={
        <View style={{ marginBottom: spacing.xl }}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[type.hero, { color: colors.ink }]}>Notes</Text>
              <Text style={[type.hero, { color: colors.muted }]}>{todo.length} to act on</Text>
            </View>
            <IconButton
              icon="share"
              accessibilityLabel="Export notes"
              onPress={() => notes.length && Share.share({ message: notesAsText(shown) })}
            />
          </View>
          <View style={styles.filters}>
            <Pill label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
            <Pill label="To do" active={filter === 'todo'} onPress={() => setFilter('todo')} />
            <Pill label="Done" active={filter === 'done'} onPress={() => setFilter('done')} />
          </View>
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          icon="edit-3"
          title={filter === 'all' ? 'No notes yet' : filter === 'todo' ? 'Nothing to do' : 'Nothing done yet'}
          body="Tap the pencil on any post to save a takeaway or mark something you want to act on later."
        />
      }
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
          onPress={() => router.push({ pathname: '/note', params: { noteId: item.id, postId: item.postId } })}>
          <View style={styles.cardTop}>
            {item.actionable ? (
              <Pressable
                hitSlop={10}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.done }}
                onPress={() => updateNote(item.id, { done: !item.done })}
                style={[styles.check, item.done && styles.checkDone]}>
                {item.done ? <Feather name="check" size={16} color="#fff" /> : null}
              </Pressable>
            ) : null}
            <Text style={[styles.text, item.done && styles.textDone]}>{item.text}</Text>
          </View>
          <Pressable
            style={styles.source}
            onPress={() => item.postId && router.push({ pathname: '/post/[id]', params: { id: item.postId } })}>
            <Feather name="corner-down-right" size={14} color={colors.muted} />
            <Text style={styles.sourceText} numberOfLines={1}>
              {item.postTitle}
            </Text>
          </Pressable>
          <Text style={type.caption}>
            r/{item.subreddit} · {timeAgo(item.updatedAt / 1000)} ago
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  filters: { flexDirection: 'row', gap: spacing.sm + 2, marginTop: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg + 4,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  cardTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  check: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.faint,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  text: { flex: 1, fontSize: 16, color: colors.ink, lineHeight: 23 },
  textDone: { color: colors.muted, textDecorationLine: 'line-through' },
  source: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.tile, borderRadius: radius.sm, padding: spacing.md },
  sourceText: { flex: 1, fontSize: 14, color: colors.inkSoft, fontWeight: '500' },
});

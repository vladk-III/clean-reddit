import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PostCard } from '@/components/PostCard';
import { Badge, IconButton, Pill, SectionHeader, StatTile } from '@/components/ui';
import { greeting } from '@/lib/format';
import { accuracy, totals } from '@/lib/learning';
import { dueCards } from '@/lib/quiz';
import { fetchFeed, Post, SortMode } from '@/lib/reddit';
import { feedFilterOptions, postCache, useStore } from '@/lib/store';
import { colors, radius, spacing, type } from '@/lib/theme';

const SORTS: { key: SortMode; label: string }[] = [
  { key: 'hot', label: 'Hot' },
  { key: 'top', label: 'Top' },
  { key: 'new', label: 'New' },
  { key: 'rising', label: 'Rising' },
];

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const store = useStore();
  const { settings, history, notes, stats, cards, readSinceQuiz } = store;

  const [selected, setSelected] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>('hot');
  const [posts, setPosts] = useState<Post[]>([]);
  const [after, setAfter] = useState<string | null>(null);
  const [hidden, setHidden] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const subs = useMemo(() => (selected ? [selected] : settings.subreddits), [selected, settings.subreddits]);
  const filterOpts = useMemo(() => feedFilterOptions(settings), [settings]);

  const load = useCallback(
    async (mode: 'reset' | 'more' | 'refresh') => {
      if (mode === 'more' && (!after || loading)) return;
      const id = ++requestId.current;
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await fetchFeed({ subreddits: subs, sort, after: mode === 'more' ? after : null, ...filterOpts });
        if (id !== requestId.current) return;
        res.posts.forEach((p) => postCache.set(p.id, p));
        setPosts((prev) => {
          if (mode !== 'more') return res.posts;
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...res.posts.filter((p) => !seen.has(p.id))];
        });
        setHidden((h) => (mode === 'more' ? h + res.hiddenCount : res.hiddenCount));
        setAfter(res.after);
      } catch (e) {
        if (id === requestId.current) setError(e instanceof Error ? e.message : 'Something went wrong.');
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [after, loading, subs, sort, filterOpts],
  );

  useEffect(() => {
    if (!store.ready) return;
    setPosts([]);
    setAfter(null);
    load('reset');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.ready, subs, sort, filterOpts]);

  const readIds = useMemo(() => new Set(history.map((h) => h.id)), [history]);
  const notedIds = useMemo(() => new Set(notes.map((n) => n.postId)), [notes]);
  const today = totals(stats, 1);
  const week = totals(stats, 7);
  const acc = accuracy(week);
  const due = dueCards(cards).length;
  const checkReady = settings.quizEvery > 0 && readSinceQuiz >= settings.quizEvery;
  const [hello, part] = greeting();

  const openPost = useCallback((p: Post) => router.push({ pathname: '/post/[id]', params: { id: p.id } }), [router]);
  const openNote = useCallback(
    (p: Post) => {
      postCache.set(p.id, p);
      router.push({ pathname: '/note', params: { postId: p.id } });
    },
    [router],
  );

  const header = (
    <View>
      <View style={[styles.hero, { paddingTop: insets.top + spacing.lg }]}>
        <View style={{ flex: 1 }}>
          <Text style={[type.hero, { color: colors.ink }]}>{settings.displayName ? `${hello},` : hello}</Text>
          <Text style={[type.hero, { color: colors.muted }]} numberOfLines={1}>
            {settings.displayName || part}
          </Text>
        </View>
        <IconButton
          icon="layers"
          accessibilityLabel="Review questions"
          onPress={() => router.push({ pathname: '/quiz', params: { mode: 'review' } })}
        />
        <IconButton icon="edit-3" variant="dark" accessibilityLabel="Notes" onPress={() => router.navigate('/notes')} />
      </View>

      <View style={styles.panelTop}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1, gap: spacing.sm + 2 }}>
            <Text style={type.title}>Today's learning</Text>
            {checkReady ? (
              <Badge label="Knowledge check ready" />
            ) : due > 0 ? (
              <Badge label={`${due} card${due === 1 ? '' : 's'} to review`} />
            ) : (
              <Badge label="Clean feed on" tone="dark" />
            )}
          </View>
          <IconButton icon="plus" variant="tile" accessibilityLabel="Add subreddit" onPress={() => router.push('/subreddits')} />
        </View>

        <View style={styles.tiles}>
          <StatTile
            label={'Read\ntoday'}
            value={`${String(today.read).padStart(2, '0')}/${settings.dailyGoal}`}
            progress={today.read / Math.max(1, settings.dailyGoal)}
            onPress={() => router.navigate('/learn')}
          />
          <StatTile
            label={'Quiz\naccuracy'}
            value={acc == null ? '—' : `${Math.round(acc * 100)}%`}
            progress={acc ?? 0}
            onPress={() => router.navigate('/learn')}
          />
        </View>

        {checkReady ? (
          <Pressable
            style={styles.check}
            onPress={() => router.push({ pathname: '/quiz', params: { mode: 'check' } })}
            accessibilityRole="button">
            <View style={styles.checkIcon}>
              <Feather name="zap" size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.checkTitle}>Knowledge check</Text>
              <Text style={styles.checkBody}>
                You've read {readSinceQuiz} posts. Lock them in with a quick quiz.
              </Text>
            </View>
            <Feather name="arrow-right" size={20} color="#fff" />
          </Pressable>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
          <Pill label="All" active={selected == null} onPress={() => setSelected(null)} />
          {settings.subreddits.map((s) => (
            <Pill key={s} label={s} active={selected === s} onPress={() => setSelected(s)} />
          ))}
        </ScrollView>

        <View style={styles.sorts}>
          {SORTS.map((s) => (
            <Pill key={s.key} label={s.label} tone="dark" active={sort === s.key} onPress={() => setSort(s.key)} />
          ))}
        </View>

        <SectionHeader title="Your feed" action={hidden > 0 ? `${hidden} hidden` : undefined} />

        {error ? (
          <View style={styles.error}>
            <Feather name="wifi-off" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => load('reset')} hitSlop={8}>
              <Text style={styles.retry}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.canvas }}
      contentContainerStyle={{ flexGrow: 1 }}
      data={posts}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <View style={styles.itemWrap}>
          <PostCard
            post={item}
            read={readIds.has(item.id)}
            hasNote={notedIds.has(item.id)}
            hideImages={settings.hideImages}
            onPress={openPost}
            onNote={openNote}
          />
        </View>
      )}
      ListEmptyComponent={
        loading ? null : (
          <View style={[styles.itemWrap, { paddingVertical: spacing.xl }]}>
            <Text style={[type.caption, { textAlign: 'center' }]}>{error ? '' : 'Nothing here yet. Pull to refresh.'}</Text>
          </View>
        )
      }
      ListFooterComponent={
        <View style={[styles.footer, { paddingBottom: insets.bottom + 110 }]}>
          {loading ? <ActivityIndicator color={colors.ink} /> : null}
        </View>
      }
      ListFooterComponentStyle={{ flexGrow: 1 }}
      onEndReached={() => load('more')}
      onEndReachedThreshold={0.6}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor={colors.ink} />}
    />
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl + 4,
  },
  panelTop: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl + 4,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xl + 4 },
  tiles: { flexDirection: 'row', gap: spacing.md },
  check: {
    marginTop: spacing.md,
    backgroundColor: colors.dark,
    borderRadius: radius.lg,
    padding: spacing.lg + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 2,
  },
  checkIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#3A3A3A', alignItems: 'center', justifyContent: 'center' },
  checkTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },
  checkBody: { color: '#BDBBB6', fontSize: 14, marginTop: 2, lineHeight: 19 },
  chipScroll: { marginHorizontal: -spacing.xl, marginTop: spacing.xl + 4 },
  chips: { gap: spacing.sm + 2, paddingHorizontal: spacing.xl },
  sorts: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.xl },
  itemWrap: { backgroundColor: colors.surface, paddingHorizontal: spacing.xl },
  footer: { backgroundColor: colors.surface, flexGrow: 1, paddingTop: spacing.md },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  errorText: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 19 },
  retry: { color: colors.danger, fontWeight: '700' },
});

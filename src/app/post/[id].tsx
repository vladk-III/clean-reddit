import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton, Panel } from '@/components/ui';
import { compact, plainText, timeAgo } from '@/lib/format';
import { Comment, fetchPost, Post } from '@/lib/reddit';
import { commentsCache, feedFilterOptions, postCache, useStore } from '@/lib/store';
import { colors, radius, spacing, type } from '@/lib/theme';

function CommentItem({ comment }: { comment: Comment }) {
  return (
    <View style={[styles.comment, comment.depth > 0 && styles.reply]}>
      <View style={styles.commentMeta}>
        <Text style={styles.commentAuthor}>{comment.author}</Text>
        {comment.score ? <Text style={type.caption}>· {compact(comment.score)} pts</Text> : null}
      </View>
      <Text style={styles.commentBody}>{plainText(comment.body)}</Text>
      {comment.replies.slice(0, 2).map((r) => (
        <CommentItem key={r.id} comment={r} />
      ))}
    </View>
  );
}

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { settings, notes, history, markRead } = useStore();

  const [post, setPost] = useState<Post | null>(postCache.get(id) ?? null);
  const [comments, setComments] = useState<Comment[]>(commentsCache.get(id) ?? []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const markedRead = useRef(false);
  const prompted = useRef(false);

  const note = notes.find((n) => n.postId === id);

  useEffect(() => {
    let cancelled = false;
    const permalink =
      postCache.get(id)?.permalink ??
      history.find((h) => h.id === id)?.permalink ??
      notes.find((n) => n.postId === id)?.permalink;
    fetchPost(id, { ...feedFilterOptions(settings), permalink: permalink || undefined })
      .then((res) => {
        if (cancelled) return;
        if (!res.post) {
          setPost(null);
          setError('This post is hidden by the content filter or no longer exists.');
          return;
        }
        postCache.set(id, res.post);
        commentsCache.set(id, res.comments);
        setPost(res.post);
        setComments(res.comments);
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Something went wrong.';
        // The post itself is usually already here from the feed; only the comments are missing.
        setError(postCache.has(id) ? `Couldn’t load comments. ${msg}` : msg);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (post && !markedRead.current) {
      markedRead.current = true;
      markRead(post);
    }
  }, [post, markRead]);

  // "Note after reading": intercept leaving the post (back button, swipe, hardware back)
  // and open the note sheet in its place.
  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (!settings.promptNoteAfterReading || prompted.current || note || !post) return;
      prompted.current = true;
      e.preventDefault();
      router.replace({ pathname: '/note', params: { postId: id, afterReading: '1' } });
    });
  }, [navigation, settings.promptNoteAfterReading, note, post, router, id]);

  const body = post ? plainText(post.selftext) : '';
  const showImage = post?.image && !settings.hideImages;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={[styles.nav, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon="chevron-left" accessibilityLabel="Back" variant="light" size={44} onPress={() => router.back()} />
        <Text style={styles.navTitle} numberOfLines={1}>
          {post ? `r/${post.subreddit}` : 'Post'}
        </Text>
        <IconButton
          icon="external-link"
          accessibilityLabel="Open on Reddit"
          size={44}
          onPress={() => post && Linking.openURL(`https://www.reddit.com${post.permalink}`)}
        />
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {post ? (
          <View style={styles.head}>
            <Text style={type.caption}>
              u/{post.author} · {timeAgo(post.createdUtc)} ago{post.flair ? ` · ${post.flair}` : ''}
            </Text>
            <Text style={styles.title}>{post.title}</Text>
            {post.hasStats ? (
              <View style={styles.stats}>
                <View style={styles.statChip}>
                  <Feather name="arrow-up" size={14} color={colors.inkSoft} />
                  <Text style={styles.statText}>{compact(post.score)}</Text>
                </View>
                <View style={styles.statChip}>
                  <Feather name="message-circle" size={14} color={colors.inkSoft} />
                  <Text style={styles.statText}>{compact(post.numComments)}</Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        <Panel style={{ paddingBottom: insets.bottom + spacing.xxl }}>
          {error ? <Text style={[type.body, { color: colors.danger }]}>{error}</Text> : null}

          {showImage ? (
            <Image
              source={{ uri: post!.image!.url }}
              style={[styles.image, { aspectRatio: post!.image!.width / post!.image!.height }]}
              contentFit="contain"
            />
          ) : null}

          {body ? <Text style={styles.body}>{body}</Text> : null}

          {post && !post.isSelf ? (
            <Pressable style={styles.link} onPress={() => Linking.openURL(post.url)}>
              <Feather name="link-2" size={16} color={colors.ink} />
              <Text style={styles.linkText} numberOfLines={1}>
                {post.domain}
              </Text>
              <Feather name="arrow-up-right" size={16} color={colors.muted} />
            </Pressable>
          ) : null}

          {post ? (
            <View style={styles.learnBox}>
              <Text style={styles.learnTitle}>Make it stick</Text>
              <Text style={styles.learnBody}>
                Answer a couple of questions or write down what you want to remember or act on.
              </Text>
              <View style={styles.actions}>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Quiz me"
                    icon="zap"
                    variant="accent"
                    onPress={() => router.push({ pathname: '/quiz', params: { postId: post.id } })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label={note ? 'Edit note' : 'Add note'}
                    icon="edit-3"
                    variant="dark"
                    onPress={() => router.push({ pathname: '/note', params: { postId: post.id } })}
                  />
                </View>
              </View>
              {note ? (
                <Text style={styles.notePreview} numberOfLines={3}>
                  {note.actionable ? '☐ ' : ''}
                  {note.text}
                </Text>
              ) : null}
            </View>
          ) : null}

          <Text style={[type.heading, { marginTop: spacing.xl, marginBottom: spacing.md }]}>Top comments</Text>
          {loading ? <ActivityIndicator color={colors.ink} /> : null}
          {!loading && comments.length === 0 && !error ? <Text style={type.caption}>No comments to show.</Text> : null}
          {comments.slice(0, 25).map((c) => (
            <CommentItem key={c.id} comment={c} />
          ))}
        </Panel>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  navTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.ink },
  head: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink, letterSpacing: -0.8, lineHeight: 33 },
  stats: { flexDirection: 'row', gap: spacing.sm },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  statText: { fontSize: 14, color: colors.inkSoft, fontWeight: '600' },
  image: { width: '100%', borderRadius: radius.md, backgroundColor: colors.tile, marginBottom: spacing.lg },
  body: { ...type.body, fontSize: 17, lineHeight: 26, color: colors.ink, marginBottom: spacing.lg },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.tile,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  linkText: { flex: 1, fontSize: 15, color: colors.ink, fontWeight: '500' },
  learnBox: { backgroundColor: colors.tile, borderRadius: radius.lg, padding: spacing.lg + 4, gap: spacing.sm },
  learnTitle: { ...type.heading },
  learnBody: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  notePreview: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: 14,
    color: colors.inkSoft,
    lineHeight: 20,
  },
  comment: { paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, gap: 4 },
  reply: {
    marginLeft: spacing.md,
    paddingLeft: spacing.md,
    borderTopWidth: 0,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
  },
  commentMeta: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  commentAuthor: { fontSize: 14, fontWeight: '600', color: colors.ink },
  commentBody: { fontSize: 15, color: colors.inkSoft, lineHeight: 22 },
});

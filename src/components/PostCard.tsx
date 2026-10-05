import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { compact, plainText, timeAgo } from '@/lib/format';
import type { Post } from '@/lib/reddit';
import { colors, radius, spacing } from '@/lib/theme';

type Props = {
  post: Post;
  read: boolean;
  hasNote: boolean;
  hideImages: boolean;
  onPress: (post: Post) => void;
  onNote: (post: Post) => void;
};

function PostCardImpl({ post, read, hasNote, hideImages, onPress, onNote }: Props) {
  const preview = post.isSelf ? plainText(post.selftext) : '';
  const showImage = !hideImages && post.image && !post.spoiler;
  return (
    <Pressable
      onPress={() => onPress(post)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={post.title}>
      <View style={styles.meta}>
        <View style={styles.subDot} />
        <Text style={styles.sub} numberOfLines={1}>
          r/{post.subreddit}
        </Text>
        <Text style={styles.time}>· {timeAgo(post.createdUtc)}</Text>
        {read ? <Text style={styles.readTag}>Read</Text> : null}
      </View>

      <Text style={[styles.title, read && { color: colors.inkSoft }]}>{post.title}</Text>

      {preview ? (
        <Text style={styles.preview} numberOfLines={3}>
          {preview}
        </Text>
      ) : null}

      {showImage ? (
        <Image
          source={{ uri: post.image!.url }}
          style={[styles.image, { aspectRatio: Math.max(0.8, Math.min(2, post.image!.width / post.image!.height)) }]}
          contentFit="cover"
          transition={150}
        />
      ) : !post.isSelf ? (
        <View style={styles.link}>
          <Feather name="link-2" size={14} color={colors.muted} />
          <Text style={styles.linkText} numberOfLines={1}>
            {post.domain}
          </Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.stat}>
          <Feather name="arrow-up" size={16} color={colors.muted} />
          <Text style={styles.statText}>{compact(post.score)}</Text>
        </View>
        <View style={styles.stat}>
          <Feather name="message-circle" size={16} color={colors.muted} />
          <Text style={styles.statText}>{compact(post.numComments)}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => onNote(post)}
          hitSlop={10}
          accessibilityLabel={hasNote ? 'Edit note' : 'Add note'}
          style={[styles.noteButton, hasNote && { backgroundColor: colors.accentSoft }]}>
          <Feather name="edit-3" size={16} color={hasNote ? colors.accent : colors.ink} />
        </Pressable>
      </View>
    </Pressable>
  );
}

export const PostCard = memo(PostCardImpl);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.lg + 4,
    marginBottom: spacing.md + 4,
    gap: spacing.md,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  subDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  sub: { fontSize: 14, fontWeight: '600', color: colors.ink, flexShrink: 1 },
  time: { fontSize: 14, color: colors.muted },
  readTag: {
    marginLeft: 'auto',
    fontSize: 12,
    color: colors.muted,
    backgroundColor: colors.tile,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  title: { fontSize: 18, fontWeight: '600', color: colors.ink, letterSpacing: -0.3, lineHeight: 24 },
  preview: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  image: { width: '100%', borderRadius: radius.md, backgroundColor: colors.tile },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.tile,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  linkText: { fontSize: 13, color: colors.muted },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 14, color: colors.muted, fontWeight: '500' },
  noteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

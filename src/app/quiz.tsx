import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, EmptyState, IconButton, ProgressRing } from '@/components/ui';
import { aiQuestionsForPost } from '@/lib/ai';
import { dueCards, localQuestionsForPost, Question, ReadPost } from '@/lib/quiz';
import { commentsCache, postCache, useStore } from '@/lib/store';
import { colors, radius, spacing, type } from '@/lib/theme';

type Mode = 'post' | 'check' | 'review';

function shuffleInPlace<T>(a: T[]) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function QuizScreen() {
  const params = useLocalSearchParams<{ postId?: string; mode?: string }>();
  const mode: Mode = params.postId ? 'post' : params.mode === 'review' ? 'review' : 'check';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { history, cards, settings, recordAnswer, resetKnowledgeCheck, readSinceQuiz } = useStore();

  // Build the question set once; store updates during the quiz must not reshuffle it.
  // Offline sets are ready immediately; only the AI path needs an async request.
  const [plan] = useState(() => {
    if (mode === 'review') return { questions: dueCards(cards).slice(0, 10).map((c) => c.question) };
    if (mode === 'check') {
      const recent = history.slice(0, Math.max(3, Math.min(readSinceQuiz || settings.quizEvery, 10)));
      const qs = recent.flatMap((p) => localQuestionsForPost(p, history.filter((h) => h.id !== p.id)).slice(0, 1));
      return { questions: shuffleInPlace(qs).slice(0, 6) };
    }
    const id = params.postId!;
    const cached = postCache.get(id);
    const post: ReadPost | undefined =
      history.find((h) => h.id === id) ??
      (cached && { id, title: cached.title, subreddit: cached.subreddit, selftext: cached.selftext, permalink: cached.permalink, readAt: Date.now() });
    if (!post) return { questions: [] };
    const others = history.filter((h) => h.id !== id);
    if (settings.aiQuizzes && settings.anthropicKey) return { questions: null, aiPost: post, others };
    return { questions: localQuestionsForPost(post, others) };
  });

  const [questions, setQuestions] = useState<Question[] | null>(plan.questions);
  const [notice, setNotice] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);

  useEffect(() => {
    if (!plan.aiPost) return;
    const post = plan.aiPost;
    const others = plan.others ?? [];
    let cancelled = false;
    aiQuestionsForPost(settings.anthropicKey, post, commentsCache.get(post.id) ?? [])
      .then((qs) => !cancelled && setQuestions(qs.length ? qs : localQuestionsForPost(post, others)))
      .catch((e) => {
        if (cancelled) return;
        setNotice(`${e instanceof Error ? e.message : 'AI questions unavailable.'} Using offline questions instead.`);
        setQuestions(localQuestionsForPost(post, others));
      });
    return () => {
      cancelled = true;
    };
  }, [plan, settings.anthropicKey]);

  const done = questions != null && index >= questions.length && questions.length > 0;

  useEffect(() => {
    if (done && mode === 'check') resetKnowledgeCheck();
  }, [done, mode, resetKnowledgeCheck]);

  const q = questions?.[index];
  const title = useMemo(() => ({ post: 'Quiz', check: 'Knowledge check', review: 'Review' })[mode], [mode]);

  const choose = (i: number) => {
    if (picked != null || !q) return;
    setPicked(i);
    const ok = i === q.answerIndex;
    if (ok) setCorrect((c) => c + 1);
    recordAnswer(q, ok);
  };

  const next = () => {
    setPicked(null);
    setIndex((i) => i + 1);
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={[styles.nav, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon="x" size={44} accessibilityLabel="Close quiz" onPress={close} />
        <Text style={styles.navTitle}>{title}</Text>
        <View style={{ width: 44 }} />
      </View>

      {questions == null ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.ink} />
          <Text style={[type.caption, { marginTop: spacing.md }]}>
            {settings.aiQuizzes && settings.anthropicKey ? 'Writing questions with Claude…' : 'Building questions…'}
          </Text>
        </View>
      ) : questions.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            icon={mode === 'review' ? 'check-circle' : 'book-open'}
            title={mode === 'review' ? 'Nothing due' : 'Not enough to quiz on'}
            body={
              mode === 'review'
                ? 'You are all caught up. Questions you answer come back here on a spaced schedule.'
                : 'Read a few text posts (TIL, ELI5, AskScience work great) and try again.'
            }
          />
          <Button label="Back to reading" onPress={close} />
        </View>
      ) : done ? (
        <View style={styles.center}>
          <ProgressRing progress={correct / questions.length} size={120} stroke={12} />
          <Text style={[type.display, { marginTop: spacing.xl }]}>
            {correct}/{questions.length}
          </Text>
          <Text style={[type.body, { textAlign: 'center', marginBottom: spacing.xl }]}>
            {correct === questions.length
              ? 'Perfect. These will come back in a few days to keep them fresh.'
              : 'Missed ones will come back tomorrow in Review.'}
          </Text>
          <Button label="Done" onPress={close} />
        </View>
      ) : q ? (
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${((index + (picked != null ? 1 : 0)) / questions.length) * 100}%` }]} />
          </View>
          <Text style={type.caption}>
            Question {index + 1} of {questions.length} · r/{q.subreddit}
            {q.source === 'ai' ? ' · by Claude' : ''}
          </Text>
          {notice && index === 0 ? <Text style={styles.notice}>{notice}</Text> : null}
          <Text style={styles.prompt}>{q.prompt}</Text>

          <View style={{ gap: spacing.md }}>
            {q.choices.map((choice, i) => {
              const isAnswer = i === q.answerIndex;
              const state = picked == null ? 'idle' : isAnswer ? 'right' : picked === i ? 'wrong' : 'dim';
              return (
                <Pressable
                  key={`${i}-${choice}`}
                  onPress={() => choose(i)}
                  style={({ pressed }) => [
                    styles.choice,
                    state === 'right' && { backgroundColor: colors.successSoft, borderColor: colors.success },
                    state === 'wrong' && { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
                    state === 'dim' && { opacity: 0.5 },
                    pressed && picked == null && { opacity: 0.7 },
                  ]}>
                  <View style={styles.choiceKey}>
                    <Text style={styles.choiceKeyText}>{String.fromCharCode(65 + i)}</Text>
                  </View>
                  <Text style={styles.choiceText}>{choice}</Text>
                  {state === 'right' ? <Feather name="check" size={20} color={colors.success} /> : null}
                  {state === 'wrong' ? <Feather name="x" size={20} color={colors.danger} /> : null}
                </Pressable>
              );
            })}
          </View>

          {picked != null ? (
            <View style={{ gap: spacing.lg, marginTop: spacing.lg }}>
              {q.explanation ? <Text style={styles.explanation}>{q.explanation}</Text> : null}
              <Button label={index + 1 === questions.length ? 'See results' : 'Next question'} onPress={next} />
            </View>
          ) : null}
        </ScrollView>
      ) : null}
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
  },
  navTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  body: { padding: spacing.xl, gap: spacing.lg },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  notice: { fontSize: 13, color: colors.inkSoft, backgroundColor: colors.accentSoft, padding: spacing.md, borderRadius: radius.sm },
  prompt: { fontSize: 22, fontWeight: '600', color: colors.ink, lineHeight: 30, letterSpacing: -0.4, marginBottom: spacing.sm },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.surface,
    padding: spacing.lg,
  },
  choiceKey: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.tile, alignItems: 'center', justifyContent: 'center' },
  choiceKeyText: { fontWeight: '700', color: colors.ink },
  choiceText: { flex: 1, fontSize: 16, color: colors.ink, lineHeight: 22 },
  explanation: { fontSize: 15, color: colors.inkSoft, lineHeight: 22, backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.md },
});

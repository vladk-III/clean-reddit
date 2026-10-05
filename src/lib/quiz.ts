import type { Post } from './reddit';

export type Question = {
  id: string;
  postId: string;
  postTitle: string;
  subreddit: string;
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation?: string;
  source: 'local' | 'ai';
};

/** Lightweight post snapshot kept in history so quizzes work offline later. */
export type ReadPost = Pick<Post, 'id' | 'title' | 'subreddit' | 'selftext' | 'permalink'> & { readAt: number };

type Rng = () => number;

const STOPWORDS = new Set(
  (
    'a an and are as at be been but by can could did do does for from had has have he her his how i if in into is it its ' +
    'just like me more most my no not now of on one or our out over so some than that the their them then there these ' +
    'they this those to too up us very was we were what when where which who why will with would you your about after ' +
    'again all also am any because before being both each few further here him himself itself let made many may might ' +
    'much must myself new off once only other own same she should still such through under until while yet til today ' +
    'learned eli5 people thing things really actually know get got make way time year years first last make why does'
  ).split(' '),
);

function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sentences(text: string): string[] {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // markdown links -> text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_>#`~]/g, '')
    .replace(/([.!?])\s+/g, '$1\n')
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 6 && s.length <= 220);
}

function tokens(sentence: string): string[] {
  return sentence.split(/\s+/).map((w) => w.replace(/^[^\w]+|[^\w%]+$/g, ''));
}

function isNumberToken(w: string) {
  return /^\d[\d,.]*%?$/.test(w);
}

/** Words worth quizzing on: numbers, capitalised names, or long non-stopwords. */
export function keywords(sentence: string): string[] {
  const words = tokens(sentence);
  return words.filter((w, i) => {
    if (!w || w.length < 3) return isNumberToken(w) && w.length > 0;
    if (isNumberToken(w)) return true;
    const lower = w.toLowerCase();
    if (STOPWORDS.has(lower)) return false;
    if (/^[A-Z]/.test(w) && i > 0) return true;
    return w.length >= 6;
  });
}

function numberDistractors(answer: string, rng: Rng): string[] {
  const pct = answer.endsWith('%');
  const n = Number(answer.replace(/[,%]/g, ''));
  if (!Number.isFinite(n)) return [];
  const isYear = Number.isInteger(n) && n >= 1000 && n <= 2100 && !pct;
  const offsets = isYear ? [-50, -20, -10, 10, 20, 100] : [0.5, 0.25, 2, 3, 10, 1.5];
  const out = new Set<string>();
  for (const o of shuffle(offsets, rng)) {
    let v = isYear ? n + o : n * o;
    if (Number.isInteger(n)) v = Math.round(v);
    else v = Math.round(v * 10) / 10;
    if (v === n || v <= 0) continue;
    const s = answer.includes(',') ? v.toLocaleString('en-US') : String(v);
    out.add(pct ? `${s}%` : s);
    if (out.size === 3) break;
  }
  return [...out];
}

function wordDistractors(answer: string, pool: string[], rng: Rng): string[] {
  const capital = /^[A-Z]/.test(answer);
  const seen = new Set([answer.toLowerCase()]);
  const candidates = shuffle(pool, rng).filter((w) => {
    const lower = w.toLowerCase();
    if (seen.has(lower) || !/^[A-Za-z]+$/.test(w)) return false;
    if (/^[A-Z]/.test(w) !== capital) return false;
    seen.add(lower);
    return true;
  });
  return candidates.slice(0, 3);
}

let counter = 0;
function qid(postId: string) {
  counter += 1;
  return `${postId}-${Date.now().toString(36)}-${counter}`;
}

/**
 * Fill-in-the-blank questions built from the post's own text. Works offline, no AI needed.
 * `others` supplies distractor words from other recently read posts.
 */
export function clozeQuestions(post: ReadPost, others: ReadPost[], max = 2, rng: Rng = Math.random): Question[] {
  const sourceText = `${post.title.replace(/^(TIL|ELI5)[:,\s-]*(that\s+)?/i, '')}. ${post.selftext}`;
  const candidates = shuffle(sentences(sourceText), rng);
  const pool = [...others, post].flatMap((p) => sentences(`${p.title}. ${p.selftext}`).flatMap(keywords));
  const fallbackPool = ['Mercury', 'Napoleon', 'Pacific', 'Egypt', 'Tokyo', 'Jupiter', 'calcium', 'gravity', 'protein', 'oxygen', 'algorithm', 'glacier', 'Saturn', 'Roman', 'bacteria', 'volcano'];

  const out: Question[] = [];
  const used = new Set<string>();
  for (const sentence of candidates) {
    if (out.length >= max) break;
    const keys = keywords(sentence).filter((k) => !used.has(k.toLowerCase()));
    if (!keys.length) continue;
    // Prefer numbers and proper nouns: they are the facts people want to remember.
    const ranked = [...keys].sort((a, b) => score(b) - score(a));
    const answer = ranked[0];
    let distractors = isNumberToken(answer)
      ? numberDistractors(answer, rng)
      : wordDistractors(answer, pool.filter((w) => !sentence.includes(w)), rng);
    if (distractors.length < 3 && !isNumberToken(answer)) {
      distractors = [...distractors, ...wordDistractors(answer, fallbackPool, rng).filter((d) => !distractors.includes(d))].slice(0, 3);
    }
    if (distractors.length < 2) continue;
    used.add(answer.toLowerCase());
    const blanked = sentence.replace(new RegExp(`\\b${answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), '_____');
    const choices = shuffle([answer, ...distractors], rng);
    out.push({
      id: qid(post.id),
      postId: post.id,
      postTitle: post.title,
      subreddit: post.subreddit,
      prompt: `Fill in the blank:\n“${blanked}”`,
      choices,
      answerIndex: choices.indexOf(answer),
      explanation: `From r/${post.subreddit}: “${sentence}”`,
      source: 'local',
    });
  }
  return out;
}

function score(word: string) {
  if (isNumberToken(word)) return 3;
  if (/^[A-Z]/.test(word)) return 2;
  return word.length / 10;
}

/** "Which community was this from?" — good for spaced review across many posts. */
export function subredditQuestion(post: ReadPost, others: ReadPost[], rng: Rng = Math.random): Question | null {
  const subs = [...new Set(others.map((o) => o.subreddit).filter((s) => s.toLowerCase() !== post.subreddit.toLowerCase()))];
  const fallback = ['todayilearned', 'askscience', 'AskHistorians', 'space', 'explainlikeimfive', 'dataisbeautiful', 'YouShouldKnow'];
  const distractors = shuffle(subs, rng).slice(0, 3);
  for (const f of shuffle(fallback, rng)) {
    if (distractors.length >= 3) break;
    if (f.toLowerCase() !== post.subreddit.toLowerCase() && !distractors.includes(f)) distractors.push(f);
  }
  const choices = shuffle([post.subreddit, ...distractors], rng).map((s) => `r/${s}`);
  return {
    id: qid(post.id),
    postId: post.id,
    postTitle: post.title,
    subreddit: post.subreddit,
    prompt: `Where did you read this?\n“${post.title}”`,
    choices,
    answerIndex: choices.indexOf(`r/${post.subreddit}`),
    source: 'local',
  };
}

export function localQuestionsForPost(post: ReadPost, others: ReadPost[], rng: Rng = Math.random): Question[] {
  const qs = clozeQuestions(post, others, 2, rng);
  if (qs.length < 2) {
    const sq = subredditQuestion(post, others, rng);
    if (sq) qs.push(sq);
  }
  return qs;
}

// ---------- Spaced repetition (Leitner boxes) ----------

export type Card = { question: Question; box: number; dueAt: number; lastAnsweredAt?: number };

const DAY = 24 * 60 * 60 * 1000;
const BOX_INTERVALS = [0, 1, 3, 7, 16, 35]; // days until next review per box

export function newCard(question: Question, now = Date.now()): Card {
  return { question, box: 1, dueAt: now + BOX_INTERVALS[1] * DAY };
}

export function reviewCard(card: Card, correct: boolean, now = Date.now()): Card {
  const box = correct ? Math.min(card.box + 1, BOX_INTERVALS.length - 1) : 1;
  return { ...card, box, dueAt: now + BOX_INTERVALS[box] * DAY, lastAnsweredAt: now };
}

export function dueCards(cards: Card[], now = Date.now()): Card[] {
  return cards.filter((c) => c.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt);
}

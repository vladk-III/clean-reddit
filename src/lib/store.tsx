import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type { Card, Question, ReadPost } from './quiz';
import { newCard, reviewCard } from './quiz';
import type { Comment, Post } from './reddit';

export type Settings = {
  displayName: string;
  subreddits: string[];
  strictFilter: boolean;
  blockedWords: string[];
  hideImages: boolean;
  dailyGoal: number;
  /** Show a knowledge check after this many posts read. 0 turns it off. */
  quizEvery: number;
  /** Open the note sheet when leaving a post. */
  promptNoteAfterReading: boolean;
  aiQuizzes: boolean;
  anthropicKey: string;
  redditClientId: string;
  /** Web only: overrides the relay URL built into the site. */
  redditProxy: string;
};

export type Note = {
  id: string;
  postId: string;
  postTitle: string;
  subreddit: string;
  permalink: string;
  text: string;
  actionable: boolean;
  done: boolean;
  createdAt: number;
  updatedAt: number;
};

export type DayStats = { read: number; answered: number; correct: number };

export const DEFAULT_SUBREDDITS = [
  'todayilearned',
  'explainlikeimfive',
  'askscience',
  'AskHistorians',
  'space',
  'science',
  'dataisbeautiful',
  'YouShouldKnow',
  'LifeProTips',
  'history',
];

export const DEFAULT_SETTINGS: Settings = {
  displayName: '',
  subreddits: DEFAULT_SUBREDDITS,
  strictFilter: true,
  blockedWords: [],
  hideImages: false,
  dailyGoal: 10,
  quizEvery: 5,
  promptNoteAfterReading: false,
  aiQuizzes: false,
  anthropicKey: '',
  redditClientId: '',
  redditProxy: '',
};

type PersistedState = {
  settings: Settings;
  notes: Note[];
  history: ReadPost[];
  cards: Card[];
  stats: Record<string, DayStats>;
  readSinceQuiz: number;
};

const KEYS: { [K in keyof PersistedState]: string } = {
  settings: 'cr.settings',
  notes: 'cr.notes',
  history: 'cr.history',
  cards: 'cr.cards',
  stats: 'cr.stats',
  readSinceQuiz: 'cr.readSinceQuiz',
};

const INITIAL: PersistedState = {
  settings: DEFAULT_SETTINGS,
  notes: [],
  history: [],
  cards: [],
  stats: {},
  readSinceQuiz: 0,
};

const MAX_HISTORY = 300;
const MAX_CARDS = 500;

export function dayKey(t = Date.now()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Store = PersistedState & {
  ready: boolean;
  updateSettings: (patch: Partial<Settings>) => void;
  markRead: (post: Post) => void;
  saveNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Note;
  updateNote: (id: string, patch: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  recordAnswer: (question: Question, correct: boolean) => void;
  resetKnowledgeCheck: () => void;
  clearAllData: () => Promise<void>;
};

const StoreContext = createContext<Store | null>(null);

// Posts the user tapped on, so the detail screen can render instantly before comments load.
export const postCache = new Map<string, Post>();
export const commentsCache = new Map<string, Comment[]>();

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(INITIAL);
  const [ready, setReady] = useState(false);
  const dirty = useRef(new Set<keyof PersistedState>());

  useEffect(() => {
    (async () => {
      try {
        const entries = await AsyncStorage.multiGet(Object.values(KEYS));
        const loaded: Partial<PersistedState> = {};
        (Object.keys(KEYS) as (keyof PersistedState)[]).forEach((k, i) => {
          const raw = entries[i]?.[1];
          if (raw != null) (loaded as any)[k] = JSON.parse(raw);
        });
        setState((s) => ({
          ...s,
          ...loaded,
          settings: { ...DEFAULT_SETTINGS, ...(loaded.settings ?? {}) },
        }));
      } catch {
        // Corrupt storage should never brick the app; start fresh.
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // Persist only the slices that changed.
  useEffect(() => {
    if (!ready || dirty.current.size === 0) return;
    const keys = [...dirty.current];
    dirty.current.clear();
    AsyncStorage.multiSet(keys.map((k) => [KEYS[k], JSON.stringify(state[k])])).catch(() => {});
  }, [state, ready]);

  const update = useCallback(<K extends keyof PersistedState>(key: K, fn: (prev: PersistedState[K]) => PersistedState[K]) => {
    dirty.current.add(key);
    setState((s) => ({ ...s, [key]: fn(s[key]) }));
  }, []);

  const bumpStats = useCallback(
    (patch: Partial<DayStats>) =>
      update('stats', (prev) => {
        const k = dayKey();
        const cur = prev[k] ?? { read: 0, answered: 0, correct: 0 };
        return {
          ...prev,
          [k]: {
            read: cur.read + (patch.read ?? 0),
            answered: cur.answered + (patch.answered ?? 0),
            correct: cur.correct + (patch.correct ?? 0),
          },
        };
      }),
    [update],
  );

  const value = useMemo<Store>(
    () => ({
      ...state,
      ready,
      updateSettings: (patch) => update('settings', (prev) => ({ ...prev, ...patch })),
      markRead: (post) => {
        const already = state.history.some((h) => h.id === post.id);
        update('history', (prev) =>
          [
            {
              id: post.id,
              title: post.title,
              subreddit: post.subreddit,
              selftext: post.selftext.slice(0, 4000),
              permalink: post.permalink,
              readAt: Date.now(),
            },
            ...prev.filter((h) => h.id !== post.id),
          ].slice(0, MAX_HISTORY),
        );
        if (!already) {
          bumpStats({ read: 1 });
          update('readSinceQuiz', (n) => n + 1);
        }
      },
      saveNote: (input) => {
        const now = Date.now();
        const existing = input.id ? state.notes.find((n) => n.id === input.id) : undefined;
        const note: Note = {
          ...input,
          id: existing?.id ?? `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        update('notes', (prev) => [note, ...prev.filter((n) => n.id !== note.id)]);
        return note;
      },
      updateNote: (id, patch) =>
        update('notes', (prev) => prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n))),
      deleteNote: (id) => update('notes', (prev) => prev.filter((n) => n.id !== id)),
      recordAnswer: (question, correct) => {
        bumpStats({ answered: 1, correct: correct ? 1 : 0 });
        update('cards', (prev) => {
          const existing = prev.find((c) => c.question.id === question.id);
          // Wrong answers come back tomorrow; right ones get pushed further out.
          const card = reviewCard(existing ?? newCard(question), correct);
          return [card, ...prev.filter((c) => c.question.id !== question.id)].slice(0, MAX_CARDS);
        });
      },
      resetKnowledgeCheck: () => update('readSinceQuiz', () => 0),
      clearAllData: async () => {
        await AsyncStorage.multiRemove(Object.values(KEYS));
        setState(INITIAL);
      },
    }),
    [state, ready, update, bumpStats],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

export function feedFilterOptions(
  settings: Pick<Settings, 'strictFilter' | 'blockedWords' | 'redditClientId' | 'redditProxy'>,
) {
  return {
    strict: settings.strictFilter,
    extraBlockedWords: settings.blockedWords,
    auth: { clientId: settings.redditClientId || undefined, proxyUrl: settings.redditProxy || undefined },
  };
}

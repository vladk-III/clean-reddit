import { clozeQuestions, dueCards, keywords, localQuestionsForPost, newCard, ReadPost, reviewCard, subredditQuestion } from '@/lib/quiz';

function seeded(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const post: ReadPost = {
  id: 'p1',
  title: 'TIL the Great Wall of China is not visible from the Moon with the naked eye',
  subreddit: 'todayilearned',
  selftext:
    'Astronaut Yang Liwei confirmed in 2003 that he could not see the wall from orbit. The wall is only about 6 metres wide in most places, which is far too narrow to resolve from 384,000 kilometres away.',
  permalink: '/r/todayilearned/comments/p1/',
  readAt: 0,
};

const others: ReadPost[] = [
  { id: 'p2', title: 'ELI5: Why does Saturn have rings while Jupiter barely has any?', subreddit: 'explainlikeimfive', selftext: '', permalink: '', readAt: 0 },
  { id: 'p3', title: 'How did Roman engineers build aqueducts across valleys without modern tools?', subreddit: 'AskHistorians', selftext: '', permalink: '', readAt: 0 },
  { id: 'p4', title: 'Why do glaciers look blue when ordinary snow and ice look white?', subreddit: 'askscience', selftext: '', permalink: '', readAt: 0 },
];

describe('quiz generation', () => {
  it('extracts numbers and names as keywords', () => {
    const k = keywords('Astronaut Yang Liwei confirmed in 2003 that he could not see the wall');
    expect(k).toEqual(expect.arrayContaining(['Yang', 'Liwei', '2003', 'confirmed']));
    expect(k).not.toContain('the');
  });

  it('builds fill-in-the-blank questions with one correct answer', () => {
    const qs = clozeQuestions(post, others, 2, seeded());
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) {
      expect(q.prompt).toContain('_____');
      expect(new Set(q.choices).size).toBe(q.choices.length);
      expect(q.choices.length).toBeGreaterThanOrEqual(3);
      const answer = q.choices[q.answerIndex];
      expect(q.explanation).toContain(answer);
      expect(q.prompt).not.toContain(answer);
    }
  });

  it('builds a subreddit recall question', () => {
    const q = subredditQuestion(post, others, seeded())!;
    expect(q.choices[q.answerIndex]).toBe('r/todayilearned');
    expect(q.choices).toHaveLength(4);
  });

  it('always produces something for short link posts', () => {
    const short: ReadPost = { ...post, title: 'Cool photo', selftext: '' };
    expect(localQuestionsForPost(short, others, seeded()).length).toBeGreaterThan(0);
  });
});

describe('spaced repetition', () => {
  const day = 24 * 60 * 60 * 1000;
  const q = subredditQuestion(post, others, seeded())!;

  it('moves correct answers further out and resets wrong ones', () => {
    const now = 1_000_000;
    let card = newCard(q, now);
    card = reviewCard(card, true, now);
    expect(card.box).toBe(2);
    expect(card.dueAt).toBe(now + 3 * day);
    card = reviewCard(card, false, now);
    expect(card.box).toBe(1);
    expect(card.dueAt).toBe(now + day);
  });

  it('lists only due cards, oldest first', () => {
    const now = 10 * day;
    const a = { ...newCard(q, 0), dueAt: now - day };
    const b = { ...newCard(q, 0), dueAt: now - 2 * day };
    const c = { ...newCard(q, 0), dueAt: now + day };
    expect(dueCards([a, b, c], now)).toEqual([b, a]);
  });
});

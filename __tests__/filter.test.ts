import { blockReason, containsBlockedText, filterComments, isSubredditAllowed } from '@/lib/filter';
import type { Post } from '@/lib/reddit';

const base: Post = {
  id: 'a1',
  title: 'TIL octopuses have three hearts',
  subreddit: 'todayilearned',
  author: 'someone',
  selftext: '',
  url: 'https://en.wikipedia.org/wiki/Octopus',
  domain: 'en.wikipedia.org',
  permalink: '/r/todayilearned/comments/a1/',
  score: 100,
  numComments: 10,
  hasStats: true,
  createdUtc: 0,
  isSelf: false,
  isVideo: false,
  over18: false,
  spoiler: false,
  quarantine: false,
  flair: null,
  image: null,
};

const strict = { strict: true, extraWords: [] };
const lenient = { strict: false, extraWords: [] };

describe('content filter', () => {
  it('lets clean posts through', () => {
    expect(blockReason(base, strict)).toBeNull();
  });

  it("always blocks posts Reddit marks NSFW, even with strict mode off", () => {
    expect(blockReason({ ...base, over18: true }, lenient)).toBe('marked NSFW');
    expect(blockReason({ ...base, quarantine: true }, lenient)).toBe('quarantined');
  });

  it('blocks adult subreddits and domains', () => {
    expect(blockReason({ ...base, subreddit: 'gonewild' }, lenient)).toBe('blocked subreddit');
    expect(blockReason({ ...base, domain: 'i.redgifs.com' }, lenient)).toBe('blocked domain');
    expect(isSubredditAllowed('PetiteGoneWild')).toBe(false);
    expect(isSubredditAllowed('askscience')).toBe(true);
    expect(isSubredditAllowed('Sussex')).toBe(true);
  });

  it('blocks explicit keywords in titles, bodies and flair', () => {
    expect(blockReason({ ...base, title: 'Check out my OnlyFans' }, lenient)).toBe('title');
    expect(blockReason({ ...base, selftext: 'this is so horny lol' }, lenient)).toBe('body');
    expect(blockReason({ ...base, flair: 'NSFW' }, lenient)).toBe('flair');
    expect(containsBlockedText('Feeling cute today [F]', lenient)).toBe(true);
  });

  it('blocks suggestive terms only in strict mode', () => {
    const post = { ...base, title: 'Rate my bikini body' };
    expect(blockReason(post, strict)).toBe('title');
    expect(blockReason(post, lenient)).toBeNull();
  });

  it('avoids common false positives', () => {
    for (const text of [
      'The cockpit of a 747',
      'Life in Essex and Sussex',
      'Graduated summa cum laude',
      'Visible to the naked eye tonight',
      'How to hook up a second monitor',
      'Analysis of the 2008 recession',
      'A 28F asking about her taxes (28F)',
    ]) {
      expect(containsBlockedText(text, strict)).toBe(false);
    }
  });

  it('supports user-defined blocked words', () => {
    expect(containsBlockedText('Election results are in', { strict: false, extraWords: ['election'] })).toBe(true);
  });

  it('drops blocked comments together with their replies', () => {
    const comments = [
      { id: '1', author: 'a', body: 'Great explanation', score: 1, depth: 0, replies: [{ id: '2', author: 'b', body: 'nsfw link here', score: 1, depth: 1, replies: [] }] },
      { id: '3', author: 'c', body: 'send nudes', score: 1, depth: 0, replies: [{ id: '4', author: 'd', body: 'fine reply', score: 1, depth: 1, replies: [] }] },
    ];
    const out = filterComments(comments, strict);
    expect(out.map((c) => c.id)).toEqual(['1']);
    expect(out[0].replies).toEqual([]);
  });
});

import { checkSubreddit, fetchFeed, fetchPost, onSessionExpired, resetFeedState } from '@/lib/reddit';

const jsonPost = (id: string, extra: Record<string, unknown> = {}) => ({
  kind: 't3',
  data: { id, title: `Post ${id}`, subreddit: 'askscience', author: 'a', selftext: 'Body', permalink: `/r/askscience/comments/${id}/x/`, score: 1234, num_comments: 56, created_utc: 1, is_self: true, ...extra },
});

const res = (body: string, status = 200, url = 'https://www.reddit.com/x.json') =>
  ({ ok: status < 400, status, url, text: async () => body, headers: { get: () => null } }) as unknown as Response;

const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><author><name>/u/a</name></author><category term="askscience"/><content type="html"></content><id>t3_rss1</id><link href="https://www.reddit.com/r/askscience/comments/rss1/x/" /><published>2026-10-05T11:00:00+00:00</published><title>From the feed</title></entry></feed>`;

const signedIn = { auth: { session: true } };

describe('signed-in Reddit session', () => {
  beforeEach(() => resetFeedState());
  afterEach(() => onSessionExpired(null));

  it('loads full data (with counts and NSFW flags) when signed in', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      res(JSON.stringify({ kind: 'Listing', data: { after: 't3_p2', children: [jsonPost('p1'), jsonPost('p2', { over_18: true })] } })),
    );
    const listing = await fetchFeed({ subreddits: ['askscience'], sort: 'hot', ...signedIn });
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('https://www.reddit.com/r/askscience/hot.json?raw_json=1&limit=25');
    expect((global.fetch as jest.Mock).mock.calls[0][1]).toMatchObject({ credentials: 'include' });
    expect(listing.posts.map((p) => [p.id, p.score, p.hasStats])).toEqual([['p1', 1234, true]]); // NSFW post removed
    expect(listing.after).toBe('t3_p2');
  });

  it('returns nested replies from full data', async () => {
    const tree = [
      { data: { children: [jsonPost('p1')] } },
      {
        data: {
          children: [
            { kind: 't1', data: { id: 'c1', author: 'x', body: 'Top', score: 5, replies: { data: { children: [{ kind: 't1', data: { id: 'c2', author: 'y', body: 'Reply', score: 2, replies: '' } }] } } } },
          ],
        },
      },
    ];
    global.fetch = jest.fn().mockResolvedValue(res(JSON.stringify(tree)));
    const { comments } = await fetchPost('p1', signedIn);
    expect(comments[0].replies.map((r) => [r.id, r.depth])).toEqual([['c2', 1]]);
  });

  it('falls back to the public feeds and reports it when the sign-in expires', async () => {
    const expired = jest.fn();
    onSessionExpired(expired);
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(res('<!DOCTYPE html><html>log in</html>', 200, 'https://www.reddit.com/login/'))
      .mockResolvedValueOnce(res(atom));
    const listing = await fetchFeed({ subreddits: ['askscience'], sort: 'hot', ...signedIn });
    expect(expired).toHaveBeenCalledTimes(1);
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain('/r/askscience/hot/.rss');
    expect(listing.posts.map((p) => p.id)).toEqual(['rss1']);
  });

  it("uses Reddit's own adult flag when adding a subreddit", async () => {
    global.fetch = jest.fn().mockResolvedValue(res(JSON.stringify({ kind: 't5', data: { over18: true } })));
    expect(await checkSubreddit('somesub', { session: true })).toMatchObject({ ok: false, reason: expect.stringContaining('adult') });
  });
});

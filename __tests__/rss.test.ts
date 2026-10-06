import { entryToComment, entryToPost, htmlToText, isAtom, parseAtom } from '@/lib/rss';

// Shaped like Reddit's Atom feeds: content is XML-escaped HTML.
const esc = (html: string) => html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const submitted = (sub: string, id: string, link: string) =>
  ` &#32; submitted by &#32; <a href="https://www.reddit.com/user/someone"> /u/someone </a> <br/> <span><a href="${link}">[link]</a></span> &#32; <span><a href="https://www.reddit.com/r/${sub}/comments/${id}/slug/">[comments]</a></span>`;

const selfPost = `<entry><author><name>/u/curious_cat</name><uri>https://www.reddit.com/user/curious_cat</uri></author><category term="askscience" label="r/askscience"/><content type="html">${esc(
  '<!-- SC_OFF --><div class="md"><p>Sunlight scatters off <strong>nitrogen</strong> &amp; oxygen.</p> <ul><li>Blue scatters most</li></ul> </div><!-- SC_ON -->' +
    submitted('askscience', 'abc123', 'https://www.reddit.com/r/askscience/comments/abc123/slug/'),
)}</content><id>t3_abc123</id><link href="https://www.reddit.com/r/askscience/comments/abc123/slug/" /><updated>2026-10-05T12:00:00+00:00</updated><published>2026-10-05T11:00:00+00:00</published><title>Why is the sky blue &amp; sunsets red?</title></entry>`;

const imagePost = `<entry><author><name>/u/photographer</name></author><category term="space" label="r/space"/><content type="html">${esc(
  '<table> <tr><td> <a href="https://www.reddit.com/r/space/comments/img1/slug/"> <img src="https://b.thumbs.redditmedia.com/t.jpg" alt="Moon" title="Moon" /> </a> </td><td>' +
    submitted('space', 'img1', 'https://i.redd.it/moon.jpeg') +
    '</td></tr></table>',
)}</content><id>t3_img1</id><media:thumbnail url="https://b.thumbs.redditmedia.com/t.jpg" /><link href="https://www.reddit.com/r/space/comments/img1/slug/" /><published>2026-10-05T10:00:00+00:00</published><title>The Moon tonight</title></entry>`;

const linkPost = `<entry><author><name>/u/reader</name></author><category term="todayilearned" label="r/todayilearned"/><content type="html">${esc(
  submitted('todayilearned', 'lnk1', 'https://www.smithsonianmag.com/honey'),
)}</content><id>t3_lnk1</id><link href="https://www.reddit.com/r/todayilearned/comments/lnk1/slug/" /><published>2026-10-05T09:00:00+00:00</published><title>TIL honey never spoils</title></entry>`;

const comment = `<entry><author><name>/u/acoustics_nerd</name></author><category term="askscience" label="r/askscience"/><content type="html">${esc(
  '<!-- SC_OFF --><div class="md"><p>Rayleigh scattering &gt; Mie scattering here.</p> <p>Fun fact!</p> </div><!-- SC_ON -->',
)}</content><id>t1_c1</id><link href="https://www.reddit.com/r/askscience/comments/abc123/slug/c1/" /><published>2026-10-05T12:30:00+00:00</published><title>/u/acoustics_nerd on Why is the sky blue?</title></entry>`;

const feed = (entries: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/"><category term="askscience" label="r/askscience"/><title>feed</title>${entries}</feed>`;

describe('Reddit Atom feeds', () => {
  it('recognises feeds and rejects HTML pages', () => {
    expect(isAtom(feed(''))).toBe(true);
    expect(isAtom('<!DOCTYPE html><html><body>blocked</body></html>')).toBe(false);
  });

  it('parses a text post', () => {
    const [entry] = parseAtom(feed(selfPost));
    const post = entryToPost(entry);
    expect(post).toMatchObject({
      id: 'abc123',
      title: 'Why is the sky blue & sunsets red?',
      subreddit: 'askscience',
      author: 'curious_cat',
      permalink: '/r/askscience/comments/abc123/slug/',
      isSelf: true,
      domain: 'self.askscience',
      hasStats: false,
      image: null,
    });
    expect(post.selftext).toBe('Sunlight scatters off nitrogen & oxygen.\n\n• Blue scatters most');
    expect(post.selftext).not.toContain('submitted by');
    expect(post.createdUtc).toBe(Date.parse('2026-10-05T11:00:00Z') / 1000);
  });

  it('parses image and link posts', () => {
    const [img, link] = parseAtom(feed(imagePost + linkPost)).map(entryToPost);
    expect(img).toMatchObject({ isSelf: false, url: 'https://i.redd.it/moon.jpeg', domain: 'i.redd.it', selftext: '' });
    expect(img.image?.url).toBe('https://i.redd.it/moon.jpeg');
    expect(link).toMatchObject({ isSelf: false, url: 'https://www.smithsonianmag.com/honey', domain: 'smithsonianmag.com', image: null });
  });

  it('parses comments', () => {
    const entries = parseAtom(feed(selfPost + comment));
    const c = entryToComment(entries[1]);
    expect(c).toMatchObject({ id: 'c1', author: 'acoustics_nerd', depth: 0 });
    expect(c.body).toBe('Rayleigh scattering > Mie scattering here.\n\nFun fact!');
  });

  it('turns HTML into readable text', () => {
    expect(htmlToText('<p>a<br/>b</p><p>&quot;c&quot; &#39;d&#39;</p>')).toBe('a\nb\n\n"c" \'d\'');
  });
});

describe('loading posts through feeds', () => {
  const { fetchFeed, fetchPost } = require('@/lib/reddit') as typeof import('@/lib/reddit');
  const respond = (body: string, status = 200) =>
    jest.fn().mockResolvedValue({ ok: status < 400, status, text: async () => body } as unknown as Response);

  afterEach(() => jest.restoreAllMocks());

  it('loads and filters a subreddit feed', async () => {
    const nsfw = linkPost.replace('TIL honey never spoils', 'my onlyfans link').replace(/lnk1/g, 'bad1');
    global.fetch = respond(feed(selfPost + imagePost + nsfw));
    const res = await fetchFeed({ subreddits: ['askscience', 'space'], sort: 'hot' });
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('https://www.reddit.com/r/askscience+space/hot/.rss?limit=25');
    expect(res.posts.map((p) => p.id)).toEqual(['abc123', 'img1']);
    expect(res.hiddenCount).toBe(1);
  });

  it('explains HTML block pages instead of failing to parse them', async () => {
    global.fetch = respond('<!DOCTYPE html><html>blocked</html>');
    await expect(fetchFeed({ subreddits: ['space'], sort: 'hot' })).rejects.toThrow('web page instead of a feed');
    global.fetch = respond('blocked', 403);
    await expect(fetchFeed({ subreddits: ['space'], sort: 'hot' })).rejects.toThrow('Reddit blocked this request');
  });

  it('loads a post with comments from its permalink', async () => {
    global.fetch = respond(feed(selfPost + comment));
    const res = await fetchPost('abc123', { permalink: '/r/askscience/comments/abc123/slug/' });
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('https://www.reddit.com/r/askscience/comments/abc123/slug/.rss?limit=60');
    expect(res.post?.title).toContain('sky blue');
    expect(res.comments.map((c) => c.author)).toEqual(['acoustics_nerd']);
  });
});

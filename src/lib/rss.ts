import type { Comment, Post } from './reddit';

/**
 * Reddit's Atom ("RSS") feeds still work without an account, while its JSON
 * endpoints now require one. Feeds carry less data: no score, comment count or
 * NSFW flag, and comments come back as a flat list.
 */

export type AtomEntry = {
  id: string;
  title: string;
  author: string;
  subreddit: string;
  link: string;
  published: string;
  content: string; // HTML
  thumbnail: string | null;
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? m[1].trim() : '';
}

function attr(xml: string, element: string, attribute: string): string | null {
  const m = xml.match(new RegExp(`<${element}\\b[^>]*\\s${attribute}="([^"]*)"`));
  return m ? decodeEntities(m[1]) : null;
}

export function isAtom(text: string): boolean {
  return /<feed[\s>]/.test(text.slice(0, 2000));
}

export function parseAtom(xml: string): AtomEntry[] {
  return xml
    .split('<entry>')
    .slice(1)
    .map((chunk) => chunk.split('</entry>')[0])
    .map((e) => ({
      id: tag(e, 'id'),
      title: decodeEntities(tag(e, 'title')),
      author: decodeEntities(tag(tag(e, 'author'), 'name')).replace(/^\/u\//, ''),
      subreddit: attr(e, 'category', 'term') ?? '',
      link: attr(e, 'link', 'href') ?? '',
      published: tag(e, 'published') || tag(e, 'updated'),
      content: decodeEntities(tag(e, 'content')),
      thumbnail: attr(e, 'media:thumbnail', 'url'),
    }));
}

/** Converts Reddit's rendered Markdown HTML back into readable plain text. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<\/(p|blockquote|pre|h[1-6])>/gi, '\n\n')
      .replace(/<\/(div|li|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The author's own text (Reddit wraps it in <div class="md">). */
function bodyHtml(content: string): string {
  const m = content.match(/<div class="md">([\s\S]*)<\/div>\s*(?:<!-- SC_ON -->|$)/);
  return m ? m[1] : '';
}

function anchorBefore(content: string, label: string): string | null {
  const m = content.match(new RegExp(`<a href="([^"]+)">\\s*\\${label}\\s*</a>`));
  return m ? decodeEntities(m[1]) : null;
}

function hostOf(url: string): string {
  const m = url.match(/^https?:\/\/([^/?#]+)/i);
  return m ? m[1].replace(/^www\./, '').toLowerCase() : '';
}

const IMAGE_URL = /^https:\/\/(i\.redd\.it|i\.imgur\.com|preview\.redd\.it)\/.+|\.(jpe?g|png|webp|gif)(\?.*)?$/i;

export function entryToPost(e: AtomEntry): Post {
  const permalink = e.link.replace(/^https?:\/\/[^/]+/, '');
  const linkUrl = anchorBefore(e.content, '[link]') ?? e.link;
  // Self posts link back to their own comments page.
  const isSelf =
    linkUrl.replace(/^https?:\/\/[^/]+/, '') === permalink || (hostOf(linkUrl) === 'reddit.com' && /\/comments\//.test(linkUrl));
  const imageUrl = !isSelf && IMAGE_URL.test(linkUrl) && !/\.gifv?$/i.test(linkUrl) ? linkUrl : e.thumbnail;
  return {
    id: e.id.replace(/^t3_/, ''),
    title: e.title,
    subreddit: e.subreddit,
    author: e.author || '[deleted]',
    selftext: htmlToText(bodyHtml(e.content)),
    url: linkUrl,
    domain: isSelf ? `self.${e.subreddit}` : hostOf(linkUrl),
    permalink,
    score: 0,
    numComments: 0,
    hasStats: false,
    createdUtc: e.published ? Math.floor(Date.parse(e.published) / 1000) : 0,
    isSelf,
    isVideo: hostOf(linkUrl) === 'v.redd.it',
    over18: false, // not exposed in feeds; see filter.ts for what still applies
    spoiler: false,
    quarantine: false,
    flair: null,
    image: imageUrl ? { url: imageUrl, width: 4, height: 3 } : null,
  };
}

export function entryToComment(e: AtomEntry): Comment {
  return {
    id: e.id.replace(/^t1_/, ''),
    author: e.author || '[deleted]',
    body: htmlToText(bodyHtml(e.content) || e.content),
    score: 0,
    depth: 0,
    replies: [],
    permalink: e.link.replace(/^https?:\/\/[^/]+/, '') || undefined,
  };
}

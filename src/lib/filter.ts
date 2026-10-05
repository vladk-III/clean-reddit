import type { Comment, Post } from './reddit';

/**
 * Content filter. Layers, from most to least reliable:
 *  1. Reddit's own flags (over_18, quarantine) — always enforced, cannot be turned off.
 *  2. Blocked subreddits and link domains.
 *  3. Keyword matching on title, body, flair and subreddit name.
 * Keyword matching is a safety net, not a guarantee; layer 1 does most of the work.
 */

// Always blocked: explicit terms.
const CORE_TERMS = [
  'nsfw', 'nsfl', 'porn', 'porno', 'pornography', 'pornhub', 'xxx', 'nude', 'nudes', 'nudity',
  'sex', 'sexy', 'sexual', 'sexually', 'sexting', 'horny', 'lewd', 'erotic', 'erotica', 'fetish', 'kink', 'kinky',
  'onlyfans', 'fansly', 'hentai', 'rule34', 'r34', 'milf', 'dilf', 'gonewild', 'camgirl', 'camgirls',
  'orgasm', 'masturbate', 'masturbating', 'masturbation', 'boobs', 'boobies', 'tits', 'titties', 'nipple',
  'nipples', 'dick pic', 'thirst trap', 'stripper', 'strip club',
  'pussy', 'cock', 'blowjob', 'handjob', 'threesome', 'bdsm', 'dominatrix', 'cumming', 'genitals',
  'upskirt', 'see through', 'see-through', 'topless', 'bottomless', 'braless', 'g-string', 'lingerie',
  '18+', 'adults only',
];

// Blocked when strict mode is on (default): suggestive-but-not-explicit terms.
const STRICT_TERMS = [
  'bikini', 'thong', 'cleavage', 'busty', 'curvy', 'thicc', 'thick thighs', 'booty', 'twerk', 'twerking',
  'seductive', 'sultry', 'steamy', 'flirt', 'flirty', 'flirting', 'sexiest', 'hottest girl', 'hot girl',
  'hot girls', 'hot guy', 'hot guys', 'body count', 'spicy pics', 'feet pics', 'underwear', 'panties',
  'swimsuit model', 'penis', 'vagina', 'erection', 'condom', 'aroused', 'arousal', 'libido', 'onlyfan',
  'smash or pass', 'rate me', 'am i hot', 'hookup', 'one night stand', 'escort',
];

const BLOCKED_SUBREDDIT_PATTERN =
  /(nsfw|porn|gonewild|nude|naked|sex|lewd|hentai|rule34|onlyfans|boob|tits|thicc|milf|fetish|kink|bdsm|horny|realgirls|holdthemoan|slut|fuck|r4r$|lingerie|thong|panties|yogapants|hotwife|cuckold|swinger|stripper|camgirl|bikini)/i;

// Real places/topics that happen to contain a blocked substring.
const ALLOWED_SUBREDDITS = new Set(['sussex', 'essex', 'middlesex', 'wessex', 'eastsussex', 'westsussex']);

const BLOCKED_SUBREDDITS = new Set([
  'aww_nsfw', 'trashy', 'watchpeopledie', 'gore', 'medicalgore', 'morbidreality', 'eyebleach_nsfw',
  'sexypeople', 'prettygirls', 'gentlemanboners', 'hotchickswithtattoos', 'outfits', 'fitgirls',
  'celebs', 'celebhub', 'jerkofftoceleb', 'drunkgirls', 'hardbodies', 'instagramreality',
  'tinder', 'r4r', 'dirtypenpals', 'sextoys', 'relationship_advice_nsfw', 'askredditafterdark', 'sexstories',
  'beautifulfemales', 'faceoff', 'truefmk', 'fmk', 'whowouldyoufuck', 'smashorpass', 'amihot', 'rateme',
  'truerateme', 'malefashionadvice_nsfw', 'cosplaygirls', 'cosplaybabes',
]);

const BLOCKED_DOMAINS = [
  'pornhub.com', 'xvideos.com', 'xhamster.com', 'redgifs.com', 'onlyfans.com', 'fansly.com', 'erome.com',
  'chaturbate.com', 'xnxx.com', 'spankbang.com', 'youporn.com', 'rule34.xxx', 'imagefap.com', 'motherless.com',
];

// "[F]", "(f)", "[M4F]" — gender tags used almost exclusively on adult subreddits.
const GENDER_TAG = /[[(]\s*(?:f|m|mf|ff|mm|m4f|f4m|f4f|m4m|f4a|m4a)\s*[\])]/i;

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const regexCache = new Map<string, RegExp>();

function termRegex(terms: string[]): RegExp {
  const key = terms.join('|');
  let re = regexCache.get(key);
  if (!re) {
    // Word boundaries keep "Sussex", "cockpit", "Essex", "scum" etc. from matching.
    const body = terms.map((t) => escapeRegex(t.toLowerCase()).replace(/\\ |\s+/g, '[\\s_-]*')).join('|');
    re = new RegExp(`(?:^|[^a-z0-9])(?:${body})(?=$|[^a-z0-9])`, 'i');
    regexCache.set(key, re);
  }
  return re;
}

export type FilterOptions = { strict: boolean; extraWords: string[] };

function blockedTerms(opts: FilterOptions) {
  const extra = opts.extraWords.map((w) => w.trim().toLowerCase()).filter(Boolean);
  return [...CORE_TERMS, ...(opts.strict ? STRICT_TERMS : []), ...extra];
}

export function containsBlockedText(text: string, opts: FilterOptions): boolean {
  if (!text) return false;
  if (GENDER_TAG.test(text)) return true;
  return termRegex(blockedTerms(opts)).test(text);
}

export function isSubredditAllowed(name: string): boolean {
  const n = name.toLowerCase().replace(/^\/?r\//, '');
  if (ALLOWED_SUBREDDITS.has(n)) return true;
  if (BLOCKED_SUBREDDITS.has(n)) return false;
  return !BLOCKED_SUBREDDIT_PATTERN.test(n);
}

export function isDomainAllowed(domain: string): boolean {
  const d = domain.toLowerCase();
  return !BLOCKED_DOMAINS.some((b) => d === b || d.endsWith(`.${b}`));
}

/** Returns the reason a post was blocked, or null if it is clean. */
export function blockReason(post: Post, opts: FilterOptions): string | null {
  if (post.over18) return 'marked NSFW';
  if (post.quarantine) return 'quarantined';
  if (!isSubredditAllowed(post.subreddit)) return 'blocked subreddit';
  if (!isDomainAllowed(post.domain)) return 'blocked domain';
  if (post.flair && containsBlockedText(post.flair, opts)) return 'flair';
  if (containsBlockedText(post.title, opts)) return 'title';
  if (containsBlockedText(post.selftext, opts)) return 'body';
  return null;
}

export function filterPosts(posts: Post[], opts: FilterOptions): Post[] {
  return posts.filter((p) => blockReason(p, opts) === null);
}

/** Drops comments with blocked text (and their replies). */
export function filterComments(comments: Comment[], opts: FilterOptions): Comment[] {
  return comments
    .filter((c) => !containsBlockedText(c.body, opts))
    .map((c) => ({ ...c, replies: filterComments(c.replies, opts) }));
}

export function timeAgo(unixSeconds: number, now = Date.now()) {
  const s = Math.max(0, Math.floor(now / 1000 - unixSeconds));
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d`;
  if (s < 86400 * 365) return `${Math.floor(s / (86400 * 30))}mo`;
  return `${Math.floor(s / (86400 * 365))}y`;
}

export function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return ['Good', 'night'];
  if (h < 12) return ['Good', 'morning'];
  if (h < 18) return ['Good', 'afternoon'];
  return ['Good', 'evening'];
}

/** Strips the most common Markdown so post bodies read as clean text. */
export function plainText(md: string) {
  return md
    .replace(/&#x200B;/g, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/^>\s?/gm, '')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`{1,3}([^`]*)`{1,3}/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

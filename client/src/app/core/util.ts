// Presentation helpers shared by components.

/** Pastel course palette: [fill, deep accent]. A course keeps its color everywhere. */
const TONES: [string, string][] = [
  ['#d9ccff', '#5b3fe0'], // lilac
  ['#eeea9e', '#6f6300'], // lemon
  ['#c3ebd5', '#1d6b45'], // mint
  ['#ffd9c2', '#a94a18'], // peach
  ['#cbe1ff', '#2456b3'], // sky
  ['#ffd0d6', '#ad2e43'], // rose
  ['#ede0cc', '#7a5c30'], // sand
  ['#ebd3f7', '#7d35a3'], // orchid
];

export function tone(courseId: number) { return TONES[Math.abs(courseId - 1) % TONES.length]; }
export function toneStyle(courseId: number) { const [c, d] = tone(courseId); return `--c:${c};--c-deep:${d}`; }

export type ArtKind = 'web' | 'data' | 'flow' | 'code' | 'design' | 'math' | 'book';
export function artFor(category: string): ArtKind {
  const c = category.toLowerCase();
  if (c.includes('web')) return 'web';
  if (c.includes('data')) return 'data';
  if (c.includes('engineer')) return 'flow';
  if (c.includes('program') || c.includes('code') || c.includes('computer')) return 'code';
  if (c.includes('design') || c.includes('art')) return 'design';
  if (c.includes('math') || c.includes('stat')) return 'math';
  return 'book';
}

export function initials(name: string) {
  const parts = name.replace('Dr.', '').replace('Prof.', '').split(' ').filter(Boolean);
  if (!parts.length) return '?';
  return (parts.length === 1 ? parts[0][0] : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function firstName(name: string) {
  return name.replace('Dr. ', '').replace('Prof. ', '').split(' ')[0];
}

export function avatarTone(name: string) {
  let sum = 0;
  for (const ch of name) sum += ch.charCodeAt(0);
  return 't' + ((sum % 6) + 1);
}

export function letterGrade(pct: number) {
  return pct >= 93 ? 'A' : pct >= 90 ? 'A-' : pct >= 87 ? 'B+' : pct >= 83 ? 'B' : pct >= 80 ? 'B-'
    : pct >= 77 ? 'C+' : pct >= 73 ? 'C' : pct >= 70 ? 'C-' : pct >= 67 ? 'D+' : pct >= 60 ? 'D' : 'F';
}

export function isPast(iso: string) { return new Date(iso).getTime() < Date.now(); }

function humanize(ms: number) {
  const mins = Math.max(1, Math.floor(ms / 60000));
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'}`;
  if (hours >= 1) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return `${mins} min`;
}

export function dueText(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return diff < 0 ? `${humanize(-diff)} overdue` : `Due in ${humanize(diff)}`;
}

export function score(n: number) { return Number.isInteger(n) ? `${n}` : n.toFixed(1).replace(/\.0$/, ''); }

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export type WorkStatus = { label: string; css: string };
export function workStatus(due: string, sub: { score: number | null; isLate: boolean } | null): WorkStatus {
  if (!sub) return isPast(due) ? { label: 'Missing', css: 'missing' } : { label: 'Not submitted', css: 'open' };
  if (sub.score !== null) return { label: 'Graded', css: 'graded' };
  return sub.isLate ? { label: 'Submitted late', css: 'late' } : { label: 'Submitted', css: 'submitted' };
}

/** "2026-10-03T23:59" for <input type="datetime-local">. */
export function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function isoDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "just now", "12 min ago", "3 h ago", "2 days ago", then a date. */
export function ago(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return days === 1 ? 'yesterday' : `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
